import { describe, expect, it } from "vitest";
import { createInkDwell, createTileDwell, hitTile, PEN_DOWN_REARM_MS, rIn, tileRadius, type InkDwellConfig } from "./dwell";
import { DEFAULT_SETTINGS, type PenState, type Vec2 } from "./types";

const CFG: InkDwellConfig = { rIn: 15, penDownDwellMs: 800, penUpDwellMs: 1200, latch: false };
const FRAME = 1000 / 30;

describe("rIn", () => {
  it("= max(15, lazyRadius/2, 3 × restJitterRms)", () => {
    expect(rIn(DEFAULT_SETTINGS)).toBe(15);
    expect(rIn({ ...DEFAULT_SETTINGS, lazyRadius: 40 })).toBe(20);
    expect(rIn({ ...DEFAULT_SETTINGS, restJitterRms: 7 })).toBe(21);
    expect(tileRadius({ ...DEFAULT_SETTINGS, tileDwellRadius: 60 })).toBe(60);
    expect(tileRadius(DEFAULT_SETTINGS)).toBe(15);
  });
});

/** Drive the detector the way the engine does (pen state follows its fires). */
function drive(points: (t: number) => Vec2, ms: number, opts: { pen?: PenState; cfg?: InkDwellConfig; blocked?: (t: number) => boolean } = {}) {
  const d = createInkDwell();
  let pen: PenState = opts.pen ?? "HOVER";
  if (pen === "DRAWING") d.notifyPenDown(points(0), 0);
  const fires: { type: string; t: number; trimFromT?: number }[] = [];
  const states: { t: number; kind: string | null; progress: number }[] = [];
  for (let t = 0; t <= ms; t += FRAME) {
    const r = d.update({ t, p: points(t), pen, blocked: opts.blocked?.(t) ?? false }, opts.cfg ?? CFG);
    states.push({ t, kind: r.state.kind, progress: r.state.progress });
    if (r.fire) {
      fires.push(r.fire);
      pen = r.fire.type === "pen-down" ? "DRAWING" : "HOVER";
    }
  }
  return { fires, states, pen };
}

describe("pen-down dwell", () => {
  it("fires exactly once on a still segment, ~800 ms after stillness began", () => {
    const { fires } = drive(() => ({ x: 200, y: 200 }), 5000);
    expect(fires.map((f) => f.type)).toEqual(["pen-down"]);
    expect(fires[0].t).toBeGreaterThanOrEqual(800);
    expect(fires[0].t).toBeLessThanOrEqual(800 + 2 * FRAME);
  });

  it("never flickers at the r_in / r_out boundary: progress is monotonic and it fires once", () => {
    // Still for 300 ms (fill starts), then jitter straddling r_in (0.8 r_in ↔ 1.6 r_in, < r_out).
    let i = 0;
    const pts = (t: number): Vec2 => {
      if (t < 300) return { x: 100, y: 100 };
      i++;
      return { x: 100 + (i % 2 ? 0.8 : 1.6) * CFG.rIn, y: 100 };
    };
    const { fires, states } = drive(pts, 3000);
    expect(fires.filter((f) => f.type === "pen-down")).toHaveLength(1);
    const filling = states.filter((s) => s.t <= fires[0].t && s.kind === "pen-down");
    for (let k = 1; k < filling.length; k++) expect(filling[k].progress).toBeGreaterThanOrEqual(filling[k - 1].progress);
    // the fill never dropped back to "not filling" once it had started
    const firstFill = states.findIndex((s) => s.kind === "pen-down");
    const firedIdx = states.findIndex((s) => s.t === fires[0].t);
    expect(states.slice(firstFill, firedIdx + 1).every((s) => s.kind === "pen-down")).toBe(true);
  });

  it("cancels only beyond r_out", () => {
    const pts = (t: number): Vec2 => (t < 400 ? { x: 0, y: 0 } : { x: 2.2 * CFG.rIn + (t - 400) * 0.2, y: 0 });
    const { fires, states } = drive(pts, 1500);
    expect(fires).toHaveLength(0);
    expect(states.find((s) => s.t > 300 && s.t < 400)?.kind).toBe("pen-down");
    expect(states.find((s) => s.t > 450)?.kind).toBeNull();
  });

  it("does not fill while blocked (rest zone / off canvas)", () => {
    const { fires } = drive(() => ({ x: 5, y: 5 }), 4000, { blocked: () => true });
    expect(fires).toHaveLength(0);
  });

  it("re-arms only 600 ms after a pen-up AND after moving > r_in away", () => {
    const d = createInkDwell();
    d.notifyPenUp({ x: 0, y: 0 }, 0);
    // Still at the same spot for 5 s: never arms.
    let fired = false;
    for (let t = 0; t < 5000; t += FRAME) if (d.update({ t, p: { x: 0, y: 0 }, pen: "HOVER", blocked: false }, CFG).fire) fired = true;
    expect(fired).toBe(false);
    // Move away immediately after a fresh pen-up and hold still there: fires, but not before 600 ms + 250 ms window.
    const d2 = createInkDwell();
    d2.notifyPenUp({ x: 0, y: 0 }, 0);
    let at = -1;
    for (let t = 0; t < 5000 && at < 0; t += FRAME) {
      const r = d2.update({ t, p: { x: 100, y: 0 }, pen: "HOVER", blocked: false }, CFG);
      if (r.fire) at = t;
    }
    expect(at).toBeGreaterThanOrEqual(PEN_DOWN_REARM_MS + 800);
  });
});

describe("pen-up dwell", () => {
  it("is not armed until the point moved > r_in from the pen-down anchor", () => {
    const { fires, states } = drive(() => ({ x: 50, y: 50 }), 6000, { pen: "DRAWING" });
    expect(fires).toHaveLength(0);
    expect(states.every((s) => s.kind === null)).toBe(true);
  });

  it("lifts after penUpDwellMs within r_in/2, with trimFromT = start of stillness", () => {
    const pts = (t: number): Vec2 => (t < 1000 ? { x: 50 + t * 0.1, y: 50 } : { x: 150, y: 50 });
    const { fires } = drive(pts, 4000, { pen: "DRAWING" });
    expect(fires.map((f) => f.type)).toEqual(["pen-up"]);
    expect(fires[0].trimFromT!).toBeGreaterThanOrEqual(1000 - FRAME);
    expect(fires[0].trimFromT!).toBeLessThanOrEqual(1000 + FRAME);
    expect(fires[0].t - fires[0].trimFromT!).toBeGreaterThanOrEqual(1200);
  });

  it("a 40 px/s straight stroke lasting 3 s never triggers pen-up", () => {
    const { fires, states } = drive((t) => ({ x: 40 * (t / 1000), y: 0 }), 3000, { pen: "DRAWING" });
    expect(fires).toHaveLength(0);
    expect(states.every((s) => s.kind === null)).toBe(true); // ring never shown
  });

  it("has no hysteresis: drifting just over r_in/2 restarts the stillness", () => {
    // moves 9 px (> 7.5 = r_in/2) every 1 s: never 1.2 s within r_in/2
    const pts = (t: number): Vec2 => (t < 500 ? { x: t * 0.1, y: 0 } : { x: 50 + 9 * Math.floor((t - 500) / 1000), y: 0 });
    const { fires } = drive(pts, 8000, { pen: "DRAWING" });
    expect(fires).toHaveLength(0);
  });

  it("is disabled by Latch", () => {
    const pts = (t: number): Vec2 => (t < 1000 ? { x: t * 0.1, y: 0 } : { x: 100, y: 0 });
    const { fires } = drive(pts, 8000, { pen: "DRAWING", cfg: { ...CFG, latch: true } });
    expect(fires).toHaveLength(0);
  });
});

describe("tile dwell", () => {
  const tiles = [
    { id: "a", rect: { x: 0, y: 0, w: 64, h: 64 } },
    { id: "b", rect: { x: 100, y: 0, w: 64, h: 64 } },
  ];
  const opts = { radius: 15, dwellMs: 800, snapPx: 0 };

  it("fires once after dwellMs on the hovered tile, no auto-repeat", () => {
    const td = createTileDwell();
    const fired: string[] = [];
    for (let t = 0; t < 3000; t += FRAME) {
      const s = td.update({ x: 30, y: 30 }, tiles, t, opts);
      if (s.firedId) fired.push(s.firedId);
    }
    expect(fired).toEqual(["a"]);
    // leave and come back: fires again
    td.update({ x: 300, y: 300 }, tiles, 3000, opts);
    let again: string | null = null;
    for (let t = 3100; t < 4200; t += FRAME) again = td.update({ x: 30, y: 30 }, tiles, t, opts).firedId ?? again;
    expect(again).toBe("a");
  });

  it("restarts when the pointer moves beyond 2 × radius from the anchor", () => {
    const td = createTileDwell();
    let fired = false;
    for (let t = 0; t < 3000; t += FRAME) {
      const x = 2 + (Math.floor(t / 500) % 2) * 40; // 40 px hop every 500 ms > 2 × 15
      if (td.update({ x, y: 30 }, tiles, t, opts).firedId) fired = true;
    }
    expect(fired).toBe(false);
    // with the "Hard to hold still" radius (60) the same hops fire
    const td2 = createTileDwell();
    let fired2 = false;
    for (let t = 0; t < 3000; t += FRAME) {
      const x = 2 + (Math.floor(t / 500) % 2) * 40;
      if (td2.update({ x, y: 30 }, tiles, t, { ...opts, radius: 60 }).firedId) fired2 = true;
    }
    expect(fired2).toBe(true);
  });

  it("snap-to-target counts a near miss as hovering the nearest tile", () => {
    expect(hitTile({ x: 80, y: 30 }, tiles, 0)).toBeNull();
    expect(hitTile({ x: 80, y: 30 }, tiles, 40)).toBe("a");
    expect(hitTile({ x: 90, y: 30 }, tiles, 40)).toBe("b");
  });

  it("null pointer resets", () => {
    const td = createTileDwell();
    td.update({ x: 30, y: 30 }, tiles, 0, opts);
    expect(td.update(null, tiles, 500, opts)).toEqual({ hoveredId: null, progress: 0, firedId: null });
  });
});
