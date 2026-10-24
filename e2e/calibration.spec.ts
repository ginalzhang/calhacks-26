/**
 * §9: calibration completes (ReplaySource, fixture `calibration`: 3 s still, then a 4 s circle).
 *
 * ASSUMPTIONS
 *  - Typed/`__steady.command("calibrate")` starts the two-step calibration (action `calibrate`).
 *  - Calibration times its steps from the first tracked frame (runtime REST_MS 3000, CIRCLE_MS 4000),
 *    so the fixture is loaded with `autoplay=0` and played only once `calibrating` is true.
 *  - When done: `calibrated === true`, `calibrating === false`, gain within the 2..10 slider range.
 *  - The app may ask once for "a slightly larger circle"; the test then replays the circle again.
 */
import { expect, test } from "@playwright/test";
import { command, getState, openApp, playToEnd, waitForState } from "./helpers";

test("calibration completes from the replayed rest + circle", async ({ page }) => {
  await openApp(page, { fixture: "calibration" });
  await command(page, "calibrate");
  await waitForState(page, (s) => s.calibrating, { message: '"calibrate" should start calibration' });

  await playToEnd(page);
  let s = await getState(page);
  if (s.calibrating) {
    // Asked for a larger circle once: replay the fixture (its circle) again.
    await playToEnd(page);
  }
  s = await waitForState(page, (st) => st.calibrated && !st.calibrating, { timeout: 8_000, message: "calibration should finish" });
  expect(s.settings.gain).toBeGreaterThanOrEqual(2);
  expect(s.settings.gain).toBeLessThanOrEqual(10);
  expect(s.strokeCount, "calibration never leaves ink").toBe(0);
});
