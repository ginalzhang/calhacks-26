/**
 * MediaPipeSource: webcam + @mediapipe/tasks-vision HandLandmarker (VIDEO mode, 1 hand).
 * - wasm from jsDelivr for the pinned version, float16 model from Google storage (web quickstart).
 * - GPU delegate with automatic CPU fallback if creation throws.
 * - Detection driven by video.requestVideoFrameCallback, timestamp = performance.now().
 * - No Web Worker. Mean luma sampled from a tiny canvas every ~500 ms.
 * - Head mode (P3): FaceLandmarker with outputFaceBlendshapes, same frame contract.
 */
import type { HandLandmarker, FaceLandmarker } from "@mediapipe/tasks-vision";
import type { LandmarkFrame, LandmarkSource, SourceMode, SourceStats } from "./LandmarkSource";

export const MEDIAPIPE_VERSION = "1.1.1";
export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type FrameCb = (f: LandmarkFrame) => void;

export interface MediaPipeOptions {
  deviceId?: string | null;
  /** Drop capture to 320×240 if the UI stutters. */
  lowRes?: boolean;
}

export class MediaPipeSource implements LandmarkSource {
  readonly kind = "mediapipe" as const;
  mode: SourceMode = "hand";
  video: HTMLVideoElement | null = null;

  private subs = new Set<FrameCb>();
  private stream: MediaStream | null = null;
  private hand: HandLandmarker | null = null;
  private face: FaceLandmarker | null = null;
  private delegate: "GPU" | "CPU" | null = null;
  private running = false;
  private rvfcHandle: number | null = null;
  private cameraTimes: number[] = [];
  private detectTimes: number[] = [];
  private lastTs = 0;
  private luma: number | null = null;
  private lastLumaAt = 0;
  private lumaCanvas: HTMLCanvasElement | null = null;
  /** Set when the face model lacks the jawOpen blendshape (face tap disabled). */
  jawOpenAvailable: boolean | null = null;

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
    await this.loadModel(this.mode);
    this.running = true;
    this.schedule();
  }

  /** The deviceId actually in use (persisted so "Use last setup" picks the same camera). */
  get deviceId(): string | null {
    return this.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? null;
  }

  async setMode(mode: SourceMode): Promise<void> {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.running) await this.loadModel(mode);
  }

  private async loadModel(mode: SourceMode) {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    const make = async (delegate: "GPU" | "CPU") => {
      if (mode === "hand") {
        this.hand ??= await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } else {
        this.face ??= await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      }
      this.delegate = delegate;
    };
    try {
      await make("GPU");
    } catch (gpuErr) {
      console.warn("[Steady] GPU delegate failed, falling back to CPU", gpuErr);
      try {
        await make("CPU");
      } catch (cpuErr) {
        throw new Error(`The hand-tracking model could not load. Check the internet connection. (${(cpuErr as Error)?.message ?? cpuErr})`);
      }
    }
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

  private detect(v: HTMLVideoElement, now: number): LandmarkFrame {
    const base = { t: now, videoWidth: v.videoWidth, videoHeight: v.videoHeight, luma: this.luma };
    if (this.mode === "face" && this.face) {
      const r = this.face.detectForVideo(v, now);
      const lm = r.faceLandmarks?.[0] ?? null;
      let blendshapes: Record<string, number> | null = null;
      const cats = r.faceBlendshapes?.[0]?.categories;
      if (cats) {
        blendshapes = {};
        for (const c of cats) blendshapes[c.categoryName] = c.score;
        if (this.jawOpenAvailable === null) {
          this.jawOpenAvailable = cats.some((c) => c.categoryName === "jawOpen");
          if (!this.jawOpenAvailable) console.warn("[Steady] face blendshapes lack jawOpen; face tap disabled");
        }
      }
      return { ...base, landmarks: lm ? lm.map((p) => ({ x: p.x, y: p.y, z: p.z })) : null, handedness: null, blendshapes };
    }
    if (!this.hand) return { ...base, landmarks: null, handedness: null, blendshapes: null };
    const r = this.hand.detectForVideo(v, now);
    const lm = r.landmarks?.[0] ?? null;
    const hd = r.handedness?.[0]?.[0]?.categoryName;
    return {
      ...base,
      landmarks: lm ? lm.map((p) => ({ x: p.x, y: p.y, z: p.z })) : null,
      handedness: hd === "Left" || hd === "Right" ? hd : null,
      blendshapes: null,
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
