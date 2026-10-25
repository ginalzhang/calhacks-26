# Steady

Steady is a working prototype of a local macOS drawing companion for Krita on Apple Silicon/macOS 26+. It maps camera-based head or palm tracking to a calibrated canvas and provides drawing controls through a floating panel and configurable global keys. It includes five-position calibration, canvas marking, explicit real-input opt-in, and pause/recovery controls.

Physical-camera and Krita acceptance remain partially unverified. Voice input and speech-asset installation are disabled. Generic shortcut profiles are configuration previews; native execution supports the fixed Krita profile.

## Development

Use Node 26.12.1, npm 11.20.0, Swift 6.4, and macOS SDK 27.0. Install the pinned dependencies with the committed `package-lock.json`.

```sh
npm ci
npm run setup:electron
npm run assets
npm run dev
```

Development starts Forge/Vite and the bundled native helper. If the environment sets `ELECTRON_RUN_AS_NODE=1`, unset it before launching Electron; Playwright does this explicitly. Packaged resources load locally from files and `steady-resource:`. Model/runtime URLs and hashes are recorded in [the asset manifest](resources/asset-manifest.json). Restore assets with `npm run assets`; runtime downloads and CDN fallback are blocked.

## Checks and packaging

```sh
npm run typecheck
npm test
npm run test:native
npm run package
npm run test:e2e
npm run make
```

Package before running the packaged-app end-to-end tests. Automated tests use fake input; they do not establish physical-camera, real desktop input, fullscreen, permissions, external-display, or offline inference acceptance.

The packaged app is `out/Steady-darwin-arm64/Steady.app`. ZIP output is `out/make/zip/darwin/arm64/Steady-darwin-arm64-0.1.0.zip`. The Swift executable and verified model/runtime files are outside ASAR under `Contents/Resources/`. See [the native helper documentation](native/README.md) for protocol and runtime details.

## Using the prototype

The panel starts paused, with camera and microphone off and fake native input enabled.

1. Open Settings, select a camera and tracking mode, and start capture. The preview is mirrored.
2. Complete neutral/left/right/up/down calibration. Each capture samples for two seconds and requires at least 40 valid samples and 80% validity. Calibration is saved separately per camera and mode. Recenter preserves extents and leaves input paused.
3. Open a disposable Krita document, select the display, and explicitly enable real input in Settings.
4. Close Settings, keep Krita in the foreground, and choose **Set canvas** on the floating panel. Use F8 to mark the top-left and bottom-right corners. Canvas setup ends paused.
5. Resume explicitly after tracking is valid for 500 ms. F8 otherwise toggles the pen; F9 pauses. Additional global keys can be configured in Settings.

Reconfirm the canvas each launch and after geometry, camera, or mode changes. Opening Settings, target changes, and tracking loss release input. Recovery never resumes automatically. The panel continues to own capture when unfocused or collapsed. After declared palm loss, show only the selected model label and explicitly confirm the hand; continuity uses a conservative label/proximity heuristic.

Settings also offers a bounded real-input probe in the packaged app. Confirm a disposable Krita document, switch to Krita during the five-second countdown, and keep the physical cursor over the canvas with room for a ten-point rightward stroke. Emergency release is available in Settings.

## Known limitations

- Relaxed desk-facing palm tracking remains unverified; earlier validation used a raised hand.
- The 10-second warmup and 60-second baseline measure renderer mapping rate and receipt-to-map processing time. Camera inference p95 measures bitmap dispatch to result receipt. These do not establish native-event or perceived smoothing latency.
- Speech implementation and diagnostics remain in the source, but microphone enable and speech-asset installation are rejected. Live recognition and speech timing are unverified.
- No camera frames, recordings, or transcripts are persisted. Retained speech timing diagnostics contain identifiers and counters only.

Historical plans, reviews, operator checklists, and execution evidence are preserved locally in `.archive/plan/`. `.archive/` is ignored by Git and is not included in fresh checkouts. These records describe earlier development milestones; this README describes the current working prototype.
