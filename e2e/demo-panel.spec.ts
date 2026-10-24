/**
 * §7 / §9: the Demo panel (`?demo=1`) shows live metrics; Next judge only with ?demo=1.
 *
 * ASSUMPTIONS
 *  - `?demo=1` opens the Demo panel expanded: the "Demo" tile has aria-pressed="true".
 *  - The panel shows text for: deviation (RMS px), last-stroke time, command success, Claude call
 *    counts ("Claude: N calls ..."), camera/detection fps.
 *  - "Simulate tremor" and "Ghost view" are toggle tiles (aria-pressed); "Next judge" is visible
 *    only with ?demo=1.
 *  - `getState().metrics` carries numeric deviation values once a stroke has been drawn.
 */
import { expect, test } from "@playwright/test";
import { getState, openApp, playToEnd, waitForState } from "./helpers";

test("Demo panel shows metrics and demo toggles", async ({ page }) => {
  await openApp(page, { fixture: "word-tremor", demo: true });
  const demo = page.getByRole("button", { name: "Demo", exact: true });
  await expect(demo).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Simulate tremor", exact: true })).toHaveAttribute("aria-pressed", /true|false/);
  await expect(page.getByRole("button", { name: "Ghost view", exact: true })).toHaveAttribute("aria-pressed", /true|false/);
  await expect(page.getByRole("button", { name: "Next judge", exact: true })).toBeVisible();

  await playToEnd(page);
  await waitForState(page, (s) => s.strokeCount === 1, { timeout: 3_000 });

  for (const re of [/deviation/i, /stroke time|last stroke/i, /command success|commands?/i, /claude/i, /fps/i]) {
    await expect(page.getByText(re).first(), `Demo panel should show ${re}`).toBeVisible();
  }
  const m = (await getState(page)).metrics;
  expect(typeof m.deviationRawPx).toBe("number");
  expect(typeof m.deviationSmoothedPx).toBe("number");
  expect(m.deviationRawPx, "raw deviation is measured on the tremor word").toBeGreaterThan(0);
});

test("Next judge is hidden without ?demo=1", async ({ page }) => {
  await openApp(page, { fixture: "still-10s" });
  await expect(page.getByRole("button", { name: "Next judge", exact: true })).toHaveCount(0);
});

test("Simulate tremor toggles aria-pressed", async ({ page }) => {
  await openApp(page, { fixture: "still-10s", demo: true });
  const sim = page.getByRole("button", { name: "Simulate tremor", exact: true });
  const before = await sim.getAttribute("aria-pressed");
  await sim.click();
  await expect(sim).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
});
