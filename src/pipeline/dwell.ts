/**
 * Dwell detectors (agent A). Pure: every call carries its own timestamp (ms).
 *
 * INK dwell (§3), evaluated on the One Euro output in canvas px (pre lazy brush):
 *  - Pen-down dwell (pen HOVER): "still" when every point of the last 250 ms lies within
 *    r_in of their centroid; the fill then runs from the start of that 250 ms window and is
 *    cancelled only if the point leaves r_out = 2 × r_in around the anchor (the centroid), so
 *    it never flickers at the r_in boundary. Fires after `penDownDwellMs` (default 800).
 *  - Pen-up dwell (pen DRAWING): tighter rule, no hysteresis: lifts only if the point stayed
 *    within r_in / 2 of where stillness began for the whole `penUpDwellMs` (default 1200).
 *    The ring (kind "pen-up") is reported only once stillness has lasted 250 ms, so slow
 *    drawing never shows a flickering ring. The fire carries `trimFromT` = start of stillness.
 *  - Arming: after any pen-down the pen-up dwell is armed only once the point has moved
 *    > r_in from the pen-down anchor. After any pen-up the next pen-down dwell is armed only
 *    after 600 ms AND (by default, see DECISIONS.md "[A] Pen-down re-arm also needs a move")
 *    once the point has moved > r_in from the pen-up anchor, so a resting hand toggles at most
 *    once in every scenario. Latch disables the pen-up dwell entirely.
 *  - Tracking loss (disarmUntilMoved): the pen-down dwell stays disarmed until the point has
 *    moved > r_in from the first re-acquired point, so flickery detection over a resting hand
 *    never pens down (DECISIONS.md "[A] No pen-down dwell after re-acquire until a move").
 *
 * TILE dwell: separate, see createTileDwell().
 */
import type { DwellState, PenState, PipelineSettings, Rect, TileDwellState, TileRect, Vec2 } from "./types";

/** r_in = max(15 px, lazyRadius / 2, 3 × rest-jitter RMS). */
export function rIn(s: PipelineSettings): number {
  return Math.max(15, s.lazyRadius / 2, 3 * (s.restJitterRms || 0));
}

/** Tile dwell radius: the "Hard to hold still" override, else r_in. */
export function tileRadius(s: PipelineSettings): number {
  return s.tileDwellRadius ?? rIn(s);
}

export const STILL_WINDOW_MS = 250;
export const PEN_DOWN_REARM_MS = 600;

export interface InkDwellConfig {
  rIn: number;
  penDownDwellMs: number;
  penUpDwellMs: number;
  latch: boolean;
}

export interface InkDwellInput {
  t: number;
  /** One Euro output, canvas px. */
  p: Vec2;
  pen: PenState;
  /** Rest zone / off canvas / dwell disabled: no toggling, fills cancel. */
  blocked: boolean;
}

export type InkDwellFire =
  | { type: "pen-down"; t: number; at: Vec2 }
  | { type: "pen-up"; t: number; trimFromT: number; at: Vec2 };

export interface InkDwell {
  update(input: InkDwellInput, cfg: InkDwellConfig): { state: DwellState; fire: InkDwellFire | null };
  /** Tell the detector the pen went down (any cause). `at` = pen-down anchor (canvas px, filtered). */
  notifyPenDown(at: Vec2, t: number): void;
  /** Tell the detector the pen went up (any cause). `at` = where it lifted (canvas px, filtered). */
  notifyPenUp(at: Vec2 | null, t: number): void;
  /** Drop partial fills and the stillness window (re-acquire, remap). Arming is kept. */
  clearWindow(t: number): void;
  /**
   * Tracking loss: disarm the pen-down dwell until the point has moved > r_in from the FIRST
   * point seen after this call (the re-acquired point). Explicit pen toggles are unaffected.
   */
  disarmUntilMoved(): void;
  /** True once the point moved > r_in from the last pen-down anchor (pen-up dwell arming, ignoring Latch). */
  readonly movedSincePenDown: boolean;
  /** Back to the initial state (pen-down armed). */
  reset(): void;
  readonly state: DwellState;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function createInkDwell(opts: { requireMoveAfterPenUp?: boolean } = {}): InkDwell {
  const requireMove = opts.requireMoveAfterPenUp ?? true;

  // pen-down side
  let buf: { x: number; y: number; t: number }[] = [];
  let windowStartT: number | null = null;
  let filling = false;
  let fillStartT = 0;
  let downAnchor: Vec2 | null = null;
  let armedDown = true;
  let penUpT = -Infinity;
  let penUpAnchor: Vec2 | null = null;
  let movedAway = true;
  /** Set by disarmUntilMoved(): the next HOVER point becomes the move-away anchor. */
  let anchorOnNext = false;

  // pen-up side
  let armedUp = false;
  let penDownAnchor: Vec2 | null = null;
  let still: Vec2 | null = null;
  let stillT = 0;

  let last: DwellState = { kind: null, progress: 0, anchor: null, armed: true };

  const clearDown = (t: number | null) => {
    buf = [];
    windowStartT = t;
    filling = false;
    downAnchor = null;
  };

  const api: InkDwell = {
    update(input, cfg) {
      const { t, p, pen, blocked } = input;
      const rOut = 2 * cfg.rIn;
      let fire: InkDwellFire | null = null;

      if (pen === "HOVER") {
        still = null;
        if (anchorOnNext) {
          anchorOnNext = false;
          penUpAnchor = { x: p.x, y: p.y };
          movedAway = false;
          armedDown = false;
        }
        // Re-arm after a pen-up: 600 ms and (optionally) a move away from where it lifted.
        if (!armedDown) {
          if (!movedAway && (!penUpAnchor || dist(p, penUpAnchor) > cfg.rIn)) movedAway = true;
          if (movedAway && t - penUpT >= PEN_DOWN_REARM_MS) {
            armedDown = true;
            clearDown(t);
          }
        }
        if (!armedDown || blocked) {
          clearDown(blocked ? null : windowStartT);
          last = { kind: null, progress: 0, anchor: null, armed: armedDown };
          return { state: last, fire };
        }
        if (windowStartT === null) windowStartT = t;
        buf.push({ x: p.x, y: p.y, t });
        while (buf.length && buf[0].t < t - STILL_WINDOW_MS) buf.shift();

        if (filling && downAnchor && dist(p, downAnchor) > rOut) {
          filling = false;
          downAnchor = null;
        }
        if (!filling && t - windowStartT >= STILL_WINDOW_MS && buf.length >= 2) {
          let cx = 0;
          let cy = 0;
          for (const q of buf) {
            cx += q.x;
            cy += q.y;
          }
          const c = { x: cx / buf.length, y: cy / buf.length };
          if (buf.every((q) => dist(q, c) <= cfg.rIn)) {
            filling = true;
            downAnchor = c;
            fillStartT = Math.max(windowStartT, t - STILL_WINDOW_MS);
          }
        }
        if (filling && downAnchor) {
          const progress = Math.min(1, (t - fillStartT) / cfg.penDownDwellMs);
          if (progress >= 1) {
            const at = { ...downAnchor };
            fire = { type: "pen-down", t, at };
            api.notifyPenDown(at, t);
            last = { kind: "pen-down", progress: 1, anchor: at, armed: false };
            return { state: last, fire };
          }
          last = { kind: "pen-down", progress, anchor: { ...downAnchor }, armed: true };
        } else {
          last = { kind: null, progress: 0, anchor: null, armed: true };
        }
        return { state: last, fire };
      }

      // pen === "DRAWING"
      clearDown(null);
      if (!armedUp && (!penDownAnchor || dist(p, penDownAnchor) > cfg.rIn)) armedUp = true;
      const armed = armedUp && !cfg.latch;
      if (!armed || blocked) {
        still = null;
        last = { kind: null, progress: 0, anchor: null, armed };
        return { state: last, fire };
      }
      if (!still || dist(p, still) > cfg.rIn / 2) {
        still = { x: p.x, y: p.y };
        stillT = t;
      }
      const held = t - stillT;
      if (held >= cfg.penUpDwellMs) {
        const at = { ...still };
        fire = { type: "pen-up", t, trimFromT: stillT, at };
        api.notifyPenUp(at, t);
        last = { kind: "pen-up", progress: 1, anchor: at, armed: false };
        return { state: last, fire };
      }
      last =
        held >= STILL_WINDOW_MS
          ? { kind: "pen-up", progress: held / cfg.penUpDwellMs, anchor: { ...still }, armed }
          : { kind: null, progress: 0, anchor: null, armed };
      return { state: last, fire };
    },

    notifyPenDown(at, _t) {
      void _t;
      anchorOnNext = false;
      penDownAnchor = { ...at };
      armedUp = false;
      still = null;
      clearDown(null);
    },

    notifyPenUp(at, t) {
      anchorOnNext = false;
      penUpT = t;
      penUpAnchor = at ? { ...at } : null;
      armedDown = false;
      movedAway = !requireMove || !at;
      still = null;
      clearDown(null);
    },

    clearWindow(t) {
      clearDown(t);
      still = null;
    },

    disarmUntilMoved() {
      armedDown = false;
      movedAway = false;
      anchorOnNext = true;
      clearDown(null);
    },

    reset() {
      clearDown(null);
      armedDown = true;
      penUpT = -Infinity;
      penUpAnchor = null;
      movedAway = true;
      anchorOnNext = false;
      armedUp = false;
      penDownAnchor = null;
      still = null;
      last = { kind: null, progress: 0, anchor: null, armed: true };
    },

    get state() {
      return last;
    },

    get movedSincePenDown() {
      return armedUp;
    },
  };
  return api;
}

// ---------------------------------------------------------------- tile dwell

/** Distance from a point to a rect (0 inside). */
export function distToRect(p: Vec2, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Tile under the pointer; else (snap-to-target) the nearest tile within `snapPx` of its edge. */
export function hitTile(p: Vec2, tiles: TileRect[], snapPx: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const tile of tiles) {
    const d = distToRect(p, tile.rect);
    if (d === 0) return tile.id;
    if (snapPx > 0 && d <= snapPx && d < bestD) {
      best = tile.id;
      bestD = d;
    }
  }
  return best;
}

export interface TileDwell {
  update(pointer: Vec2 | null, tiles: TileRect[], t: number, opts: { radius: number; dwellMs: number; snapPx: number }): TileDwellState;
  reset(): void;
}

/**
 * Tile dwell: hovering one tile (or within snapPx of it) for `dwellMs` fires it once.
 * The fill starts where hovering began and is cancelled when the pointer leaves the tile or
 * moves more than 2 × radius from that anchor (same r_in / r_out hysteresis as ink dwell;
 * radius = tileDwellRadius override or r_in). After firing, the same tile can fire again only
 * after the pointer has left it (no auto-repeat).
 */
export function createTileDwell(): TileDwell {
  let hovered: string | null = null;
  let anchor: Vec2 | null = null;
  let startT = 0;
  let spent = false;
  return {
    update(pointer, tiles, t, opts) {
      if (!pointer) {
        hovered = null;
        anchor = null;
        spent = false;
        return { hoveredId: null, progress: 0, firedId: null };
      }
      const id = hitTile(pointer, tiles, opts.snapPx);
      if (id !== hovered) {
        hovered = id;
        anchor = id ? { ...pointer } : null;
        startT = t;
        spent = false;
      }
      if (!hovered || !anchor) return { hoveredId: null, progress: 0, firedId: null };
      if (spent) return { hoveredId: hovered, progress: 0, firedId: null };
      if (dist(pointer, anchor) > 2 * opts.radius) {
        anchor = { ...pointer };
        startT = t;
      }
      const progress = opts.dwellMs > 0 ? Math.min(1, (t - startT) / opts.dwellMs) : 1;
      if (progress >= 1) {
        spent = true;
        return { hoveredId: hovered, progress: 1, firedId: hovered };
      }
      return { hoveredId: hovered, progress, firedId: null };
    },
    reset() {
      hovered = null;
      anchor = null;
      spent = false;
    },
  };
}
