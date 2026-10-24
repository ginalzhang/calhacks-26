/**
 * PointerEngine (agent A): the whole §2/§3 pointer pipeline + pen state machine, pure.
 *
 *   camera px (mirrored) ─▶ [simulated tremor, demo] ─▶ One Euro (per axis, camera px)
 *     ─▶ active-box map (canvas px) = `filtered` ─▶ ink dwell reads here
 *     ─▶ lazy brush (radius = lazyRadius, friction 0) = `pointer` (visible cursor, what ink records)
 *
 * PEN STATE: `pen` is the LOGICAL pen (HOVER / DRAWING). Toggled by dwell (both §3 rules +
 * arming, see dwell.ts), explicitly by togglePen()/setPen() (Space / voice / typed / tile /
 * face; no cooldown), lifted by tracking loss, Latch disables the pen-up dwell.
 *
 * STROKES vs PEN (how the UI should record ink):
 *  - Every `pen-down` event STARTS a stroke at `event.at`; every `pen-up` event ENDS the open
 *    stroke (drop points with t >= trimFromT when present). A pen-up with no open stroke is a
 *    no-op for the recorder (e.g. an explicit pen-up after the pointer already left the canvas).
 *  - While a stroke is open, append `frame.pointer` when `frame.inking` is true.
 *  - `frame.inking` = pen DRAWING && tracking ok && pointer over the canvas (input.overCanvas).
 *
 * CANVAS EXIT (§3 Latch rule, applies with or without Latch): when the pointer leaves the
 * canvas with the pen logically down, the engine emits `pen-up` cause "left-canvas" (trimFromT
 * = the frame it left, so no off-canvas point is kept) but `pen` STAYS "DRAWING". When the
 * pointer re-enters with the pen still down, it emits `pen-down` cause "left-canvas" at the
 * re-entry pointer: a new stroke, no connecting line. The pen-up dwell re-arms relative to
 * the re-entry point. Dwell never toggles while off canvas or in a rest zone.
 * An explicit pen-down while not inkable (off canvas / tracking lost) still returns its
 * pen-down event (contract), then the next frame closes it with trimFromT = that pen-down
 * time (an empty stroke: finalizeStroke returns null), and ink resumes with a pen-down
 * carrying the original cause once the pointer is inkable.
 *
 * TRACKING LOSS (design rule 10): no camera point for > 300 ms (null frames, or a stall with
 * no frames at all) → `tracking: "lost"`, `pen-up` cause "tracking-lost" (even under Latch),
 * pen HOVER, pointer frozen at its last value. lossReason: "too-dark" when the last reported
 * luma < 40, else "low-fps" when detection fps < 25, else "no-hand". On re-acquire the filters
 * and lazy brush restart at the new point (`frame.reacquired` is true for that frame) and the
 * pen stays up until an explicit pen-down: Space / voice / typed / tile / face work at once;
 * the pen-down DWELL is disarmed until the pointer has moved > r_in from the first re-acquired
 * point (so flickery detection over a resting hand never inks). A tracking-lost pen-up on a
 * stroke that never moved > r_in carries trimFromT = its start (no dot left behind).
 * Gaps ≤ 300 ms freeze the pointer without lifting the pen.
 *
 * Extra frame fields beyond PointerFrame (see EngineFrame): inking, reacquired, quality, box.
 */
import { effectiveBox, mapToCanvas } from "./activeBox";
import { createInkDwell, rIn } from "./dwell";
import { createLazyBrush } from "./lazyBrush";
import { createOneEuro2D } from "./oneEuro";
import { steadinessToParams } from "./steadiness";
import { createTremorSimulator } from "./tremor";
import type {
  DwellState,
  PenCause,
  PenEvent,
  PenState,
  PipelineSettings,
  PointerEngine,
  PointerFrame,
  PointerInput,
  Rect,
  Size,
  TrackingLossReason,
  Vec2,
} from "./types";

export const TRACKING_LOST_MS = 300;
export const TOO_DARK_LUMA = 40;
export const LOW_FPS = 25;

export interface EngineFrame extends PointerFrame {
  /** A stroke is open and the pointer is inkable: append `pointer` to the open stroke. */
  inking: boolean;
  /** Tracking came back on this frame (status: "Tracking back. Pen is up."). */
  reacquired: boolean;
  /** Tracking-quality warning while tracking is ok (lighting / fps), else null. */
  quality: TrackingLossReason | null;
  /** Active box actually used, camera px. */
  box: Rect;
}

export interface Engine extends PointerEngine {
  process(input: PointerInput): EngineFrame;
  /** Reset filters + dwell. Pen goes up; the pen-up event is delivered in the next frame's events. */
  reset(t: number, cause?: PenCause): void;
  setVideoSize(size: Size): void;
  /** True while a stroke is open (pen down and inkable at the last frame or toggle). */
  readonly strokeOpen: boolean;
}

export function createPointerEngine(settings: PipelineSettings, canvas: Size, video: Size, opts: { tremorSeed?: number } = {}): Engine {
  let s: PipelineSettings = { ...settings, filter: { ...settings.filter } };
  let canvasSize = { ...canvas };
  let videoSize = { ...video };

  const euro = createOneEuro2D(s.filter);
  const lazy = createLazyBrush(s.lazyRadius);
  const dwell = createInkDwell();
  const tremor = createTremorSimulator(opts.tremorSeed ?? 1);

  let pen: PenState = "HOVER";
  let strokeOpen = false;
  let strokeOpenedT = 0;
  let openedUninkable = false;
  let reopenCause: PenCause = "left-canvas";

  let firstT: number | null = null;
  let lastSeenT: number | null = null;
  let lost = false;
  let lastLuma: number | null = null;
  let lastFps: number | null = null;
  let lastOverCanvas = true;
  let needsRemap = false;

  let rawCamera: Vec2 | null = null;
  let filteredCamera: Vec2 | null = null;
  let rawCanvas: Vec2 | null = null;
  let filtered: Vec2 | null = null;
  let pointer: Vec2 | null = null;
  let dwellState: DwellState = { kind: null, progress: 0, anchor: null, armed: true };

  const pending: PenEvent[] = [];

  const box = () => effectiveBox(s.activeBox, videoSize, canvasSize, s.gain);
  const cfg = () => ({ rIn: rIn(s), penDownDwellMs: s.penDownDwellMs, penUpDwellMs: s.penUpDwellMs, latch: s.latch });

  const lossReason = (): TrackingLossReason => {
    if (lastLuma !== null && lastLuma < TOO_DARK_LUMA) return "too-dark";
    if (lastFps !== null && lastFps < LOW_FPS) return "low-fps";
    return "no-hand";
  };
  const quality = (): TrackingLossReason | null => {
    if (lastLuma !== null && lastLuma < TOO_DARK_LUMA) return "too-dark";
    if (lastFps !== null && lastFps < LOW_FPS) return "low-fps";
    return null;
  };

  const goLost = (t: number, events: PenEvent[]) => {
    lost = true;
    if (pen === "DRAWING") {
      // A stroke that never moved > r_in since its pen-down (a resting hand) is dropped
      // entirely (trimFromT = its start) so tracking flicker never leaves a dot.
      const trim = strokeOpen && !dwell.movedSincePenDown ? { trimFromT: strokeOpenedT } : {};
      pen = "HOVER";
      strokeOpen = false;
      events.push({ type: "pen-up", t, cause: "tracking-lost", ...trim });
      dwell.notifyPenUp(filtered, t);
    }
    // Whatever the pen state: no pen-down dwell after re-acquire until a deliberate move
    // (> r_in from the first re-acquired point). Explicit toggles still work immediately.
    dwell.disarmUntilMoved();
    dwellState = { kind: null, progress: 0, anchor: null, armed: dwell.state.armed };
  };

  const engine: Engine = {
    process(input: PointerInput): EngineFrame {
      const t = input.t;
      const events: PenEvent[] = pending.splice(0, pending.length);
      if (input.luma != null) lastLuma = input.luma;
      if (input.detectionFps != null) lastFps = input.detectionFps;
      if (firstT === null) firstT = t;
      const overCanvas = input.overCanvas !== false;
      lastOverCanvas = overCanvas;
      let reacquired = false;
      const cam = input.camera;
      const usedBox = box();

      if (!cam) {
        const since = t - (lastSeenT ?? firstT);
        if (!lost && since > TRACKING_LOST_MS) goLost(t, events);
        rawCamera = null;
      } else {
        if (!lost && lastSeenT !== null && t - lastSeenT > TRACKING_LOST_MS) goLost(t, events); // stall
        if (lost) {
          lost = false;
          reacquired = true;
          euro.reset();
          tremor.reset();
          dwell.clearWindow(t);
        }
        lastSeenT = t;
        const raw = s.simulateTremor ? tremor.apply(cam, t) : { x: cam.x, y: cam.y };
        const fc = euro.filter(raw, t);
        rawCamera = raw;
        filteredCamera = fc;
        rawCanvas = mapToCanvas(raw, usedBox, canvasSize);
        filtered = mapToCanvas(fc, usedBox, canvasSize);
        if (needsRemap || reacquired || !pointer) {
          lazy.reset(filtered);
          if (needsRemap) dwell.clearWindow(t);
          needsRemap = false;
        }

        const blocked = !s.dwellEnabled || !!input.inRestZone || !overCanvas;
        const r = dwell.update({ t, p: filtered, pen, blocked }, cfg());
        dwellState = r.state;
        if (r.fire?.type === "pen-down") {
          pen = "DRAWING";
          lazy.reset(r.fire.at);
          strokeOpen = true;
          strokeOpenedT = t;
          openedUninkable = false;
          events.push({ type: "pen-down", t, at: { ...r.fire.at }, cause: "dwell" });
        } else if (r.fire?.type === "pen-up") {
          pen = "HOVER";
          strokeOpen = false;
          events.push({ type: "pen-up", t, cause: "dwell", trimFromT: r.fire.trimFromT });
        }
        pointer = lazy.update(filtered);
      }

      // Ink boundaries while the pen is logically down (canvas exit / re-entry, loss during toggle).
      const inkable = !lost && overCanvas && pointer !== null;
      if (pen === "DRAWING") {
        if (strokeOpen && !inkable) {
          events.push({ type: "pen-up", t, cause: "left-canvas", trimFromT: openedUninkable ? strokeOpenedT : t });
          strokeOpen = false;
          if (!openedUninkable) reopenCause = "left-canvas";
        } else if (!strokeOpen && inkable && pointer) {
          events.push({ type: "pen-down", t, at: { ...pointer }, cause: reopenCause });
          strokeOpen = true;
          strokeOpenedT = t;
          openedUninkable = false;
          reopenCause = "left-canvas";
          dwell.notifyPenDown(filtered ?? pointer, t);
        }
      }

      return {
        t,
        tracking: lost ? "lost" : "ok",
        lossReason: lost ? lossReason() : null,
        rawCamera: rawCamera ? { ...rawCamera } : null,
        filteredCamera: filteredCamera ? { ...filteredCamera } : null,
        rawCanvas: rawCanvas ? { ...rawCanvas } : null,
        filtered: filtered ? { ...filtered } : null,
        pointer: pointer ? { ...pointer } : null,
        pen,
        dwell: lost ? { kind: null, progress: 0, anchor: null, armed: dwellState.armed } : dwellState,
        events,
        inking: pen === "DRAWING" && strokeOpen && inkable,
        reacquired,
        quality: lost ? null : quality(),
        box: usedBox,
      };
    },

    togglePen(t: number, cause: PenCause): PenEvent {
      return engine.setPen(pen === "HOVER" ? "DRAWING" : "HOVER", t, cause) as PenEvent;
    },

    setPen(state: PenState, t: number, cause: PenCause): PenEvent | null {
      if (state === pen) return null;
      if (state === "DRAWING") {
        pen = "DRAWING";
        const at = pointer ? { ...pointer } : { x: canvasSize.w / 2, y: canvasSize.h / 2 };
        dwell.notifyPenDown(filtered ?? at, t);
        const inkable = !lost && lastOverCanvas && pointer !== null;
        strokeOpen = true;
        strokeOpenedT = t;
        openedUninkable = !inkable;
        reopenCause = cause;
        return { type: "pen-down", t, at, cause };
      }
      pen = "HOVER";
      strokeOpen = false;
      dwell.notifyPenUp(filtered, t);
      return { type: "pen-up", t, cause };
    },

    updateSettings(patch: Partial<PipelineSettings>) {
      const next: PipelineSettings = { ...s, ...patch, filter: { ...(patch.filter ?? s.filter) } };
      if (patch.steadiness !== undefined && patch.filter === undefined && patch.lazyRadius === undefined) {
        const p = steadinessToParams(patch.steadiness);
        next.filter = { ...next.filter, minCutoff: p.minCutoff };
        next.lazyRadius = p.lazyRadius;
      }
      const f0 = s.filter;
      const f1 = next.filter;
      if (f0.minCutoff !== f1.minCutoff || f0.beta !== f1.beta || f0.dCutoff !== f1.dCutoff) euro.setParams(f1);
      if (next.lazyRadius !== s.lazyRadius) lazy.setRadius(next.lazyRadius);
      if (next.gain !== s.gain || next.activeBox !== s.activeBox) needsRemap = true;
      if (next.mode !== s.mode || next.pointerLandmark !== s.pointerLandmark) {
        euro.reset();
        needsRemap = true;
      }
      if (next.simulateTremor !== s.simulateTremor) tremor.reset();
      s = next;
    },

    getSettings(): PipelineSettings {
      return { ...s, filter: { ...s.filter } };
    },

    setCanvasSize(size: Size) {
      if (size.w === canvasSize.w && size.h === canvasSize.h) return;
      canvasSize = { ...size };
      needsRemap = true;
    },

    setVideoSize(size: Size) {
      if (size.w === videoSize.w && size.h === videoSize.h) return;
      videoSize = { ...size };
      needsRemap = true;
    },

    reset(t: number, cause: PenCause = "key") {
      euro.reset();
      lazy.reset();
      dwell.reset();
      tremor.reset();
      pointer = null;
      if (pen === "DRAWING") pending.push({ type: "pen-up", t, cause });
      pen = "HOVER";
      strokeOpen = false;
      dwellState = { kind: null, progress: 0, anchor: null, armed: true };
    },

    get pen() {
      return pen;
    },

    get strokeOpen() {
      return strokeOpen;
    },
  };
  return engine;
}
