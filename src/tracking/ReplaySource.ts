/**
 * ReplaySource: plays a LandmarkFixture (public/fixtures/*.json) on real timing.
 * Frame timestamps are the fixture's own `t` rebased onto performance.now(), so the
 * pipeline sees exactly the fixture's sample spacing.
 */
import type {
  LandmarkFixture,
  LandmarkFrame,
  LandmarkSource,
  ReplayControls,
  SourceMode,
  SourceStats,
} from "./LandmarkSource";

type FrameCb = (f: LandmarkFrame) => void;

export class ReplaySource implements LandmarkSource, ReplayControls {
  readonly kind = "replay" as const;
  mode: SourceMode = "hand";
  readonly video: HTMLVideoElement | null = null;
  loop = false;

  private fixture: LandmarkFixture | null = null;
  private subs = new Set<FrameCb>();
  private idx = 0;
  /** performance.now() that corresponds to fixture time frames[0].t (adjusted for pauses). */
  private base = 0;
  private pausedAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _playing = false;
  private finishWaiters: (() => void)[] = [];
  private done = false;
  private emitTimes: number[] = [];
  private lastT = 0;
  private loading: Promise<void> | null = null;

  constructor(private url: string | null = null, private autoplay = true) {}

  get playing(): boolean {
    return this._playing;
  }

  async load(fixtureUrl: string): Promise<void> {
    this.stopTimer();
    const res = await fetch(fixtureUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load replay fixture ${fixtureUrl} (${res.status})`);
    const fx = (await res.json()) as LandmarkFixture;
    if (!fx || !Array.isArray(fx.frames) || fx.frames.length === 0) {
      throw new Error(`Replay fixture ${fixtureUrl} has no frames`);
    }
    this.loadFixture(fx);
  }

  /** Load an in-memory fixture (tests / synthesised data). */
  loadFixture(fx: LandmarkFixture): void {
    this.stopTimer();
    this.fixture = fx;
    this.mode = fx.mode ?? "hand";
    this.idx = 0;
    this.done = false;
    this._playing = false;
    this.pausedAt = null;
  }

  async start(): Promise<void> {
    if (this.url && !this.fixture) {
      this.loading = this.load(this.url);
      try {
        await this.loading;
      } finally {
        this.loading = null;
      }
    }
    if (this.autoplay && this.fixture) this.play();
  }

  /** True once a fixture is loaded and play() will start immediately. */
  get ready(): boolean {
    return !!this.fixture;
  }

  stop(): void {
    this.stopTimer();
    this._playing = false;
  }

  onFrame(cb: FrameCb): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  stats(): SourceStats {
    const now = performance.now();
    this.emitTimes = this.emitTimes.filter((t) => now - t < 1000);
    const fps = this._playing ? this.emitTimes.length : 0;
    return { cameraFps: fps, detectionFps: fps, delegate: "replay" };
  }

  play(): void {
    const fx = this.fixture;
    if (!fx && this.loading) {
      // Called before the fixture arrived: start as soon as it has loaded.
      void this.loading.then(() => this.play()).catch(() => undefined);
      return;
    }
    if (!fx || this._playing) return;
    if (this.done) this.idx = 0;
    this.done = false;
    const now = performance.now();
    const t0 = fx.frames[0].t;
    if (this.pausedAt !== null && this.idx > 0) {
      this.base += now - this.pausedAt;
    } else {
      this.base = now - (fx.frames[this.idx]?.t ?? t0) + t0;
    }
    // Timestamps must stay strictly increasing across restarts (MediaPipe-style contract).
    if (this.base + (fx.frames[this.idx].t - t0) <= this.lastT) this.base = this.lastT + 1 - (fx.frames[this.idx].t - t0);
    this.pausedAt = null;
    this._playing = true;
    this.tick();
  }

  pause(): void {
    if (!this._playing) return;
    this.stopTimer();
    this._playing = false;
    this.pausedAt = performance.now();
  }

  restart(): void {
    this.stopTimer();
    this._playing = false;
    this.pausedAt = null;
    this.idx = 0;
    this.done = false;
    this.play();
  }

  finished(): Promise<void> {
    if (this.done) return Promise.resolve();
    return new Promise((resolve) => this.finishWaiters.push(resolve));
  }

  private stopTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private tick = () => {
    this.timer = null;
    const fx = this.fixture;
    if (!fx || !this._playing) return;
    const t0 = fx.frames[0].t;
    const now = performance.now();
    // Emit every frame that is due (catches up after a throttled timer).
    while (this.idx < fx.frames.length && this.base + (fx.frames[this.idx].t - t0) <= now + 1) {
      this.emit(fx, this.idx);
      this.idx++;
    }
    if (this.idx >= fx.frames.length) {
      if (this.loop) {
        const lastT = fx.frames[fx.frames.length - 1].t - t0;
        const step = 1000 / (fx.fps || 30);
        this.base += lastT + step;
        this.idx = 0;
      } else {
        this._playing = false;
        this.done = true;
        const w = this.finishWaiters;
        this.finishWaiters = [];
        w.forEach((r) => r());
        return;
      }
    }
    const due = this.base + (fx.frames[this.idx].t - t0);
    this.timer = setTimeout(this.tick, Math.max(0, due - performance.now()));
  };

  private emit(fx: LandmarkFixture, i: number) {
    const fr = fx.frames[i];
    const t = Math.max(this.base + (fr.t - fx.frames[0].t), this.lastT + 0.001);
    this.lastT = t;
    this.emitTimes.push(performance.now());
    const frame: LandmarkFrame = {
      t,
      landmarks: fr.lm ? fr.lm.map(([x, y, z]) => ({ x, y, z })) : null,
      handedness: fr.lm ? (fr.handedness ?? null) : null,
      blendshapes: null,
      videoWidth: fx.videoWidth || 640,
      videoHeight: fx.videoHeight || 480,
      luma: typeof fx.luma === "number" ? fx.luma : 128,
    };
    this.subs.forEach((cb) => cb(frame));
  }
}
