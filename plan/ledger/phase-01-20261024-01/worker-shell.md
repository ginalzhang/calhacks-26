# Shell worker: Phase 01 renderer and camera feasibility

## Identity and authorization
- Run / phase: phase-01-20261024-01 / 01.
- Agent / parent: `/root/shell` / `/root`; model identity not exposed.
- Exact assignment: [shell-assignment.md](artifacts/shell-assignment.md). Exact authorization: [authorization.md](artifacts/authorization.md).
- Started: 2026-10-24, America/Los_Angeles (exact launch clock not exposed).
- Baseline: `207669b43c3f270bf88b89f9e129f0e27c11e3aa`, `extension-version`; preexisting planning files and parent-created contracts/fixtures/record remain untouched.
- Owns: `src/preload/`, `src/renderer/`, `tests/shell/`, this record and `artifacts/shell-*`.
- Readiness: parent materialized shared `SteadyAPI`, `TrackingSample`, `ProbeStatus`, action IDs and protocol fixtures before assignment.

## Execution events
- Read phase prompt, full Revision 2 plan, record rules, exact worker assignment and shared contract. Inspection exit 0. No AGENTS.md found in workspace inventory.
- Implemented typed preload invoking only fixed `steady:*` channels. `steady:status-changed` is its only listener channel; cleanup returns unsubscribe.
- Implemented compact React panel and focusable settings view selected by `?view=settings`. Core actions use the same API dispatcher and register semantic button rectangles. Controls have 44-point minimum targets and visible keyboard focus. Collapse leaves panel camera owner mounted.
- Implemented panel-owned camera worker pipeline. Settings posts validated camera controls through same-origin BroadcastChannel; renderer reports transient probe status without persistence. Requests 640x480/30fps, processes one frame at a time, transfers/closes ImageBitmaps, drops intermediate opportunities. Timer capture does not rely on animation-frame callbacks.
- Implemented local MediaPipe detector worker with 0.6 thresholds, GPU-first/one CPU initialization fallback, head nose/palm centroid mirrored once, multi-subject/invalid-landmark rejection. Inference faults stop stream/worker and pause; explicit restart required.
- Added pure synthetic tests for anchors, rejection, one-frame gate and bounded fallback. No desktop input, camera or microphone accessed by tests.

## Decisions and blockers
- Parent must register `steady-resource://assets/` for local model/runtime resources and IPC channels documented in handoff.
- Camera timestamp uses `performance.now()` when capturing bitmap; parent must synchronize renderer/native clocks. It is not sensor-exposure timing; latency evidence must record this limitation.
- Full calibration, hand continuity and product settings remain later-phase work. Probe emits normalized anchors only; it does not invent calibration or draw.
- Packaged focus/z-order/Spaces, background camera/inference and offline/telemetry checks require parent integration and operator evidence. Not run by shell worker.

## Handoff
- Implementation in progress; checks pending parent dependency installation. All new files uncommitted; no commit created.

### Verification and integration handoff — 2026-10-24 14:39 America/Los_Angeles
- Parent requested renderer→main clock synchronization without changing shared API. Added preload `clock.ts` and eight-round-trip synchronization over `steady:clock`, choosing minimum RTT, capture-time offset conversion before IPC, 30-second refresh, `steady:resync-clocks` wake handling, 500ms per-round-trip timeout, sample suppression on uncertainty above 10ms, Pause and `steady:clock-fault` reporting on failure. Capture timestamps are never replaced by send time.
- Added synthetic clock tests for eight-round-trip selection, original capture-time conversion, uncertainty and invalid samples.
- `npm run typecheck && npm test -- tests/shell`: exit 0 at 14:37; typecheck passed and nine tests passed.
- After subsequent local changes and concurrent parent main-process implementation, reran both commands. Shell tests again passed (nine tests in two files, exit 0). Global typecheck reported TS2769 only in parent-owned `src/main/index.ts` event-union loops at lines 133/135. Parent notified; shell files had no diagnostics. [Typecheck output](artifacts/shell-typecheck.txt), [test output](artifacts/shell-tests.txt). The combined shell invocation ended 0 because its final command printed evidence; typecheck itself failed and is not reported as passing.
- Corrected initial stale BroadcastChannel status closure using a live report ref. Added panel title drag region with button no-drag regions. Clock-status subscribers update after synchronization finishes.

## Final shell handoff
- Worker scope implemented; packaged/hardware acceptance remains **not run**, dependent on parent integration and operator.
- Changed paths: `src/preload/index.ts`, `src/preload/clock.ts`, `src/renderer/env.d.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/style.css`, `src/renderer/tracking.ts`, `src/renderer/probe.ts`, `src/renderer/vision.worker.ts`, `tests/shell/tracking.test.ts`, `tests/shell/clock.test.ts`, this record and shell evidence artifacts. All uncommitted; no commit created.
- Required integration: preload entry `src/preload/index.ts`; renderer entry `src/renderer/index.html`; settings use `?view=settings`; local custom protocol `steady-resource://assets/` serves `wasm/`, `face_landmarker.task`, `hand_landmarker.task`. Preload IPC channels: `steady:status`, `steady:status-changed`, `steady:action`, `steady:collapse`, `steady:open-settings`, `steady:close-settings`, `steady:select-camera`, `steady:sample`, `steady:microphone`, `steady:install-speech-assets`, `steady:register-buttons`, `steady:quit`, `steady:clock`, `steady:clock-fault`, `steady:resync-clocks`.
- Parent main must validate all IPC payloads and sender ownership; convert panel-relative registered rectangles to authoritative logical display coordinates; pause on settings/config/fault; sync main→native clocks separately; send `steady:resync-clocks` after wake; disable renderer background throttling; supply bundled resources and network denial; use panel behavior specified in plan.
- Strict renderer CSP permits self/local custom resource assets and worker/blob only. Development React refresh preamble may need a development-specific CSP policy or disabled refresh. No CDN URLs or external network dependencies appear in shell modules.
- Remaining evidence: packaged background inference/GPU support/CPU fallback, camera permissions under identity, panel focus/Spaces/fullscreen and collapse, speech and native-input probes. No physical input or microphone/camera probe was run by worker. No raw images/audio/transcripts persisted.

## Continuation: bounded native probe controls — 2026-10-24 America/Los_Angeles
- Parent explicitly assigned followup: “Additional phase01 integration needed in your owned files. Parent extending SteadyAPI with runNativeProbe():Promise<void> and releaseInput():Promise<void>. Please add preload allowlist steady:run-native-probe and steady:release-input. Settings add visible explanation + button 'Run bounded real-input probe' with explicit checkbox confirmation 'I have a disposable Krita document open and will switch to Krita during the five-second countdown'; disable button until checked. Probe helper is launched by packaged app with explicit --real-input --probe (operator doesn't launch helper in terminal). Parent will wait 5sec then confirm stdin. Add emergency release button. This is phase feasibility only; default main helper stays fake. No new agents/reviewers. Also dev CSP React preamble may fail; investigate safe dev-only CSP hash plugin recommendation, report to parent rather than editing config.”
- Added the two typed preload methods against parent-extended shared API. Added settings probe explanation, exact confirmation checkbox, gated run button, five-second countdown feedback, disabled repeat launches and confirmation reset. Added emergency release button. No probe launched by worker.
- Inspected pinned React/Vite sources for CSP; reported nonce-based dev-only transform plus optional HMR disabling as robust solution, and exact-script post-transform hashing caveats. [Investigation](artifacts/shell-dev-csp.md). No shared/config paths edited.
- `npm run typecheck && npm test -- tests/shell`: typecheck failed only in concurrent parent-owned `tests/e2e/packaged.spec.ts:5` environment type (`string | undefined` versus `string`), exit 1; shell tests did not run in this chained attempt. Parent notified; reran shell tests independently.
- Emergency release must cancel a pending probe countdown/child as part of parent implementation; parent notified. No permission grants or real desktop input were performed.
- Independent `npm test -- tests/shell`: exit 0, all nine tests in two files passed at 14:44 America/Los_Angeles. Followup changes remain uncommitted. Handoff to parent; all packaged/operator gates remain not run by this worker.

## Continuation: local WASM loader CSP — 2026-10-24 America/Los_Angeles
- Exact parent assignment: “Please fix production CSP: vision worker dynamically imports local WASM JS from steady-resource://assets/wasm, but explicit script-src currently excludes steady-resource:. Add steady-resource: to script-src, preserving local-only policy. Parent adding actual packaged model-worker initialization + synthetic blank frame test (no camera/native input). Then handoff; rest done.”
- Added `steady-resource:` to renderer `script-src` so bundled MediaPipe WASM loader JS is permitted. The policy still permits only self and the parent-controlled local asset scheme, retaining `wasm-unsafe-eval` for WASM compilation; no network origins added.
- Validation: exact previous CSP directive matched before replacement (exit 0). Packaged model-worker/synthetic-frame checks are owned by parent and were not run by this worker. All changes remain uncommitted.

## Continuation: packaged ESM runtime initialization — 2026-10-24 14:48 America/Los_Angeles
- Parent reported actual packaged synthetic model-worker failure: `Model initialization failed: Error: ModuleFactory not set.` Assigned investigation/fix inside pinned MediaPipe 1.1.1 and module-worker architecture; no dependency substitution permitted.
- Inspected installed `vision.d.ts` public `forVisionTasks(basePath?, useModule?)`, minified runtime's loader/factory lifecycle and bundled classic/ESM runtime endings. Default classic loader declares a module-local factory when imported by a module worker; ESM loader explicitly exports/sets the factory.
- Updated worker to pass `true` for public `useModule` option. Explicitly imports that selected local loader, validates its default factory, and restores `self.ModuleFactory` before each GPU/CPU initialization. Restoration handles pinned TaskRunner clearing the global factory after runtime construction: cached ESM imports do not rerun side effects for the one permitted CPU fallback.
- `npm run typecheck && npm test -- tests/shell`: exit 0; typecheck passed; nine tests in two files passed. Parent notified to rebuild package and rerun actual synthetic blank-frame worker integration; that packaged result remains pending at worker handoff.
- Changed only owned `src/renderer/vision.worker.ts` plus this record. No shared interfaces, versions, runtime assets, architecture or network origins changed. No real camera/native input performed. Uncommitted state preserved.

## Final UI continuation — 2026-10-24 14:50 America/Los_Angeles
- Parent assigned microphone indication using its optional shared `ProbeStatus.microphoneEnabled` field, visible Quit/close within fixed panel geometry, and scroll access if actions exceed 560 points. No config edits permitted.
- Added mic on/off status to panel (including collapsed) and settings, defaulting off. Added always-visible 44-point header × button invoking Quit/release through the existing API.
- Kept panel at 320x560 / 320x96 and made expanded content scroll within remaining space. Semantic button registration now updates on scroll and clips button rectangles to the visible content viewport, preventing offscreen controls from acquiring header hit regions.
- Parent confirmed `runNativeProbe` resolves when scheduled, so retained its five-second operator countdown after scheduling resolution rather than resetting it immediately.
- `npm run typecheck && npm test -- tests/shell`: exit 0; typecheck passed and all nine tests in two files passed. No hardware/camera/mic/input actions performed. Changes remain uncommitted. Parent owns final packaging/synthetic-worker check and phase review; shell worker hands off and stops edits.
