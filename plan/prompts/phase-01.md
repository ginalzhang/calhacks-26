# Phase 01 — Shell and feasibility

## Authorization and entry

Use a fresh orchestrator only after explicit user authorization for phase 01. The planning-package creation and Revision 2 update did not authorize application work. Read [Revision 2](../PLAN.md), [the execution index](../LEDGER.md), [record rules](../ledger/README.md), and applicable repository instructions. Inspect tracked/untracked changes, the branch, baseline commit, previous attempts, and reviewer history. Preserve unrelated work and never merge the reference application.

Create `plan/ledger/phase-01-YYYYMMDD-NN/`, record exact authorization and baseline/dirty state, and update the index to running. A prompt's existence is not authorization.

**Current continuation amendment,2026-10-24:** voice is deferred under the [user instruction](../ledger/phase-01-20261024-01/artifacts/voice-deferral-01.md). Continue Phase 01 only; do not launch/resume a reviewer automatically. Preserve all prior reviews and pending review requirements.

## Fixed inputs and ownership

Implement the [fixed build baseline](../PLAN.md#fixed-build-baseline), [process ownership](../PLAN.md#process-ownership), [shared contracts](../PLAN.md#shared-contracts), and [private protocol](../PLAN.md#private-native-protocol). Use the specified Electron/Forge/Vite/React/TypeScript/Swift versions and app identity; this phase verifies compatibility, it does not choose another stack. Pin direct dependencies exactly and retain the lockfile. A failed pinned build is blocked, not permission to change versions or architecture silently.

The orchestrator owns root manifests/lockfile, build/package configuration, shared TypeScript declarations and JSON fixtures, main-process supervision/routing, and ledger index. Materialize the specified contracts and assign exclusive file paths before dependent worker edits. Shared interfaces are fixed by the plan, not negotiated into new behavior.

Delegate most implementation to two workers using the worker template:

1. **Shell worker:** owns compact panel, preload/UI modules, focusable settings/probe window, camera selection, minimal MediaPipe worker probe, and shell tests. Implement the fixed panel size/placement, nonactivating/fullscreen/Spaces behavior, background operation, and local-only resource loading.
2. **Native worker:** owns the Swift package and native tests. Implement the specified stdio protocol, authoritative state/permissions/display reporting, bounded native-input probes, foreground guards, 250 ms freshness deadline/10 ms watchdog, parent EOF cleanup, emergency-release entry point, with voice disabled. Preserve existing speech code/evidence and the inactive VAD import for later Phase 04 work.

The orchestrator integrates workers; workers report shared-file changes rather than editing each other's ownership. Keep the probe limited to phase feasibility rather than implementing the full later calibration/product UI.

## Deliverables and mandatory gate

- Reproducible development and packaged arm64 `.app` builds using Forge 8 `.cjs` main/preload conventions, app version `0.1.0`, bundle ID `org.steady.local`, and macOS deployment target 26.0.
- The Swift executable outside ASAR, bundled version-1 model/runtime assets, source/hash manifest, resource lookup independent of the checkout, and required permission descriptions. No terminal-launched helper or localhost native service.
- A panel above windowed/fullscreen Krita 5.3.4 (`org.krita`) without focus theft, including collapse and Spaces changes. Opening settings pauses input.
- Background camera/inference, one frame in flight, GPU-first/one-CPU-initialization fallback, no CDN, and blocked application outbound traffic including telemetry.
- Protocol fixtures covering framing, validation, sequence/session/generation handling, acknowledgments, clock synchronization, timeout, and emergency release with fake input.
- Voice stays disabled: no microphone activation or speech-asset setup. Speech permissions, boundary integration, offline recognition and ten-probe latency gates are deferred to Phase 04; the exact future [voice requirements](../PLAN.md#commands-and-voice) remain.
- The required scripts in [automated acceptance](../PLAN.md#automated-acceptance). Native-input tests default to fake mode; live probes require an explicit real-input flag and operator participation.

Run type checks, JS/native fake-backend checks, and packaging. With the operator and a disposable Krita document, verify packaged-identity permissions, actual native movement/release, z-order/focus across windowed/fullscreen/Spaces, unfocused inference, and offline physical tracking with blocked outbound/telemetry attempts. Retain distinct desk-camera and selected external-display/mixed-scale/negative-origin hardware checks. Do not run speech trials in Phase 01.

Verify stale capture despite live heartbeats and parent disconnect with fake input before supervised native probes. Check that the packaged `--release-and-exit` entry point works. Record versions, equipment, configuration, procedure, actual outcomes, and artifact location. Missing evidence, failed pinned dependencies, or failed nondeferred native assumptions leave the phase blocked. The historical speech-boundary failure is an unresolved Phase 04 prerequisite, not a Phase 01 exit blocker. Do not claim a development-only run satisfies packaged acceptance.

## Review and handoff

After integration and meaningful evidence, audit all prior phase-01 runs and reviewer records. Instantiate the reviewer template with the full baseline/change inventory (including untracked files), all mandatory criteria, results, limitations, and unresolved prior findings. Use a fresh reviewer under the [standing reviewer continuation policy](../PLAN.md#reviewer-sessions-and-continuations). Additional or replacement sessions are already user-authorized when continuation, unavailability/interruption, or materially changed work requires them; record each launch's reason and a separate reviewer record. Fixes and affected rechecks are recorded in the assigned session. Record pass or blocked and carry all unresolved findings forward; interrupted reviews remain in history.

Hand off exact locked versions, commands, implemented fixed-contract files/fixtures, permission findings, resource manifest, nonvoice hardware evidence, reviewer record, deferred speech findings, and remaining blockers. Stop. Phase 02 requires separate authorization and a fresh orchestrator.
