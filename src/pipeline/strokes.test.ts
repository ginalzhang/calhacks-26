import { describe, expect, it } from "vitest";
import { eraserHits, finalizeStroke, makeDot, outlineToPath2DString, straighten, strokeBBox, strokeOutline } from "./strokes";
import type { Stroke, TimedPoint } from "./types";

const timed = (pts: [number, number][], dt = 33): TimedPoint[] => pts.map(([x, y], i) => ({ x, y, t: i * dt }));
const O = { id: "s1", colour: "blue" as const, width: 6, rIn: 15 };

describe("finalizeStroke", () => {
  it("dot rule: bbox smaller than r_in → single dot at the anchor (first point)", () => {
    const s = finalizeStroke(timed([[100, 100], [104, 103], [108, 99], [103, 110]]), O)!;
    expect(s.kind).toBe("dot");
    expect(s.points).toEqual([{ x: 100, y: 100 }]);
    expect(s.width).toBe(6);
    expect(s.colour).toBe("blue");
  });

  it("a stroke at least r_in in one dimension is kept as freehand, RDP-simplified (ε 1.5)", () => {
    const pts = timed(Array.from({ length: 101 }, (_, i) => [i * 2, 50 + (i % 2) * 0.5] as [number, number]));
    const s = finalizeStroke(pts, O)!;
    expect(s.kind).toBe("free");
    expect(s.points.length).toBeLessThan(10);
    expect(s.points[0]).toEqual({ x: 0, y: 50 });
    expect(s.points[s.points.length - 1].x).toBe(200);
  });

  it("trims points with t >= trimFromT (pen-up dwell period)", () => {
    const pts = timed([[0, 0], [50, 0], [100, 0], [101, 1], [100, 2], [102, 1]]);
    const s = finalizeStroke(pts, { ...O, trimFromT: pts[3].t })!;
    expect(s.points[s.points.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it("returns null for no points (after trim) and keeps raw when given", () => {
    expect(finalizeStroke([], O)).toBeNull();
    expect(finalizeStroke(timed([[0, 0], [40, 0]]), { ...O, trimFromT: 0 })).toBeNull();
    const raw = [{ x: 1, y: 2 }];
    expect(finalizeStroke(timed([[0, 0], [40, 0]]), { ...O, raw })!.raw).toBe(raw);
  });
});

describe("outline + path", () => {
  it("perfect-freehand outline surrounds the stroke at about width/2", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: 100 }));
    const out = strokeOutline(pts, 10);
    expect(out.length).toBeGreaterThan(8);
    const bb = strokeBBox(out);
    expect(bb.h).toBeGreaterThan(8);
    expect(bb.h).toBeLessThan(12);
    const d = outlineToPath2DString(out);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(outlineToPath2DString([])).toBe("");
  });

  it("a single-point (dot) stroke still has an outline", () => {
    expect(strokeOutline([{ x: 5, y: 5 }], 8).length).toBeGreaterThan(3);
  });
});

describe("straighten / eraser / dot", () => {
  it("straighten keeps first and last point", () => {
    expect(straighten([{ x: 0, y: 0 }, { x: 5, y: 9 }, { x: 10, y: 1 }])).toEqual([{ x: 0, y: 0 }, { x: 10, y: 1 }]);
    expect(straighten([])).toEqual([]);
  });

  it("eraserHits finds strokes within radius + width/2", () => {
    const a: Stroke = { id: "a", kind: "free", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], colour: "black", width: 4, createdAt: 0 };
    const b: Stroke = makeDot({ x: 200, y: 200 }, { id: "b", colour: "red", width: 10 });
    expect(eraserHits([a, b], { x: 50, y: 10 }, 9)).toEqual(["a"]);
    expect(eraserHits([a, b], { x: 50, y: 20 }, 9)).toEqual([]);
    expect(eraserHits([a, b], { x: 210, y: 200 }, 6)).toEqual(["b"]);
  });
});
