import { describe, expect, it } from "vitest";
import { IDENTITY_VIEW, MAX_ZOOM, MIN_ZOOM, fitView, isIdentity, moveView, toCanvas, toDoc, unionRect, visibleDocRect, zoomAbout } from "./view";

const canvas = { w: 800, h: 600 };

describe("view transform", () => {
  it("identity view maps points unchanged", () => {
    expect(toDoc({ x: 12, y: 34 }, IDENTITY_VIEW)).toEqual({ x: 12, y: 34 });
    expect(toCanvas({ x: 12, y: 34 }, IDENTITY_VIEW)).toEqual({ x: 12, y: 34 });
    expect(isIdentity(IDENTITY_VIEW)).toBe(true);
  });

  it("toDoc and toCanvas are inverses", () => {
    const v = { zoom: 2.5, pan: { x: -40, y: 75 } };
    const p = { x: 123.4, y: -56.7 };
    const back = toDoc(toCanvas(p, v), v);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it("zoomAbout keeps the anchor point fixed on screen and clamps", () => {
    const about = { x: 400, y: 300 };
    const docBefore = toDoc(about, IDENTITY_VIEW);
    const v = zoomAbout(IDENTITY_VIEW, 1.25, about);
    expect(v.zoom).toBeCloseTo(1.25);
    const screen = toCanvas(docBefore, v);
    expect(screen.x).toBeCloseTo(about.x);
    expect(screen.y).toBeCloseTo(about.y);
    let z = IDENTITY_VIEW;
    for (let i = 0; i < 20; i++) z = zoomAbout(z, 1.25, about);
    expect(z.zoom).toBe(MAX_ZOOM);
    for (let i = 0; i < 40; i++) z = zoomAbout(z, 0.8, about);
    expect(z.zoom).toBe(MIN_ZOOM);
  });

  it("move up shows content further up (content slides down)", () => {
    const v = moveView(IDENTITY_VIEW, "up", canvas);
    expect(v.pan).toEqual({ x: 0, y: 150 });
    expect(moveView(IDENTITY_VIEW, "right", canvas).pan).toEqual({ x: -200, y: 0 });
    // A doc point near the top moves down on screen after "move up".
    expect(toCanvas({ x: 0, y: 0 }, v).y).toBe(150);
  });

  it("fit page is the identity when nothing is drawn or content already fits", () => {
    expect(fitView(null, canvas)).toEqual(IDENTITY_VIEW);
    expect(fitView({ x: 10, y: 10, w: 100, h: 100 }, canvas)).toEqual(IDENTITY_VIEW);
  });

  it("fit page zooms out to show content outside the canvas, centred", () => {
    const content = { x: -400, y: -100, w: 1600, h: 800 };
    const v = fitView(content, canvas, 24);
    expect(v.zoom).toBeLessThan(1);
    const tl = toCanvas({ x: content.x, y: content.y }, v);
    const br = toCanvas({ x: content.x + content.w, y: content.y + content.h }, v);
    expect(tl.x).toBeGreaterThanOrEqual(23.9);
    expect(br.x).toBeLessThanOrEqual(canvas.w - 23.9);
    expect(tl.y).toBeGreaterThanOrEqual(0);
    expect(br.y).toBeLessThanOrEqual(canvas.h);
    expect((tl.x + br.x) / 2).toBeCloseTo(canvas.w / 2);
  });

  it("visibleDocRect and unionRect", () => {
    const v = { zoom: 2, pan: { x: -100, y: -50 } };
    expect(visibleDocRect(v, canvas)).toEqual({ x: 50, y: 25, w: 400, h: 300 });
    expect(unionRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: -5, w: 20, h: 5 })).toEqual({ x: 0, y: -5, w: 25, h: 15 });
    expect(unionRect(null, { x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
});
