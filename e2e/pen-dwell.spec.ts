/**
 * §9: dwell toggles the pen; a stroke appears; a resting hand never leaves ink.
 *
 * ASSUMPTIONS
 *  - `?skipIntro=1` lands on the ready canvas with default settings (gain 3, dwell 800/1200 ms).
 *  - `dwell-stroke`: still 1.5 s → 2 s stroke → still 2.3 s; pen goes DRAWING by dwell, then HOVER by
 *    dwell, leaving exactly one stroke. `still-10s`: at most one toggle, zero strokes.
 *  - The canvas (role=img) aria-label is updated on pen-up and mentions the stroke count
 *    ("Drawing canvas, page Notes 1, 1 stroke").
 */
import { expect, test } from "@playwright/test";
import { canvas, finished, getState, openApp, penLog, play, playToEnd, recordPen, waitForState } from "./helpers";

test("pen-down and pen-up dwell draw exactly one stroke", async ({ page }) => {
  await openApp(page, { fixture: "dwell-stroke" });
  await recordPen(page);
  expect((await getState(page)).pen).toBe("HOVER");
  await play(page);
  await waitForState(page, (s) => s.pen === "DRAWING", { timeout: 4_000, message: "pen-down dwell should fire during the first 1.5 s" });
  await finished(page);
  const s = await waitForState(page, (st) => st.pen === "HOVER" && st.strokeCount === 1, {
    timeout: 3_000,
    message: "pen-up dwell should lift the pen and commit one stroke",
  });
  expect(s.tracking).toBe("ok");
  expect(await penLog(page)).toEqual(["HOVER", "DRAWING", "HOVER"]);
  await expect(canvas(page)).toHaveAttribute("aria-label", /\b1 stroke\b/i);
});

test("a hand resting still for 10 s never leaves ink", async ({ page }) => {
  await openApp(page, { fixture: "still-10s" });
  await recordPen(page);
  await playToEnd(page);
  const s = await getState(page);
  expect(s.strokeCount).toBe(0);
  const log = await penLog(page);
  expect(log.length - 1, `pen toggles: ${log.join(" → ")}`).toBeLessThanOrEqual(1);
});

test("the slow tremor word is drawn as one stroke (P0 legible word)", async ({ page }) => {
  await openApp(page, { fixture: "word-tremor" });
  await playToEnd(page);
  const s = await waitForState(page, (st) => st.strokeCount === 1 && st.pen === "HOVER", {
    timeout: 3_000,
    message: "word-tremor should leave exactly one stroke and lift the pen",
  });
  expect(s.lastStrokeKind ?? "free").toBe("free");
});
