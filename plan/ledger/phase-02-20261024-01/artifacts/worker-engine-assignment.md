# Scoped worker prompt template — Revision 2

The orchestrator replaces every `<...>` field before assignment and saves the exact instantiated prompt in the run's artifacts. This template is not phase authorization. Use the fixed [Revision 2 specification](../PLAN.md); do not reopen its product, algorithm, build, vocabulary, protocol, state, or acceptance decisions.

## Assignment

You are `/root/worker_engine` for Steady phase `02`, run `phase-02-20261024-01`, parent `/root`. Read `plan/PLAN.md`, `plan/ledger/README.md`, repository instructions, `plan/prompts/phase-02.md`, and `plan/ledger/phase-01-20261024-01/handoff.md (final COMPLETE checkpoint), plan/ledger/phase-01-20261024-01/reviewer-02.md`. Exact user authorization is at `plan/ledger/phase-02-20261024-01/artifacts/authorization.md`.

Implement `Pure five-position calibration with 2s windows, >=40 valid/80%, medians, scaled MAD, strict extents >0.01 and >3*jitter, exact One Euro/gain defaults, directional absolute mapping, per-camera/mode calibration validation/key helpers, recenter preserving extents/reset, deterministic tests.` within this authorized phase. The orchestrator owns shared integration and the execution index. Application work does not inherit authorization from a planning-document revision.

## Ownership and fixed contracts

- Own `new src/renderer/engine/ and tests/engine/` and `plan/ledger/phase-02-20261024-01/worker-engine.md`.
- Implement `PLAN.md first launch/calibration and tracking/mapping, src/shared/contracts.ts; ownership/API frozen in orchestrator.md` with the specified versions, units, field requirements, validation, and state/timing behavior. Positive/negative JSON fixtures must agree across TypeScript and Swift.
- Inputs/readiness dependencies: `Baseline code is ready; use existing shared types. Optional TrackingSample.selectedHand is centrally approved and added by parent. Send exact public API early.`.
- Adjacent worker boundaries: `See frozen ownership in orchestrator.md; parent owns all shared files, fixtures, schema, main/preload/UI/manifests.`.
- Do not edit shared manifests/contracts, another worker's files, `plan/PLAN.md`, or `plan/LEDGER.md` unless ownership is explicitly reassigned. Send the exact integration change to the orchestrator instead.
- Do not spawn agents/reviewers or start a later phase. Preserve user work and report conflicts.

## Required checks and constraints

Deliver `Engine modules and deterministic tests covering exact boundaries, jitter, filter/gain limits/resets, invalid/out-of-order/generation/stale frames, camera/mode keys and recenter. Parent supplies shared fixtures/schema/file IO.`. Run `npm run typecheck; npx vitest run tests/engine` and record `sanitized deterministic replay/jitter metrics and test outcomes; no medical claims`. These instantiate the phase's fixed requirements; they do not weaken or replace them.

Use fake clocks/native backends and synthetic fixtures for automated checks. No test suite manipulates the real desktop. Supervised live probes require an explicit real-input flag, a disposable Krita document, and operator participation. Record unavailable checks as not run and notify the parent; do not relabel replay results or grant permissions on the user's behalf.

If a pinned dependency, architectural assumption, or mandatory target fails, report the evidence and mark the dependent work blocked. Continue independent authorized work. Do not silently substitute versions/architectures, add cloud/browser/LLM speech, change thresholds/vocabulary, bypass native guards, or relax a gate. Follow the exact plan state machine, 250 ms freshness deadline/10 ms watchdog, one-second voice p95/1.5-second expiry, and privacy boundaries wherever relevant.

## Record and handoff

Maintain your record using the ledger rules: exact task prompt, parent/agent identity if exposed, baseline/dirty state, owned paths, dated observable actions, changes, commands/outcomes, failures, artifacts, and remaining work. Do not store hidden reasoning, credentials, recordings, or raw camera data.

Return changed paths, implemented fixed interfaces, command/check outcomes, integration steps, evidence links, blockers, and your record path. State the result commit or explicit uncommitted state; do not create a commit unless separately instructed. Hand off to the parent orchestrator and stop.
