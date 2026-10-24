/**
 * §9: one run with Chromium's fake webcam fed from a real recorded clip:
 *   --use-fake-device-for-media-stream --use-file-for-fake-video-capture=e2e/assets/hand.y4m
 * (configured in playwright.config.ts, project "fake-camera").
 *
 * ASSUMPTIONS
 *  - e2e/assets/hand.y4m is a 5 s, 640×480 clip of a real resting hand recorded by the team
 *    (see NEEDS-HUMAN.md). It is not synthesised: MediaPipe needs a real hand to detect.
 *    Record e.g. with: ffmpeg -f avfoundation -framerate 30 -video_size 640x480 -i "0" -t 5 -pix_fmt yuv420p e2e/assets/hand.y4m
 *  - Without `source=replay` the app uses MediaPipeSource; `__steady.replay` is null.
 *  - The MediaPipe wasm + model load from the CDN (network required).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { SteadyTestHooks } from "../src/tracking/LandmarkSource";

const CLIP = join(__dirname, "assets", "hand.y4m");

test("webcam path detects the recorded hand", async ({ page }) => {
  test.skip(!existsSync(CLIP), `e2e/assets/hand.y4m is missing: record a 5 s 640x480 clip of a resting hand (see NEEDS-HUMAN.md) to run the fake-camera test.`);
  await page.goto("/?skipIntro=1");
  await page.waitForFunction(() => typeof (window as unknown as { __steady?: unknown }).__steady === "object", null, { timeout: 45_000 });
  expect(await page.evaluate(() => (window as unknown as { __steady: SteadyTestHooks }).__steady.replay)).toBeNull();
  // Model download + first detection; the clip loops, so the hand is visible repeatedly.
  await page.waitForFunction(() => (window as unknown as { __steady: SteadyTestHooks }).__steady.getState().tracking === "ok", null, {
    timeout: 60_000,
    polling: 200,
  });
  const fps = await page.evaluate(() => (window as unknown as { __steady: SteadyTestHooks }).__steady.getState().metrics);
  expect(fps.cameraFps ?? 0).toBeGreaterThan(0);
});
