# Phase 02 — Tracking engine

## Authorization and entry

Use a fresh orchestrator only after explicit phase-02 authorization and a completed, reviewed phase 01. Read [Revision 2](../PLAN.md), [index](../LEDGER.md), [record rules](../ledger/README.md), applicable repository instructions, prior handoffs, fixed contracts, and actual code/dirty state. Create a unique run with exact authorization, baseline, ownership, and prior-review audit.

## Fixed inputs and ownership

Implement [first launch and calibration](../PLAN.md#first-launch-and-calibration), [tracking and mapping](../PLAN.md#tracking-and-mapping), and the specified shared contracts without changing algorithms, thresholds, or defaults. The orchestrator owns main/preload integration, shared declarations/fixtures, settings schema, manifests, and index. Existing phase-01 contracts are inputs, not choices to reopen.

Delegate most work to two workers with exclusive modules/tests:

1. **Capture/inference worker:** camera acquisition/selection, local model loading, one-frame scheduling, stale-result rejection, mirrored preview, exact anchor extraction, validity/quality reporting, and selected-hand continuity. Implement the fixed 0.6 thresholds, up-to-two-hand detection, single selected label, ambiguity rejection, and 0.12 jump rule. Mirror horizontal coordinates once.
2. **Engine worker:** pure five-capture calibration, scaled-MAD jitter, directional position mapping, the prescribed One Euro filter/gain settings, per-camera/mode persistence, recentering, synthetic fixtures, and tests. Do not add a precision-circle task, automatic gain substitution, prediction, or another stabilizer.

The orchestrator integrates setup UI and fake/probe input without enabling later-phase unrestricted drawing. Shared-file changes go through the orchestrator.

## Deliverables and mandatory checks

- Request 640×480 at 30 fps with nearest available format; preserve GPU-first/one-CPU-initialization fallback and explicit recovery on subsequent inference failure.
- Neutral/left/right/up/down captures: two seconds after Capture, at least 40 valid samples and 80% validity, median positions, retry/cancel, and directional extents exceeding both the fixed normalized minimum and jitter threshold.
- Absolute per-direction mapping and exact smoothing/gain defaults from the plan. Recenter preserves extents, releases input, resets filters, and ends paused.
- Validated separate calibration per camera/mode; no persisted mic/armed/pen state. Camera/mode changes require applicable calibration and canvas confirmation.
- Explicit hand confirmation after declared loss. Multiple hands/different labels/large jumps never silently transfer control. Do not describe the heuristic as biometric identification.
- Replay/unit tests for calibration boundaries, directional mapping, filter/gain limits, invalid or out-of-order samples, stale inference, loss/reacquisition, mode/camera changes, and hand ambiguity. Verify deterministic output and record jitter behavior without claiming medical effectiveness.

Run type/unit/integration checks and package the app. Under the [2026-10-24 user amendment](../ledger/phase-02-20261024-01/artifacts/desk-palm-deferral-01.md), obtain real Head and Palm evidence; a raised hand is permitted for Phase 02, while relaxed desk-facing Palm physical validation is deferred to Phase 05. Background operation, selected-hand loss/confirmation, all calibration steps, mapping/recenter, device/configuration/results and a performance baseline remain required for both real modes. Keep every algorithm, threshold and default fixed and label placement accurately. Missing remaining mandatory camera evidence leaves the phase blocked; replay data cannot substitute. The full timed acceptance runs and deferred desk-facing Palm gate belong to phase 05.

## Review and handoff

Audit previous attempts/reviews and use the reviewer template after integration. Supply the complete phase changes, fixed algorithm/contracts, mandatory criteria, replay and camera evidence, limitations, and prior unresolved findings. Follow the [standing reviewer continuation policy](../PLAN.md#reviewer-sessions-and-continuations): additional or replacement sessions are user-authorized when justified; record each reason, identity and separate reviewer record. Repairs/rechecks are recorded in the assigned session. Record pass or blocked and retain all prior findings/dispositions.

Hand off implemented calibration/settings/sample contracts, fixtures, camera observations, performance baseline, reviewer disposition, and blockers. Stop before phase 03, which requires separate authorization and a fresh orchestrator.
