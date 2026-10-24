/**
 * Lazy-brush dead zone (friction 0). Hand-rolled equivalent of the `lazy-brush` package's
 * update(): the brush stays put while the pointer is within `radius`; beyond it, the brush is
 * dragged along the pointer→brush line so it ends exactly `radius` behind.
 * Hand-rolled because the package treats radius 0 as 30 (`radius || 30`) and rounds the
 * overshoot to 0.1 px, which breaks the exact §2 dead-zone test (ii).
 */
import type { Vec2 } from "./types";

export interface LazyBrush {
  update(p: Vec2): Vec2;
  reset(p?: Vec2): void;
  setRadius(r: number): void;
}

export function createLazyBrush(radius: number): LazyBrush {
  let r = Math.max(0, radius);
  let brush: Vec2 | null = null;
  return {
    update(p: Vec2): Vec2 {
      if (!brush) {
        brush = { x: p.x, y: p.y };
        return { ...brush };
      }
      const dx = p.x - brush.x;
      const dy = p.y - brush.y;
      const d = Math.hypot(dx, dy);
      if (d > r) {
        const k = (d - r) / d;
        brush = { x: brush.x + dx * k, y: brush.y + dy * k };
      }
      return { ...brush };
    },
    reset(p?: Vec2) {
      brush = p ? { x: p.x, y: p.y } : null;
    },
    setRadius(next: number) {
      r = Math.max(0, next);
    },
  };
}
