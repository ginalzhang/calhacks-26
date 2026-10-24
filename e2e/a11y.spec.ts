/**
 * §0 rule 6: basic accessibility checks (no axe dependency; explicit checks for the spec's rules).
 *
 * ASSUMPTIONS
 *  - Tiles are real <button>s whose visible text is ACTIONS[].label, each ≥ 64×64 CSS px.
 *  - Toggle tiles (ACTIONS[].toggle) expose aria-pressed.
 *  - The P0 tiles Pen, Latch, Undo and Save PNG are reachable (directly or via a category tile).
 *  - The canvas is role="img" with an aria-label starting "Drawing canvas"; a role="status" live
 *    region exists; the Steadiness slider is a native range input with a label and
 *    aria-valuetext "Steadiness N of 100".
 */
import { expect, test } from "@playwright/test";
import { ACTIONS } from "../src/actions";
import { canvas, openApp, tile } from "./helpers";

test("tiles are named buttons, at least 64 px, toggles expose aria-pressed", async ({ page }) => {
  await openApp(page, { fixture: "still-10s", demo: true });
  for (const id of ["pen.toggle", "latch.toggle", "undo", "export.png"] as const) await tile(page, id);
  await page.keyboard.press("Escape").catch(() => {});

  const checked: string[] = [];
  const problems: string[] = [];
  for (const def of ACTIONS) {
    const btns = page.getByRole("button", { name: def.label, exact: true });
    const n = await btns.count();
    for (let i = 0; i < n; i++) {
      const b = btns.nth(i);
      if (!(await b.isVisible())) continue;
      checked.push(def.label);
      const info = await b.evaluate((el) => ({ tag: el.tagName, pressed: el.getAttribute("aria-pressed"), text: (el.textContent ?? "").trim() }));
      const box = await b.boundingBox();
      if (info.tag !== "BUTTON") problems.push(`${def.label}: is <${info.tag.toLowerCase()}>, not <button>`);
      if (!info.text) problems.push(`${def.label}: no visible text label`);
      if (!box || box.width < 64 - 0.5 || box.height < 64 - 0.5) problems.push(`${def.label}: ${box ? `${Math.round(box.width)}×${Math.round(box.height)}` : "no box"} < 64×64`);
      if (def.toggle && info.pressed !== "true" && info.pressed !== "false") problems.push(`${def.label}: toggle without aria-pressed`);
    }
  }
  expect(checked.length, "some action tiles should be visible").toBeGreaterThanOrEqual(4);
  expect(problems, `checked ${checked.length} tiles`).toEqual([]);
});

test("canvas, live region and Steadiness slider are screen-reader correct", async ({ page }) => {
  await openApp(page, { fixture: "still-10s" });
  const c = canvas(page);
  await expect(c).toBeVisible();
  await expect(c).toHaveAttribute("aria-label", /^Drawing canvas/i);
  expect(await c.getAttribute("tabindex")).toBe("0");
  await expect(page.getByRole("status").first()).toBeAttached();

  const slider = page.getByRole("slider", { name: /steadiness/i });
  await expect(slider).toBeVisible();
  expect(await slider.evaluate((el) => (el as HTMLInputElement).type)).toBe("range");
  await expect(slider).toHaveAttribute("aria-valuetext", /^Steadiness \d+ of 100$/);
});

test("focused tiles show a visible focus ring", async ({ page }) => {
  await openApp(page, { fixture: "still-10s" });
  const pen = await tile(page, "pen.toggle");
  await pen.focus();
  const ring = await pen.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2, shadow: cs.boxShadow !== "none" };
  });
  expect(ring.outline || ring.shadow, "focus ring (outline ≥ 2 px or box-shadow)").toBe(true);
});
