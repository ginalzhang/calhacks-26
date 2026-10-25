# Reviewer prompt template — Revision 2 with reviewer-policy amendment

Replace every `<...>` field and save this exact instantiated assignment. Audit all prior attempts and reviews for this phase. The [standing user-approved reviewer policy](../PLAN.md#reviewer-sessions-and-continuations) permits additional or replacement sessions on continuation, prior-reviewer unavailability/interruption, or materially changed work requiring renewed review. Record why this session is needed and use a unique record. Interrupted sessions and prior findings remain in history. Perform repairs/affected rechecks in the assigned session and hand off unresolved work explicitly.

## Assignment and complete inputs

You are `<reviewer-id>` for Steady phase `<phase-id>`, run `<run-id>`, parent `<orchestrator-id>`. Authorization/prior-review audit: `<authorization-and-review-audit-reference>`.

Read [Revision 2](../PLAN.md), `plan/ledger/README.md`, repository instructions, `<phase-prompt>`, and `<orchestrator-and-worker-records>`. Review the whole integrated phase, including earlier code that affects its behavior, not just the latest patch.

Required inputs:

- Baseline commit and existing dirty-state inventory: `<baseline-reference>`.
- All integrated tracked/untracked changes and result state: `<change-inventory-reference>`.
- Full fixed phase acceptance criteria: `<criteria-verbatim-or-exact-section-links>`.
- Automated/replay/manual evidence and artifacts: `<evidence-links>`.
- Failures, known limitations, missing checks: `<limitation-links>`.

For an additional reviewer session, the authorization/review-audit input must also identify the standing policy, this launch's reason, earlier reviewer records, and the disposition of each prior unresolved finding.

## Review and repair

Check correctness, completeness, contract/fixture agreement, ownership integration, and evidence. Audit relevant fixed decisions: pinned build/identity; calibration/mapping/hand rules; state transitions and native freshness/release; local semantic panel clicks; stdio/session/sequence/generation/clock/ack rules; exact finalized speech vocabulary/timing; blocked outbound telemetry; and packaged runtime/first-run requirements. Compare results against the numeric targets and exact scripts in the plan. A reported passing build or transmitted shortcut alone does not prove hardware behavior.

Record findings with severity, paths, and observable impact. Fix issues within the authorized phase, then run affected checks. Do not alter the plan, swap dependencies/architecture, loosen acceptance, change algorithms/vocabulary, or start later-phase work to avoid a failure. Broader changes remain documented blockers for the user. Preserve unrelated work. Do not delegate subagents or another reviewer.

Automated checks use fake native input. Supervised real-input checks require the flag, operator participation, and disposable documents. Missing mandatory evidence remains blocked. For delivery, artifact changes require rebuild, affected rechecks, and updated checksums before this session closes.

## Record and disposition

Maintain `<reviewer-record-path>` with exact prompt, identity/parent, baseline, inspected changes, findings, fixes, commands/outcomes, evidence, and outstanding work. Append corrections; preserve prior failures. Do not edit `plan/LEDGER.md`; send its required update to the orchestrator.

Return one disposition:

- **Pass:** all phase deliverables and mandatory gates have evidence; findings are fixed or demonstrably nonblocking under the fixed plan.
- **Blocked:** identify each unresolved failure, unavailable mandatory check, or required out-of-scope decision, plus next owner/action.

Include final changed paths, commit or uncommitted state, checks/results, remaining limitations, and record/artifact links. The orchestrator records all reviewer sessions/results and stops before another phase. Additional sessions are authorized under the standing policy; prior blocked findings and mandatory evidence must still be resolved before pass.
