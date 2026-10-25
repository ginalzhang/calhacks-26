# Scoped worker prompt template — Revision 2

This is the instantiated worker assignment, saved by the orchestrator. This template is not phase authorization. Use the fixed [Revision 2 specification](../PLAN.md); do not reopen its product, algorithm, build, vocabulary, protocol, state, or acceptance decisions.

## Assignment

You are `shell` for Steady phase `01`, run `phase-01-20261024-01`, parent `/root`. Read `plan/PLAN.md`, `plan/ledger/README.md`, repository instructions, `plan/prompts/phase-01.md`, and `plan/ledger/phase-01-20261024-01/orchestrator.md (no prior application attempts)`. Exact user authorization is at `plan/ledger/phase-01-20261024-01/artifacts/authorization.md`.

Implement `320x560 / 320x96 compact React panel and focusable settings/probe UI, typed sandboxed preload, camera selection, local MediaPipe worker with GPU-first/one CPU fallback and one frame in flight, accessible 44-point controls and explicit microphone/assets controls. Minimal feasibility UI only. Parent owns main-process window behavior.` within this authorized phase. The orchestrator owns shared integration and the execution index. Application work does not inherit authorization from a planning-document revision.

## Ownership and fixed contracts

- Own `src/preload/, src/renderer/, tests/shell/, plan/ledger/phase-01-20261024-01/artifacts/shell-*` and `plan/ledger/phase-01-20261024-01/worker-shell.md`.
- Implement `Revision 2 fixed build, ownership, shared contracts, private native protocol, commands/voice; src/shared/contracts.ts and fixtures/protocol-v1.json (materialized; read only)` with the specified versions, units, field requirements, validation, and state/timing behavior. Positive/negative JSON fixtures must agree across TypeScript and Swift.
- Inputs/readiness dependencies: `Contracts are ready. Timestamp units are monotonic milliseconds, coordinates logical Quartz points. Use SteadyAPI exactly; request integration changes from parent.`.
- Adjacent worker boundaries: `native/ owned by native worker; main/shared/manifests/config/scripts/resources owned by parent`.
- Do not edit shared manifests/contracts, another worker's files, `plan/PLAN.md`, or `plan/LEDGER.md` unless ownership is explicitly reassigned. Send the exact integration change to the orchestrator instead.
- Do not spawn agents/reviewers or start a later phase. Preserve user work and report conflicts.

## Required checks and constraints

Deliver `renderer/preload/worker modules and meaningful shell tests; report requested main integration changes`. Run `npm run typecheck and npm test -- tests/shell after dependencies ready; independent pure checks meanwhile` and record `commands, exit codes, automated versus not-run hardware classification, failures and limitations`. These instantiate the phase's fixed requirements; they do not weaken or replace them.

Use fake clocks/native backends and synthetic fixtures for automated checks. No test suite manipulates the real desktop. Supervised live probes require an explicit real-input flag, a disposable Krita document, and operator participation. Record unavailable checks as not run and notify the parent; do not relabel replay results or grant permissions on the user's behalf.

If a pinned dependency, architectural assumption, or mandatory target fails, report the evidence and mark the dependent work blocked. Continue independent authorized work. Do not silently substitute versions/architectures, add cloud/browser/LLM speech, change thresholds/vocabulary, bypass native guards, or relax a gate. Follow the exact plan state machine, 250 ms freshness deadline/10 ms watchdog, one-second voice p95/1.5-second expiry, and privacy boundaries wherever relevant.

## Record and handoff

Maintain your record using the ledger rules: exact task prompt, parent/agent identity if exposed, baseline/dirty state, owned paths, dated observable actions, changes, commands/outcomes, failures, artifacts, and remaining work. Do not store hidden reasoning, credentials, recordings, or raw camera data.

Return changed paths, implemented fixed interfaces, command/check outcomes, integration steps, evidence links, blockers, and your record path. State the result commit or explicit uncommitted state; do not create a commit unless separately instructed. Hand off to the parent orchestrator and stop.
