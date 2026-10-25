# Applied Phase 01 voice deferral — 2026-10-24 America/Los_Angeles

Agent `/root`, continuing `phase-01-20261024-01` on `extension-version`, HEAD `207669b43c3f270bf88b89f9e129f0e27c11e3aa`. All existing implementation/planning work remains uncommitted. No worker or reviewer launched/resumed; Phase 02 not started.

## Exact authorization and effective scope

User, after approving the VAD proposal and then interrupting its implementation:

> Actually, stop. Let's just defer voice input for now. Establish the change to the plan and continue phase 1.

This supersedes the earlier request to implement [VAD proposal 01](vad-revision-proposal-01.md). Stop that work and continue the nonvoice Phase 01 scope. Defer voice implementation/feasibility, speech-asset installation, microphone/speech permission trials, on-device boundaries, offline speech and ten-probe speech latency acceptance to separately authorized Phase 04. Preserve those future requirements: Apple transcription, offline operation, exact grammar,400ms silence,six-second utterance limit,1.5-second expiry and p95<=1second. No speech success is claimed and no latency is recorded as zero.

The approved VAD proposal remains a future design reference, not an active Phase 01 dependency or acceptance result. Phase 04 must resolve the measured SpeechDetector boundary failure and validate its replacement before claiming working voice. Phase 02–06 authorizations remain separate. The earlier explicit instruction prohibiting automatic reviewer launch still applies; required review is pending until scheduled by the user.

## Interrupted work preserved

Before interruption, the exact approved libfvad revision was downloaded and its required unmodified sources/notices imported into `native/ThirdParty/libfvad/` with `SOURCE.json`. No C target, wrapper, boundary state machine, converter, timing repair or VAD integration was implemented. `native/Package.swift` and dependency pins/lockfile remain unchanged. The inactive import is retained in the working tree and is not compiled or linked; Forge's packaged ASAR source exclusion is checked so it does not become a shipped dependency.

[Interrupted implementation record](vad-implementation-01.md) and all prior proposals, counters, reviews, failed experiments and checksums remain historical. Before any continuation edits, full source/evidence and the prior ZIP/development helper had been backed up under `/private/tmp/steady-phase01-20261024-01/vad-baseline/`; prior operator app copies are preserved.

## Applied documentation and behavior

- PLAN.md records the effective deferral, corrected current authorization status and revised Phase 01/04 gates. Phase 01 and 04 prompts match it. Later voice behavior/targets remain required in Phase 04; no later phase starts through this amendment.
- Phase 01 UI reports voice deferred and microphone off; offers no microphone-enable or speech-asset-setup control. Existing camera/native probes and microphone-disable action remain.
- Main rejects activation/setup attempts. Native protocol independently rejects microphone-enable and asset-install requests with `voice-deferred-phase01` before scheduling TCC/assets/audio. Microphone disable, Pause and Pen-up remain available. The capability list describes the deferral. Existing SpeechProbe/grammar/diagnostics implementation remains dormant and preserved.
- Continue type/unit/native/process/packaging/signature/synthetic-model checks, including packaged voice-deferral rejection and Chromium offline emulation. This does not substitute for physical network-off tracking or external hardware evidence.

## Current Phase 01 gates

Voice is **deferred**, not failed Phase 01 acceptance and not passed. Remaining nondeferred gates include pinned builds/resources/protocol/watchdog/EOF, panel focus/fullscreen/Spaces, actual camera/background/inference and packaged Accessibility/native input, physical offline inference/outbound policy, distinct desk-facing camera and selected external display including mixed-scale/negative-origin geometry, affected artifact checks/checksums and required documented review. Existing prior hardware outcomes remain tied to their tested artifact hashes.

See [current operator procedure](operator-procedure-nonvoice-01.md). Build/check results and latest artifact/handoff will be appended after execution. No phase pass is inferred from this scope amendment.

## Implementation and check outcome

All scoped code/documentation changes are complete. Automated checks pass: typecheck,32 JavaScript tests,31 Swift tests,7 fake-process checks on development and signed packaged helper,9 asset hashes,make/package/deep strict code signature, and packaged e2e(4.0seconds). Initial sandboxed make failed on a network fetch; the exact same pinned build passed with network access, with both logs retained. E2e verifies voice-activation/setup rejection and microphone-off status, local Head/Palm model inference under Chromium offline emulation, outbound denial and collapsed fake-camera progression. No actual microphone, physical camera or desktop event used by these checks.

[Artifact/check record](voice-deferral-artifacts.json), [ASAR audit](voice-deferral-package-audit.json). New operator app `/private/tmp/steady-phase01-20261024-01/nonvoice/Steady.app`, strict signature verified and launched through LaunchServices with inherited Electron Node mode unset. Current ZIP140191723bytes,SHA256 `a7c5547a48efbce896bf9f74bbd56704d91987f2fb788b370a1d29a047ac5aee`; signed helper `d5fe938295f52209f58f97fe3c69770fb853b41620f327c6002480ba010c9ef6`. Prior speech-copy process was closed by exact-path SIGTERM to avoid global-shortcut conflicts; previous files/copies/evidence retained.

Operator confirms external display and desk-facing camera are available. Current-artifact physical Head/desk-Palm observations requested; no completed result yet. Phase01 remains blocked on nondeferred manual hardware and required affected review, not voice. No Phase02 or reviewer launch.
