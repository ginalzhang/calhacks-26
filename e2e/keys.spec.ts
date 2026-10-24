/**
 * §3 key map / §9: Backspace undoes; Space toggles the pen; keys do nothing inside the typed box.
 *
 * ASSUMPTIONS
 *  - One document keydown listener; it ignores events whose target is a button/input/textarea/select.
 *  - The canvas has tabIndex=0 and role=img; focusing it and pressing keys reaches the key map.
 *  - Backspace and Z undo; Y redoes; Space toggles pen; Esc in the typed box returns focus to the canvas.
 */
import { expect, test } from "@playwright/test";
import { canvas, drawOneStroke, focusCanvas, getState, openApp, pause, play, typedBox, waitForState } from "./helpers";

test("Backspace undoes the last stroke, Y redoes it, Z undoes again", async ({ page }) => {
  await openApp(page, { fixture: "dwell-stroke" });
  await drawOneStroke(page);
  expect((await getState(page)).undoLabel).toBeTruthy();
  await focusCanvas(page);
  await page.keyboard.press("Backspace");
  await waitForState(page, (s) => s.strokeCount === 0, { timeout: 2_000, message: "Backspace should undo" });
  await page.keyboard.press("y");
  await waitForState(page, (s) => s.strokeCount === 1, { timeout: 2_000, message: "Y should redo" });
  await page.keyboard.press("z");
  await waitForState(page, (s) => s.strokeCount === 0, { timeout: 2_000, message: "Z should undo" });
});

test("Space toggles the pen from the canvas", async ({ page }) => {
  await openApp(page, { fixture: "still-10s" });
  // Acquire tracking first (no hand = no pen), then pause before the 800 ms pen-down dwell can fire.
  await play(page);
  await waitForState(page, (s) => s.tracking === "ok", { timeout: 3_000, message: "replay should give tracking" });
  await pause(page);
  expect((await getState(page)).pen).toBe("HOVER");
  await focusCanvas(page);
  await page.keyboard.press(" ");
  await waitForState(page, (s) => s.pen === "DRAWING", { timeout: 2_000, message: "Space should put the pen down" });
  await page.keyboard.press(" ");
  await waitForState(page, (s) => s.pen === "HOVER", { timeout: 2_000, message: "Space should lift the pen" });
});

test("keys type normally inside the typed-command box", async ({ page }) => {
  await openApp(page, { fixture: "dwell-stroke" });
  await drawOneStroke(page);
  const box = typedBox(page);
  await box.click();
  await page.keyboard.type("z y");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("m");
  await page.keyboard.press("p");
  const s = await getState(page);
  expect(s.strokeCount, "z/Backspace in the box must not undo").toBe(1);
  expect(s.pen, "Space in the box must not toggle the pen").toBe("HOVER");
  expect(s.tracking, "P in the box must not pause tracking").toBe("ok");
  await expect(box).toHaveValue("z mp");

  await page.keyboard.press("Escape");
  await expect(canvas(page)).toBeFocused();
});
