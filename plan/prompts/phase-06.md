# Phase 06 — Standalone delivery

## Authorization and entry

Start a fresh orchestrator after explicit phase-06 authorization and completed/reviewed phase 05. Read [Revision 2](../PLAN.md), [index](../LEDGER.md), [record rules](../ledger/README.md), repository instructions, handoffs, exact locked build inputs, accepted configurations, and limitations. Record authorization, baseline/dirty state, unique run, ownership, and review history.

## Fixed inputs and ownership

Implement [standalone delivery](../PLAN.md#standalone-delivery) using the fixed build/package baseline, local identity, resource contracts, and state defaults. Public signing/notarization, publishing, automatic updates, and credential-dependent release steps remain outside scope.

The orchestrator owns root package/build configuration, lockfile, local app identity, final integration, and index. Delegate most work to:

1. **Packaging worker:** assigned packaging/resource scripts and runtime audits. Produce the arm64 `.app` and ZIP with Forge 8.0.1; place Swift executable outside ASAR, include local version-1 models/runtime/notices and source/hash manifest, preserve permissions, and verify packaged lookup/emergency release. Use local/ad-hoc signing, not Developer ID credentials.
2. **Delivery worker:** build/install/setup/troubleshooting documentation and supervised delivery checks. Cover permissions, cameras, calibration, canvas remapping, microphone/model setup, global bindings, offline behavior, generic-profile caveats, and known limitations. Coordinate clean-account checks with the operator; do not create accounts or grant permissions silently.

Shared config changes go through the orchestrator. Recheck affected phase-05 behavior after late functional/build changes. No release/publish command or external messaging is authorized.

## Deliverables and mandatory checks

- Required build/package scripts, exact dependency lockfile, `.app` and ZIP locations, file sizes, SHA-256 checksums, source/hash resource manifest, and exact build inputs.
- Validate `/private/tmp/steady-delivery/Steady.app` with development servers stopped, outside the checkout, without a separately launched helper. Audit for checkout paths or runtime Node/Python/Swift/compiler dependencies; distinguish static audit from actually testing a machine without tools.
- Use a clean macOS account with operator participation for first-run permission evidence. Missing clean-account evidence leaves the gate blocked. Camera/mic/native-control permissions must be attributed to the packaged application identity.
- Verify speech asset readiness/install, explicit mic enable, offline tracking/speech after setup, and restart with paused/pen-up/mic-off defaults.
- Exercise real core drawing and local panel clicks in windowed/fullscreen Krita, selected-display mapping, focus behavior, and native release safeguards from the delivered package. Confirm outbound application traffic including telemetry remains blocked.
- Document macOS 26+/arm64, Krita 5.3.4 as the verification target, actual tested configuration, assisted setup/camera needs, remapping requirements, and the local-delivery boundary. Do not claim public distribution or untested app/platform support.

Artifacts may remain outside Git with precise locations/checksums. Do not commit large build outputs merely for ledger completeness. Missing first-run/runtime/hardware evidence or a failed standalone assumption leaves the phase blocked.

## Review and final handoff

Audit all previous review launches and use the reviewer template with the full integrated changes, fixed delivery criteria, package/build inputs, permission/runtime evidence, checksums, affected phase-05 regression results, and prior unresolved findings. Follow the [standing reviewer continuation policy](../PLAN.md#reviewer-sessions-and-continuations); additional or replacement sessions are user-authorized when justified, with launch reasons/identities and separate records. Fix/recheck within the assigned session. If an artifact changes, rebuild, rerun affected checks, and recompute its checksum before that artifact's review closes. Preserve prior findings/dispositions.

Record pass or blocked, final artifact/checksum/configuration, user instructions, evidence and agent-record links, and remaining limitations. Stop. Completion authorizes no publishing or further roadmap work.
