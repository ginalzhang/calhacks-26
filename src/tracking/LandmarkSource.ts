/**
 * LandmarkSource: where landmarks come from. Implemented by
 *  - MediaPipeSource (webcam + @mediapipe/tasks-vision HandLandmarker / FaceLandmarker), agent B
 *  - ReplaySource (replays recorded/synthesised landmark JSON on real timing), agent B;
 *    fixtures under public/fixtures/*.json are produced by agent D (scripts/synth-fixtures.ts).
 *
 * Downstream code is landmark-agnostic: the app picks the pointer landmark
 * (hand 8 / 5 / 9, or face 1 in Head mode), mirrors x and converts to camera px:
 *   camera.x = (1 - lm.x) * videoWidth;  camera.y = lm.y * videoHeight
 */

/** MediaPipe-normalised landmark (x, y in 0..1 of the UNMIRRORED video frame). */
export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export interface LandmarkFrame {
  /** performance.now() ms at detection (replay: fixture t rebased onto performance.now()). */
  t: number;
  /** 21 hand landmarks (Hand mode) or 478 face landmarks (Head mode), or null when nothing detected. */
  landmarks: NormalizedLandmark[] | null;
  /** MediaPipe handedness label of the detected hand, if any. */
  handedness: "Left" | "Right" | null;
  /** Face blendshape scores by categoryName (Head mode / face tap), e.g. { jawOpen: 0.4 }. */
  blendshapes: Record<string, number> | null;
  videoWidth: number;
  videoHeight: number;
  /** Mean luma 0..255 of a downsampled frame (≈ every 500 ms), if measured. */
  luma: number | null;
}

export interface SourceStats {
  cameraFps: number;
  detectionFps: number;
  /** "GPU" | "CPU" for MediaPipe, "replay" for ReplaySource. */
  delegate: "GPU" | "CPU" | "replay" | null;
}

export type SourceKind = "mediapipe" | "replay";
export type SourceMode = "hand" | "face";

export interface LandmarkSource {
  readonly kind: SourceKind;
  /** Hand or face landmarks. MediaPipeSource may support switching (Head mode, P3). */
  mode: SourceMode;
  /** Starts camera/model or replay. Rejects with a readable Error (permission denied, no camera, model load failed). */
  start(): Promise<void>;
  stop(): void;
  /** Subscribe to frames; returns an unsubscribe function. */
  onFrame(cb: (frame: LandmarkFrame) => void): () => void;
  stats(): SourceStats;
  /** The live <video> element for the preview thumbnail (MediaPipeSource only). */
  readonly video: HTMLVideoElement | null;
}

/** Extra controls on ReplaySource (used by Playwright via window.__steady.replay). */
export interface ReplayControls {
  load(fixtureUrl: string): Promise<void>;
  play(): void;
  pause(): void;
  /** Restart from frame 0. */
  restart(): void;
  /** Resolves when the current fixture has been fully played. */
  finished(): Promise<void>;
  readonly playing: boolean;
  /** Loop at the end (default false). */
  loop: boolean;
}

// ---------------------------------------------------------------- fixture file format

/**
 * public/fixtures/<name>.json. Landmarks are stored exactly as MediaPipe emits them
 * (normalised, UNMIRRORED), so a stroke that moves right on screen has DECREASING x.
 * `lm` is either the full 21-point hand array as [x, y, z] triples, or null for "no hand".
 */
export interface LandmarkFixture {
  version: 1;
  name: string;
  description: string;
  mode: SourceMode;
  videoWidth: number; // 640
  videoHeight: number; // 480
  fps: number; // nominal, 30
  /** Optional: mean luma to report (e.g. 30 for a "too dark" fixture). */
  luma?: number;
  frames: { t: number; lm: [number, number, number][] | null; handedness?: "Left" | "Right" }[];
}

/**
 * Fixture names agent D produces (all at 30 fps, 640×480, pointer = landmark 8):
 *  - still-10s       : hand resting still for 10 s with ~1 px rest jitter
 *  - calibration     : 3 s still (rest jitter) then 4 s comfortable circle
 *  - dwell-stroke    : still 1.2 s (pen-down dwell) → 2 s horizontal stroke → still 1.6 s (pen-up dwell)
 *  - word-tremor     : still → slow word-shaped path ("hi"/cursive loop) with 6 Hz ±5 px jitter → still
 *  - circle-stroke   : still → roughly circular closed stroke → still (for "make it a circle")
 *  - tracking-lost   : stroke in progress, then 1 s of null frames mid-stroke, then hand back
 *  - too-dark        : like still-10s but luma 25 and intermittent nulls
 */
export const FIXTURES = [
  "still-10s",
  "calibration",
  "dwell-stroke",
  "word-tremor",
  "circle-stroke",
  "tracking-lost",
  "too-dark",
] as const;
export type FixtureName = (typeof FIXTURES)[number];

// ---------------------------------------------------------------- app URL params + test hooks

/**
 * URL params the app honours:
 *  ?source=replay&fixture=<FixtureName>  use ReplaySource instead of the webcam (Playwright, demos)
 *  ?autoplay=0                            don't start replay automatically (tests call __steady.replay.play())
 *  ?skipIntro=1                           skip first-run/privacy screen and calibration (uses defaults)
 *  ?demo=1                                Demo panel expanded + "Next judge" tile visible
 *
 * window.__steady (always installed; read-only snapshot + replay controls) — see SteadyTestHooks.
 */
export interface SteadyTestHooks {
  getState(): {
    pen: "HOVER" | "DRAWING";
    strokeCount: number;
    textCount: number;
    pageName: string;
    tracking: "ok" | "lost";
    lossReason: string | null;
    calibrated: boolean;
    calibrating: boolean;
    status: string;
    undoLabel: string | null;
    lastStrokeKind: string | null;
    settings: { steadiness: number; latch: boolean; gain: number };
    metrics: Record<string, number>;
  };
  /** Run a typed command exactly as if typed into the box. */
  command(text: string): Promise<void>;
  replay: ReplayControls | null;
}
