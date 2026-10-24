/**
 * Desktop mode (§6a) pure mapping. No DOM, no WebSocket, no React.
 *
 * Coordinate spaces:
 *  - "engine px": the PointerEngine's canvas px. In Desktop mode agent B sets the engine canvas
 *    size to the drawing area's size, so engine px are drawing-area-relative screen points
 *    (0..area.w × 0..area.h inside the area; negative / larger values are outside it, the
 *    engine does not clamp).
 *  - "screen points": macOS main-display points, top-left origin (what the helper moves to).
 */
import type { PenState, Rect, Size, TrackingState, Vec2 } from "@/pipeline/types";

/** Smallest drawing area accepted from the corner setup (screen points per side). */
export const MIN_AREA_PT = 40;

/**
 * Engine px (drawing-area-relative) → screen points. `engine` is the engine canvas size when it
 * differs from the area size (then the point is scaled); omit it when they match (the contract).
 */
export function areaPoint(p: Vec2, area: Rect, engine?: Size): Vec2 {
  const sx = engine && engine.w > 0 ? area.w / engine.w : 1;
  const sy = engine && engine.h > 0 ? area.h / engine.h : 1;
  return { x: area.x + p.x * sx, y: area.y + p.y * sy };
}

/** Screen points → engine px (inverse of areaPoint without scaling). */
export function screenToArea(p: Vec2, area: Rect): Vec2 {
  return { x: p.x - area.x, y: p.y - area.y };
}

/** Is an engine-px point inside the drawing area (edges count as inside)? */
export function insideArea(p: Vec2, area: Size): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= area.w && p.y <= area.h;
}

/** What a dwell does in Desktop mode: inside the area it toggles the pen, outside it clicks. */
export function desktopDwellAction(inside: boolean): "pen-toggle" | "click" {
  return inside ? "pen-toggle" : "click";
}

export function clampToRect(p: Vec2, r: Rect): Vec2 {
  return { x: Math.min(Math.max(p.x, r.x), r.x + r.w), y: Math.min(Math.max(p.y, r.y), r.y + r.h) };
}

/** Clamp to the main display (0..w-1 × 0..h-1). */
export function clampToScreen(p: Vec2, screen: Size): Vec2 {
  return { x: Math.min(Math.max(p.x, 0), Math.max(0, screen.w - 1)), y: Math.min(Math.max(p.y, 0), Math.max(0, screen.h - 1)) };
}

export function fullScreenArea(screen: Size): Rect {
  return { x: 0, y: 0, w: screen.w, h: screen.h };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Rectangle from the two setup corners (any order), clamped to the screen; null if too small. */
export function areaFromCorners(a: Vec2, b: Vec2, screen: Size | null): Rect | null {
  if (![a.x, a.y, b.x, b.y].every(finite)) return null;
  let x0 = Math.min(a.x, b.x);
  let y0 = Math.min(a.y, b.y);
  let x1 = Math.max(a.x, b.x);
  let y1 = Math.max(a.y, b.y);
  if (screen) {
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(screen.w, x1);
    y1 = Math.min(screen.h, y1);
  }
  const r = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  return r.w >= MIN_AREA_PT && r.h >= MIN_AREA_PT ? r : null;
}

/** Validate a persisted / user-supplied area against the screen. null = invalid (use default). */
export function sanitizeArea(r: unknown, screen: Size | null): Rect | null {
  if (!r || typeof r !== "object") return null;
  const { x, y, w, h } = r as Record<string, unknown>;
  if (![x, y, w, h].every(finite)) return null;
  return areaFromCorners({ x: x as number, y: y as number }, { x: (x as number) + (w as number), y: (y as number) + (h as number) }, screen);
}

export interface HoldInput {
  /** Socket open and hello received. */
  connected: boolean;
  tracking: TrackingState;
  pen: PenState;
  /** Engine's own "append ink now" flag (pen down AND over the canvas AND tracking ok), if provided. */
  inking?: boolean;
  /** Pointer inside the drawing area (engine px). */
  inside: boolean;
  paused: boolean;
  /** Corner setup running: the button is never held. */
  settingUp: boolean;
}

/**
 * Should the real mouse button be held this frame? Pen-down is only possible inside the
 * drawing area, never while tracking is lost / paused / setting up / disconnected.
 */
export function shouldHoldButton(s: HoldInput): boolean {
  if (!s.connected || s.paused || s.settingUp) return false;
  if (s.tracking !== "ok" || s.pen !== "DRAWING" || !s.inside) return false;
  return s.inking ?? true;
}

/** Where to put the real pointer: screen-clamped, and area-clamped while the button is held. */
export function screenTarget(pointer: Vec2, area: Rect, screen: Size, holding: boolean, engine?: Size): Vec2 {
  let p = areaPoint(pointer, area, engine);
  if (holding) p = clampToRect(p, area);
  return clampToScreen(p, screen);
}

/** Skip sub-pixel moves (sub-point jitter is invisible and only costs messages). */
export function movedEnough(a: Vec2 | null, b: Vec2, eps = 0.25): boolean {
  return !a || Math.abs(a.x - b.x) >= eps || Math.abs(a.y - b.y) >= eps;
}
