/**
 * The live pipeline runtime (client only):
 *   LandmarkSource → pickPointer (mirror, camera px) → PointerEngine (A) → PointerFrame
 *   → pen events → stroke recorder → finalizeStroke (A) → history
 *   → tile dwell (A) over the toolbar / rest zones
 *   → calibration capture
 * High-frequency data stays here (mutable); discrete changes go to the store.
 */
import { COLOUR_HEX, type ActionId } from "@/actions";
import { createPointerEngine, type Engine, type EngineFrame } from "@/pipeline/pointer";
import { finalizeStroke, eraserHits, straighten } from "@/pipeline/strokes";
import { createTileDwell, rIn } from "@/pipeline/dwell";
import { newId } from "@/pipeline/document";
import { rmsDeviation } from "@/pipeline/metrics";
import { steadinessToParams } from "@/pipeline/steadiness";
import { analyzeCalibration } from "@/pipeline/calibration";
import type {
  PenEvent,
  PenCause,
  PipelineSettings,
  PointerFrame,
  Size,
  TileDwellState,
  TimedPoint,
  TrackingLossReason,
  Vec2,
} from "@/pipeline/types";
import type { LandmarkFrame, LandmarkSource } from "@/tracking/LandmarkSource";
import { ReplaySource } from "@/tracking/ReplaySource";
import { pickPointer, pointerIndex } from "@/tracking/pointerLandmark";
import { fixtureUrl, getParams } from "@/lib/params";
import { earcon, tick } from "@/lib/earcons";
import { KEYS, load, save } from "@/lib/persist";
import { getState, setState, setStatus, type CalibrationUI, type FaceSignal } from "./store";
import { commit, page } from "./docOps";
import { desktop } from "@/desktop/bridge";
import { toDoc, type View } from "@/lib/view";
import { calibrateFaceTap, createFaceTap, MIC_SUPPRESS_MS, type FaceTapDetector } from "@/lib/faceTap";
import { breakMessage, createBreakTimer } from "@/lib/breaks";
import { detrendedRms } from "@/pipeline/calibration";
import { suggestSteadiness } from "@/pipeline/steadiness";
import type { CalibrationResult, Rect } from "@/pipeline/types";
import { micClosedAt } from "./voice";

export interface LiveStroke {
  id: string;
  points: TimedPoint[];
  raw: Vec2[];
  startT: number;
}

interface CalibCapture {
  stage: "rest" | "circle";
  startT: number | null;
  rest: TimedPoint[];
  /** Raw mirrored camera px during the rest step (Head mode neutral position). */
  restRaw: TimedPoint[];
  circle: TimedPoint[];
  handedness: "Left" | "Right" | null;
  lastUiT: number;
}

/** Per-mode reach (Hand and Head mode keep their own gain, box and calibration). */
interface ModeSetup {
  gain: number;
  activeBox: Rect | null;
  calibration: CalibrationResult | null;
}

export const HEAD_GAIN_DEFAULT = 6;
/** "Open your mouth comfortably twice": face-tap check length. */
export const FACE_CAL_MS = 6000;

export const REST_MS = 3000;
export const CIRCLE_MS = 4000;
export const RECENTER_MS = 3000;

class Runtime {
  source: LandmarkSource | null = null;
  replay: ReplaySource | null = null;
  engine: Engine | null = null;
  videoSize: Size = { w: 640, h: 480 };
  canvasSize: Size = { w: 800, h: 600 };
  canvasEl: HTMLCanvasElement | null = null;
  /** Latest processed frame (render loop reads it). */
  frame: EngineFrame | null = null;
  /** Last known pointer (frozen while tracking is lost: the "?" ring sits here). */
  lastPointer: Vec2 | null = null;
  live: LiveStroke | null = null;
  /** Stroke ids erased during the current eraser pen-down (hidden live, committed on pen-up). */
  erasing: Set<string> | null = null;
  tileDwell = createTileDwell();
  tileState: TileDwellState = { hoveredId: null, progress: 0, firedId: null };
  /** Set right before a dwell-fired el.click() so the tile's onClick knows the input method. */
  pendingVia: "tile-dwell" | null = null;
  calib: CalibCapture | null = null;
  lastFrameAt = 0;
  luma: number | null = null;
  started = false;
  /** Saved reach for the mode that is not active. */
  modes: Partial<Record<"hand" | "head", ModeSetup>> = {};
  /** Called on a face tap (set by setup.ts → dispatch pen.toggle via "face"). */
  onFaceTap: (() => void) | null = null;
  private faceTap: FaceTapDetector | null = null;
  private faceCal: { samples: { t: number; v: number }[]; startT: number | null; lastUiT: number } | null = null;
  private breaks = createBreakTimer();
  private penDownT = 0;
  private rawBuf: TimedPoint[] = [];
  private smoothBuf: TimedPoint[] = [];
  private lastMetricsAt = 0;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private unsub: (() => void) | null = null;
  private lastTracking: "ok" | "lost" = "lost";
  private everTracked = false;

  // ------------------------------------------------------------ lifecycle

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const params = getParams();
    let src: LandmarkSource;
    if (params.source === "replay") {
      const r = new ReplaySource(params.fixture ? fixtureUrl(params.fixture) : null, params.autoplay);
      src = r;
    } else {
      const { MediaPipeSource } = await import("@/tracking/MediaPipeSource");
      const setup = load<{ deviceId?: string | null } | null>(KEYS.setup, null);
      const mp = new MediaPipeSource({ deviceId: setup?.deviceId ?? null });
      mp.onJawOpenCheck = (ok) => this.onJawOpenCheck(ok);
      src = mp;
    }
    this.source = src;
    this.unsub = src.onFrame(this.onLandmarks);
    this.statsTimer = setInterval(this.pollStats, 500);
    try {
      await src.start();
      // Expose replay controls only once the fixture is loaded (tests drive it immediately).
      if (src instanceof ReplaySource) this.replay = src;
      setState({ trackingStarted: true, sourceError: null });
      const dev = (src as { deviceId?: string | null }).deviceId;
      if (dev) {
        const setup = load<Record<string, unknown>>(KEYS.setup, {});
        save(KEYS.setup, { ...setup, deviceId: dev });
      }
      if (src.kind === "replay" && !params.fixture) setStatus("Replay mode: no fixture given. Add ?fixture=word-tremor to the address.");
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      setState({ sourceError: msg, tracking: "lost", lossReason: "no-camera" });
      setStatus(msg, "alert");
    }
  }

  stop(): void {
    this.unsub?.();
    this.source?.stop();
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.started = false;
  }

  setCanvas(el: HTMLCanvasElement | null): void {
    this.canvasEl = el;
  }

  setCanvasSize(size: Size): void {
    if (size.w < 1 || size.h < 1) return;
    this.canvasSize = size;
    // In Desktop mode the engine maps onto the drawing area instead (see setDesktop).
    if (!getState().desktopOn) this.engine?.setCanvasSize(size);
  }

  /** Engine space for Desktop mode: drawing-area-relative points (E's mapping). */
  desktopEngineSize(): Size {
    const a = desktop.drawingArea;
    return { w: Math.max(1, a.w), h: Math.max(1, a.h) };
  }

  /** P2b: switch the engine between Steady's canvas and the desktop drawing area. */
  setDesktop(on: boolean): void {
    this.penUp("tile");
    this.live = null;
    this.engine?.setCanvasSize(on ? this.desktopEngineSize() : this.canvasSize);
  }

  private ensureEngine(video: Size) {
    if (!this.engine) {
      this.videoSize = video;
      this.engine = createPointerEngine(getState().settings, this.canvasSize, video);
    } else if (video.w !== this.videoSize.w || video.h !== this.videoSize.h) {
      this.videoSize = video;
      this.engine.setVideoSize(video);
    }
    return this.engine;
  }

  // ------------------------------------------------------------ settings

  updateSettings(patch: Partial<PipelineSettings>): void {
    setState((s) => ({ settings: { ...s.settings, ...patch } }));
    this.engine?.updateSettings(patch);
  }

  setSteadiness(v: number): void {
    const s = Math.max(0, Math.min(100, Math.round(v)));
    const p = steadinessToParams(s);
    const cur = getState().settings;
    this.updateSettings({ steadiness: s, lazyRadius: p.lazyRadius, filter: { ...cur.filter, minCutoff: p.minCutoff } });
  }

  // ------------------------------------------------------------ frames

  private onLandmarks = (lf: LandmarkFrame) => {
    const st = getState();
    this.lastFrameAt = performance.now();
    this.luma = lf.luma;
    const engine = this.ensureEngine({ w: lf.videoWidth, h: lf.videoHeight });
    if (st.paused) return;
    if (st.desktopOn) return this.onDesktopLandmarks(lf, engine);
    const idx = pointerIndex(st.settings.mode, st.settings.pointerLandmark);
    const camera = pickPointer(lf, idx);
    const prev = this.frame?.pointer ?? this.lastPointer;
    const overCanvas = prev ? this.isOverCanvas(prev) : false;
    const calibrating = st.phase === "calibrating";
    const inRestZone = !overCanvas || calibrating || st.phase === "intro" || !!st.dialog || !!st.panel;
    const stats = this.source?.stats();
    const f = engine.process({
      t: lf.t,
      camera,
      luma: lf.luma ?? undefined,
      detectionFps: stats?.detectionFps,
      inRestZone,
      overCanvas,
    });
    this.frame = f;
    if (f.pointer) this.lastPointer = f.pointer;

    for (const ev of f.events) this.onPenEvent(ev, f);
    this.trackInk(f);
    this.trackTracking(f);
    this.trackMetrics(f);
    if (calibrating && st.calib?.measuring) this.captureCalibration(f, lf);
    else this.trackTiles(f);
    this.trackFace(lf);
    this.trackBreaks(f);
  };

  /** P2b frame path: same engine, but "canvas" = the desktop drawing area; no ink on Steady's page. */
  private onDesktopLandmarks(lf: LandmarkFrame, engine: Engine) {
    const st = getState();
    const camera = pickPointer(lf, pointerIndex(st.settings.mode, st.settings.pointerLandmark));
    const prev = this.frame?.pointer ?? this.lastPointer;
    const overCanvas = desktop.isInside(prev);
    const stats = this.source?.stats();
    const f = engine.process({
      t: lf.t,
      camera,
      luma: lf.luma ?? undefined,
      detectionFps: stats?.detectionFps,
      inRestZone: !overCanvas || !!st.dialog,
      overCanvas,
    });
    this.frame = f;
    if (f.pointer) this.lastPointer = f.pointer;
    for (const ev of f.events) this.onPenEvent(ev, f);
    desktop.onFrame(f);
    this.trackTracking(f);
    this.trackMetrics(f);
    this.trackFace(lf);
    this.trackBreaks(f);
  }

  isOverCanvas(p: Vec2): boolean {
    return p.x >= 0 && p.y >= 0 && p.x <= this.canvasSize.w && p.y <= this.canvasSize.h;
  }

  /** Canvas px → viewport px. */
  toViewport(p: Vec2): Vec2 {
    const r = this.canvasEl?.getBoundingClientRect();
    if (!r) return p;
    return { x: r.left + (p.x * r.width) / this.canvasSize.w, y: r.top + (p.y * r.height) / this.canvasSize.h };
  }

  // ------------------------------------------------------------ pen + ink

  /** Explicit pen toggle (Space / voice / typed / tile). No cooldown. */
  togglePen(cause: PenCause): void {
    if (getState().paused) {
      setStatus("Tracking is paused. Press P or say “pause” to resume.");
      return;
    }
    const engine = this.engine;
    if (!engine) {
      setStatus("Waiting for the camera. The pen will work once your hand is tracked.");
      return;
    }
    const ev = engine.togglePen(performance.now(), cause);
    this.onPenEvent(ev, this.frame);
  }

  penUp(cause: PenCause): void {
    const ev = this.engine?.setPen("HOVER", performance.now(), cause);
    if (ev) this.onPenEvent(ev, this.frame);
  }

  private onPenEvent(ev: PenEvent, f: PointerFrame | null) {
    const st = getState();
    if (st.desktopOn) {
      // The helper holds / releases the real mouse button; Steady's own page records nothing.
      desktop.onPenEvent(ev);
      if (ev.type === "pen-up" && ev.cause === "left-canvas") return;
      if (ev.type === "pen-down" && st.pen === "DRAWING") return;
      if (ev.type === "pen-down") {
        if (st.sounds) earcon("down");
        setState({ pen: "DRAWING" });
        setStatus("Pen down");
      } else {
        if (st.sounds && st.pen === "DRAWING") earcon("up");
        setState({ pen: "HOVER" });
        if (ev.cause !== "tracking-lost") setStatus("Pen up");
      }
      return;
    }
    // Ink boundaries while the pen stays logically down (canvas exit / re-entry): no earcon,
    // no pen-state change, just end / start the live stroke.
    if (ev.type === "pen-up" && ev.cause === "left-canvas") {
      this.endLive(ev.trimFromT);
      return;
    }
    if (ev.type === "pen-down" && st.pen === "DRAWING") {
      if (st.tool !== "eraser" && st.phase === "ready" && this.isOverCanvas(ev.at)) this.startLive(ev.at, ev.t);
      return;
    }
    if (ev.type === "pen-down") {
      this.penDownT = ev.t;
      if (st.demoOpen && !st.demoQuoteSeen) setState({ demoQuoteSeen: true });
      if (st.reminder) setState({ reminder: null });
      if (st.sounds) earcon("down");
      setState({ pen: "DRAWING" });
      setStatus(st.tool === "eraser" ? "Pen down (eraser)" : st.tool === "straight" ? "Pen down (straight line)" : "Pen down");
      if (st.tool === "eraser") {
        this.erasing = new Set();
      } else {
        const at = ev.at ?? f?.pointer;
        if (at && this.isOverCanvas(at) && st.phase === "ready") this.startLive(at, ev.t);
      }
    } else {
      if (st.sounds && st.pen === "DRAWING") earcon("up");
      this.endLive(ev.trimFromT);
      this.commitErase();
      setState((s) => ({ pen: "HOVER", metrics: { ...s.metrics, lastStrokeMs: Math.round(ev.t - this.penDownT) } }));
      if (ev.cause !== "tracking-lost") setStatus("Pen up");
    }
  }

  /** Current zoom / move view (identity unless the user zoomed). */
  view(): View {
    const s = getState();
    return { zoom: s.zoom, pan: s.pan };
  }

  /** Canvas px → document coordinates (ink is stored in document space). */
  toDoc(p: Vec2): Vec2 {
    return toDoc(p, this.view());
  }

  private startLive(at: Vec2, t: number) {
    const d = this.toDoc(at);
    this.live = { id: newId("s"), points: [{ x: d.x, y: d.y, t }], raw: [], startT: t };
  }

  private trackInk(f: EngineFrame) {
    const st = getState();
    if (st.pen !== "DRAWING" || st.phase !== "ready") return;
    const p = f.pointer;
    const over = p ? this.isOverCanvas(p) : false;
    if (st.tool === "eraser") {
      if (p && over && this.erasing) {
        const visible = page().strokes.filter((s) => !this.erasing!.has(s.id));
        const hits = eraserHits(visible, this.toDoc(p), Math.max(12, st.width * 2) / st.zoom);
        if (hits.length) {
          hits.forEach((id) => this.erasing!.add(id));
          setState((s) => ({ renderVersion: s.renderVersion + 1 }));
        }
      }
      return;
    }
    // The engine decides when ink flows (pen down AND over the canvas); it emits
    // left-canvas pen-up / pen-down boundaries so strokes never get a connecting line.
    if (f.inking && p) {
      if (!this.live) this.startLive(p, f.t);
      else {
        const d = this.toDoc(p);
        this.live.points.push({ x: d.x, y: d.y, t: f.t });
      }
      if (f.rawCanvas) this.live?.raw.push(this.toDoc(f.rawCanvas));
    }
  }

  private endLive(trimFromT?: number) {
    const live = this.live;
    this.live = null;
    if (!live) return;
    const st = getState();
    let stroke = finalizeStroke(live.points, {
      id: live.id,
      colour: st.colour,
      width: st.width,
      rIn: rIn(st.settings),
      trimFromT,
      raw: live.raw,
    });
    if (!stroke) return;
    if (st.tool === "straight" && stroke.kind !== "dot" && stroke.points.length >= 2) {
      stroke = { ...stroke, kind: "line", points: straighten(stroke.points) };
    }
    const p = page();
    commit(stroke.kind === "dot" ? "dot" : stroke.kind === "line" ? "straight line" : "stroke", [
      { type: "add-stroke", pageId: p.id, stroke },
    ]);
    setState({ selectedStrokeId: null });
  }

  private commitErase() {
    const ids = this.erasing;
    this.erasing = null;
    if (!ids || ids.size === 0) return;
    commit(ids.size === 1 ? "erase" : `erase ${ids.size} strokes`, [{ type: "remove-strokes", pageId: page().id, ids: [...ids] }]);
    setStatus(ids.size === 1 ? "Erased 1 stroke" : `Erased ${ids.size} strokes`);
  }

  /** Place a dot at the cursor (voice/typed "dot"). */
  placeDot(): boolean {
    const p = this.frame?.pointer ?? this.lastPointer;
    const st = getState();
    if (!p || !this.isOverCanvas(p)) return false;
    const d = this.toDoc(p);
    const stroke = finalizeStroke([{ x: d.x, y: d.y, t: performance.now() }], {
      id: newId("s"),
      colour: st.colour,
      width: st.width,
      rIn: rIn(st.settings),
    });
    if (!stroke) return false;
    commit("dot", [{ type: "add-stroke", pageId: page().id, stroke: { ...stroke, kind: "dot", points: [{ x: d.x, y: d.y }] } }]);
    return true;
  }

  // ------------------------------------------------------------ tracking state

  private trackTracking(f: EngineFrame) {
    const st = getState();
    if (f.tracking !== this.lastTracking) {
      const was = this.lastTracking;
      this.lastTracking = f.tracking;
      if (f.tracking === "lost") {
        setState({ tracking: "lost", lossReason: f.lossReason });
        if (this.everTracked || st.phase === "ready") setStatus(lossMessage(f.lossReason), "alert");
      } else {
        setState({ tracking: "ok", lossReason: null, alert: null });
        if (was === "lost" && st.phase !== "intro" && (f.reacquired || this.everTracked)) {
          const hint =
            f.quality === "too-dark"
              ? " It is still dark here: a lamp facing you helps."
              : f.quality === "low-fps"
                ? " The camera is slow: close other tabs or apps."
                : "";
          setStatus(`${st.pen === "DRAWING" ? "Tracking back." : "Tracking back. Pen is up."}${hint}`);
        }
        this.everTracked = true;
      }
    } else if (f.tracking === "lost" && f.lossReason !== st.lossReason) {
      setState({ lossReason: f.lossReason });
      if (st.phase === "ready") setStatus(lossMessage(f.lossReason), "alert");
    }
    if (f.pen !== st.pen && f.events.length === 0) setState({ pen: f.pen });
  }

  // ------------------------------------------------------------ metrics

  private trackMetrics(f: EngineFrame) {
    if (f.rawCanvas && f.pointer) {
      this.rawBuf.push({ ...f.rawCanvas, t: f.t });
      this.smoothBuf.push({ ...f.pointer, t: f.t });
    }
    const cutoff = f.t - 1500;
    while (this.rawBuf.length && this.rawBuf[0].t < cutoff) this.rawBuf.shift();
    while (this.smoothBuf.length && this.smoothBuf[0].t < cutoff) this.smoothBuf.shift();
    if (f.t - this.lastMetricsAt < 300) return;
    this.lastMetricsAt = f.t;
    const raw = roughness(this.rawBuf);
    const smooth = roughness(this.smoothBuf);
    const s = getState();
    if (s.demoOpen || s.ghost || s.tremor) {
      setState({
        metrics: { ...s.metrics, deviationRawPx: round1(raw), deviationSmoothedPx: round1(smooth) },
      });
    } else {
      // Keep the hooks' metrics fresh without re-rendering often.
      s.metrics.deviationRawPx = round1(raw);
      s.metrics.deviationSmoothedPx = round1(smooth);
    }
  }

  private pollStats = () => {
    const stats = this.source?.stats();
    if (!stats) return;
    const s = getState();
    if (s.metrics.cameraFps !== stats.cameraFps || s.metrics.detectionFps !== stats.detectionFps) {
      setState({ metrics: { ...s.metrics, cameraFps: stats.cameraFps, detectionFps: stats.detectionFps } });
    }
    // Camera stalled entirely (no frames for 1 s): feed the engine a "no hand" frame so it fails safe.
    if (this.source?.kind === "mediapipe" && s.trackingStarted && performance.now() - this.lastFrameAt > 1000 && this.engine) {
      const f = this.engine.process({ t: performance.now(), camera: null, detectionFps: 0 });
      this.frame = f;
      for (const ev of f.events) this.onPenEvent(ev, f);
      this.trackTracking(f);
    }
  };

  // ------------------------------------------------------------ tiles (rest zone dwell)

  private trackTiles(f: EngineFrame) {
    const st = getState();
    const p = f.pointer;
    const engineSettings = st.settings;
    // In modal contexts (first run, setup screen, confirm dialog) tiles may sit over the canvas.
    const modal = st.phase !== "ready" || !!st.dialog || !!st.panel;
    if (!p || f.tracking !== "ok" || !st.inputs.dwell || (!modal && this.isOverCanvas(p))) {
      this.setTileState(this.tileDwell.update(null, [], f.t, { radius: 1, dwellMs: engineSettings.tileDwellMs, snapPx: 0 }));
      return;
    }
    const vp = this.toViewport(p);
    const tiles = collectTiles();
    const radius = engineSettings.tileDwellRadius ?? rIn(engineSettings);
    const ts = this.tileDwell.update(vp, tiles, f.t, {
      radius,
      dwellMs: engineSettings.tileDwellMs,
      snapPx: engineSettings.tileSnapPx,
    });
    this.setTileState(ts);
    if (ts.firedId) {
      const el = document.querySelector<HTMLElement>(`[data-tile="${cssEscape(ts.firedId)}"]`);
      if (el && !el.closest("[inert]") && !(el as HTMLButtonElement).disabled) {
        tick();
        this.pendingVia = "tile-dwell";
        el.click();
        this.pendingVia = null;
      }
    }
  }

  private setTileState(ts: TileDwellState) {
    const prev = this.tileState;
    this.tileState = ts;
    if (prev.hoveredId && prev.hoveredId !== ts.hoveredId) {
      const el = document.querySelector<HTMLElement>(`[data-tile="${cssEscape(prev.hoveredId)}"]`);
      el?.style.removeProperty("--dwell");
      el?.removeAttribute("data-dwell-hover");
    }
    if (ts.hoveredId) {
      const el = document.querySelector<HTMLElement>(`[data-tile="${cssEscape(ts.hoveredId)}"]`);
      if (el) {
        // prefers-reduced-motion: stepped indicator (quarters) instead of a smooth fill.
        const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.style.setProperty("--dwell", String(reduced ? Math.floor(ts.progress * 4) / 4 : ts.progress));
        el.setAttribute("data-dwell-hover", "");
      }
    }
  }

  // ------------------------------------------------------------ calibration

  beginCalibration(scope: CalibrationUI["scope"]): void {
    this.live = null;
    this.penUp("tile");
    // Head mode: one 3 s "hold still" step sets the neutral position (and the rest shake).
    const head = getState().settings.mode === "head";
    const stage = scope === "recenter" && !head ? "circle" : "rest";
    this.calib = { stage, startT: null, rest: [], restRaw: [], circle: [], handedness: null, lastUiT: 0 };
    const prevAsked = getState().calib?.askedLarger ?? false;
    setState({
      phase: "calibrating",
      previewCollapsed: false,
      calib: {
        step: stage,
        progress: 0,
        message: stageMessage(stage),
        askedLarger: scope === "full" ? false : prevAsked,
        scope,
        measuring: true,
      },
    });
    this.engine?.updateSettings({ dwellEnabled: false });
    setStatus(stageMessage(stage));
  }

  cancelCalibration(): void {
    this.calib = null;
    this.engine?.updateSettings({ dwellEnabled: getState().settings.dwellEnabled });
    setState({ phase: "ready", calib: null, previewCollapsed: true });
    setStatus("Setup cancelled. Using the previous settings.");
  }

  private captureCalibration(f: EngineFrame, lf: LandmarkFrame) {
    const c = this.calib;
    const ui = getState().calib;
    if (!c || !ui || !ui.measuring) return;
    if (f.tracking !== "ok" || !f.filtered || !f.rawCamera) {
      if (f.t - c.lastUiT > 500) {
        c.lastUiT = f.t;
        const what = getState().settings.mode === "head" ? "your face" : "your hand";
        setState({ calib: { ...ui, message: `I can't see ${what} yet. There's no rush; the timer waits for you.` } });
      }
      return;
    }
    if (c.startT === null) c.startT = f.t;
    if (lf.handedness) c.handedness = lf.handedness;
    const dur = c.stage === "rest" ? REST_MS : ui.scope === "recenter" ? RECENTER_MS : CIRCLE_MS;
    if (c.stage === "rest") {
      c.rest.push({ ...f.filtered, t: f.t });
      c.restRaw.push({ ...f.rawCamera, t: f.t });
    } else c.circle.push({ ...f.rawCamera, t: f.t });
    const progress = Math.min(1, (f.t - c.startT) / dur);
    if (progress < 1) {
      if (f.t - c.lastUiT > 100) {
        c.lastUiT = f.t;
        setState({ calib: { ...ui, step: c.stage, progress, message: stageMessage(c.stage) } });
      }
      return;
    }
    // Step complete.
    if (getState().settings.mode === "head") {
      this.finishHeadCalibration(c, ui);
      return;
    }
    if (c.stage === "rest" && ui.scope === "full") {
      c.stage = "circle";
      c.startT = null;
      setState({ calib: { ...ui, step: "circle", progress: 0, message: stageMessage("circle") } });
      setStatus(stageMessage("circle"));
      return;
    }
    this.finishCalibration(c, ui);
  }

  private finishCalibration(c: CalibCapture, ui: CalibrationUI) {
    const st = getState();
    const prev = st.calibration;
    const result = analyzeCalibration({
      rest: c.rest.length ? c.rest : [],
      circle: c.circle,
      video: this.videoSize,
      canvas: this.canvasSize,
      handedness: c.handedness,
      settings: st.settings,
    });
    if (ui.scope !== "remeasure" && result.circleTooSmall && !ui.askedLarger) {
      // Ask once for a slightly larger circle, then accept whatever comes next.
      c.stage = "circle";
      c.startT = null;
      c.circle = [];
      setState({
        calib: { ...ui, step: "retry-circle", askedLarger: true, progress: 0, message: "Try a slightly larger circle, still slow and easy." },
      });
      setStatus("Try a slightly larger circle, still slow and easy.");
      return;
    }
    this.calib = null;
    let merged = result;
    const patch: Partial<PipelineSettings> = {};
    if (ui.scope === "remeasure" && prev) {
      merged = { ...prev, restJitterRms: result.restJitterRms, suggestedSteadiness: Math.max(result.suggestedSteadiness, prev.suggestedSteadiness), completedAt: result.completedAt };
      patch.restJitterRms = result.restJitterRms;
    } else if (ui.scope === "recenter" && prev) {
      merged = { ...prev, activeBox: result.activeBox, gain: result.gain, hand: result.hand, circleTooSmall: result.circleTooSmall, completedAt: result.completedAt };
      patch.activeBox = result.activeBox;
      patch.gain = result.gain;
    } else {
      patch.activeBox = result.activeBox;
      patch.gain = result.gain;
      patch.restJitterRms = result.restJitterRms;
    }
    patch.dwellEnabled = st.settings.dwellEnabled;
    this.updateSettings(patch);
    if (ui.scope !== "recenter") this.setSteadiness(merged.suggestedSteadiness);
    this.engine?.reset(performance.now());
    setState({ calibration: merged, phase: "ready", calib: null, previewCollapsed: true, pen: "HOVER" });
    persistSetup();
    const msg =
      ui.scope === "recenter"
        ? `Recentered. Gain ${merged.gain.toFixed(1)}×.`
        : ui.scope === "remeasure"
          ? `Measured again. Steadiness ${getState().settings.steadiness}.`
          : `Setup done. Gain ${merged.gain.toFixed(1)}×, Steadiness ${getState().settings.steadiness}. Hold still to start drawing.`;
    setStatus(msg);
  }

  // ------------------------------------------------------------ pause

  setPaused(on: boolean): void {
    if (on) {
      this.penUp("tile");
      this.live = null;
      setState({ paused: true });
      setStatus("Tracking paused. Press P, say “pause” or use the Pause tile to resume.");
    } else {
      this.engine?.reset(performance.now());
      setState({ paused: false });
      setStatus("Tracking resumed. Pen is up.");
    }
  }

  // ------------------------------------------------------------ Head mode (§2 P3)

  /** Switch Hand ↔ Head mode. Each mode keeps its own gain, active box and calibration. */
  async setHeadMode(on: boolean): Promise<boolean> {
    const st = getState();
    const cur = st.settings.mode;
    const next = on ? "head" : "hand";
    if (cur === next) return true;
    const src = this.source as (LandmarkSource & { setMode?: (m: "hand" | "face") => Promise<void> }) | null;
    if (src?.kind === "mediapipe" && src.setMode) {
      setStatus(on ? "Starting head tracking…" : "Starting hand tracking…");
      try {
        await src.setMode(on ? "face" : "hand");
      } catch (e) {
        setStatus(`${(e as Error)?.message ?? e} Staying in ${cur === "head" ? "Head" : "Hand"} mode.`);
        return false;
      }
    }
    this.penUp("tile");
    this.live = null;
    this.modes[cur] = { gain: st.settings.gain, activeBox: st.settings.activeBox, calibration: st.calibration };
    const saved = this.modes[next] ?? { gain: on ? HEAD_GAIN_DEFAULT : 3, activeBox: null, calibration: null };
    this.updateSettings({ mode: next, gain: on ? Math.max(3, saved.gain) : saved.gain, activeBox: saved.activeBox });
    setState({ calibration: saved.calibration });
    this.engine?.reset(performance.now());
    this.breaks.reset();
    persistSetup();
    setStatus(
      on
        ? `Head mode on: move your nose to move the cursor (gain ${Math.max(3, saved.gain).toFixed(1)}×). Look at the middle of the screen and say “recenter” to set your neutral position.`
        : "Hand mode on.",
    );
    return true;
  }

  private finishHeadCalibration(c: CalibCapture, ui: CalibrationUI) {
    const st = getState();
    const prev = st.calibration;
    const n = c.restRaw.length || 1;
    const neutral = { x: c.restRaw.reduce((a, p) => a + p.x, 0) / n, y: c.restRaw.reduce((a, p) => a + p.y, 0) / n };
    const gain = Math.max(3, st.settings.gain || HEAD_GAIN_DEFAULT);
    const w = this.canvasSize.w / gain;
    const h = this.canvasSize.h / gain;
    const activeBox = ui.scope === "remeasure" && prev ? prev.activeBox : { x: neutral.x - w / 2, y: neutral.y - h / 2, w, h };
    const restJitterRms = ui.scope === "recenter" && prev ? prev.restJitterRms : detrendedRms(c.rest);
    const suggested = suggestSteadiness(restJitterRms, 0);
    const result: CalibrationResult = {
      restJitterRms,
      kineticResidualRms: 0,
      activeBox,
      gain,
      hand: "unknown",
      suggestedSteadiness: suggested,
      circleTooSmall: false,
      completedAt: Date.now(),
    };
    this.calib = null;
    this.updateSettings({ activeBox, gain, restJitterRms, dwellEnabled: st.settings.dwellEnabled });
    if (ui.scope !== "recenter") this.setSteadiness(suggested);
    this.engine?.reset(performance.now());
    setState({ calibration: result, phase: "ready", calib: null, previewCollapsed: true, pen: "HOVER" });
    persistSetup();
    setStatus(ui.scope === "recenter" ? "Neutral position set. Move your head gently to move the cursor." : `Head setup done: neutral position set, gain ${gain.toFixed(1)}×.`);
  }

  // ------------------------------------------------------------ face tap (§3 P3)

  private onJawOpenCheck(ok: boolean) {
    if (ok) return;
    const f = getState().face;
    console.warn("[Steady] jawOpen blendshape missing: face tap disabled");
    setState({ face: { ...f, jawOpenMissing: true, enabled: false, calibrating: null } });
    this.faceCal = null;
    if (f.enabled || f.calibrating !== null) setStatus("Face tap is unavailable: the face model gave no mouth signal on this computer.");
  }

  /** Turn face tap on (runs the short check first if needed) or off. */
  async setFaceTap(on: boolean): Promise<void> {
    const f = getState().face;
    if (!on) {
      this.faceCal = null;
      this.faceTap = null;
      setState({ face: { ...f, enabled: false, calibrating: null } });
      await this.faceSignals(false);
      setStatus("Face tap off.");
      return;
    }
    if (f.jawOpenMissing) {
      setStatus("Face tap is unavailable: the face model gave no mouth signal on this computer. Space, voice and dwell still work.");
      return;
    }
    if (!(await this.faceSignals(true))) return;
    if (f.calibration && f.calibration.signal === f.signal) {
      this.faceTap = createFaceTap(f.calibration);
      setState({ face: { ...f, enabled: true } });
      setStatus(f.signal === "jawOpen" ? "Face tap on: open and close your mouth once to toggle the pen." : "Face tap on: raise your eyebrows once to toggle the pen.");
      return;
    }
    this.faceCal = { samples: [], startT: null, lastUiT: 0 };
    setState({ face: { ...f, calibrating: 0 } });
    setStatus(f.signal === "jawOpen" ? "Face tap check: open your mouth comfortably twice." : "Face tap check: raise your eyebrows comfortably twice.");
  }

  cancelFaceCalibration() {
    if (!this.faceCal) return;
    this.faceCal = null;
    setState({ face: { ...getState().face, calibrating: null } });
    void this.faceSignals(false);
    setStatus("Face tap check cancelled.");
  }

  /** Hand mode needs the face model running alongside for blendshapes. */
  private async faceSignals(on: boolean): Promise<boolean> {
    const src = this.source as (LandmarkSource & { setFaceSignals?: (on: boolean) => Promise<void> }) | null;
    if (!src?.setFaceSignals) return true; // replay: blendshapes come from the fixture
    if (!on && getState().settings.mode === "head") return true;
    try {
      await src.setFaceSignals(on);
      return true;
    } catch (e) {
      setStatus(`${(e as Error)?.message ?? e} Face tap is off.`);
      return false;
    }
  }

  private trackFace(lf: LandmarkFrame) {
    const st = getState();
    const face = st.face;
    if (!this.faceCal && !face.enabled) return;
    const score = lf.blendshapes ? (lf.blendshapes[face.signal] ?? null) : null;
    const cal = this.faceCal;
    if (cal) {
      if (score === null) {
        if (lf.t - cal.lastUiT > 1000) {
          cal.lastUiT = lf.t;
          setStatus("Face tap check: I can't see your face yet. There's no rush.");
        }
        return;
      }
      cal.startT ??= lf.t;
      cal.samples.push({ t: lf.t, v: score });
      const progress = Math.min(1, (lf.t - cal.startT) / FACE_CAL_MS);
      if (progress < 1) {
        if (lf.t - cal.lastUiT > 200) {
          cal.lastUiT = lf.t;
          setState({ face: { ...face, calibrating: progress } });
        }
        return;
      }
      this.faceCal = null;
      const res = calibrateFaceTap(cal.samples);
      if (!res) {
        setState({ face: { ...face, calibrating: null, enabled: false } });
        void this.faceSignals(false);
        setStatus(
          face.signal === "jawOpen"
            ? "I couldn't see two clear mouth movements. Try Face tap again, or use the eyebrows option in Settings."
            : "I couldn't see two clear eyebrow raises. Try Face tap again, or use the mouth option in Settings.",
        );
        return;
      }
      const calibration = { signal: face.signal, open: res.open, close: res.close };
      this.faceTap = createFaceTap(calibration);
      setState({ face: { ...face, calibrating: null, enabled: true, calibration } });
      persistFace();
      setStatus(face.signal === "jawOpen" ? "Face tap ready: open and close your mouth once to toggle the pen." : "Face tap ready: raise your eyebrows once to toggle the pen.");
      return;
    }
    if (!face.enabled || !this.faceTap) return;
    // Suppressed while the mic is open and for 500 ms after (speaking moves the jaw).
    const suppressed =
      st.mic.open || performance.now() - micClosedAt < MIC_SUPPRESS_MS || st.paused || st.phase !== "ready" || !!st.dialog;
    if (this.faceTap.update(score, lf.t, suppressed)) this.onFaceTap?.();
  }

  // ------------------------------------------------------------ break reminders

  private trackBreaks(f: EngineFrame) {
    const st = getState();
    const active = f.tracking === "ok" && !st.paused && st.phase === "ready";
    if (this.breaks.tick(f.t, active, st.settings.mode) && st.breakReminders && !st.reminder) {
      const msg = breakMessage(st.settings.mode);
      setState({ reminder: msg });
      setStatus(msg);
    }
  }

  /** Face tap signal: mouth (jawOpen) or eyebrows (browInnerUp). Changing it needs a new check. */
  setFaceSignal(signal: FaceSignal): void {
    const f = getState().face;
    if (f.signal === signal) return;
    this.faceTap = null;
    setState({ face: { ...f, signal, enabled: false, calibration: f.calibration?.signal === signal ? f.calibration : null } });
    persistFace();
    setStatus(signal === "jawOpen" ? "Face tap will use opening the mouth. Turn Face tap on to check it." : "Face tap will use raising the eyebrows. Turn Face tap on to check it.");
  }

  /** Visible strokes for the renderer (hides strokes being erased). */
  isErasing(id: string): boolean {
    return !!this.erasing?.has(id);
  }
}

// ------------------------------------------------------------ helpers

export function lossMessage(r: TrackingLossReason | null): string {
  switch (r) {
    case "too-dark":
      return "Tracking lost: too dark. Turn on a lamp facing you. Pen is up.";
    case "low-fps":
      return "Tracking lost: the camera is too slow. Close other tabs or apps. Pen is up.";
    case "no-camera":
      return "Tracking lost: no camera. Check the camera connection. Pen is up.";
    case "paused":
      return "Tracking paused.";
    default:
      return "Tracking lost: no hand in view. Rest your hand where the camera can see it. Pen is up.";
  }
}

export function stageMessage(stage: "rest" | "circle"): string {
  if (getState().settings.mode === "head") return "Look at the middle of the screen and hold your head still.";
  return stage === "rest" ? "Rest your hand and hold still." : "Slowly draw a circle as big as feels easy.";
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Roughness: RMS distance of each point from the centred moving average of its
 * neighbours (±4 samples ≈ ±130 ms at 30 fps). Measures high-frequency jitter only;
 * slow intended movement contributes almost nothing. Shown for raw vs smoothed.
 */
export function roughness(pts: Vec2[], k = 4): number {
  if (pts.length < 2 * k + 1) return 0;
  const a: Vec2[] = [];
  const b: Vec2[] = [];
  for (let i = k; i < pts.length - k; i++) {
    let sx = 0;
    let sy = 0;
    for (let j = i - k; j <= i + k; j++) {
      sx += pts[j].x;
      sy += pts[j].y;
    }
    a.push(pts[i]);
    b.push({ x: sx / (2 * k + 1), y: sy / (2 * k + 1) });
  }
  return rmsDeviation(a, b);
}

function cssEscape(s: string) {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"');
}

function collectTiles() {
  const out: { id: string; rect: { x: number; y: number; w: number; h: number } }[] = [];
  document.querySelectorAll<HTMLElement>("[data-tile]").forEach((el) => {
    if (el.closest("[inert]") || (el as HTMLButtonElement).disabled) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    out.push({ id: el.dataset.tile!, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
  });
  return out;
}

export function persistSetup() {
  const s = getState();
  const prev = load<Record<string, unknown>>(KEYS.setup, {});
  save(KEYS.setup, {
    ...prev,
    calibration: s.calibration,
    settings: { ...s.settings, simulateTremor: false },
    posture: s.posture,
    modes: { ...runtime.modes, [s.settings.mode]: { gain: s.settings.gain, activeBox: s.settings.activeBox, calibration: s.calibration } },
    savedAt: Date.now(),
  });
}

/** Face tap thresholds + choice survive reloads (it stays off until turned on). */
export function persistFace() {
  const f = getState().face;
  const prefs = load<Record<string, unknown>>(KEYS.prefs, {});
  save(KEYS.prefs, { ...prefs, face: { calibration: f.calibration, signal: f.signal } });
}

export function inkContrastWarning(colour: keyof typeof COLOUR_HEX, bg: "light" | "dark", ratio: (a: string, b: string) => number) {
  const r = ratio(COLOUR_HEX[colour], BG_HEX[bg]);
  return r < 3 ? r : null;
}

export const BG_HEX = { light: "#fbfaf6", dark: "#1e2027" } as const;

export const runtime = new Runtime();

/** For dispatch: actions that the pen state machine handles directly. */
export type PenActionId = Extract<ActionId, "pen.toggle" | "latch.toggle" | "dot">;
