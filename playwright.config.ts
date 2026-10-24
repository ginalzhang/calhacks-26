import { defineConfig, devices } from "@playwright/test";

/**
 * Steady end-to-end tests (PROMPT.md §9).
 *
 * - Project "replay": every spec except fake-camera; drives the app with ReplaySource
 *   (`?source=replay&fixture=<name>`) and `window.__steady` (src/tracking/LandmarkSource.ts).
 * - Project "fake-camera": Chromium with a fake webcam fed from e2e/assets/hand.y4m.
 *   Skips with a clear message when the clip has not been recorded yet.
 *
 * A shared dev server normally runs on :3217 already; `reuseExistingServer` attaches to it.
 * If nothing is listening, Playwright starts `npm run dev -- -p 3217` itself.
 */
const PORT = 3217;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Replays run on real timing (5-11 s each) and the dev server compiles on first hit.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "replay",
      testIgnore: /fake-camera\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "fake-camera",
      testMatch: /fake-camera\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--use-file-for-fake-video-capture=e2e/assets/hand.y4m",
          ],
        },
      },
    },
  ],
});
