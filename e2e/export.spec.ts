/**
 * §9: export produces a PNG.
 *
 * ASSUMPTIONS
 *  - The "Save PNG" tile (action `export.png`, possibly inside the "Pages" category) and the typed
 *    command "export picture" both trigger a browser download of a PNG file (canvas.toBlob).
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PNG_SIGNATURE, drawOneStroke, openApp, tile, typedBox } from "./helpers";

test("Save PNG tile downloads a real PNG", async ({ page }) => {
  await openApp(page, { fixture: "dwell-stroke" });
  await drawOneStroke(page);
  const save = await tile(page, "export.png");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10_000 }), save.click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
  const path = await download.path();
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), "file starts with the PNG signature").toBe(true);
  expect(bytes.length).toBeGreaterThan(1000);
});

test('typed "export picture" downloads a PNG', async ({ page }) => {
  await openApp(page, { fixture: "dwell-stroke" });
  await drawOneStroke(page);
  const box = typedBox(page);
  await box.fill("export picture");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10_000 }), box.press("Enter")]);
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
});
