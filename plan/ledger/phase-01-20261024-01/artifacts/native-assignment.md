# Scoped worker prompt template — Revision 2

This is the instantiated worker assignment, saved by the orchestrator. This template is not phase authorization. Use the fixed [Revision 2 specification](../PLAN.md); do not reopen its product, algorithm, build, vocabulary, protocol, state, or acceptance decisions.

## Assignment

You are `native` for Steady phase `01`, run `phase-01-20261024-01`, parent `/root`. Read `plan/PLAN.md`, `plan/ledger/README.md`, repository instructions, `plan/prompts/phase-01.md`, and `plan/ledger/phase-01-20261024-01/orchestrator.md (no prior application attempts)`. Exact user authorization is at `plan/ledger/phase-01-20261024-01/artifacts/authorization.md`.

Implement `Swift package SteadyNative executable and Swift Testing tests: strict bounded stdio protocol, authoritative state/permissions/displays, guarded bounded native-input probes, independent 250ms freshness/10ms watchdog, EOF release and --release-and-exit, SpeechAnalyzer/SpeechTranscriber fastResults/audio-time/SpeechDetector offline speech probe with explicit mic and asset enable, finalized exact prefixed grammar, 400ms silence, six-second utterances, 1.5s expiry. Default backend fake.` within this authorized phase. The orchestrator owns shared integration and the execution index. Application work does not inherit authorization from a planning-document revision.

## Ownership and fixed contracts

- Own `native/, plan/ledger/phase-01-20261024-01/artifacts/native-*` and `plan/ledger/phase-01-20261024-01/worker-native.md`.
- Implement `Revision 2 fixed build, ownership, shared contracts, private native protocol, commands/voice; src/shared/contracts.ts and fixtures/protocol-v1.json (materialized; read only)` with the specified versions, units, field requirements, validation, and state/timing behavior. Positive/negative JSON fixtures must agree across TypeScript and Swift.
- Inputs/readiness dependencies: `Contracts are ready. Timestamp units are monotonic milliseconds, coordinates logical Quartz points. Use SteadyAPI exactly; request integration changes from parent.`.
- Adjacent worker boundaries: `preload/renderer/shell tests owned by shell worker; main/shared/manifests/config/scripts/resources owned by parent`.
- Do not edit shared manifests/contracts, another worker's files, `plan/PLAN.md`, or `plan/LEDGER.md` unless ownership is explicitly reassigned. Send the exact integration change to the orchestrator instead.
- Do not spawn agents/reviewers or start a later phase. Preserve user work and report conflicts.

## Required checks and constraints

Deliver `Swift package arm64/macOS26, native fake tests including shared fixtures and stale capture despite live heartbeats, documented CLI and resource integration. Read installed SDK swiftinterfaces for APIs.`. Run `swift build and swift test with workspace or /private/tmp module cache; no permission prompts or real-input probes. Report executable location, CLI, protocol details and blockers` and record `commands, exit codes, automated versus not-run hardware classification, failures and limitations`. These instantiate the phase's fixed requirements; they do not weaken or replace them.

Use fake clocks/native backends and synthetic fixtures for automated checks. No test suite manipulates the real desktop. Supervised live probes require an explicit real-input flag, a disposable Krita document, and operator participation. Record unavailable checks as not run and notify the parent; do not relabel replay results or grant permissions on the user's behalf.

If a pinned dependency, architectural assumption, or mandatory target fails, report the evidence and mark the dependent work blocked. Continue independent authorized work. Do not silently substitute versions/architectures, add cloud/browser/LLM speech, change thresholds/vocabulary, bypass native guards, or relax a gate. Follow the exact plan state machine, 250 ms freshness deadline/10 ms watchdog, one-second voice p95/1.5-second expiry, and privacy boundaries wherever relevant.

## Record and handoff

Maintain your record using the ledger rules: exact task prompt, parent/agent identity if exposed, baseline/dirty state, owned paths, dated observable actions, changes, commands/outcomes, failures, artifacts, and remaining work. Do not store hidden reasoning, credentials, recordings, or raw camera data.

Return changed paths, implemented fixed interfaces, command/check outcomes, integration steps, evidence links, blockers, and your record path. State the result commit or explicit uncommitted state; do not create a commit unless separately instructed. Hand off to the parent orchestrator and stop.
