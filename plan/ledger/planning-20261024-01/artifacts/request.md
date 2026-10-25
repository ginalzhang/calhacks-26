PLEASE IMPLEMENT THIS PLAN:
# Steady: Accessible Drawing Companion for macOS

## Summary

Create a standalone Mac application that helps artists draw in Krita using head movement or relaxed palm movement, with voice commands for common actions. A movable, collapsible panel remains above the drawing app without taking keyboard focus during drawing.

This stage produces planning documents only. **No files have been created because this session is in Plan mode.** Once writing is enabled, create the planning package described below; application development requires separate authorization for each phase.

Agreed MVP:

- Apple Silicon, macOS 26+, one selected display.
- Electron and TypeScript, with a bundled Swift component for native input and speech.
- Switchable head and resting-palm tracking, with separate calibration.
- Explicit voice/key control of strokes; no automatic dwell or gesture activation.
- Local English voice recognition, enabled explicitly and requiring the prefix “Steady.”
- Verified Krita support; configurable shortcuts for other apps without claiming tested compatibility.
- A packaged `.app` that requires no terminal, browser tab, API key, or installed development tools.

## Planning Package and Agent Workflow

Create this structure:

```text
plan/
  PLAN.md
  LEDGER.md
  prompts/
    phase-01.md
    phase-02.md
    phase-03.md
    phase-04.md
    phase-05.md
    phase-06.md
    worker-template.md
    reviewer-template.md
  ledger/
    README.md
    <phase-and-run-id>/
      orchestrator.md
      <worker-id>.md
      reviewer.md
      artifacts/
```

**`PLAN.md` is the authoritative specification.** It contains the agreed scope, architecture, phase dependencies, acceptance criteria, and agent operating rules. Prompts reference it instead of duplicating the specification. The ledger records execution evidence and never silently overrides the plan.

**`LEDGER.md` is the execution index.** For each phase, record authorization, run identifier, starting and ending commits when available, status, linked agent records, review outcome, and next handoff. Preserve previous attempts when a phase is resumed.

Each agent maintains its own record containing:

- Role, phase, parent agent, task, and exact assigned prompt.
- Starting repository state and assigned file ownership.
- Changes made, commands run, outcomes, and artifact references.
- Decisions within its authorized scope, blockers, and remaining work.
- A completion summary sufficient for another model instance to continue.

Records contain observable work and evidence, not hidden reasoning, credentials, raw camera frames, or microphone recordings. Append corrections rather than rewriting execution history. The orchestrator alone updates the shared index.

Each phase follows the same lifecycle:

1. The user authorizes that phase and starts a fresh orchestrator.
2. The orchestrator reads the plan and prior handoff, then delegates scoped implementation tasks to workers.
3. Workers perform most implementation, with explicit ownership to prevent conflicting edits.
4. The orchestrator integrates the work and runs the phase checks.
5. **One fresh reviewer agent runs once**, reviews the integrated phase, fixes issues, and reruns affected checks within that session.
6. The orchestrator records the result and stops before the next phase.

An unresolved blocker leaves the phase blocked. Do not launch another reviewer automatically or advance past a failed gate. Each phase prompt must specify worker assignments, dependencies, deliverables, checks, and handoff requirements. The reviewer prompt must include the phase’s full integrated changes and acceptance criteria.

## Application Design

### Desktop shell and native input

Use Electron with a React/TypeScript interface, a sandboxed renderer, context isolation, and a narrow typed preload API. Bundle a Swift helper inside the application and communicate through private standard-input/output pipes, without a localhost server.

The native helper owns mouse/keyboard event generation, foreground-app checks, permission checks, input state, and a watchdog. Apple’s [Quartz event API](https://developer.apple.com/documentation/coregraphics/cgevent) provides native event posting.

The compact panel uses Electron’s panel window behavior, floating level, inactive showing, and fullscreen/Spaces visibility. A separate focusable settings window handles configuration. Validate focus behavior in Phase 1. Electron documents the relevant [window and background-throttling controls](https://www.electronjs.org/docs/latest/api/browser-window).

Use typed internal interfaces for:

- Tracking samples: timestamp, mode, normalized position, validity, and quality.
- Calibration: camera, mode, movement range, gain, smoothing, and selected display.
- Commands: action identifier, input source, and unique recognition/event identifier.
- Native requests and status: pointer movement, button state, allowed shortcuts, permissions, foreground target, and faults.

The renderer cannot request arbitrary shell commands or unrestricted native operations.

### Tracking and drawing

Use locally bundled MediaPipe hand and face models. Run inference in a worker, allow only one frame in flight, and discard obsolete frames. Google notes that detection calls block their calling thread and recommends [workers for web inference](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

- **Head mode:** track the nose position relative to a calibrated neutral position.
- **Palm mode:** track the centroid of the wrist and palm-base knuckles, without requiring pointing, gripping, or pinching.
- Track one selected hand; losing it must not silently transfer control to another hand.
- Provide camera selection, mirrored preview, adjustable gain, smoothing, and recentering.
- Calibrate comfortable movement bounds with guided instructions. Store separate settings for each mode and camera.
- Head mode supports the built-in camera. Palm mode may require a desk-facing external camera.

Map movement onto the selected display. The artist explicitly marks a canvas rectangle using tracked corner positioning and voice/key confirmation. Hover can reach Krita controls outside that rectangle; drawing is permitted only inside it.

Use mouse strokes, without simulated pressure or tilt. Leaving the canvas ends the stroke, and reentry requires another explicit pen-down command.

### Commands, voice, and safeguards

Provide these commands through voice and equivalent visible controls:

- Pen down, pen up, and pen toggle.
- Single left click.
- Undo and redo.
- Select brush.
- Toggle erase mode.
- Increase or decrease brush size.
- Pause, resume, and recenter.

Use remappable global shortcuts, initially F8 for pen toggle and F9 for emergency pause. Detect registration failures and explain Mac function-key behavior.

Use Swift `SpeechAnalyzer`/`SpeechTranscriber` for on-device English recognition. Handle supported-locale checks and Apple speech-model installation explicitly. Asset installation may require internet once; subsequent recognition must work offline. Follow Apple’s [speech implementation guidance](https://developer.apple.com/documentation/Speech/bringing-advanced-speech-to-text-capabilities-to-your-app).

The microphone starts disabled on every launch. While enabled, accept complete prefixed commands such as “Steady, undo.” Use a deterministic grammar, reject ambiguous phrases, and execute each finalized utterance once. Do not use an LLM or cloud fallback.

Krita integration uses configurable shortcuts. Label erasing as a **toggle**, since Krita’s erase mode changes the current brush behavior; do not claim knowledge of its current state. Selecting the brush does not imply disabling erase mode. Verify shortcut behavior against the installed Krita version.

Input rules:

- Start paused and pen-up; require explicit activation after calibration.
- Release the button before shortcuts, pause, recalibration, mode changes, or focus changes.
- On missing tracking, freeze movement; release within 300 ms of the last valid sample.
- Maintain an independent native watchdog so a stalled renderer cannot keep drawing.
- On recovery, remain pen-up until explicitly rearmed.
- Suspend native control when another application becomes foreground.
- Prevent drawing or native clicks through the companion panel.
- Pause and invalidate canvas mapping when display configuration changes; require the artist to remap after moving or resizing the canvas.
- Handle helper termination through a parent-side emergency release invocation; helper-side cleanup handles parent disconnects.
- Show tracking, microphone, pen, target-app, and paused status clearly.

## Implementation Phases

| Phase | Delegated work | Required exit evidence |
|---|---|---|
| **1. Shell and feasibility** | Workers build the Electron shell/floating panel and Swift bridge. Run minimal camera, background tracking, native-input, and offline-speech probes in a packaged app. | Panel remains above windowed/fullscreen Krita without taking focus; native input permissions work under the packaged identity; tracking continues while unfocused; local speech works after asset setup. Block if a core assumption fails. |
| **2. Tracking engine** | Workers implement camera/inference and the deterministic calibration/filtering engine with replay fixtures. | Both modes work on real hardware; palm mode needs no finger gesture; calibration persists separately; replay tests cover jitter, stale frames, loss, reacquisition, and hand identity. |
| **3. Krita drawing integration** | Workers implement coordinate conversion/input safeguards and canvas setup/Krita shortcut profiles. | Real strokes, explicit clicks, canvas boundaries, focus suspension, emergency pause, watchdog, and recovery work in Krita. Test Retina scaling and an external selected display. |
| **4. Voice and accessible controls** | Workers implement native speech/command parsing and accessible onboarding/panel/settings. | Every core action has a nonvoice path; prefixed commands execute once offline; mic state is explicit; keyboard navigation and VoiceOver labels work. |
| **5. Integrated validation** | Workers run fault-injection tests and real-camera/artist-workflow evaluation, then fix integration issues. | Both tracking modes complete the acceptance workflow; evidence distinguishes automated tests from human observations; unresolved limitations are documented accurately. |
| **6. Standalone delivery** | Workers package the application and native resources, and prepare installation/troubleshooting documentation. | `.app` runs outside the checkout without development dependencies; installed assets support offline use; first-launch permissions and restart behavior are verified. Record artifact checksum and final review. |

Every phase includes the single reviewer session defined above. Public signing, notarization, publishing, and automatic updates are deferred.

## Acceptance Tests and Defaults

Automated checks cover coordinate mapping, calibration, smoothing, command parsing/deduplication, state transitions, malformed native requests, foreground gating, stale frames, watchdog release, and pen-up recovery.

Real-hardware acceptance covers:

- Head and desk-facing palm tracking.
- Windowed and fullscreen Krita, panel collapse, and Spaces changes.
- Drawing a line, circle, and short sketch; undo/redo; erase toggle; brush sizing; clicking a Krita control.
- Camera disconnect, microphone denial, focus loss, renderer/helper termination, sleep/wake, and display changes.
- An offline session after model setup, with no application audio/video uploads.
- Keyboard-only operation and a VoiceOver smoke test.

Record tracking rate and frame-receipt-to-event latency. Initial targets on the development Mac are at least 25 tracking updates/second and p95 processing latency below 150 ms. Voice targets are at least 95% correct execution across a fixed 40-command quiet-room test and zero actions during an unprefixed conversation test. These are acceptance targets, not existing claims.

Use **Steady** as the working name and voice prefix. Use `marseille/prompt.md-copy` at commit `cb6a082` for inspiration only; build fresh on `extension-version`, without merging the reference application. Its README’s synthetic-only head-tracking evidence does not satisfy real-camera acceptance.

Defer pressure/tilt, automatic dwell, facial gestures, simultaneous tracking modes, multi-display traversal, general desktop automation, zoom/pan commands, color/layer commands, AI artwork editing, and verified Photoshop/GIMP support.
