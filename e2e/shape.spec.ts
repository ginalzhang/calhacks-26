/**
 * §9: typed "make it a circle" converts the last stroke.
 *
 * ASSUMPTIONS
 *  - The typed-command box is a textbox labelled with "command"; Enter submits it; the local
 *    grammar matches "make it a circle" exactly (action `shape.circle`, no network needed).
 *  - After conversion `getState().lastStrokeKind === "circle"` and the stroke count is unchanged
 *    (replace, not add). The conversion is undoable ("Undo: make it a circle").
 */
import { expect, test } from "@playwright/test";
import { getState, openApp, playToEnd, typedBox, waitForState } from "./helpers";

test('typed "make it a circle" turns the last stroke into a circle', async ({ page }) => {
  await openApp(page, { fixture: "circle-stroke" });
  await playToEnd(page);
  await waitForState(page, (s) => s.strokeCount === 1 && s.pen === "HOVER", { timeout: 4_000, message: "circle-stroke should leave one stroke" });

  const box = typedBox(page);
  await expect(box).toBeVisible();
  await box.fill("make it a circle");
  await box.press("Enter");

  const s = await waitForState(page, (st) => st.lastStrokeKind === "circle", { timeout: 5_000, message: "last stroke should become a circle" });
  expect(s.strokeCount).toBe(1);
  expect(s.undoLabel ?? "").toMatch(/circle/i);
  // The box does not keep the submitted command around to be re-run by accident.
  expect((await getState(page)).pen).toBe("HOVER");
});
