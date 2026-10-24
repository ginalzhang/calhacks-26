/**
 * §0 rule 6 / §5: destructive actions use a modal alertdialog; Esc cancels; focus starts on Cancel.
 *
 * ASSUMPTIONS
 *  - "Clear page" (action `page.clear`, destructive) opens role="alertdialog" with an accessible name.
 *  - Focus moves to the cancel button ("✗ No" or a button named Cancel) on open and is restored on close.
 *  - Esc cancels; Enter on the focused cancel button cancels; typed "yes" confirms.
 */
import { expect, test } from "@playwright/test";
import { command, drawOneStroke, getState, openApp, tile, waitForState } from "./helpers";

test("Esc cancels the Clear page dialog and keeps the drawing", async ({ page }) => {
  await openApp(page, { fixture: "dwell-stroke" });
  await drawOneStroke(page);
  const clear = await tile(page, "page.clear");
  await clear.click();
  const dlg = page.getByRole("alertdialog");
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAccessibleName(/.+/);
  const focusedName = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el && el.closest('[role="alertdialog"]') ? (el.getAttribute("aria-label") ?? el.textContent ?? "").trim() : null;
  });
  expect(focusedName, "focus moves into the dialog, on the cancel button").toMatch(/no|cancel/i);

  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  expect((await getState(page)).strokeCount).toBe(1);
});

test("Enter on the focused cancel button cancels; typed yes confirms", async ({ page }) => {
  await openApp(page, { fixture: "dwell-stroke" });
  await drawOneStroke(page);
  await command(page, "clear page");
  const dlg = page.getByRole("alertdialog");
  await expect(dlg).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(dlg).toBeHidden();
  expect((await getState(page)).strokeCount, "a stray Enter cancels").toBe(1);

  await command(page, "clear page");
  await expect(dlg).toBeVisible();
  await command(page, "yes");
  await expect(dlg).toBeHidden();
  await waitForState(page, (s) => s.strokeCount === 0, { timeout: 2_000, message: '"yes" should confirm the clear' });
});
