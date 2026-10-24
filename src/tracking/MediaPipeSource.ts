/**
 * MediaPipeSource: webcam + @mediapipe/tasks-vision (VIDEO mode, 1 hand / 1 face).
 * - Self-hosted wasm + float16 models in /public/mediapipe (§1 P3); the jsDelivr / Google
 *   storage URLs from MediaPipe's web quickstart are the automatic fallback.
 * - GPU delegate with automatic CPU fallback if creation throws.
 * - Detection driven by video.requestVideoFrameCallback, timestamp = performance.now().
 * - No Web Worker. Mean luma sampled from a tiny canvas every ~500 ms.
 * - Head mode: FaceLandmarker (outputFaceBlendshapes) supplies landmarks + blendshapes.
 *   Face tap in Hand mode: the face model also runs on every other frame for blendshapes only.
 */
import type { HandLandmarker, FaceLandmarker } from "@mediapipe/tasks-vision";
import type { LandmarkFrame, LandmarkSource, SourceMode, SourceStats } from "./LandmarkSource";

export const MEDIAPIPE_VERSION = "1.1.1";
export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** Self-hosted copies (§1 P3) in /public/mediapipe; the CDN URLs above are the automatic fallback. */
export const LOCAL_WASM_URL = "/mediapipe/wasm";
export const LOCAL_HAND_MODEL_URL = "/mediapipe/hand_landmarker.task";
export const LOCAL_FACE_MODEL_URL = "/mediapipe/face_landmarker.task";

export interface AssetSet {
  name: "local" | "cdn";
  wasm: string;
  hand: string;
  face: string;
}
export const ASSET_SETS: readonly AssetSet[] = [
  { name: "local", wasm: LOCAL_WASM_URL, hand: LOCAL_HAND_MODEL_URL, face: LOCAL_FACE_MODEL_URL },
  { name: "cdn", wasm: WASM_URL, hand: HAND_MODEL_URL, face: FACE_MODEL_URL },
];

type FrameCb = (f: LandmarkFrame) => void;

export interface MediaPipeOptions {
  deviceId?: string | null;
  /** Drop capture to 320×240 if the UI stutters. */
  lowRes?: boolean;
}

/** Cheap check that a self-hosted file is really there before handing the URL to MediaPipe. */
async function reachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export class MediaPipeSource implements LandmarkSource {
  readonly kind = "mediapipe" as const;
  mode: SourceMode = "hand";
  video: HTMLVideoElement | null = null;
  /** Also run the face model in Hand mode (face tap). */
  faceSignals = false;
  /** Where the wasm + models actually came from. */
  assetSource: "local" | "cdn" | null = null;
  /** null until the first face result; false when blendshapes lack jawOpen (face tap disabled). */
  jawOpenAvailable: boolean | null = null;
  /** Called once when the jawOpen check has run on a real face result. */
  onJawOpenCheck: ((ok: boolean) => void) | null = null;

  private subs = new Set<FrameCb>();
  private stream: MediaStream | null = null;
  private hand: HandLandmarker | null = null;
  private face: FaceLandmarker | null = null;
  private faceLoading: Promise<void> | null = null;
  private delegate: "GPU" | "CPU" | null = null;
  private running = false;
  private rvfcHandle: number | null = null;
  private cameraTimes: number[] = [];
  private detectTimes: number[] = [];
  private lastTs = 0;
  private luma: number | null = null;
  private lastLumaAt = 0;
  private lumaCanvas: HTMLCanvasElement | null = null;
  private frameNo = 0;
  private lastBlendshapes: Record<string, number> | null = null;

  constructor(private opts: MediaPipeOptions = {}) {}

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot use the camera. Use desktop Chrome.");
    }
    const lowRes = this.opts.lowRes;
    const video: MediaTrackConstraints = {
      width: { ideal: lowRes ? 320 : 640 },
      height: { ideal: lowRes ? 240 : 480 },
      frameRate: { ideal: 30 },
    };
    if (this.opts.deviceId) video.deviceId = { ideal: this.opts.deviceId };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError") throw new Error("Camera permission was blocked. Allow the camera in the address bar, then reload.");
      if (name === "NotFoundError") throw new Error("No camera found. Plug in a webcam, then reload.");
      if (name === "NotReadableError") throw new Error("The camera is in use by another app. Close it, then reload.");
      throw new Error(`Camera could not start: ${(e as Error)?.message ?? String(e)}`);
    }
    const el = document.createElement("video");
    el.playsInline = true;
    el.muted = true;
    el.autoplay = true;
    el.srcObject = this.stream;
    el.setAttribute("aria-hidden", "true");
    this.video = el;
    await el.play().catch(() => undefined);
    if (!el.videoWidth) {
      await new Promise<void>((resolve) => el.addEventListener("loadeddata", () => resolve(), { once: true }));
    }
    if (this.mode === "hand") await this.loadHand();
    else await this.loadFace();
    this.running = true;
    this.schedule();
  }

  /** The deviceId actually in use (persisted so "Use last setup" picks the same camera). */
  get deviceId(): string | null {
    return this.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? null;
  }

  /** Hand ↔ Head mode. Loads the face model on first use; rejects with a readable Error. */
  async setMode(mode: SourceMode): Promise<void> {
    if (mode === "face") await this.loadFace();
    else await this.loadHand();
    this.mode = mode;
  }

  /** Face tap in Hand mode needs blendshapes from the face model too. */
  async setFaceSignals(on: boolean): Promise<void> {
    this.faceSignals = on;
    if (on) await this.loadFace();
  }

  private async loadHand() {
    if (this.hand) return;
    await this.create("hand");
  }

  private async loadFace() {
    if (this.face) return;
    this.faceLoading ??= this.create("face").finally(() => {
      this.faceLoading = null;
    });
    await this.faceLoading;
  }

  /** Try self-hosted assets first, then the CDN; on each, GPU first, then CPU. */
  private async create(kind: "hand" | "face") {
    const vision = await import("@mediapipe/tasks-vision");
    let lastErr: unknown = null;
    for (const set of ASSET_SETS) {
      if (set.name === "local" && !(await reachable(kind === "hand" ? set.hand : set.face))) continue;
      let fileset;
      try {
        fileset = await vision.FilesetResolver.forVisionTasks(set.wasm);
      } catch (e) {
        lastErr = e;
        continue;
      }
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          if (kind === "hand") {
            this.hand = await vision.HandLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: set.hand, delegate },
              runningMode: "VIDEO",
              numHands: 1,
            });
          } else {
            this.face = await vision.FaceLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: set.face, delegate },
              runningMode: "VIDEO",
              numFaces: 1,
              outputFaceBlendshapes: true,
            });
          }
          this.delegate = delegate;
          this.assetSource = set.name;
          if (set.name === "cdn") console.info(`[Steady] ${kind} model loaded from the CDN fallback`);
          return;
        } catch (e) {
          lastErr = e;
          console.warn(`[Steady] ${kind} model: ${set.name} assets, ${delegate} delegate failed`, e);
        }
      }
    }
    const what = kind === "hand" ? "hand-tracking" : "face-tracking";
    throw new Error(`The ${what} model could not load. Check the internet connection. (${(lastErr as Error)?.message ?? lastErr})`);
  }

  stop(): void {
    this.running = false;
    const v = this.video;
    if (v && this.rvfcHandle !== null && "cancelVideoFrameCallback" in v) v.cancelVideoFrameCallback(this.rvfcHandle);
    this.rvfcHandle = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.hand?.close();
    this.face?.close();
    this.hand = null;
    this.face = null;
  }

  onFrame(cb: FrameCb): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  stats(): SourceStats {
    const now = performance.now();
    this.cameraTimes = this.cameraTimes.filter((t) => now - t < 1000);
    this.detectTimes = this.detectTimes.filter((t) => now - t < 1000);
    return { cameraFps: this.cameraTimes.length, detectionFps: this.detectTimes.length, delegate: this.delegate };
  }

  private schedule() {
    const v = this.video;
    if (!v || !this.running) return;
    if ("requestVideoFrameCallback" in v) {
      this.rvfcHandle = v.requestVideoFrameCallback(() => this.onVideoFrame());
    } else {
      // Non-Chrome fallback (banner already says "use desktop Chrome").
      setTimeout(() => this.onVideoFrame(), 33);
    }
  }

  private onVideoFrame() {
    if (!this.running || !this.video) return;
    const v = this.video;
    let now = performance.now();
    if (now <= this.lastTs) now = this.lastTs + 0.01;
    this.lastTs = now;
    this.cameraTimes.push(now);
    this.frameNo++;
    try {
      this.sampleLuma(v, now);
      const frame = this.detect(v, now);
      this.detectTimes.push(performance.now());
      this.subs.forEach((cb) => cb(frame));
    } catch (e) {
      console.error("[Steady] detection failed", e);
    }
    this.schedule();
  }

  private runFace(v: HTMLVideoElement, now: number) {
    const r = this.face!.detectForVideo(v, now);
    const cats = r.faceBlendshapes?.[0]?.categories;
    let blendshapes: Record<string, number> | null = null;
    if (cats) {
      blendshapes = {};
      for (const c of cats) blendshapes[c.categoryName] = c.score;
      if (this.jawOpenAvailable === null) {
        // Startup assertion (§3): the blendshape list must contain jawOpen.
        this.jawOpenAvailable = cats.some((c) => c.categoryName === "jawOpen");
        if (!this.jawOpenAvailable) console.warn("[Steady] face blendshapes lack jawOpen; mouth tap disabled");
        this.onJawOpenCheck?.(this.jawOpenAvailable);
      }
    }
    return { landmarks: r.faceLandmarks?.[0] ?? null, blendshapes };
  }

  private detect(v: HTMLVideoElement, now: number): LandmarkFrame {
    const base = { t: now, videoWidth: v.videoWidth, videoHeight: v.videoHeight, luma: this.luma };
    if (this.mode === "face") {
      if (!this.face) return { ...base, landmarks: null, handedness: null, blendshapes: null };
      const r = this.runFace(v, now);
      return { ...base, landmarks: r.landmarks ? r.landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })) : null, handedness: null, blendshapes: r.blendshapes };
    }
    if (!this.hand) return { ...base, landmarks: null, handedness: null, blendshapes: null };
    const r = this.hand.detectForVideo(v, now);
    const lm = r.landmarks?.[0] ?? null;
    const hd = r.handedness?.[0]?.[0]?.categoryName;
    // Face tap in Hand mode: blendshapes from every other frame (halves the extra cost).
    if (this.faceSignals && this.face && this.frameNo % 2 === 0) {
      this.lastBlendshapes = this.runFace(v, now + 0.001).blendshapes;
    } else if (!this.faceSignals) {
      this.lastBlendshapes = null;
    }
    return {
      ...base,
      landmarks: lm ? lm.map((p) => ({ x: p.x, y: p.y, z: p.z })) : null,
      handedness: hd === "Left" || hd === "Right" ? hd : null,
      blendshapes: this.lastBlendshapes,
    };
  }

  private sampleLuma(v: HTMLVideoElement, now: number) {
    if (now - this.lastLumaAt < 500) return;
    this.lastLumaAt = now;
    const c = (this.lumaCanvas ??= Object.assign(document.createElement("canvas"), { width: 32, height: 24 }));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, 32, 24);
    const d = ctx.getImageData(0, 0, 32, 24).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    this.luma = sum / (d.length / 4);
  }
}
