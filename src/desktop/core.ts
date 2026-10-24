/**
 * Desktop mode controller core (§6a). Pure and deterministic: every call carries its own
 * timestamp (ms), no DOM / WebSocket / timers. bridge.ts owns the socket and feeds this.
 *
 * Per engine frame it decides which helper messages to send:
 *  - the button is held only while shouldHoldButton() (pen DRAWING + inking + inside the
 *    drawing area + tracking ok + not paused / setting up); otherwise `up` is sent first;
 *  - `move` to the pointer (screen-clamped; area-clamped while held), one per frame at most,
 *    skipped when it moved < 0.25 pt;
 *  - dwell-click OUTSIDE the drawing area (pen up, dwell-click on): A's ink-dwell detector
 *    (createInkDwell) with its arming rules, so a resting hand clicks once and must move
 *    away (> r_in) and wait 600 ms before the next click;
 *  - drawing-area setup: the same detector, anywhere on screen, captures the top-left and
 *    bottom-right corners (or markCorner() from F8 / pen toggle).
 *  - watchdog (tick): no frame for 300 ms while held → `up` (rVFC stalled, pause, hidden tab).
 */
import { createInkDwell, type InkDwell } from "@/pipeline/dwell";
import type { PenEvent, PointerFrame, Rect, Size, Vec2 } from "@/pipeline/types";
import {
  areaFromCorners,
  areaPoint,
  clampToScreen,
  fullScreenArea,
  insideArea,
  movedEnough,
  screenTarget,
  shouldHoldButton,
} from "./mapping";

export type OutMsg =
  | { t: "move"; x: number; y: number }
  | { t: "down" }
  | { t: "up" }
  | { t: "click" }
  | { t: "ping" }
  | { t: "keys"; combo: string; app?: string }
  | { t: "config"; area?: Rect | null; hotkeys?: { pen?: string; pause?: string } };

export type SetupStage = "top-left" | "bottom-right";

export interface CoreConfig {
  /** Dwell radius (engine px = screen points): r_in or the tile-radius override. */
  rIn: number;
  /** Dwell time for clicks / corners, ms. */
  dwellMs: number;
  /** Dwell input switched on (WCAG 2.5.4 input toggles). */
  dwellEnabled: boolean;
  paused: boolean;
}

export interface StepResult {
  msgs: OutMsg[];
  /** Pointer inside the drawing area this frame. */
  inside: boolean;
  /** 0..1 fill of the click / corner dwell (for the panel's progress bar). */
  progress: number;
  /** Set when a dwell-click fired (screen points). */
  clicked: Vec2 | null;
  /** Set when a setup corner was captured. */
  corner: { stage: SetupStage; at: Vec2 } | null;
  /** Set when setup finished with a valid area. */
  areaDone: Rect | null;
  /** Set when setup's two corners made an invalid (too small) area; setup restarts. */
  areaRejected: boolean;
}

export const WATCHDOG_MS = 300;
export const MIN_MOVE_INTERVAL_MS = 8;

export interface DesktopCore {
  /** Drawing area in screen points (the full screen while setting up). */
  readonly area: Rect;
  /** The user's saved area (ignores setup). */
  readonly savedArea: Rect;
  readonly screen: Size | null;
  readonly buttonDown: boolean;
  readonly setupStage: SetupStage | null;
  readonly dwellClick: boolean;
  readonly connected: boolean;
  /** Last pointer seen (engine px), null while tracking is lost. */
  readonly lastPointer: Vec2 | null;
  setScreen(s: Size | null): void;
  /** null = whole screen. */
  setArea(r: Rect | null): void;
  setEngineSize(s: Size | null): void;
  setDwellClick(on: boolean): void;
  setConnected(on: boolean): void;
  /** Helper's authoritative button state ({"t":"state"}). */
  onHelperState(down: boolean): void;
  isInside(p: Vec2 | null): boolean;
  /** `t` = frame time (dwell timing); `wallT` = arrival time on the tick() clock (watchdog), default t. */
  step(frame: PointerFrame, cfg: CoreConfig, t: number, wallT?: number): StepResult;
  penEvent(ev: PenEvent): OutMsg[];
  /** Watchdog; call every ~100 ms. Returns `up` if frames stopped while held. */
  tick(t: number): OutMsg[];
  /** Release now (pause, page hide, disable). */
  release(): OutMsg[];
  startSetup(): void;
  cancelSetup(): void;
  /** Explicit corner mark (F8 / pen toggle) at the last pointer. */
  markCorner(t: number): StepResult;
}

const NO_STEP = (): StepResult => ({ msgs: [], inside: false, progress: 0, clicked: null, corner: null, areaDone: null, areaRejected: false });

export function createDesktopCore(init: { screen?: Size | null; area?: Rect | null; dwellClick?: boolean } = {}): DesktopCore {
  let screen: Size | null = init.screen ?? null;
  let saved: Rect | null = init.area ?? null;
  let engineSize: Size | null = null;
  let dwellClick = init.dwellClick ?? true;
  let connected = false;
  let down = false;
  let lastSent: Vec2 | null = null;
  let lastMoveT = -Infinity;
  let lastFrameT = -Infinity;
  let lastPointer: Vec2 | null = null;
  let wasLost = false;
  /** After setup / (re)connect: never press until the engine pen has been seen up once. */
  let needPenUp = false;
  let stage: SetupStage | null = null;
  let firstCorner: Vec2 | null = null;
  const clickDwell: InkDwell = createInkDwell();
  const setupDwell: InkDwell = createInkDwell();

  const fallbackScreen = (): Size => screen ?? { w: 1440, h: 900 };
  const savedArea = (): Rect => saved ?? fullScreenArea(fallbackScreen());
  const area = (): Rect => (stage ? fullScreenArea(fallbackScreen()) : savedArea());
  const engineDims = (): Size => engineSize ?? { w: area().w, h: area().h };
  const scaled = (): Size | undefined => (engineSize ? engineSize : undefined);
  const inside = (p: Vec2 | null): boolean => !!p && !stage && insideArea(p, engineDims());
  const toScreen = (p: Vec2): Vec2 => clampToScreen(areaPoint(p, area(), scaled()), fallbackScreen());

  const up = (): OutMsg[] => {
    if (!down) return [];
    down = false;
    return [{ t: "up" }];
  };

  const captureCorner = (at: Vec2, res: StepResult): void => {
    if (!stage) return;
    if (stage === "top-left") {
      firstCorner = at;
      stage = "bottom-right";
      res.corner = { stage: "top-left", at };
      return;
    }
    res.corner = { stage: "bottom-right", at };
    const r = firstCorner ? areaFromCorners(firstCorner, at, screen) : null;
    if (r) {
      saved = r;
      stage = null;
      needPenUp = true;
      firstCorner = null;
      res.areaDone = r;
      lastSent = null;
    } else {
      res.areaRejected = true;
      stage = "top-left";
      firstCorner = null;
    }
  };

  const api: DesktopCore = {
    get area() {
      return area();
    },
    get savedArea() {
      return savedArea();
    },
    get screen() {
      return screen;
    },
    get buttonDown() {
      return down;
    },
    get setupStage() {
      return stage;
    },
    get dwellClick() {
      return dwellClick;
    },
    get connected() {
      return connected;
    },
    get lastPointer() {
      return lastPointer;
    },
    setScreen(s) {
      screen = s;
    },
    setArea(r) {
      saved = r;
      lastSent = null;
    },
    setEngineSize(s) {
      engineSize = s;
    },
    setDwellClick(on) {
      dwellClick = on;
      if (!on) clickDwell.clearWindow(0);
    },
    setConnected(on) {
      connected = on;
      needPenUp = true;
      if (!on) {
        down = false;
        lastSent = null;
      }
    },
    onHelperState(d) {
      down = d;
    },
    isInside: inside,

    step(frame, cfg, t, wallT) {
      const res = NO_STEP();
      lastFrameT = wallT ?? t;
      if (frame.pen === "HOVER") needPenUp = false;
      const ok = frame.tracking === "ok" && !!frame.pointer;
      const p = ok ? frame.pointer : null;
      lastPointer = p;
      res.inside = inside(p);

      if (!ok) {
        if (!wasLost) {
          clickDwell.disarmUntilMoved();
          setupDwell.disarmUntilMoved();
        }
        wasLost = true;
        res.msgs.push(...up());
        return res;
      }
      wasLost = false;

      const want = shouldHoldButton({
        connected,
        tracking: frame.tracking,
        pen: frame.pen,
        inking: frame.inking,
        inside: res.inside,
        paused: cfg.paused,
        settingUp: !!stage,
      }) && !needPenUp;
      if (down && !want) res.msgs.push(...up());
      if (!connected || cfg.paused) return res;

      // move (one per frame, sub-point moves skipped)
      const target = screenTarget(p!, area(), fallbackScreen(), want, scaled());
      const mustMove = want && !down;
      if (mustMove || (t - lastMoveT >= MIN_MOVE_INTERVAL_MS && movedEnough(lastSent, target))) {
        res.msgs.push({ t: "move", x: Math.round(target.x * 10) / 10, y: Math.round(target.y * 10) / 10 });
        lastSent = target;
        lastMoveT = t;
      }
      if (want && !down) {
        down = true;
        res.msgs.push({ t: "down" });
      }

      // dwell: corner setup anywhere, else dwell-click outside the area
      const dp = frame.filtered ?? p!;
      const dcfg = { rIn: cfg.rIn, penDownDwellMs: cfg.dwellMs, penUpDwellMs: cfg.dwellMs, latch: true };
      if (stage) {
        const r = setupDwell.update({ t, p: dp, pen: "HOVER", blocked: !cfg.dwellEnabled }, dcfg);
        res.progress = r.state.kind === "pen-down" ? r.state.progress : 0;
        if (r.fire) {
          setupDwell.notifyPenUp(r.fire.at, t);
          captureCorner(target, res);
        }
      } else {
        const blocked = !dwellClick || !cfg.dwellEnabled || res.inside || frame.pen !== "HOVER";
        const r = clickDwell.update({ t, p: dp, pen: "HOVER", blocked }, dcfg);
        res.progress = r.state.kind === "pen-down" ? r.state.progress : 0;
        if (r.fire) {
          clickDwell.notifyPenUp(r.fire.at, t);
          res.msgs.push(...up(), { t: "click" });
          res.clicked = target;
        }
      }
      return res;
    },

    penEvent(ev) {
      // Lift immediately on any pen-up (explicit, dwell, tracking loss, leaving the area);
      // pen-downs are applied on the next frame by step() (only inside the area).
      return ev.type === "pen-up" ? up() : [];
    },

    tick(t) {
      const out: OutMsg[] = [];
      if (down && t - lastFrameT > WATCHDOG_MS) out.push(...up());
      if (connected) out.push({ t: "ping" });
      return out;
    },

    release: up,

    startSetup() {
      stage = "top-left";
      firstCorner = null;
      setupDwell.reset();
      setupDwell.disarmUntilMoved();
      lastSent = null;
    },

    cancelSetup() {
      if (stage) needPenUp = true;
      stage = null;
      firstCorner = null;
      lastSent = null;
    },

    markCorner(t) {
      void t;
      const res = NO_STEP();
      if (!stage || !lastPointer) return res;
      res.msgs.push(...up());
      captureCorner(toScreen(lastPointer), res);
      return res;
    },
  };
  return api;
}
