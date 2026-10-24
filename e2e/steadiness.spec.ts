/**
 * P0 definition of done: the Steadiness slider visibly changes the result; voice/typed
 * "steadier" / "looser" move it by ±10 (§0 rule 8).
 *
 * ASSUMPTIONS
 *  - Steadiness is a native range input labelled "Steadiness" (0..100), mirrored in
 *    getState().settings.steadiness. Changing it applies live to the pipeline.
 *  - Each test uses a fresh browser context, so persisted settings do not leak between runs.
 */
import { expect, test, type Browser } from "@playwright/test";
import { canvas, command, getState, openApp, playToEnd, waitForState } from "./helpers";

async function drawWordAt(browser: Browser, steadiness: number): Promise<Buffer> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await openApp(page, { fixture: "word-tremor" });
  await page.getByRole("slider", { name: /steadiness/i }).fill(String(steadiness));
  await waitForState(page, (s, v) => s.settings.steadiness === v, { arg: steadiness, timeout: 2_000, message: "slider should update settings" });
  await playToEnd(page);
  await waitForState(page, (s) => s.strokeCount === 1 && s.pen === "HOVER", { timeout: 3_000 });
  const shot = await canvas(page).screenshot();
  await ctx.close();
  return shot;
}

test("Steadiness 0 and 100 draw visibly different strokes from the same input", async ({ browser }) => {
  const loose = await drawWordAt(browser, 0);
  const steady = await drawWordAt(browser, 100);
  expect(loose.equals(steady), "canvas renders should differ").toBe(false);
});

test('"steadier" and "looser" move Steadiness by 10', async ({ page }) => {
  await openApp(page, { fixture: "still-10s" });
  const start = (await getState(page)).settings.steadiness;
  await command(page, "steadier");
  await waitForState(page, (s, v) => s.settings.steadiness === Math.min(100, (v as number) + 10), { arg: start, timeout: 2_000 });
  await command(page, "looser");
  await waitForState(page, (s, v) => s.settings.steadiness === v, { arg: start, timeout: 2_000 });
  await expect(page.getByRole("slider", { name: /steadiness/i })).toHaveAttribute("aria-valuetext", `Steadiness ${start} of 100`);
});
