/**
 * §9 / §0 rule 10: tracking lost mid-stroke lifts and freezes the pen; it stays up after re-acquire.
 *
 * ASSUMPTIONS
 *  - `tracking-lost`: pen down by dwell, stroke in progress, 1 s of null frames from t = 3.0 s,
 *    then the hand comes back elsewhere and moves (no new dwell possible before the end).
 *  - While lost: `tracking === "lost"`, `lossReason` set, `pen === "HOVER"`, and a role=alert
 *    region says why. After re-acquire the status says "Tracking back. Pen is up."
 *  - `too-dark` (luma 25, intermittent nulls) reports `lossReason "too-dark"` and a status about light.
 */
import { expect, test } from "@playwright/test";
import { finished, getState, openApp, play, waitForState } from "./helpers";

test("tracking loss mid-stroke lifts the pen and keeps it up", async ({ page }) => {
  await openApp(page, { fixture: "tracking-lost" });
  await play(page);
  await waitForState(page, (s) => s.pen === "DRAWING", { timeout: 4_000, message: "pen-down dwell should fire first" });
  const lost = await waitForState(page, (s) => s.tracking === "lost", { timeout: 5_000, message: "tracking should be reported lost" });
  // Within the loss window the pen must be up (> 300 ms rule) and a reason given.
  const during = await waitForState(page, (s) => s.tracking === "lost" && s.pen === "HOVER", { timeout: 1_000, message: "pen should lift while lost" });
  expect(during.lossReason ?? lost.lossReason).toBeTruthy();
  await expect(page.getByRole("alert").filter({ hasText: /tracking|hand|lost/i }).first()).toBeVisible();

  await finished(page);
  const after = await waitForState(page, (s) => s.tracking === "ok", { timeout: 3_000, message: "tracking should come back" });
  expect(after.pen, "pen stays up after re-acquire until an explicit pen-down").toBe("HOVER");
  expect(after.strokeCount, "the interrupted stroke is kept").toBeGreaterThanOrEqual(1);
  expect(after.status).toMatch(/pen is up/i);
});

test("a dark room shows the lighting warning", async ({ page }) => {
  await openApp(page, { fixture: "too-dark" });
  await play(page);
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { __steady: { getState(): { lossReason: string | null; status: string } } }).__steady.getState();
      return s.lossReason === "too-dark" || /dark|light/i.test(s.status);
    },
    null,
    { timeout: 12_000 },
  );
  expect((await getState(page)).status).toMatch(/dark|light|lamp/i);
});
