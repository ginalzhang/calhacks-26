import { describe, expect, it } from "vitest";
import type { PenState, PointerFrame, Vec2 } from "@/pipeline/types";
import { createDesktopCore, type CoreConfig, type OutMsg } from "./core";

const screen = { w: 1500, h: 1000 };
const area = { x: 300, y: 100, w: 900, h: 700 };
const cfg: CoreConfig = { rIn: 15, dwellMs: 800, dwellEnabled: true, paused: false };
const DT = 1000 / 30;

function frame(t: number, p: Vec2 | null, pen: PenState = "HOVER", extra: Partial<PointerFrame> = {}): PointerFrame {
  return {
    t,
    tracking: p ? "ok" : "lost",
    lossReason: p ? null : "no-hand",
    rawCamera: null,
    filteredCamera: null,
    rawCanvas: p,
    filtered: p,
    pointer: p,
    pen,
    dwell: { kind: null, progress: 0, anchor: null, armed: true },
    events: [],
    ...extra,
  };
}

function setup() {
  const core = createDesktopCore({ screen, area });
  core.setConnected(true);
  core.step(frame(-DT, { x: 2000, y: 2000 }), cfg, -DT); // pen seen up once after connecting
  let t = 0;
  const sent: OutMsg[] = [];
  const run = (p: Vec2 | null, ms: number, pen: PenState = "HOVER", c: CoreConfig = cfg, extra: Partial<PointerFrame> = {}) => {
    const results = [];
    const end = t + ms;
    while (t < end) {
      const r = core.step(frame(t, p, pen, extra), c, t);
      sent.push(...r.msgs);
      results.push(r);
      t += DT;
    }
    return results;
  };
  const kinds = () => sent.map((m) => m.t);
  return { core, sent, run, kinds, now: () => t, advance: (ms: number) => (t += ms) };
}

describe("button only inside the drawing area", () => {
  it("pen down inside → move then down; leaving → up then move; re-entering → move then down", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    expect(s.kinds().slice(0, 2)).toEqual(["move", "down"]);
    expect(s.sent[0]).toEqual({ t: "move", x: 400, y: 200 });
    s.sent.length = 0;
    s.run({ x: -40, y: 100 }, 50, "DRAWING");
    expect(s.kinds()[0]).toBe("up");
    expect(s.sent[1]).toEqual({ t: "move", x: 260, y: 200 });
    s.sent.length = 0;
    s.run({ x: 50, y: 50 }, 50, "DRAWING");
    expect(s.kinds().slice(0, 2)).toEqual(["move", "down"]);
    expect(s.core.buttonDown).toBe(true);
  });

  it("pen-down is refused outside the area (no down ever sent)", () => {
    const s = setup();
    s.run({ x: -100, y: 300 }, 1000, "DRAWING");
    s.run({ x: 1000, y: 300 }, 1000, "DRAWING");
    expect(s.kinds()).not.toContain("down");
    expect(s.core.buttonDown).toBe(false);
  });

  it("never sends a move outside the area while the button is held", () => {
    const s = setup();
    let x = 800;
    let held = false;
    for (let i = 0; i < 60; i++) {
      const r = s.core.step(frame(i * DT, { x, y: 300 }, "DRAWING"), cfg, i * DT);
      for (const m of r.msgs) {
        if (m.t === "down") held = true;
        if (m.t === "up") held = false;
        if (m.t === "move" && held) expect(m.x).toBeLessThanOrEqual(area.x + area.w);
      }
      x += 10;
    }
  });

  it("respects the engine's inking flag", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 200, "DRAWING", cfg, { inking: false });
    expect(s.kinds()).not.toContain("down");
  });
});

describe("fail safe", () => {
  it("tracking loss sends up and freezes the pointer", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    s.sent.length = 0;
    s.run(null, 500, "DRAWING");
    expect(s.kinds()).toEqual(["up"]);
  });

  it("pause sends up and stops moves", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    s.sent.length = 0;
    s.run({ x: 120, y: 100 }, 300, "DRAWING", { ...cfg, paused: true });
    expect(s.kinds()).toEqual(["up"]);
  });

  it("any pen-up event lifts immediately; pen-downs wait for the next frame", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    expect(s.core.penEvent({ type: "pen-up", t: 0, cause: "key" })).toEqual([{ t: "up" }]);
    expect(s.core.penEvent({ type: "pen-up", t: 0, cause: "key" })).toEqual([]);
    expect(s.core.penEvent({ type: "pen-down", t: 0, at: { x: 1, y: 1 }, cause: "key" })).toEqual([]);
  });

  it("watchdog: frames stop while held → up; ping every tick while connected", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    const last = s.now() - DT;
    expect(s.core.tick(last + 100)).toEqual([{ t: "ping" }]);
    expect(s.core.tick(last + 350)).toEqual([{ t: "up" }, { t: "ping" }]);
    expect(s.core.buttonDown).toBe(false);
  });

  it("release() and disconnect clear the button", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    expect(s.core.release()).toEqual([{ t: "up" }]);
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    expect(s.core.buttonDown).toBe(true);
    s.core.setConnected(false);
    expect(s.core.buttonDown).toBe(false);
    expect(s.core.tick(99999)).toEqual([]);
  });

  it("helper state messages are authoritative (re-press after a helper-side release)", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 100, "DRAWING");
    s.core.onHelperState(false);
    s.sent.length = 0;
    s.run({ x: 101, y: 100 }, 40, "DRAWING");
    expect(s.kinds()).toContain("down");
  });

  it("disconnected: sends nothing", () => {
    const s = setup();
    s.core.setConnected(false);
    s.run({ x: 100, y: 100 }, 500, "DRAWING");
    s.run({ x: -100, y: 100 }, 2000);
    expect(s.sent).toEqual([]);
  });
});

describe("dwell: inside = pen toggle (engine), outside = click", () => {
  it("a still hand outside clicks exactly once, even after 5 s", () => {
    const s = setup();
    s.run({ x: -150, y: 200 }, 6000);
    expect(s.kinds().filter((k) => k === "click")).toHaveLength(1);
  });

  it("moving away and back allows a second click", () => {
    const s = setup();
    s.run({ x: -150, y: 200 }, 1500);
    s.run({ x: -250, y: 260 }, 700);
    s.run({ x: -150, y: 200 }, 1500);
    expect(s.kinds().filter((k) => k === "click")).toHaveLength(2);
  });

  it("dwelling inside the area never clicks (the engine toggles the pen there)", () => {
    const s = setup();
    s.run({ x: 300, y: 300 }, 4000);
    expect(s.kinds()).not.toContain("click");
  });

  it("no click while dwell-click is off, dwell input is off, or the pen is down", () => {
    const s = setup();
    s.core.setDwellClick(false);
    s.run({ x: -150, y: 200 }, 2000);
    s.core.setDwellClick(true);
    s.run({ x: -250, y: 200 }, 300);
    s.run({ x: -150, y: 200 }, 2000, "HOVER", { ...cfg, dwellEnabled: false });
    s.run({ x: -250, y: 200 }, 300);
    s.run({ x: -150, y: 200 }, 2000, "DRAWING");
    expect(s.kinds()).not.toContain("click");
  });

  it("reports click progress for the panel and the click position", () => {
    const s = setup();
    const rs = s.run({ x: -150, y: 200 }, 1200);
    expect(Math.max(...rs.map((r) => r.progress))).toBeGreaterThan(0.5);
    const fired = rs.find((r) => r.clicked);
    expect(fired?.clicked).toEqual({ x: 150, y: 300 });
  });

  it("no click from a resting hand right after tracking comes back", () => {
    const s = setup();
    s.run(null, 500);
    s.run({ x: -150, y: 200 }, 3000);
    expect(s.kinds()).not.toContain("click");
  });
});

describe("drawing-area setup", () => {
  it("dwell top-left then bottom-right sets the area; the button is never held during setup", () => {
    const s = setup();
    s.core.startSetup();
    expect(s.core.area).toEqual({ x: 0, y: 0, w: 1500, h: 1000 }); // full screen while setting up
    expect(s.core.isInside({ x: 10, y: 10 })).toBe(false);
    s.run({ x: 600, y: 400 }, 300, "DRAWING"); // arrive (moves arm the dwell)
    const r1 = s.run({ x: 200, y: 150 }, 1500, "DRAWING");
    expect(r1.find((r) => r.corner)?.corner).toEqual({ stage: "top-left", at: { x: 200, y: 150 } });
    expect(s.core.setupStage).toBe("bottom-right");
    const r2 = s.run({ x: 1100, y: 800 }, 1500, "DRAWING");
    expect(r2.find((r) => r.areaDone)?.areaDone).toEqual({ x: 200, y: 150, w: 900, h: 650 });
    expect(s.core.setupStage).toBeNull();
    expect(s.core.area).toEqual({ x: 200, y: 150, w: 900, h: 650 });
    expect(s.kinds()).not.toContain("down");
    expect(s.kinds()).not.toContain("click");
  });

  it("a too-small area is rejected and setup restarts", () => {
    const s = setup();
    s.core.startSetup();
    s.run({ x: 600, y: 400 }, 300);
    s.run({ x: 200, y: 150 }, 1500);
    const r = s.run({ x: 230, y: 175 }, 1500); // moved > r_in but only 30 × 25 pt
    expect(r.some((x) => x.areaRejected)).toBe(true);
    expect(s.core.setupStage).toBe("top-left");
    expect(s.core.savedArea).toEqual(area);
  });

  it("markCorner (F8 / pen toggle) captures at the pointer", () => {
    const s = setup();
    s.core.startSetup();
    s.run({ x: 100, y: 120 }, 50);
    expect(s.core.markCorner(s.now()).corner?.stage).toBe("top-left");
    s.run({ x: 900, y: 700 }, 50);
    expect(s.core.markCorner(s.now()).areaDone).toEqual({ x: 100, y: 120, w: 800, h: 580 });
  });

  it("a pen left down during setup does not press the button until it has been lifted once", () => {
    const s = setup();
    s.core.startSetup();
    s.run({ x: 100, y: 120 }, 50, "DRAWING");
    s.core.markCorner(s.now());
    s.run({ x: 900, y: 700 }, 50, "DRAWING");
    expect(s.core.markCorner(s.now()).areaDone).not.toBeNull();
    s.run({ x: 100, y: 100 }, 500, "DRAWING");
    expect(s.kinds()).not.toContain("down");
    s.run({ x: 100, y: 100 }, 50, "HOVER");
    s.run({ x: 100, y: 100 }, 50, "DRAWING");
    expect(s.kinds()).toContain("down");
  });

  it("connecting while the pen is already down waits for a pen-up", () => {
    const core = createDesktopCore({ screen, area });
    core.step(frame(0, { x: 10, y: 10 }, "DRAWING"), cfg, 0);
    core.setConnected(true);
    expect(core.step(frame(40, { x: 10, y: 10 }, "DRAWING"), cfg, 40).msgs.map((m) => m.t)).not.toContain("down");
  });

  it("cancel keeps the old area", () => {
    const s = setup();
    s.core.startSetup();
    s.core.cancelSetup();
    expect(s.core.area).toEqual(area);
  });
});

describe("move throttling", () => {
  it("one move per frame at most, none for a still or sub-point-jittering pointer", () => {
    const s = setup();
    s.run({ x: 100, y: 100 }, 1000);
    s.run({ x: 100.1, y: 100.1 }, 1000);
    expect(s.kinds().filter((k) => k === "move")).toHaveLength(1);
    let moves = 0;
    const t0 = s.now();
    for (let i = 0; i < 30; i++) {
      moves += s.core.step(frame(t0 + i * 2, { x: 200 + i, y: 100 }), cfg, t0 + i * 2).msgs.filter((m) => m.t === "move").length;
    }
    // 30 calls within 60 ms, min interval 8 ms → at most 8 moves
    expect(moves).toBeLessThanOrEqual(8);
    expect(moves).toBeGreaterThanOrEqual(6);
  });
});
