# Phase 03 — Krita integration

## Authorization and entry

Use a fresh orchestrator after explicit phase-03 authorization and completed/reviewed phase 02. Read [Revision 2](../PLAN.md), [index](../LEDGER.md), [record rules](../ledger/README.md), repository instructions, earlier handoffs/evidence, and current code. Record exact authorization, baseline/dirty state, unique run, ownership, and prior-review history.

## Fixed inputs and ownership

Implement [canvas/panel interaction](../PLAN.md#canvas-and-panel-interaction), the [input state machine](../PLAN.md#input-state-machine), command defaults, and the [native protocol](../PLAN.md#private-native-protocol). State meanings, coordinate units, timing, mapping, and command vocabulary are already specified. Do not redesign them in this phase.

The orchestrator owns shared protocol/command/state declarations, main dispatcher integration, build files, and index. Native helper state is authoritative; shared JSON fixtures must agree with TypeScript and Swift. Freeze exclusive file ownership before delegating:

1. **Input worker:** native/controller coordinate handling, foreground gating, state transitions, watchdog, exclusion rectangles, emergency release, and fake-backend fault/state tests. Use helper-reported Quartz logical bounds; do not apply a Retina backing-scale multiplier. Implement eight-round-trip clock synchronization, refresh/uncertainty rules, latest-only samples, and acknowledgment timeouts as specified.
2. **Canvas/commands worker:** corner setup, display selection, semantic panel hit-testing, visible core controls, fixed Krita defaults, unverified generic profiles, configurable global bindings, and associated tests. F8 marks corners only in canvas setup; otherwise it toggles the pen. F9 pauses. Other action bindings remain unassigned initially.

Workers route shared-file edits through the orchestrator; no competing state controllers. Do not add dwell/gesture drawing, automatic target activation, or broad desktop automation.

## Deliverables and mandatory checks

- Forced pen-up setup hover before a canvas exists, while Krita is foreground. Capture ordered corners using F8/control; the voice action ID is ready for phase 04. Enforce the 100×100-point minimum, display containment, and panel exclusion. Completion enters PAUSED.
- Implement SETUP, PAUSED, HOVER, DRAWING, and FAULT exactly, with mic state independent. Resume requires all prerequisites and 500 ms valid tracking. PAUSED blocks native pointer/clicks but permits target shortcuts under the specified foreground guard.
- Canvas/panel entry ends strokes to HOVER; reentry never draws automatically. Tracking gaps freeze; the 250 ms freshness deadline/10 ms watchdog releases within the 300 ms acceptance maximum and enters PAUSED. Foreground/settings/mode/display/wake events require explicit recovery/resume.
- A tracked panel Click invokes a registered semantic button locally; background does nothing. Never inject native click-through. Physical and tracked panel actions share the dispatcher.
- Explicit mouse strokes/clicks and configured shortcuts. Verify Command-Z, Command-Shift-Z, B, E, `]`, and `[` in Krita 5.3.4. Erasing remains a toggle with no invented state synchronization.
- Rejected/stale commands are discarded with feedback. Parent EOF/helper exit cleanup, `--release-and-exit`, protocol mismatch, clock uncertainty, and acknowledgment timeout are exercised with fake input.

Run deterministic state/coordinate/protocol tests and an integrated package build. With the operator and disposable Krita documents, verify real drawing/clicks/shortcuts, corner capture, panel activation without focus theft, canvas exit/reentry, target switching, emergency pause, loss/recovery, Retina mapping, and an external display selected separately in a negative-origin layout. Text/modal work is paused; do not claim internal Krita dialog inspection. Record actual app effects, not just shortcut transmission. Missing mandatory evidence leaves the phase blocked.

## Review and handoff

Audit review history and use the reviewer template with the entire integrated changes, state/contracts, full gate, fake-backend results, manual evidence, limitations, and prior unresolved findings. Follow the [standing reviewer continuation policy](../PLAN.md#reviewer-sessions-and-continuations); additional or replacement sessions are user-authorized when justified, with reasons/identities and separate records. Record fixes/rechecks in the assigned session, pass or blocked, tested coordinate/profile behavior, safeguards, and remaining work. Preserve all prior findings/dispositions.

Stop after the phase. Phase 04 requires separate authorization and a fresh orchestrator.
