import { describe, expect, it } from "vitest";
import {
  areaFromCorners,
  areaPoint,
  clampToScreen,
  desktopDwellAction,
  fullScreenArea,
  insideArea,
  movedEnough,
  sanitizeArea,
  screenTarget,
  screenToArea,
  shouldHoldButton,
  type HoldInput,
} from "./mapping";
import { mapToCanvas } from "@/pipeline/activeBox";

const screen = { w: 1512, h: 982 };
const area = { x: 400, y: 120, w: 800, h: 600 }; // e.g. the Krita canvas

describe("active box → drawing area in screen points", () => {
  it("maps engine px (area-relative) onto the area", () => {
    expect(areaPoint({ x: 0, y: 0 }, area)).toEqual({ x: 400, y: 120 });
    expect(areaPoint({ x: 800, y: 600 }, area)).toEqual({ x: 1200, y: 720 });
    expect(areaPoint({ x: 400, y: 300 }, area)).toEqual({ x: 800, y: 420 });
    expect(screenToArea({ x: 800, y: 420 }, area)).toEqual({ x: 400, y: 300 });
  });

  it("composes with the engine's active-box map: box corners land on area corners", () => {
    const box = { x: 220, y: 160, w: 200, h: 150 }; // camera px
    const engine = { w: area.w, h: area.h }; // B sets engine canvas = area size in Desktop mode
    const tl = areaPoint(mapToCanvas({ x: 220, y: 160 }, box, engine), area);
    const br = areaPoint(mapToCanvas({ x: 420, y: 310 }, box, engine), area);
    const mid = areaPoint(mapToCanvas({ x: 320, y: 235 }, box, engine), area);
    expect(tl).toEqual({ x: 400, y: 120 });
    expect(br).toEqual({ x: 1200, y: 720 });
    expect(mid).toEqual({ x: 800, y: 420 });
  });

  it("scales when the engine canvas size differs from the area", () => {
    expect(areaPoint({ x: 400, y: 300 }, area, { w: 400, h: 300 })).toEqual({ x: 1200, y: 720 });
  });

  it("default area is the whole main display", () => {
    expect(fullScreenArea(screen)).toEqual({ x: 0, y: 0, w: 1512, h: 982 });
  });

  it("clamps to the screen", () => {
    expect(clampToScreen({ x: -10, y: 5000 }, screen)).toEqual({ x: 0, y: 981 });
  });
});

describe("inside / outside the drawing area", () => {
  it("insideArea uses engine px, edges inclusive", () => {
    expect(insideArea({ x: 0, y: 0 }, area)).toBe(true);
    expect(insideArea({ x: 800, y: 600 }, area)).toBe(true);
    expect(insideArea({ x: -1, y: 10 }, area)).toBe(false);
    expect(insideArea({ x: 10, y: 601 }, area)).toBe(false);
  });

  it("dwell inside = pen toggle, outside = click", () => {
    expect(desktopDwellAction(true)).toBe("pen-toggle");
    expect(desktopDwellAction(false)).toBe("click");
  });
});

describe("pen-down (button held) only inside the area", () => {
  const base: HoldInput = { connected: true, tracking: "ok", pen: "DRAWING", inside: true, paused: false, settingUp: false };
  it("holds inside with the pen down", () => {
    expect(shouldHoldButton(base)).toBe(true);
    expect(shouldHoldButton({ ...base, inking: true })).toBe(true);
  });
  it("refuses outside the area", () => {
    expect(shouldHoldButton({ ...base, inside: false })).toBe(false);
  });
  it("refuses on tracking loss, pause, setup, disconnect, pen up, or when the engine is not inking", () => {
    expect(shouldHoldButton({ ...base, tracking: "lost" })).toBe(false);
    expect(shouldHoldButton({ ...base, paused: true })).toBe(false);
    expect(shouldHoldButton({ ...base, settingUp: true })).toBe(false);
    expect(shouldHoldButton({ ...base, connected: false })).toBe(false);
    expect(shouldHoldButton({ ...base, pen: "HOVER" })).toBe(false);
    expect(shouldHoldButton({ ...base, inking: false })).toBe(false);
  });
});

describe("never drag outside the area", () => {
  it("clamps the target to the area while holding, not while hovering", () => {
    expect(screenTarget({ x: -50, y: 700 }, area, screen, true)).toEqual({ x: 400, y: 720 });
    expect(screenTarget({ x: -50, y: 700 }, area, screen, false)).toEqual({ x: 350, y: 820 });
  });
});

describe("area setup corners", () => {
  it("normalises any corner order and clamps to the screen", () => {
    expect(areaFromCorners({ x: 1200, y: 720 }, { x: 400, y: 120 }, screen)).toEqual(area);
    expect(areaFromCorners({ x: -20, y: -20 }, { x: 2000, y: 2000 }, screen)).toEqual(fullScreenArea(screen));
  });
  it("rejects a too-small area", () => {
    expect(areaFromCorners({ x: 100, y: 100 }, { x: 120, y: 400 }, screen)).toBeNull();
    expect(areaFromCorners({ x: 100, y: 100 }, { x: NaN, y: 400 }, screen)).toBeNull();
  });
  it("sanitizes persisted areas", () => {
    expect(sanitizeArea(area, screen)).toEqual(area);
    expect(sanitizeArea({ x: 1400, y: 0, w: 500, h: 500 }, screen)).toEqual({ x: 1400, y: 0, w: 112, h: 500 });
    expect(sanitizeArea({ x: 0, y: 0, w: "5", h: 5 }, screen)).toBeNull();
    expect(sanitizeArea(null, screen)).toBeNull();
  });
});

describe("move throttling helper", () => {
  it("skips sub-point moves", () => {
    expect(movedEnough(null, { x: 1, y: 1 })).toBe(true);
    expect(movedEnough({ x: 1, y: 1 }, { x: 1.1, y: 1.2 })).toBe(false);
    expect(movedEnough({ x: 1, y: 1 }, { x: 1.3, y: 1 })).toBe(true);
  });
});
