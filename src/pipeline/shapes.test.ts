import { describe, expect, it } from "vitest";
import { fitShape, forceShape, isClosed } from "./shapes";
import { strokeBBox } from "./strokes";
import { circlePoints, densify, gaussian, jitter } from "./synth";
import type { Vec2 } from "./types";

const angleAt = (a: Vec2, v: Vec2, b: Vec2) => {
  const u = { x: a.x - v.x, y: a.y - v.y };
  const w = { x: b.x - v.x, y: b.y - v.y };
  return (Math.acos((u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y))) * 180) / Math.PI;
};

/** A hand-drawn square: starts mid-edge, slight rotation, noise, small overshoot gap. */
function wobblySquare(seed: number, rotDeg = 4): Vec2[] {
  const c = { x: 400, y: 300 };
  const s = 200;
  const r = (rotDeg * Math.PI) / 180;
  const rot = (p: Vec2) => ({
    x: c.x + (p.x - c.x) * Math.cos(r) - (p.y - c.y) * Math.sin(r),
    y: c.y + (p.x - c.x) * Math.sin(r) + (p.y - c.y) * Math.cos(r),
  });
  const v = [
    { x: 400, y: 200 },
    { x: 500, y: 200 },
    { x: 500, y: 400 },
    { x: 300, y: 400 },
    { x: 300, y: 200 },
    { x: 392, y: 203 },
  ].map(rot);
  void s;
  return jitter(densify(v, 3), 1.5, seed);
}

describe("fitShape", () => {
  it("circle: noisy hand-drawn circle → circle with the right centre and radius", () => {
    const pts = jitter(circlePoints({ x: 300, y: 300 }, 100, 90, false), 3, 1);
    pts.push({ x: pts[0].x + 5, y: pts[0].y - 8 });
    const f = fitShape(pts);
    expect(f.kind).toBe("circle");
    expect(f.closed).toBe(true);
    expect(f.residual).toBeLessThan(0.08);
    const bb = strokeBBox(f.points);
    expect(bb.w / 2).toBeGreaterThan(95);
    expect(bb.w / 2).toBeLessThan(105);
    expect(bb.x + bb.w / 2).toBeCloseTo(300, -1);
  });

  it("line: noisy straight stroke → line with PCA endpoints", () => {
    const pts = jitter(densify([{ x: 100, y: 100 }, { x: 400, y: 160 }], 3), 2, 2);
    const f = fitShape(pts);
    expect(f.kind).toBe("line");
    expect(f.points).toHaveLength(2);
    expect(f.points[0].x).toBeLessThan(105);
    expect(f.points[1].x).toBeGreaterThan(395);
    expect(f.residual).toBeLessThan(0.03);
  });

  it("square: hand-drawn square starting mid-edge → rect with 4 right angles, snapped to axes", () => {
    const f = fitShape(wobblySquare(3));
    expect(f.kind).toBe("rect");
    expect(f.points).toHaveLength(5);
    const p = f.points;
    for (let i = 0; i < 4; i++) expect(angleAt(p[(i + 3) % 4], p[i], p[(i + 1) % 4])).toBeCloseTo(90, 5);
    // rotation 4° < 10° → axis aligned
    expect(Math.abs(p[1].y - p[0].y)).toBeLessThan(1e-6);
    const bb = strokeBBox(p);
    expect(bb.w).toBeGreaterThan(185);
    expect(bb.w).toBeLessThan(215);
  });

  it("a square rotated 30° stays rotated (no axis snap beyond 10°)", () => {
    const f = fitShape(wobblySquare(4, 30));
    expect(f.kind).toBe("rect");
    const a = (Math.atan2(f.points[1].y - f.points[0].y, f.points[1].x - f.points[0].x) * 180) / Math.PI;
    expect(Math.abs(((a % 90) + 90) % 90 - 30)).toBeLessThan(5);
  });

  it("triangle: hand-drawn triangle → 3 corners", () => {
    const v = [{ x: 300, y: 100 }, { x: 450, y: 360 }, { x: 150, y: 360 }, { x: 296, y: 108 }];
    const f = fitShape(jitter(densify(v, 3), 1.5, 5));
    expect(f.kind).toBe("triangle");
    expect(f.points).toHaveLength(4);
    for (const corner of [v[0], v[1], v[2]]) {
      expect(Math.min(...f.points.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)))).toBeLessThan(20);
    }
  });

  it("a scribble must NOT classify", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = gaussian(seed);
      const pts: Vec2[] = [];
      let p = { x: 300, y: 300 };
      let heading = 0;
      for (let i = 0; i < 120; i++) {
        heading += g() * 1.2;
        p = { x: p.x + 8 * Math.cos(heading), y: p.y + 8 * Math.sin(heading) };
        pts.push(p);
      }
      expect(fitShape(pts).kind, `seed ${seed}`).toBe("none");
    }
    // zig-zag that ends near its start
    const zig = densify([{ x: 0, y: 0 }, { x: 100, y: 80 }, { x: 20, y: 120 }, { x: 140, y: 10 }, { x: 60, y: 140 }, { x: 5, y: 8 }], 3);
    expect(isClosed(zig)).toBe(true);
    expect(fitShape(zig).kind).toBe("none");
  });

  it("classification is stable across noise seeds", () => {
    for (let seed = 10; seed < 30; seed++) {
      const circ = jitter(circlePoints({ x: 300, y: 300 }, 80 + seed, 80, true), 2.5, seed);
      expect(fitShape(circ).kind, `circle seed ${seed}`).toBe("circle");
      expect(fitShape(wobblySquare(seed, seed % 7)).kind, `square seed ${seed}`).toBe("rect");
      const tri = [{ x: 300, y: 100 }, { x: 460, y: 380 }, { x: 140, y: 370 }, { x: 304, y: 106 }];
      expect(fitShape(jitter(densify(tri, 3), 2, seed)).kind, `triangle seed ${seed}`).toBe("triangle");
      const line = jitter(densify([{ x: 50, y: 400 }, { x: 350, y: 100 + seed }], 3), 2, seed);
      expect(fitShape(line).kind, `line seed ${seed}`).toBe("line");
    }
  });

  it("degenerate inputs → none", () => {
    expect(fitShape([]).kind).toBe("none");
    expect(fitShape([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]).kind).toBe("none");
  });
});

describe("forceShape always produces the requested shape", () => {
  const scribble = jitter(densify([{ x: 0, y: 0 }, { x: 100, y: 80 }, { x: 20, y: 120 }, { x: 140, y: 10 }], 3), 2, 9);
  it.each(["line", "circle", "square", "triangle"] as const)("%s from a scribble", (target) => {
    const f = forceShape(scribble, target);
    const kind = target === "square" ? "rect" : target;
    expect(f.kind).toBe(kind);
    expect(f.points.length).toBeGreaterThanOrEqual(target === "line" ? 2 : 4);
    expect(f.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(f.closed).toBe(target !== "line");
  });

  it("square is a square (equal sides)", () => {
    const rect = densify([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 }], 4);
    const f = forceShape(rect, "square");
    const bb = strokeBBox(f.points);
    expect(bb.w).toBeCloseTo(bb.h, 6);
    expect(bb.w).toBeCloseTo(200, 0);
  });

  it("works on a single point", () => {
    expect(forceShape([{ x: 5, y: 5 }], "circle").kind).toBe("circle");
    expect(forceShape([{ x: 5, y: 5 }], "square").kind).toBe("rect");
    expect(forceShape([], "line").kind).toBe("line");
  });
});
