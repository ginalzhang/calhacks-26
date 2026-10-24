/**
 * View transform for zoom / move (§4 P3), pure. Strokes are stored in DOCUMENT coordinates;
 * the canvas shows them as  canvas = doc × zoom + pan.  The default view (zoom 1, pan 0) is
 * the identity, so nothing changes until the user zooms or moves.
 */
import type { Rect, Size, Vec2 } from "@/pipeline/types";

export interface View {
  zoom: number;
  pan: Vec2;
}

export const IDENTITY_VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } };
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.25;
/** "move up/down/left/right" shifts the view by this fraction of the canvas. */
export const MOVE_FRACTION = 0.25;

export function isIdentity(v: View): boolean {
  return v.zoom === 1 && v.pan.x === 0 && v.pan.y === 0;
}

export function toDoc(p: Vec2, v: View): Vec2 {
  return { x: (p.x - v.pan.x) / v.zoom, y: (p.y - v.pan.y) / v.zoom };
}

export function toCanvas(p: Vec2, v: View): Vec2 {
  return { x: p.x * v.zoom + v.pan.x, y: p.y * v.zoom + v.pan.y };
}

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Zoom by `factor` keeping the canvas point `about` fixed on screen. */
export function zoomAbout(v: View, factor: number, about: Vec2): View {
  const zoom = clampZoom(v.zoom * factor);
  const doc = toDoc(about, v);
  return { zoom, pan: { x: about.x - doc.x * zoom, y: about.y - doc.y * zoom } };
}

export type MoveDir = "up" | "down" | "left" | "right";

/** "move up" looks further up the page, so the content slides down (and so on). */
export function moveView(v: View, dir: MoveDir, canvas: Size, fraction = MOVE_FRACTION): View {
  const dx = canvas.w * fraction;
  const dy = canvas.h * fraction;
  const d = { up: { x: 0, y: dy }, down: { x: 0, y: -dy }, left: { x: dx, y: 0 }, right: { x: -dx, y: 0 } }[dir];
  return { zoom: v.zoom, pan: { x: v.pan.x + d.x, y: v.pan.y + d.y } };
}

/**
 * "Fit page": everything drawn fits on the canvas with a margin; with nothing drawn (or content
 * that already fits at zoom 1 without moving) this is the identity view.
 */
export function fitView(content: Rect | null, canvas: Size, margin = 24): View {
  if (!content || content.w <= 0 || content.h <= 0) return IDENTITY_VIEW;
  const fitsAtOne =
    content.x >= 0 && content.y >= 0 && content.x + content.w <= canvas.w && content.y + content.h <= canvas.h;
  if (fitsAtOne) return IDENTITY_VIEW;
  const zoom = clampZoom(Math.min(1, (canvas.w - 2 * margin) / content.w, (canvas.h - 2 * margin) / content.h));
  const cx = content.x + content.w / 2;
  const cy = content.y + content.h / 2;
  return { zoom, pan: { x: canvas.w / 2 - cx * zoom, y: canvas.h / 2 - cy * zoom } };
}

/** The document-space rectangle currently visible on the canvas. */
export function visibleDocRect(v: View, canvas: Size): Rect {
  const a = toDoc({ x: 0, y: 0 }, v);
  return { x: a.x, y: a.y, w: canvas.w / v.zoom, h: canvas.h / v.zoom };
}

/** Smallest rect containing both (null-safe). */
export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
