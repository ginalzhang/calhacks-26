/**
 * Shared pipeline contracts. Pure data types + the engine interfaces that
 * agent A implements and agent B consumes. No DOM, no React.
 *
 * Coordinate spaces:
 *  - "camera px": 0..videoWidth × 0..videoHeight, ALREADY MIRRORED (x = (1 - lm.x) * videoWidth)
 *    so that moving the hand right moves the cursor right on screen.
 *  - "canvas px": CSS pixels of the drawing canvas (0..canvas.width/dpr).
 * All timestamps are milliseconds (performance.now() in the app; injected in tests).
 */
import type { ActionId, ColourName } from "@/actions";

export interface Vec2 {
  x: number;
  y: number;
}
export interface TimedPoint extends Vec2 {
  t: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  w: number;
  h: number;
}

// ---------------------------------------------------------------- settings

/** Hand landmark used as the pointer (design rule 1). Head mode uses face landmark 1. */
export type PointerLandmark = 8 | 5 | 9;

export interface FilterParams {
  /** One Euro min cutoff, Hz. Default 0.6. */
  minCutoff: number;
  /** One Euro beta. Default 0.005 (may be changed by the beta sweep; see DECISIONS.md). */
  beta: number;
  /** One Euro derivative cutoff, Hz. Default 1.0. */
  dCutoff: number;
}

export interface PipelineSettings {
  /** 0..100; maps piecewise-linearly 0→(1.2 Hz, 4 px), 50→(0.6 Hz, 12 px), 100→(0.3 Hz, 30 px). */
  steadiness: number;
  /** Live raw params (Advanced panel). steadinessToParams() fills minCutoff + lazyRadius. */
  filter: FilterParams;
  /** Lazy-brush dead-zone radius, canvas px. Default 12. */
  lazyRadius: number;
  /** Camera→canvas gain. 3 uncalibrated, slider 2..10 (Head mode 3..10, default 6). */
  gain: number;
  /** Active box in camera px (from calibration). null = centred box derived from gain. */
  activeBox: Rect | null;
  /** Pen-down dwell, ms. Default 800 (500..1500). */
  penDownDwellMs: number;
  /** Pen-up dwell, ms. Default 1.5 × pen-down (800..3000). */
  penUpDwellMs: number;
  /** Rest-jitter RMS at the One Euro output, canvas px (calibration step 1). 0 if uncalibrated. */
  restJitterRms: number;
  /** Latch: pen never lifts on its own (no pen-up dwell). */
  latch: boolean;
  /** Dwell toggles ink on the canvas (disable for switch/voice-only users). */
  dwellEnabled: boolean;
  /** Overrides r_in for TILE dwell only ("Hard to hold still" preset: 60). null = formula. */
  tileDwellRadius: number | null;
  /** Tiles count as hovered within this many px of their edge (snap-to-target). 0 = off. */
  tileSnapPx: number;
  /** Tile dwell time, ms (defaults to penDownDwellMs). */
  tileDwellMs: number;
  /** Which landmark is the pointer in Hand mode. */
  pointerLandmark: PointerLandmark;
  mode: "hand" | "head";
  /** Demo: add band-limited 4..10 Hz noise to raw camera px before the One Euro filter. */
  simulateTremor: boolean;
}

export const DEFAULT_FILTER: FilterParams = { minCutoff: 0.6, beta: 0.005, dCutoff: 1.0 };

export const DEFAULT_SETTINGS: PipelineSettings = {
  steadiness: 50,
  filter: DEFAULT_FILTER,
  lazyRadius: 12,
  gain: 3,
  activeBox: null,
  penDownDwellMs: 800,
  penUpDwellMs: 1200,
  restJitterRms: 0,
  latch: false,
  dwellEnabled: true,
  tileDwellRadius: null,
  tileSnapPx: 0,
  tileDwellMs: 800,
  pointerLandmark: 8,
  mode: "hand",
  simulateTremor: false,
};

// ---------------------------------------------------------------- tracking + pen

export type TrackingState = "ok" | "lost";
/** Why tracking is lost (status bar says why and what to do). */
export type TrackingLossReason = "no-hand" | "too-dark" | "low-fps" | "paused" | "no-camera";

export type PenState = "HOVER" | "DRAWING";

/** Why the pen changed state. */
export type PenCause = "dwell" | "key" | "voice" | "typed" | "tile" | "face" | "tracking-lost" | "left-canvas";

export type PenEvent =
  | { type: "pen-down"; t: number; at: Vec2; cause: PenCause }
  | {
      type: "pen-up";
      t: number;
      cause: PenCause;
      /** For dwell pen-ups: drop stroke points with t >= trimFromT (the dwell period). */
      trimFromT?: number;
    };

export interface DwellState {
  /** Which dwell is filling. */
  kind: "pen-down" | "pen-up" | null;
  /** 0..1 fill of the ring. */
  progress: number;
  /** Where stillness began (canvas px, pre-lazy-brush). */
  anchor: Vec2 | null;
  /** Whether the next dwell of this kind is armed (§3 arming rules). */
  armed: boolean;
}

/** One processed frame out of the PointerEngine. */
export interface PointerFrame {
  t: number;
  tracking: TrackingState;
  lossReason: TrackingLossReason | null;
  /** Raw landmark in camera px (after simulated tremor if on). */
  rawCamera: Vec2 | null;
  /** One Euro output in camera px. */
  filteredCamera: Vec2 | null;
  /** Raw point mapped to canvas px with NO filtering (for the ghost view + deviation metric). */
  rawCanvas: Vec2 | null;
  /** One Euro output mapped to canvas px. Dwell reads this. */
  filtered: Vec2 | null;
  /** After the lazy-brush dead zone. This is the visible cursor and what ink records. */
  pointer: Vec2 | null;
  pen: PenState;
  dwell: DwellState;
  /** Pen events produced while processing this frame (usually empty). */
  events: PenEvent[];
}

/** Input to the PointerEngine for one camera frame. */
export interface PointerInput {
  t: number;
  /** Pointer landmark in camera px (already mirrored), or null when no hand/face detected. */
  camera: Vec2 | null;
  /** Mean luma 0..255 of the frame, if known (too-dark detection). */
  luma?: number;
  /** Current detection fps, if known (low-fps detection). */
  detectionFps?: number;
  /** True when the pointer is over a rest zone (margin/toolbar): dwell never toggles ink. */
  inRestZone?: boolean;
  /** True when the pointer is over the canvas drawing area. */
  overCanvas?: boolean;
}

/**
 * Stateful pointer pipeline (agent A, src/pipeline/pointer.ts):
 * raw → One Euro (per axis, camera px) → active-box map → [dwell reads] → lazy brush → pointer.
 * Also owns the pen state machine, both dwell rules, arming, latch, tracking-loss (>300 ms → pen up + freeze).
 */
export interface PointerEngine {
  process(input: PointerInput): PointerFrame;
  /** Explicit pen toggle (Space / voice / typed / tile / face). No cooldown. */
  togglePen(t: number, cause: PenCause): PenEvent;
  setPen(state: PenState, t: number, cause: PenCause): PenEvent | null;
  updateSettings(patch: Partial<PipelineSettings>): void;
  getSettings(): PipelineSettings;
  setCanvasSize(size: Size): void;
  /** Reset filters + dwell (e.g. after recenter). Pen goes up. */
  reset(t: number): void;
  readonly pen: PenState;
}

// ---------------------------------------------------------------- tile dwell

export interface TileRect {
  id: string;
  rect: Rect; // canvas-overlay/page px, same space as the pointer passed in
}

/** Tile dwell (agent A, src/pipeline/dwell.ts). Separate from ink dwell. */
export interface TileDwellState {
  hoveredId: string | null;
  progress: number; // 0..1
  /** Set on the frame where the dwell completes; the UI activates that tile once. */
  firedId: string | null;
}

// ---------------------------------------------------------------- document

export type StrokeKind = "free" | "line" | "circle" | "rect" | "triangle" | "dot";

export interface Stroke {
  id: string;
  kind: StrokeKind;
  /** Canvas px, RDP-simplified (ε = 1.5) on pen-up. For shapes, the fitted outline points. */
  points: Vec2[];
  colour: ColourName;
  width: number;
  createdAt: number; // Date.now()
  /** Unsimplified, unfiltered raw canvas points (Demo ghost view). Optional; not exported. */
  raw?: Vec2[];
}

export interface TextBlock {
  id: string;
  x: number;
  y: number;
  text: string;
  colour: ColourName;
  /** Font size px. */
  size: number;
  createdAt: number;
}

export interface Page {
  id: string;
  name: string; // "Notes 1"
  strokes: Stroke[];
  texts: TextBlock[];
  background: "light" | "dark";
  guides: boolean;
}

export interface Doc {
  pages: Page[];
  currentPageId: string;
}

/** An undoable edit. Pure: apply(doc) → doc. Inverse computed by the history module. */
export type DocCommand =
  | { type: "add-stroke"; pageId: string; stroke: Stroke }
  | { type: "remove-strokes"; pageId: string; ids: string[] }
  | { type: "replace-strokes"; pageId: string; removeIds: string[]; add: Stroke[]; addTexts?: TextBlock[] }
  | { type: "style-stroke"; pageId: string; id: string; colour?: ColourName; width?: number }
  | { type: "add-text"; pageId: string; text: TextBlock }
  | { type: "edit-text"; pageId: string; id: string; text: string }
  | { type: "clear-page"; pageId: string }
  | { type: "add-page"; page: Page }
  | { type: "delete-page"; pageId: string }
  | { type: "rename-page"; pageId: string; name: string }
  | { type: "switch-page"; pageId: string }
  | { type: "set-page-props"; pageId: string; background?: "light" | "dark"; guides?: boolean };

export interface HistoryEntry {
  /** Human label for the persistent "Undo: <label>" affordance, e.g. "stroke", "make it a circle". */
  label: string;
  forward: DocCommand[];
  inverse: DocCommand[];
}

export interface History {
  doc: Doc;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

// ---------------------------------------------------------------- shapes

export type ShapeTarget = "line" | "circle" | "square" | "triangle";

export interface ShapeFit {
  kind: "line" | "circle" | "rect" | "triangle" | "none";
  /** Outline points in canvas px ready to become Stroke.points. Empty for "none". */
  points: Vec2[];
  /** Fit quality metric used for acceptance (RMS ratio etc.). */
  residual: number;
  closed: boolean;
}

// ---------------------------------------------------------------- calibration + profiles

export interface CalibrationResult {
  /** Rest-jitter RMS at the One Euro output, canvas px. */
  restJitterRms: number;
  /** High-frequency residual during the circle, canvas px. */
  kineticResidualRms: number;
  /** Active box in camera px, padded 20 %. */
  activeBox: Rect;
  /** canvas width ÷ box width, clamped 2..10. */
  gain: number;
  hand: "left" | "right" | "unknown";
  /** max(suggestion from rest, suggestion from kinetic), 0..100. */
  suggestedSteadiness: number;
  /** True when the circle needed > 10× and the user should draw a larger one (ask once). */
  circleTooSmall: boolean;
  completedAt: number;
}

export interface Profile {
  id: string;
  name: string; // "Steady day", "Shaky day", user-named
  settings: PipelineSettings;
  calibration: CalibrationResult | null;
}

// ---------------------------------------------------------------- metrics (Demo panel)

export interface Metrics {
  /** RMS distance raw-canvas vs smoothed pointer over the current/last stroke, px. */
  deviationRawPx: number;
  deviationSmoothedPx: number;
  lastStrokeMs: number;
  commandsTotal: number;
  commandsMatched: number;
  claudeCalls: number;
  claudeAccepted: number;
  claudeRejected: number;
  claudeTimeouts: number;
  cameraFps: number;
  detectionFps: number;
}

// ---------------------------------------------------------------- command resolution (agent C)


/** Result of the local grammar (src/pipeline/grammar.ts, pure). */
export type GrammarMatch =
  | { kind: "exact"; id: ActionId; phrase: string }
  | { kind: "fuzzy"; id: ActionId; phrase: string; distance: number }
  | { kind: "none"; /** Two closest phrases, for "Didn't catch that" tiles. */ nearest: { id: ActionId; phrase: string; distance: number }[] };

export interface GrammarOptions {
  /** Fuzzy matching is OFF while any dialog is open (exact only). */
  exactOnly?: boolean;
  /** Extra runtime phrases (e.g. user-named profiles: "shaky day" → profile switch). */
  extra?: { phrase: string; id: ActionId; arg?: string }[];
}

/** Final resolution of one utterance / typed command (local grammar, then /api/command). */
export type CommandResolution =
  | { kind: "actions"; actions: ActionId[]; source: "grammar" | "claude"; heard: string; arg?: string }
  | { kind: "clarify"; question: string; options: { label: string; actions: ActionId[] }[]; heard: string }
  | { kind: "none"; heard: string; nearest: ActionId[]; reason: "no-match" | "timeout" | "invalid" | "offline" | "key-missing" };

/** Context sent with unmatched transcripts (no audio, no images). */
export interface CommandContext {
  lastActions: ActionId[]; // last 3
  selected: { id: string; kind: StrokeKind; colour: ColourName; width: number } | null;
  canvas: Size;
}
