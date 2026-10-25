# Phase 05 — Integrated validation

## Authorization and entry

Use a fresh orchestrator after explicit phase-05 authorization and completed/reviewed phase 04. Read [Revision 2](../PLAN.md), [index](../LEDGER.md), [record rules](../ledger/README.md), repository instructions, all prior handoffs, frozen scripts, and known limitations. Record exact authorization, baseline/dirty state, unique run, ownership, and prior-review history.

## Fixed inputs and ownership

Execute [automated acceptance](../PLAN.md#automated-acceptance) and [hardware/usability acceptance](../PLAN.md#hardware-and-usability-acceptance). Metric definitions, scripts, algorithm/defaults, state transitions, and thresholds are fixed. Do not alter the corpus after scoring, silently loosen a target, or replace failed assumptions with another architecture.

The orchestrator owns cross-subsystem integration/fixes, acceptance matrix, clock/metric verification, and index. Delegate most work to:

1. **Fault/metrics worker:** fake-input fault harnesses, deterministic integration tests, timestamp/nearest-rank metrics, and sanitized automated evidence. Cover all state/command combinations, protocol validation/expiry/timeout, stale tracking despite liveness, clock uncertainty, panel exclusions, parent/helper/renderer failures, and pen-up recovery.
2. **Workflow worker:** supervised hardware procedures, fixed script execution, accessibility/usability reports, and assigned UI-only fixes. Coordinate with the user/operator for both cameras and the external display; confirmed availability is not evidence a test has run. Never fabricate operator observations or retain raw camera/audio data.

Assign each discovered fix to one owner before edits. Do not automate real desktop events from test suites; supervised real probes require the explicit real-input flag and disposable documents.

## Mandatory checks and exact thresholds

Complete the [user-deferred relaxed desk-facing Palm gate](../ledger/phase-02-20261024-01/artifacts/desk-palm-deferral-01.md) in this phase: document the actual desk/camera placement; perform all five captures, mapping, recenter, background operation and selected-hand loss/confirmation, then the full performance/usability acceptance below. Earlier raised-hand Palm evidence cannot establish desk-facing behavior. Retain the Phase 02 failed/partial attempts and placement limits.

Record versions, camera/display, configuration, operator/date, procedures, results, and evidence classification for every case in the plan. Required workflows include both tracking modes; line/circle/sketch; eraser/size/undo/redo; explicit panel and Krita control clicks; windowed/fullscreen/Spaces and collapse; keyboard bindings/VoiceOver; permission denial; device disconnect; focus changes; process failures; sleep/wake; and display reconfiguration.

- Run each mode for 60 seconds after ten seconds warmup. Require at least 25 posted updates/second average and nearest-rank p95 frame-receipt-to-native-event latency below 150 ms. Record smoothing/gain; do not present processing time as total perceived filter delay.
- Induce sample starvation and require release within 300 ms of the last valid sample. Exercise the specified 250 ms deadline and 10 ms watchdog, including a live heartbeat with stale captures.
- Test Retina and external displays separately, including a negative-origin layout. Do not multiply native pointer coordinates by backing scale.
- Execute the frozen 40-command script: four cycles of pen down, pen up, click, undo, redo, brush, toggle erase, bigger, smaller, recenter. Prepare document state and explicitly resume between cycles. Require at least 38 correct actual actions; wrong, missing, duplicated, and expired actions fail.
- Require p95 speech-end-to-acknowledged-action latency at most one second, including finalization. Use audio-time end of detected speech and document detector timing limits. Check pen toggle, pause/resume, marking corners, and microphone-off separately.
- Run five minutes of frozen unprefixed conversation against dry-run output: zero actions. Unknown and multiple-action phrases must also yield zero actions.
- Verify offline speech/tracking after setup, blocked application outbound requests including telemetry, and no retained recordings/transcripts. Record code/config inspection and runtime test methods and their limits.
- Record operator feedback on setup, precision, fatigue, and accidental actions. Identify developer versus intended-use artist; do not generalize effectiveness to an artist population.

Run affected checks after fixes and retain all failed attempts. Missing operator/hardware evidence, unmet targets, or unresolved mandatory faults leave the phase blocked. Replay evidence is never relabeled as real-camera evidence.

## Review and handoff

Audit review history and use the reviewer template with the full integrated changes, matrix, frozen scripts, numeric summaries, failures, limitations, and prior unresolved findings. Follow the [standing reviewer continuation policy](../PLAN.md#reviewer-sessions-and-continuations); additional or replacement sessions are user-authorized when justified, with launch reasons/identities and separate records. Repairs/rechecks are recorded in the assigned session. Record pass or blocked and every unmet gate; preserve prior findings/dispositions.

Hand off the validated configuration, exact metrics/action counts, script/evidence locations, operator observations, reviewer result, limitations, and delivery prerequisites. Stop before phase 06; it requires separate authorization and a fresh orchestrator.
