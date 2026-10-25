import fixtures from '../fixtures/phase03-v1.json';
import { expect, it } from 'vitest';
import { CanvasCapture, validateCanvas } from '../src/main/canvas';
const display = { x: -1920, y: -200, width: 1920, height: 1080 };
const panel = { x: -336, y: -176, width: 320, height: 560 };
it('captures ordered Quartz logical corners on negative-origin displays and ends paused-ready', () => {
  const capture = new CanvasCapture(); capture.begin();
  expect(capture.mark({ x: -1800, y: -100 }, display, [panel])).toBeNull();
  expect(capture.mark({ x: -700, y: 600 }, display, [panel])).toEqual({ x: -1800, y: -100, width: 1100, height: 700 });
  expect(capture.active).toBe(false); expect(capture.message).toContain('paused');
});
it('rejects reverse, undersized, off-display, nonfinite and panel-overlapping rectangles', () => {
  for (const [first, second] of [[{x:0,y:0},{x:-100,y:100}], [{x:-1800,y:0},{x:-1701,y:100}], [{x:-2000,y:0},{x:-1000,y:100}], [{x:NaN,y:0},{x:-1000,y:100}], [{x:-500,y:0},{x:-100,y:500}]]) expect(() => validateCanvas(first!, second!, display, [panel])).toThrow();
  expect(validateCanvas({x:-1800,y:0},{x:-1700,y:100},display,[panel]).width).toBe(100);
});
it('failed second corner keeps first corner for retry; cancel does not invent a canvas', () => {
  const capture = new CanvasCapture(); expect(() => capture.mark({x:-1800,y:0}, display, [])).toThrow();
  capture.begin(); capture.mark({x:-1800,y:0},display,[]);
  expect(() => capture.mark({x:-1790,y:10},display,[])).toThrow(); expect(capture.active).toBe(true);
  capture.cancel(); expect(capture.firstCorner).toBeNull(); expect(capture.active).toBe(false);
});

it('agrees with shared Phase03 positive/negative canvas fixtures', () => {
  for (const fixture of fixtures.canvas.positive) expect(validateCanvas(fixture.corners[0]!, fixture.corners[1]!, fixture.display, [fixture.panel]), fixture.name).toEqual(fixture.rect);
  for (const fixture of fixtures.canvas.negative) expect(() => validateCanvas(fixture.corners[0]!, fixture.corners[1]!, fixture.display, [fixture.panel]), fixture.name).toThrow();
});
