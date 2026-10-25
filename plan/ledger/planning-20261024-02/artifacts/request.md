PLEASE IMPLEMENT THIS PLAN:
# Steady — Decision-Complete MVP Plan, Revision 2

## 1. Summary and fixed scope

Build a standalone Mac application that helps artists draw in Krita using head or relaxed-palm movement, with local voice commands and a movable, collapsible panel above the drawing application.

This replaces the previous specification when applied to the planning documents. **No files have been changed during this Plan-mode revision.** Applying this documentation revision does not authorize application development.

### Product boundaries

- **Platform:** Apple Silicon, macOS 26+, one selected display at a time.
- **Verified application:** Krita 5.3.4, bundle identifier `org.krita`, already installed on the development Mac.
- **Tracking:** switchable head and palm modes, with separate calibration per camera and mode.
- **Pointer behavior:** absolute position mapping; holding still keeps the pointer still.
- **Drawing:** mouse strokes with explicit pen down/up. No pressure, tilt, dwell activation, or drawing gestures.
- **Voice:** local `en-US` recognition, explicitly enabled, requiring “Steady” before each command.
- **Setup:** assisted first-time permissions and calibration are acceptable. Independent setup using one switch is not an MVP requirement.
- **Delivery:** a self-contained `.app`; no terminal, browser tab, API key, runtime compiler, or separately launched helper.
- **Validation equipment:** the user can provide head-facing and desk-facing cameras and an external display.

Configurable shortcut profiles for other applications are permitted but labeled unverified. Defer verified Photoshop/GIMP support, simultaneous tracking modes, cross-display traversal, general desktop automation, zoom/pan commands, color/layer commands, AI editing, public distribution, notarization, and automatic updates.

Use the working name **Steady**, application version `0.1.0`, and local bundle identifier `org.steady.local`. Build fresh on `extension-version`; use reference commit `cb6a082` for inspiration without merging its application.

### Fixed build baseline

| Component | Selection |
|---|---|
| Development tools | Node 26.12.1, npm 11.20.0, Swift 6.4, installed macOS SDK 27.0 |
| Deployment target | macOS 26.0, arm64 |
| Desktop runtime | Electron 45.0.0 |
| Build/package system | Electron Forge CLI, Vite plugin, and ZIP maker: 8.0.1 |
| Renderer | React/React DOM 19.3.1 |
| Bundler | Vite 8.3.5; React plugin 6.1.2 |
| Type checking | TypeScript 7.0.2, strict mode |
| Tracking | `@mediapipe/tasks-vision` 1.1.1 |
| Tests | Vitest 5.0.1, Playwright 1.64.1, Swift Testing |

Forge 8 makes its Vite plugin stable and targets Vite 8. Use its `.cjs` main/preload output conventions. [Forge release notes](https://github.com/electron/forge/releases/tag/v8.0.1)

Pin direct dependencies exactly and commit the resolved lockfile. Supporting type/build packages use the selected Forge template’s compatible versions, saved exactly during bootstrap. Use `npm ci` thereafter. Dependency incompatibility blocks Phase 01; agents must not silently substitute another architecture.

## 2. Artist workflow and interaction rules

### First launch and calibration

Launch paused, pen-up, and microphone-off. Persist configuration, never active input state.

Onboarding proceeds in this order:

1. Explain camera, microphone, and native-control access; request each permission when its feature is first used.
2. Select tracking mode and camera.
3. Select the display; default to the built-in display when available, otherwise the primary display.
4. Calibrate neutral position and comfortable movement bounds.
5. Select Krita as the target and mark the canvas rectangle.
6. Show ready status; require explicit Resume.

Calibration uses five captures: **neutral, comfortable left, right, up, and down**. There is no deadline for reaching a position. Pressing Capture starts a two-second sampling window.

A capture succeeds with at least 40 valid samples and at least 80% valid frames. Use coordinate medians rather than individual endpoints. Failed captures explain the reason and offer Retry or Cancel.

Each directional extent from neutral must exceed both `0.01` normalized camera units and three times the neutral jitter estimate, calculated using scaled median absolute deviation. Insufficient range requires recapture; do not invent bounds or silently increase gain.

Store neutral and four directional extents independently for each camera/mode. Recenter captures neutral again, preserves directional extents, resets filters, releases input, and ends paused. Camera or mode changes release input and require the applicable calibration and canvas confirmation before resuming.

### Tracking and mapping

- Head anchor: face landmark 1, the nose.
- Palm anchor: centroid of landmarks 0, 5, 9, 13, and 17.
- Mirror horizontal coordinates exactly once, before calibration and mapping.
- Detector, presence, and tracking thresholds: `0.6`.
- Palm mode detects up to two hands. Calibration accepts exactly one visible hand and records its model handedness label.
- Reject a frame with multiple hands, a different label, or an anchor jump exceeding `0.12` normalized units from the preceding valid frame. After declared loss, require explicit confirmation of the selected hand before resuming.
- Continuity is a conservative heuristic, not biometric identity recognition.

Use a One Euro filter on normalized coordinates. Smoothing slider `S` ranges from 0–100, default 50:

- `minCutoff = 4 − 0.034 × S`
- `beta = 1`
- derivative cutoff `= 1 Hz`

Gain ranges from `0.5–3`, default `1`. For each axis:

```text
screenFraction =
  clamp(0.5 + 0.5 × gain ×
        (filteredPosition − neutral) / directionalExtent, 0, 1)
```

Select the positive or negative extent according to displacement direction. Map fractions to the selected display’s bounds. Do not add another brush stabilizer, prediction layer, or gesture recognizer.

Request 640×480 camera input at 30 fps; accept the nearest available format. Process one frame at a time and drop intermediate frames. Try the GPU delegate first; on initialization failure, try CPU once. A subsequent inference failure pauses control and requires explicit restart.

### Canvas and panel interaction

Canvas setup allows tracked hover with the pen forced up, even before a canvas exists. Krita must remain foreground. F8 or “Steady, mark corner” records the top-left and bottom-right positions.

Require a rectangle at least 100×100 logical screen points, inside the selected display. Reject rectangles intersecting the companion panel. After capture, remain paused until Resume.

The canvas is fixed screen geometry, not an inferred document region. Reconfirm it each launch. Display reconfiguration invalidates it automatically. Moving/resizing the Krita canvas requires explicit remapping; there is no screenshot analysis or automatic canvas detection.

The compact panel:

- Starts at the selected display’s upper-right work-area corner with a 16-point margin.
- Measures 320×560 points expanded and 320×96 collapsed.
- Is nonactivating, remains above windowed/fullscreen Krita, and appears across Spaces.
- Uses at least 44×44-point action targets.
- Preserves tracking when collapsed.
- Quits the app and releases input when closed.

Use `type: panel`, inactive showing, floating level, and disabled background throttling. Validate behavior in the packaged app. [Electron window documentation](https://www.electronjs.org/docs/latest/api/browser-window)

A tracked Click over a registered panel button invokes that button locally through semantic hit-testing. It never injects a native mouse click beneath the panel. A click over panel background does nothing. Physical panel clicks use the same action dispatcher.

Settings use a separate focusable window. Opening it pauses drawing. Closing it never resumes automatically. Settings and setup remain keyboard accessible; global command bindings provide access while Krita is foreground.

### Input state machine

Microphone state is independent of pointer state.

| State | Permitted behavior | Exit |
|---|---|---|
| **SETUP** | Calibration and forced pen-up canvas marking; no drawing or target shortcuts | Completion → PAUSED |
| **PAUSED** | No native pointer movement or clicks; target shortcuts allowed when Krita is foreground | Explicit Resume with all prerequisites → HOVER |
| **HOVER** | Pointer movement, explicit click, target shortcuts | Pen down → DRAWING |
| **DRAWING** | Pointer movement with left button held inside canvas | Pen up, click, or shortcut → HOVER |
| **FAULT** | Release attempts, diagnostic UI, local controls | Explicit recovery → PAUSED |

Additional transitions:

- Canvas exit releases the button and enters HOVER. Reentry never starts another stroke.
- Entering the panel while drawing releases first and enters HOVER.
- Foreground-app changes, settings, camera/mode changes, sleep/wake, and display changes release input and enter PAUSED.
- Returning to Krita requires Resume.
- Short tracking gaps freeze movement. At 250 ms since the last valid capture, enter PAUSED and release. A 10 ms native watchdog supports the required maximum release time of 300 ms.
- Tracking recovery never resumes or lowers the pen.
- Pen-up and Pause always attempt release, including in FAULT.
- Resume requires a confirmed canvas, calibration, permissions, intended foreground target, and 500 ms of consecutive valid tracking.
- Rejected commands are discarded with visible feedback, never queued for later execution.

Clicks and tool changes end any active stroke. Text entry and modal-dialog work are performed while paused; the MVP does not inspect Krita’s internal dialog or text-focus state.

### Commands and voice

All core commands have visible controls and configurable global bindings. Initial bindings are F8 for pen toggle and F9 for Pause; other action bindings start unassigned. Onboarding explains configuration and Mac function-key behavior. Registration conflicts remain visible and do not silently change bindings.

Use this exact voice vocabulary, ignoring case and punctuation:

```text
Steady pen down       Steady pen up
Steady pen toggle     Steady click
Steady undo           Steady redo
Steady brush          Steady toggle erase
Steady bigger         Steady smaller
Steady pause          Steady resume
Steady recenter       Steady mark corner
Steady microphone off
```

Reject synonyms, missing prefixes, and multiple actions in one utterance. Microphone activation requires a visible control or configured key.

Krita profile defaults are Command-Z, Command-Shift-Z, B, E, `]`, and `[` for undo, redo, brush, erase toggle, bigger, and smaller. Verify them in the installed application before declaring support. Never infer erase state or automatically foreground another application to deliver a shortcut.

Use `SpeechAnalyzer`, `SpeechTranscriber`, and `SpeechDetector`, with `en-US`, `fastResults`, and audio-time attributes. Tentative text may appear as feedback but never causes actions. Apple explicitly identifies `fastResults` as a responsiveness/accuracy tradeoff. [Speech reporting options](https://developer.apple.com/documentation/speech/speechtranscriber/reportingoption)

End an utterance after 400 ms of detected silence, request finalization through that audio position, and assemble its finalized spans before parsing. Limit utterances to six seconds. Accept one action per utterance, identified by speech-session UUID plus utterance number. Discard results from disabled, replaced, or invalidated sessions.

Commands act at their finalized acceptance time using the latest valid pointer. Do not backdate stroke endpoints. Require p95 speech-end-to-action latency of at most one second. Discard results arriving more than 1.5 seconds after utterance end and display a retry message. Keys/switches remain the precise stroke-timing alternative.

## 3. Architecture, interfaces, and failure behavior

### Process ownership

- **Tracking renderer/worker:** camera capture, MediaPipe, landmarks, calibration, filtering, and normalized samples.
- **Electron main:** application lifecycle, shared command dispatcher, panel hit-testing, settings, global shortcuts, packaging/resource lookup, and process supervision.
- **Swift helper:** authoritative native input state, foreground checks, display geometry, button events, watchdog, and speech lifecycle.

Use sandboxed renderers, context isolation, disabled renderer Node integration, and a typed preload allowlist. No arbitrary shell operations, localhost service, remote application code, or runtime Python dependency.

Bundle MediaPipe runtime assets and version-1 hand/face model assets. Record their source URLs and SHA-256 hashes in the asset manifest. Missing or corrupt assets produce a recoverable fault; no CDN fallback.

Block application-originated outbound network requests, including analytics. Apple-managed speech-asset installation is the only runtime setup download. MediaPipe’s package documents performance metrics separately from input processing, so offline validation must cover outbound telemetry attempts too. [MediaPipe package notice](https://www.npmjs.com/package/%40mediapipe/tasks-vision?activeTab=versions)

### Shared contracts

TypeScript definitions and Swift Codable types must implement these contracts. Shared positive/negative JSON fixtures are the compatibility authority.

| Type | Required fields |
|---|---|
| `TrackingSample` | generation, frame ID, capture timestamp, mode, valid flag, normalized anchor or null, quality reason |
| `CalibrationV1` | schema version, camera ID, mode, selected-hand label or null, neutral, four extents, jitter, gain, smoothing |
| `Command` | event ID, source (`voice`, `key`, `panel`), action ID, control generation |
| `Rect` | finite `x`, `y`, `width`, `height`; positive dimensions |
| `NativeState` | state, reason, button-down flag, foreground target, permission status, generation, latest valid frame |

Use global Quartz screen coordinates relative to the main display’s upper-left. Native display bounds are authoritative. Electron panel rectangles use the corresponding macOS logical coordinates; do not multiply pointer coordinates by Retina backing scale. Validate mixed-scale and negative-origin layouts explicitly. [Apple display coordinate definition](https://developer.apple.com/documentation/coregraphics/cgdisplaybounds%28_%3A%29)

### Private native protocol

Use newline-delimited UTF-8 JSON over stdio, with stderr reserved for diagnostics:

```text
{ v: 1, session: UUID, seq: unsigned integer, type: string, payload: object }
```

Maximum message size is 16 KiB. Sequence numbers increase within each direction/session. Reject malformed data, unknown versions/types/actions, duplicates, nonfinite numbers, and expired generations.

Supported requests:

| Request | Payload |
|---|---|
| `hello` | Application bundle ID |
| `configure` | Generation, target bundle/PID, selected display ID, canvas or null, excluded rectangles |
| `sample` | Generation, frame ID, native-domain capture timestamp, valid flag, mapped position or null |
| `action` | Generation, event ID, allowed action ID |
| `ping` | Sender timestamp |
| `microphone` | Enabled flag and speech-session UUID |
| `installSpeechAssets` | Locale `en-US` |
| `shutdown` | Empty |

Replies are `ack`, `state`, `speech`, and `fault`. Acknowledgments identify the request sequence, acceptance/rejection code, resulting native state, and native action timestamp when applicable.

Handshake returns supported protocol version, permissions, displays, and capabilities. Protocol mismatch enters FAULT. Require acknowledgment within 500 ms for state-changing requests; timeout pauses control. Samples use latest-only buffering and emit frame/event timing evidence without building a backlog.

Synchronize renderer, main, and helper monotonic clocks using eight round trips, choosing the smallest round-trip sample. Refresh every 30 seconds and after wake. If estimated uncertainty exceeds 10 ms, pause and resynchronize. Convert capture timestamps before native freshness checks.

Native safeguards run independently of speech and pipe parsing. Check foreground identity immediately before posting input, release before shortcuts, and never refresh tracking freshness from heartbeats. On helper exit, the parent invokes the bundled executable with `--release-and-exit`. Parent EOF releases and exits the helper. Recovery is explicit and starts a fresh protocol session.

Store versioned settings atomically under Electron’s application-data directory. Invalid settings fall back to setup. Do not persist microphone-enabled state, pen state, transcripts, recordings, or raw camera frames.

## 4. Six phases and agent execution

Each phase requires separate user authorization and a fresh orchestrator. Two scoped workers perform most implementation; the orchestrator owns manifests, shared contracts, integration, and the execution index.

The orchestrator freezes file ownership before delegation. Workers cannot change shared interfaces independently. Every phase ends with one fresh reviewer session that reviews the integrated changes, fixes issues, and reruns affected checks within that session.

| Phase | Worker assignments | Mandatory exit |
|---|---|---|
| **01 — Shell and feasibility** | Shell/panel/camera probe; Swift/protocol/input/speech probe | Pinned build packages successfully; panel preserves focus across windowed/fullscreen/Spaces; native permissions/input work under packaged identity; background inference and offline speech work; ten prefixed speech probes meet the one-second p95 target |
| **02 — Tracking engine** | Camera/MediaPipe/hand continuity; calibration/filtering/replays | Both real tracking modes work; calibration and mapping match this specification; stale-frame, ambiguity, loss, and persistence tests pass |
| **03 — Krita integration** | Native state/coordinates/watchdog; canvas/panel routing/profiles | Real strokes, clicks, shortcuts, panel activation, recovery, Retina, and external-display tests pass |
| **04 — Voice and accessibility** | Speech lifecycle/grammar; onboarding/controls/accessibility | Vocabulary and deduplication work offline; every core action has a visible alternative; keyboard operation and VoiceOver checks pass |
| **05 — Integrated validation** | Fault harness/metrics; supervised artist workflow | Complete hardware matrix and performance/voice targets pass; defects are fixed and limitations documented |
| **06 — Standalone delivery** | Packaging/resource audit; installation/troubleshooting verification | Delivered `.app` works outside the checkout; first-run permissions, restart, offline operation, and checksum are verified |

A missing mandatory check leaves the phase blocked. No automatic architecture substitution, relaxed target, skipped hardware gate, or second reviewer is permitted. An interrupted reviewer still counts as the phase’s session; replacing it requires an explicit user-approved exception.

Fresh orchestrators resume from the ledger and inspect actual repository state. Preserve failed attempts. No phase may start merely because its prompt exists.

## 5. Acceptance, delivery, and documentation revision

### Automated acceptance

Use fake clocks, fake native event backends, synthetic landmarks, and protocol fixtures. Automated tests must never manipulate the actual desktop.

Cover:

- Five-step calibration, directional mapping, gain, filter resets, and settings validation.
- Selected-hand ambiguity, abrupt jumps, invalid frames, stale/out-of-order frames, and recovery.
- Every state transition and command’s permitted/rejected states.
- Panel hit-testing without native click-through.
- Protocol framing, size limits, invalid messages, deduplication, generations, clock uncertainty, and acknowledgment timeout.
- Renderer stalls, live heartbeats with stale tracking, helper/parent disconnects, and release behavior.
- Exact grammar, split final spans, partial results, duplicate recognition, session cancellation, and late-result rejection.

Required scripts are `dev`, `typecheck`, `test`, `test:native`, `test:e2e`, `build:native`, `package`, and `make`. Native-input tests default to fake mode. Supervised real-input probes require an explicit real-input flag.

### Hardware and usability acceptance

Use disposable Krita documents. Record machine/OS/Krita versions, camera/display, operator, configuration, procedure, result, and evidence classification.

Test both tracking modes; windowed/fullscreen/Spaces behavior; panel collapse and local activation; drawing, erasing, sizing, undo/redo; permission denial; camera/mic disconnect; foreground changes; renderer/helper termination; sleep/wake; and display reconfiguration.

Test the built-in Retina display and the external display selected separately, including a negative-origin arrangement. Verify keyboard operation using configured global bindings and run a VoiceOver smoke test.

For each tracking mode, measure a 60-second active session after ten seconds of warmup:

- At least 25 posted tracking updates/second on average.
- p95 frame-receipt-to-native-event latency below 150 ms.
- Button release within 300 ms of the last valid sample during induced starvation.

Use nearest-rank p95. Record filter settings; processing latency does not represent total perceived movement delay from smoothing.

Freeze a 40-command script before scoring: four cycles containing pen down, pen up, click, undo, redo, brush, toggle erase, bigger, smaller, and recenter. Prepare the document and explicitly resume between cycles as necessary. Require at least 38 correct actions; wrong, missing, duplicated, or expired actions fail that trial.

Measure voice latency from the audio-time end of detected speech to the acknowledged action, including finalization delay. Report detector timing limitations. Require p95 at most one second. Test pen toggle, pause/resume, corner marking, and microphone-off separately.

Run five minutes of fixed unprefixed conversation with dry-run native output and require zero actions. Verify unknown and multiple-action phrases also produce zero actions.

Record operator feedback on setup, precision, fatigue, and accidental actions. Identify whether the operator is a developer or an intended-use artist. Broader accessibility-effectiveness claims remain outside this MVP.

### Standalone delivery

Package the Swift executable outside ASAR and include model/runtime resources and notices. Produce a locally signed/ad-hoc arm64 `.app` and ZIP; no Developer ID credentials or notarization are required for this local deliverable.

Validate from `/private/tmp/steady-delivery/Steady.app`, with development servers stopped. Audit for repository paths and runtime compiler/interpreter dependencies. Use a clean macOS account with operator participation for first-run permission evidence. Missing clean-account evidence blocks that gate.

After setup, tracking and speech must work offline. Record artifact size, SHA-256, exact build inputs, tested configuration, and known limitations. Any post-review artifact change requires affected checks and a new checksum within the same reviewer session.

### Apply the planning revision

When document editing is enabled:

- Replace `plan/PLAN.md` with this specification.
- Update all six phase prompts and both role templates to reference these fixed contracts and gates; remove instructions that leave these decisions open.
- Append a new planning-revision run to `plan/LEDGER.md`, recording the three confirmed interaction choices and equipment availability.
- Preserve prior requests, failed checks, and execution records.
- Validate document links and consistency.

Application phases remain pending until separately authorized. Technical feasibility is still to be demonstrated, but the required behavior, interfaces, defaults, ownership, and response to failed gates are fixed by this revision.
