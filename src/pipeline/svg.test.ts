import { describe, expect, it } from "vitest";
import { newPage } from "./document";
import { forceShape } from "./shapes";
import { nearestColour, pageToSvg, svgToStrokes } from "./svg";
import { gaussian } from "./synth";
import type { Stroke } from "./types";

describe("SVG export round-trip", () => {
  it("pageToSvg → svgToStrokes recovers points within 0.5 px, colours and widths", () => {
    const g = gaussian(1);
    const free: Stroke = { id: "a", kind: "free", points: Array.from({ length: 40 }, (_, i) => ({ x: 10 + i * 7.123 + g(), y: 200 + 30 * Math.sin(i / 5) + g() })), colour: "blue", width: 6, createdAt: 0 };
    const dot: Stroke = { id: "b", kind: "dot", points: [{ x: 123.456, y: 78.9 }], colour: "red", width: 10, createdAt: 0 };
    const circ: Stroke = { id: "c", kind: "circle", points: forceShape([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }], "circle").points, colour: "purple", width: 3.5, createdAt: 0 };
    const page = { ...newPage("Notes 1"), strokes: [free, dot, circ], guides: true, texts: [{ id: "t", x: 5, y: 9, text: "a < b & \"c\"", colour: "black" as const, size: 24, createdAt: 0 }] };
    const svg = pageToSvg(page, { w: 1280, h: 720 });
    expect(svg).toContain('viewBox="0 0 1280 720"');
    expect(svg).toContain("a &lt; b &amp; &quot;c&quot;");
    const back = svgToStrokes(svg);
    expect(back).toHaveLength(3);
    for (const [i, s] of [free, dot, circ].entries()) {
      expect(back[i].colour).toBe(s.colour);
      expect(back[i].width).toBe(s.width);
      expect(back[i].kind).toBe(s.kind);
      expect(back[i].points).toHaveLength(s.points.length);
      s.points.forEach((p, k) => {
        expect(Math.abs(back[i].points[k].x - p.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(back[i].points[k].y - p.y)).toBeLessThanOrEqual(0.5);
      });
    }
  });

  it("falls back to the nearest ink colour for foreign SVG paths", () => {
    expect(nearestColour("#1e60d0")).toBe("blue");
    const parsed = svgToStrokes('<svg><path d="M0,0 L10,10" stroke="#d72640" stroke-width="3"/></svg>');
    expect(parsed[0]).toMatchObject({ colour: "red", width: 3, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] });
  });
});
