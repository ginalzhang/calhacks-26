import { describe, expect, it } from "vitest";
import { effectiveBox, mapToCamera } from "./activeBox";
import { rIn } from "./dwell";
import { TUNED_FILTER } from "./oneEuro";
import { createPointerEngine, type EngineFrame } from "./pointer";
import { finalizeStroke } from "./strokes";
import { gaussian } from "./synth";
import { DEFAULT_SETTINGS, type PenEvent, type PipelineSettings, type PointerInput, type TimedPoint, type Vec2 } from "./types";

const VIDEO = { w: 640, h: 480 };
const CANVAS = { w: 1280, h: 720 };
const FRAME = 1000 / 30;
const BASE: PipelineSettings = { ...DEFAULT_SETTINGS, filter: TUNED_FILTER };

type Step = Omit<PointerInput, "t" | "camera"> & { canvas: Vec2 | null };

/** Run the engine on a canvas-px path (converted to camera px through the engine's own box). */
function run(
  path: (t: number) => Step,
  ms: number,
  settings: Partial<PipelineSettings> = {},
  hooks: { at?: (t: number, e: ReturnType<typeof createPointerEngine>) => PenEvent | null | void } = {},
  t0 = 0,
) {
  const s = { ...BASE, ...settings };
  const e = createPointerEngine(s, CANVAS, VIDEO);
  const box = effectiveBox(s.activeBox, VIDEO, CANVAS, s.gain);
  const frames: EngineFrame[] = [];
  const events: PenEvent[] = [];
  for (let t = t0; t <= t0 + ms; t += FRAME) {
    const st = path(t);
    const { canvas, ...rest } = st;
    const f = e.process({ t, camera: canvas ? mapToCamera(canvas, box, CANVAS) : null, ...rest });
    frames.push(f);
    events.push(...f.events);
    const ev = hooks.at?.(t, e);
    if (ev) {
      f.events.push(ev); // explicit toggles land after this frame's engine events
      events.push(ev);
    }
  }
  return { e, frames, events };
}

/** Rest jitter: ~1 px (camera) gaussian, like the still-10s fixture, expressed in canvas px. */
const noisy = (seed = 3, sigmaCanvas = 3) => {
  const g = gaussian(seed);
  return (p: Vec2): Vec2 => ({ x: p.x + sigmaCanvas * g(), y: p.y + sigmaCanvas * g() });
};

/** A simple stroke recorder following the documented UI rules. */
function record(frames: EngineFrame[], s: PipelineSettings = BASE) {
  const strokes: ReturnType<typeof finalizeStroke>[] = [];
  let open: TimedPoint[] | null = null;
  for (const f of frames) {
    for (const ev of f.events) {
      if (ev.type === "pen-down") open = [{ ...ev.at, t: ev.t }];
      else if (open) {
        strokes.push(finalizeStroke(open, { id: `s${strokes.length}`, colour: "black", width: 4, rIn: rIn(s), trimFromT: ev.trimFromT }));
        open = null;
      }
    }
    if (open && f.inking && f.pointer) open.push({ ...f.pointer, t: f.t });
  }
  return { strokes: strokes.filter(Boolean), open };
}

describe("PointerEngine: pipeline", () => {
  it("frames carry raw/filtered/pointer in the documented spaces", () => {
    const { frames } = run(() => ({ canvas: { x: 640, y: 360 } }), 500);
    const f = frames[frames.length - 1];
    expect(f.tracking).toBe("ok");
    expect(f.rawCamera!.x).toBeCloseTo(320, 6);
    expect(f.rawCanvas!.x).toBeCloseTo(640, 6);
    expect(f.filtered!.x).toBeCloseTo(640, 6);
    expect(f.pointer!.x).toBeCloseTo(640, 6);
    expect(f.box.w).toBeCloseTo(1280 / 3, 6);
  });

  it("simulated tremor perturbs raw camera px before the filter; the filter removes most of it", () => {
    const { frames } = run(() => ({ canvas: { x: 640, y: 360 } }), 4000, { simulateTremor: true });
    const late = frames.filter((f) => f.t > 1000);
    const rawDev = Math.max(...late.map((f) => Math.abs(f.rawCamera!.x - 320)));
    const filtDev = Math.max(...late.map((f) => Math.abs(f.filteredCamera!.x - 320)));
    expect(rawDev).toBeGreaterThan(2);
    expect(rawDev).toBeLessThanOrEqual(4 + 1e-9);
    expect(filtDev).toBeLessThan(rawDev / 2);
  });

  it("updateSettings({ steadiness }) derives mincutoff and lazy radius", () => {
    const e = createPointerEngine(BASE, CANVAS, VIDEO);
    e.updateSettings({ steadiness: 100 });
    expect(e.getSettings().filter.minCutoff).toBeCloseTo(0.3);
    expect(e.getSettings().lazyRadius).toBeCloseTo(30);
    expect(e.getSettings().filter.beta).toBe(TUNED_FILTER.beta);
    e.updateSettings({ steadiness: 0, lazyRadius: 9 });
    expect(e.getSettings().lazyRadius).toBe(9);
  });
});

describe("PointerEngine: §9 dwell behaviour at defaults", () => {
  it("a pointer held still for 10 s produces zero strokes and at most one toggle", () => {
    const n = noisy(11);
    const { frames, events } = run(() => ({ canvas: n({ x: 600, y: 300 }) }), 10_000);
    expect(events.length).toBeLessThanOrEqual(1);
    expect(record(frames).strokes).toHaveLength(0);
  });

  it("still → pen-down dwell fires exactly once at the stillness anchor", () => {
    const n = noisy(5);
    const { events } = run(() => ({ canvas: n({ x: 600, y: 300 }) }), 4000);
    const downs = events.filter((e) => e.type === "pen-down");
    expect(downs).toHaveLength(1);
    expect(downs[0].cause).toBe("dwell");
    if (downs[0].type === "pen-down") expect(Math.hypot(downs[0].at.x - 600, downs[0].at.y - 300)).toBeLessThan(5);
  });

  it("a 40 px/s straight stroke lasting 3 s never triggers pen-up; holding still afterwards lifts with a trimmed end", () => {
    const n = noisy(9, 1.5);
    const path = (t: number): Step => {
      if (t < 1200) return { canvas: n({ x: 300, y: 300 }) };
      if (t < 4200) return { canvas: n({ x: 300 + 40 * ((t - 1200) / 1000), y: 300 }) };
      return { canvas: n({ x: 420, y: 300 }) };
    };
    const during = run(path, 4200);
    expect(during.events.map((e) => `${e.type}:${e.cause}`)).toEqual(["pen-down:dwell"]);
    expect(during.e.pen).toBe("DRAWING");

    const after = run(path, 6000);
    const ups = after.events.filter((e) => e.type === "pen-up");
    expect(ups).toHaveLength(1);
    expect(ups[0].cause).toBe("dwell");
    expect(ups[0].type === "pen-up" && ups[0].trimFromT).toBeGreaterThan(4000);
    const { strokes } = record(after.frames);
    expect(strokes).toHaveLength(1);
    const pts = strokes[0]!.points;
    expect(strokes[0]!.kind).toBe("free");
    expect(pts[0].x).toBeLessThan(310);
    expect(pts[pts.length - 1].x).toBeGreaterThan(395);
  });

  it("resting after a pen-up dwell does not put the pen down again", () => {
    const path = (t: number): Step => {
      if (t < 1200) return { canvas: { x: 300, y: 300 } };
      if (t < 2200) return { canvas: { x: 300 + 0.1 * (t - 1200), y: 300 } };
      return { canvas: { x: 400, y: 300 } };
    };
    const { events } = run(path, 12_000);
    expect(events.map((e) => e.type)).toEqual(["pen-down", "pen-up"]);
  });

  it("Latch: no pen-up dwell, explicit toggle lifts", () => {
    const path = (t: number): Step => (t < 1200 ? { canvas: { x: 300, y: 300 } } : t < 2200 ? { canvas: { x: 300 + 0.1 * (t - 1200), y: 300 } } : { canvas: { x: 400, y: 300 } });
    const { e, events } = run(path, 8000, { latch: true });
    expect(events.map((x) => x.type)).toEqual(["pen-down"]);
    const up = e.togglePen(8001, "key");
    expect(up).toMatchObject({ type: "pen-up", cause: "key" });
    expect(e.pen).toBe("HOVER");
  });

  it("rest zones and dwellEnabled=false never toggle ink", () => {
    expect(run(() => ({ canvas: { x: 600, y: 300 }, inRestZone: true }), 5000).events).toHaveLength(0);
    expect(run(() => ({ canvas: { x: 600, y: 300 } }), 5000, { dwellEnabled: false }).events).toHaveLength(0);
    expect(run(() => ({ canvas: { x: 600, y: 300 }, overCanvas: false }), 5000).events).toHaveLength(0);
  });

  it("explicit toggles have no cooldown", () => {
    const e = createPointerEngine(BASE, CANVAS, VIDEO);
    e.process({ t: 0, camera: { x: 320, y: 240 } });
    expect(e.togglePen(10, "key").type).toBe("pen-down");
    expect(e.togglePen(11, "voice").type).toBe("pen-up");
    expect(e.togglePen(12, "typed").type).toBe("pen-down");
    expect(e.setPen("DRAWING", 13, "key")).toBeNull();
  });
});

describe("PointerEngine: tracking loss (design rule 10)", () => {
  const drawingThenLoss = (lossMs: number, extra: Partial<Step> = {}) => (t: number): Step => {
    if (t < 1200) return { canvas: { x: 300, y: 300 } };
    if (t < 2000) return { canvas: { x: 300 + 0.1 * (t - 1200), y: 300 } };
    if (t < 2000 + lossMs) return { canvas: null, ...extra };
    return { canvas: { x: 500, y: 400 } };
  };

  it("> 300 ms without a hand → pen-up(tracking-lost), pointer frozen, pen stays up after re-acquire", () => {
    const { frames, events, e } = run(drawingThenLoss(1000), 3700);
    expect(events.map((x) => `${x.type}:${x.cause}`)).toEqual(["pen-down:dwell", "pen-up:tracking-lost"]);
    const up = events[1];
    expect(up.t).toBeGreaterThan(2000 + 300 - FRAME);
    expect(up.t).toBeLessThan(2000 + 300 + 2 * FRAME);
    const lostFrames = frames.filter((f) => f.tracking === "lost");
    expect(lostFrames.length).toBeGreaterThan(0);
    expect(lostFrames.every((f) => f.lossReason === "no-hand")).toBe(true);
    const frozen = lostFrames[0].pointer;
    expect(lostFrames.every((f) => f.pointer!.x === frozen!.x && f.pointer!.y === frozen!.y)).toBe(true);
    const back = frames.find((f) => f.t >= 3000)!;
    expect(back.reacquired).toBe(true);
    expect(back.pen).toBe("HOVER");
    expect(back.pointer!.x).toBeCloseTo(500, 0); // filters restarted at the new point, no glide
    expect(e.pen).toBe("HOVER");
    // A hand resting where it was re-acquired never pens down by dwell…
    expect(run(drawingThenLoss(1000), 10_000).events.slice(2)).toEqual([]);
  });

  it("lifts the pen even under Latch", () => {
    const { events } = run(drawingThenLoss(1000), 3200, { latch: true });
    expect(events.map((x) => `${x.type}:${x.cause}`)).toEqual(["pen-down:dwell", "pen-up:tracking-lost"]);
  });

  it("a gap ≤ 300 ms freezes without lifting", () => {
    const { events, frames } = run(drawingThenLoss(250), 2600);
    expect(events.map((x) => x.type)).toEqual(["pen-down"]);
    expect(frames.every((f) => f.tracking === "ok")).toBe(true);
  });

  it("a stall (no frames at all) > 300 ms also counts as loss", () => {
    const e = createPointerEngine(BASE, CANVAS, VIDEO);
    e.process({ t: 0, camera: { x: 320, y: 240 } });
    e.togglePen(1, "key");
    const f = e.process({ t: 800, camera: { x: 330, y: 240 } });
    expect(f.events.map((x) => x.cause)).toEqual(["tracking-lost"]);
    expect(f.reacquired).toBe(true);
    expect(f.pen).toBe("HOVER");
  });

  it("lossReason: too-dark (luma < 40) and low-fps (< 25 fps)", () => {
    const dark = run(drawingThenLoss(1000, { luma: 25 }), 2600).frames.filter((f) => f.tracking === "lost");
    expect(dark[0].lossReason).toBe("too-dark");
    const slow = run(drawingThenLoss(1000, { detectionFps: 12 }), 2600).frames.filter((f) => f.tracking === "lost");
    expect(slow[0].lossReason).toBe("low-fps");
    const warn = run(() => ({ canvas: { x: 1, y: 1 }, luma: 20 }), 100).frames[1];
    expect(warn.tracking).toBe("ok");
    expect(warn.quality).toBe("too-dark");
  });
});

describe("PointerEngine: flicker / re-acquire never inks a resting hand", () => {
  /** Still hand (rest jitter) with null gaps of 300–500 ms every ~1.5 s (seeded). */
  const flicker = (firstGapAt: number, seed = 21) => {
    const g = gaussian(seed);
    const gaps: [number, number][] = [];
    for (let t = firstGapAt; t < 10_000; ) {
      const len = 300 + 200 * Math.abs(Math.sin(g() * 10));
      gaps.push([t, t + len]);
      t += len + 1000 + 500 * Math.abs(Math.sin(g() * 10));
    }
    const n = noisy(seed);
    return (t: number): Step => (gaps.some(([a, b]) => t >= a && t < b) ? { canvas: null, luma: 30 } : { canvas: n({ x: 600, y: 300 }), luma: 30 });
  };

  it("flicker (300–500 ms gaps every ~1.5 s) over a still hand for 10 s → zero pen-downs", () => {
    const { events, frames } = run(flicker(500), 10_000);
    expect(frames.filter((f) => f.reacquired).length).toBeGreaterThanOrEqual(4);
    expect(events.filter((e) => e.type === "pen-down")).toHaveLength(0);
  });

  it("if the first gap comes after the initial dwell: one toggle at most, and no ink is left", () => {
    const { events, frames } = run(flicker(1500, 5), 10_000);
    expect(events.filter((e) => e.type === "pen-down").length).toBeLessThanOrEqual(1);
    expect(record(frames).strokes).toHaveLength(0); // tracking-lost pen-up trims the unmoved stroke
  });

  it("after re-acquire, a deliberate move followed by a dwell still pens down", () => {
    const base = flicker(500, 8);
    const path = (t: number): Step => {
      if (t < 6000) return base(t);
      if (t < 6500) return { canvas: { x: 600 + 0.12 * (t - 6000), y: 300 } }; // 60 px move
      return { canvas: { x: 660, y: 300 } };
    };
    const { events } = run(path, 8000);
    const downs = events.filter((e) => e.type === "pen-down");
    expect(downs).toHaveLength(1);
    expect(downs[0].cause).toBe("dwell");
    expect(downs[0].t).toBeGreaterThanOrEqual(6000 + 800); // needs ~800 ms of stillness after the move began
  });

  it("Space / voice / typed / tile pen-downs work immediately after re-acquire", () => {
    for (const cause of ["key", "voice", "typed", "tile"] as const) {
      const e = createPointerEngine(BASE, CANVAS, VIDEO);
      e.process({ t: 0, camera: { x: 320, y: 240 } });
      e.process({ t: 400, camera: null });
      const back = e.process({ t: 433, camera: { x: 320, y: 240 } });
      expect(back.reacquired).toBe(true);
      expect(e.togglePen(434, cause)).toMatchObject({ type: "pen-down", cause });
      expect(e.pen).toBe("DRAWING");
    }
  });
});

describe("PointerEngine: canvas exit (§3 Latch rule)", () => {
  it("leaving ends the stroke, re-entering starts a new one, pen stays logically down", () => {
    const path = (t: number): Step => {
      const x = 300 + 0.2 * t;
      return { canvas: { x, y: 300 }, overCanvas: !(t > 1000 && t < 1500), inRestZone: t > 1000 && t < 1500 };
    };
    const { frames, events } = run(path, 2500, { latch: true }, { at: (t, e) => (t === 0 ? e.togglePen(0, "key") : null) });
    expect(events.map((x) => `${x.type}:${x.cause}`)).toEqual(["pen-down:key", "pen-up:left-canvas", "pen-down:left-canvas"]);
    expect(frames.slice(1).every((f) => f.pen === "DRAWING")).toBe(true);
    const off = frames.filter((f) => f.t > 1000 && f.t < 1500);
    expect(off.every((f) => !f.inking)).toBe(true);
    const { strokes, open } = record(frames);
    expect(strokes).toHaveLength(1);
    expect(Math.max(...strokes[0]!.points.map((p) => p.x))).toBeLessThan(300 + 0.2 * 1000 + 1);
    expect(open![0].x).toBeGreaterThan(300 + 0.2 * 1500 - 30); // filter lag + 12 px dead zone
  });

  it("an explicit pen-down while off canvas yields an empty stroke, ink starts on entry", () => {
    const path = (t: number): Step => ({ canvas: { x: 300 + 0.2 * t, y: 300 }, overCanvas: t > 500 });
    const { frames, events } = run(path, 1500, {}, { at: (t, e) => (t === 0 ? e.togglePen(0, "voice") : null) });
    expect(events.map((x) => `${x.type}:${x.cause}`)).toEqual(["pen-down:voice", "pen-up:left-canvas", "pen-down:voice"]);
    expect(record(frames).strokes).toHaveLength(0);
  });

  it("reset() lifts the pen via the next frame's events", () => {
    const e = createPointerEngine(BASE, CANVAS, VIDEO);
    e.process({ t: 0, camera: { x: 320, y: 240 } });
    e.togglePen(1, "key");
    e.reset(2);
    expect(e.pen).toBe("HOVER");
    expect(e.process({ t: 3, camera: { x: 320, y: 240 } }).events).toMatchObject([{ type: "pen-up" }]);
  });
});
