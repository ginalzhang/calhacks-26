# One-session reviewer prompt template — Revision 2

This is the exact instantiated reviewer assignment. Audit all prior attempts for this phase: launch only one fresh reviewer session unless a user-approved replacement exception is recorded. An interrupted review still counts. Fixes and affected rechecks occur within this session, without a reviewer loop.

## Assignment and complete inputs

You are `/root/reviewer` for Steady phase `01`, run `phase-01-20261024-01`, parent `/root`. Authorization/prior-review audit: `plan/ledger/phase-01-20261024-01/artifacts/review-audit.md and plan/ledger/phase-01-20261024-01/artifacts/authorization.md`.

Read [Revision 2](../PLAN.md), `plan/ledger/README.md`, repository instructions, `plan/prompts/phase-01.md`, and `plan/ledger/phase-01-20261024-01/{orchestrator,worker-shell,worker-native}.md`. Review the whole integrated phase, including earlier code that affects its behavior, not just the latest patch.

Required inputs:

- Baseline commit and existing dirty-state inventory: `plan/ledger/phase-01-20261024-01/artifacts/baseline-status.txt; baseline207669b43c3f270bf88b89f9e129f0e27c11e3aa, empty tracked application tree,18 initial untracked planning files preserved`.
- All integrated tracked/untracked changes and result state: `plan/ledger/phase-01-20261024-01/artifacts/change-inventory.json and git status --short --untracked-files=all (all application source untracked/new)`.
- Full fixed phase acceptance criteria: `plan/prompts/phase-01.md Deliverables and mandatory gate; plan/PLAN.md Fixed build baseline, Process ownership, Shared contracts, Private native protocol, Commands and voice, Automated acceptance, phase01 row and hardware evidence rules (all mandatory, no relaxation)`.
- Automated/replay/manual evidence and artifacts: `plan/ledger/phase-01-20261024-01/artifacts/integration-validation.md; native/shell records and their linked actual outputs; resources/asset-manifest.json; tests/e2e/packaged.spec.ts packaged actual model synthetic test`.
- Failures, known limitations, missing checks: `plan/ledger/phase-01-20261024-01/artifacts/integration-validation.md Scope and remaining gates; plan/ledger/phase-01-20261024-01/artifacts/operator-procedure.md; hardware operator results pending; no live inputs authorized without explicit UI flag/confirmation`.

## Review and repair

Check correctness, completeness, contract/fixture agreement, ownership integration, and evidence. Audit relevant fixed decisions: pinned build/identity; calibration/mapping/hand rules; state transitions and native freshness/release; local semantic panel clicks; stdio/session/sequence/generation/clock/ack rules; exact finalized speech vocabulary/timing; blocked outbound telemetry; and packaged runtime/first-run requirements. Compare results against the numeric targets and exact scripts in the plan. A reported passing build or transmitted shortcut alone does not prove hardware behavior.

Record findings with severity, paths, and observable impact. Fix issues within the authorized phase, then run affected checks. Do not alter the plan, swap dependencies/architecture, loosen acceptance, change algorithms/vocabulary, or start later-phase work to avoid a failure. Broader changes remain documented blockers for the user. Preserve unrelated work. Do not delegate subagents or another reviewer.

Automated checks use fake native input. Supervised real-input checks require the flag, operator participation, and disposable documents. Missing mandatory evidence remains blocked. For delivery, artifact changes require rebuild, affected rechecks, and updated checksums before this session closes.

## Record and disposition

Maintain `plan/ledger/phase-01-20261024-01/reviewer.md` with exact prompt, identity/parent, baseline, inspected changes, findings, fixes, commands/outcomes, evidence, and outstanding work. Append corrections; preserve prior failures. Do not edit `plan/LEDGER.md`; send its required update to the orchestrator.

Return one disposition:

- **Pass:** all phase deliverables and mandatory gates have evidence; findings are fixed or demonstrably nonblocking under the fixed plan.
- **Blocked:** identify each unresolved failure, unavailable mandatory check, or required out-of-scope decision, plus next owner/action.

Include final changed paths, commit or uncommitted state, checks/results, remaining limitations, and record/artifact links. The orchestrator records the result and stops before another phase. No automatic replacement or second reviewer is permitted.

Additional integration context: workers are handing off their exclusive files; you may fix any application files and your record/artifacts, but never edit plan/LEDGER.md or PLAN.md. Parent remains sole index writer and gathers operator evidence. Rebuild/checksum affected artifacts after your fixes. This is the single review session; no new reviewers or subagents. Inform parent before rebuilding so the operator copy can be refreshed. Do not run real-input or microphone/camera probes yourself.
