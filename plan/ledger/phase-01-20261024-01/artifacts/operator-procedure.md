# Phase 01 supervised packaged procedure

Evidence classification is **manual hardware** only after the operator reports actual outcomes. Until then every row is **not run**. Use a disposable Krita document; do not start later-phase calibration/product implementation.

## Equipment and identity

Record operator role (developer or intended-use artist), macOS build, Mac/chip/memory, Krita version/bundle ID, camera names/formats, display IDs/logical bounds/scales/arrangement and whether network connectivity is disabled. Known tools: macOS26.7.1/25G241, arm64 Apple M5 MacBook Pro/Mac17,2/16GB, Krita5.3.4, Node26.12.1/npm11.20.0/Swift6.4/SDK27.0. System-profiler sandbox output did not enumerate camera/display equipment; operator confirmation is required.

Use only the final recorded build/checksum. Launch Steady.app by Finder. Confirm helper location is inside the app and native backend initially fake. Permission status in Settings is a report, not evidence that permissions work under packaged identity. Grant access through the OS prompts/settings yourself. No agent grants TCC permissions.

## Panel and background inference

1. Keep Krita foreground and place the panel above its window. Confirm Steady does not take keyboard focus, physical panel controls work and closing the panel quits Steady.
2. Repeat with Krita fullscreen, after changing Spaces, and expanded/collapsed (320x560 / 320x96). Confirm the panel stays above Krita and remains on the selected display with a 16-point initial work-area margin.
3. Open Settings; confirm input pauses. Select head camera and start probe, grant camera permission, then switch to Krita and collapse the panel for at least 30 seconds. Reopen Settings and report frame-counter increase, delegate and failures. Repeat palm mode with desk camera.
4. Repeat on external display, separately selected, including negative-origin/mixed-scale layout. Record missing selection UI/equipment as blocked; do not infer success from native display enumeration.

## Native input and release

Prerequisite: fake stale-capture-with-live-heartbeats and parent-EOF/release checks pass. Grant packaged Steady accessibility permission manually. In Settings, check the disposable-document confirmation, put the cursor in a safe canvas area with 12 logical points of room to the right, click Run bounded real-input probe, and switch to Krita within five seconds. Observe hover, short stroke, and button release after deliberate starvation. Report whether any movement/release failed or any focus change occurred. Use Emergency release if necessary. Native input is separate from uncalibrated tracking.

The parent logs sanitized probe acknowledgments under Electron userData `phase01-evidence/native-probe.jsonl`. Verify `--release-and-exit` in fake mode automatically and invoke the visible emergency release under packaged identity for supervised real evidence.

## Ten offline speech probes

1. Click Set up speech assets while online. Wait for Apple installation to complete. Enable microphone explicitly and grant microphone/speech permissions. Disable network connectivity yourself; confirm Steady remains local.
2. Start a fresh microphone session. Speak these ten isolated finalized utterances, leaving at least two seconds of silence between them: alternate “Steady pause” and “Steady pen up” five times. These phase-01 release actions work while paused; full vocabulary/state scoring belongs to phase04/05.
3. Disable microphone. Retrieve Electron userData `phase01-evidence/speech-timings.jsonl` and run `node scripts/score-speech.mjs <file>`. Preserve all ten individual values, action acknowledgments and nearest-rank p95 (for ten probes this is the maximum). Require every action accepted and p95 <=1000ms.
4. Timing starts at SpeechDetector's audio-time speech end and ends at native action ack, including finalization and main routing. Audio tap host-time alignment and detector segmentation are implementation timing limitations; do not substitute final-result callback time. Missing results or null/negative timings fail the trial. No transcripts/audio are retained.

## Reporting

Report each step's actual outcome and configuration, errors, permission prompts/identity, equipment, offline status and whether the operator is a developer or intended-use artist. Attach sanitized timing evidence to the run. Missing evidence leaves Phase 01 blocked. Clean-account first-run delivery is a later phase06 gate and is not claimed by this run.
