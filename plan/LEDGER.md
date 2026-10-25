# Steady execution ledger

This is the execution index, not the product specification. [PLAN.md](PLAN.md) is authoritative. Follow the [recording and resume rules](ledger/README.md). The active orchestrator is the sole writer of this index; other agents maintain their individual records.

## Planning package

| Run | Authorization | Starting commit | Ending commit | Status | Review | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| [planning-20261024-01](ledger/planning-20261024-01/orchestrator.md) | User requested implementation of the planning package; [exact request](ledger/planning-20261024-01/artifacts/request.md). | `207669b43c3f270bf88b89f9e129f0e27c11e3aa` on `extension-version`; clean, empty working tree. | Uncommitted documentation; no commit created by this task. | Complete: planning documents created and structurally checked. | Author self-check only; no application-phase reviewer launched. | Await separate phase 01 authorization, then start a fresh orchestrator with [phase-01.md](prompts/phase-01.md). |
| [planning-20261024-02](ledger/planning-20261024-02/orchestrator.md) | User requested implementation of the Revision 2 planning update only; [exact request](ledger/planning-20261024-02/artifacts/request.md). | `207669b43c3f270bf88b89f9e129f0e27c11e3aa` on `extension-version`; 14 existing untracked planning files. | Uncommitted documentation; no commit created by this task. | Complete: Revision 2 plan and eight prompts applied; document/content/history checks passed. | Author self-check only; no application-phase reviewer launched. | Await separate phase 01 authorization, then start a fresh orchestrator with the revised [phase-01.md](prompts/phase-01.md). |
| [planning-20261024-03](ledger/planning-20261024-03/orchestrator.md) | User authorized additional reviewers for phases; [exact request](ledger/planning-20261024-03/artifacts/request.md). | `207669b43c3f270bf88b89f9e129f0e27c11e3aa` on `extension-version`; existing uncommitted Phase01/application/planning work preserved. | Uncommitted documentation; no commit created. | Complete: standing reviewer-policy amendment applied across plan, rules, active prompts and handoff. | Documentation consistency checks only; no reviewer launched by this amendment. | Additional/replacement reviewers permitted under the recorded policy; all phase gates and separate phase authorization remain. |

## Active planning revision

[PLAN.md](PLAN.md) now contains Revision 2. The original planning run above remains historical; the [baseline snapshot](ledger/planning-20261024-02/artifacts/baseline-documents.json) preserves its plan, index, and eight prompts before this revision. Prior requests, failed checks, and execution records remain unchanged.

**Reviewer-policy amendment,2026-10-24:** the user has granted standing permission for additional/replacement reviewer sessions across phases01–06 when continuation, an unavailable/interrupted reviewer, or materially changed work requires renewed review. Orchestrators may use this permission without asking again for each justified launch. Record each reason/session separately and carry all earlier findings forward. The [current policy](PLAN.md#reviewer-sessions-and-continuations) supersedes historical one-reviewer restrictions, including those quoted in old handoffs/assignments. [Authorization/amendment record](ledger/planning-20261024-03/orchestrator.md). No additional reviewer has been launched by this documentation change.

Confirmed decisions carried into Revision 2:

- Absolute position mapping: a calibrated position maps to a screen position; holding still keeps the pointer still.
- Assisted first-time setup is acceptable; one-switch-independent onboarding is not an MVP requirement.
- Voice target: nearest-rank p95 at most one second from detected speech end to acknowledged action, including finalization.
- The user can provide a head-facing camera, desk-facing camera, and external display for the relevant mandatory checks. Availability is not evidence of execution.

The approved revision also fixes the build baseline, calibration/filter defaults, state machine, native protocol, panel hit-testing, and phase gates. Applying these documents does not authorize phase 01 or any later application work.

## Application phases

Rows below are roadmap entries, not executions. Add a separate linked run entry for every actual attempt; retain previous entries on resume.

| Phase | Authorization | Run | Baseline/result commits | Verification status | User approval | Review result | Next handoff |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 — Shell and feasibility | [Original authorization](ledger/phase-01-20261024-01/artifacts/authorization.md); [user-authorized voice deferral and continuation](ledger/phase-01-20261024-01/artifacts/voice-deferral-01.md) | [phase-01-20261024-01](ledger/phase-01-20261024-01/orchestrator.md) | `207669b43c3f270bf88b89f9e129f0e27c11e3aa`; uncommitted work | complete | — | [Review 02 pass](ledger/phase-01-20261024-01/reviewer-02.md); prior blocked review and deferred speech failure preserved; [audit](ledger/phase-01-20261024-01/artifacts/reviewer-02-launch-audit.md) | Voice deferred to Phase04. Nonvoice Phase01 gates reviewed/passed with recorded camera/preview/timing/network-scope limits. Phase02 not authorized. [Handoff](ledger/phase-01-20261024-01/handoff.md). Phase02 not authorized. |
| 02 — Tracking engine | [Authorized](ledger/phase-02-20261024-01/artifacts/authorization.md); [desk-Palm deferral](ledger/phase-02-20261024-01/artifacts/desk-palm-deferral-01.md) | [phase-02-20261024-01](ledger/phase-02-20261024-01/orchestrator.md) | `207669b43c3f270bf88b89f9e129f0e27c11e3aa`; uncommitted | blocked | [**Approved by user**](ledger/phase-02-20261024-01/artifacts/approval-01.md) | [Review blocked on mandatory hardware](ledger/phase-02-20261024-01/reviewer.md); software review/repairs/checks complete | [Approved implementation handoff; remaining manual checks unverified](ledger/phase-02-20261024-01/handoff.md). Desk-facing Palm deferred to Phase 05. |
| 03 — Krita integration | [Authorized](ledger/phase-03-20261024-01/artifacts/authorization.md); Phase 02 explicitly accepted for entry | [phase-03-20261024-01](ledger/phase-03-20261024-01/orchestrator.md) | `207669b43c3f270bf88b89f9e129f0e27c11e3aa`; uncommitted | blocked — implementation/package complete; mandatory physical evidence pending | Phase 02 entry accepted; Phase 03 acceptance pending | [Independent source repairs/checks complete; blocked only on physical gates](ledger/phase-03-20261024-01/reviewer.md) | [Prepared app (keybinding typing fix) and operator checklist; direct batch testing](ledger/phase-03-20261024-01/handoff.md). [Input](ledger/phase-03-20261024-01/worker-input.md), [canvas](ledger/phase-03-20261024-01/worker-canvas.md). Voice off; stop before Phase 04 |
| 04 — Voice and accessible controls | Not granted | — | — | Pending | — | Not started | Requires completed phase 03 |
| 05 — Integrated validation | Not granted | — | — | Pending | — | Not started | Requires completed phase 04; includes deferred relaxed desk-facing Palm validation |
| 06 — Standalone delivery | Not granted | — | — | Pending | — | Not started | Requires completed phase 05 |

## Entry requirements

For each actual run add: unique run ID, exact authorization reference, agent identity/parent, baseline commit and dirty state, result commit or uncommitted state, status, linked orchestrator/worker/reviewer records, evidence artifacts, every reviewer session's identity/reason/disposition, unresolved issues, and the next safe action. Use timestamps with an explicit timezone. Do not mark a phase complete until its mandatory gates, required review, and all prior unresolved findings are accounted for.

## Latest Phase 01 continuation — boundary proposal awaiting approval

2026-10-24 America/Los_Angeles: `/root` resumed the existing run at unchanged branch/HEAD, retained all uncommitted implementation/pins/evidence and read the completed speech experiment and reviewer history. [VAD proposal 01](ledger/phase-01-20261024-01/artifacts/vad-revision-proposal-01.md) selects pinned libfvad v1.0 as a local native C dependency while retaining Apple transcription, offline operation, exact grammar and all timing targets. Proposed specification/integration/validation changes are **not applied**. [Preservation check](ledger/phase-01-20261024-01/artifacts/vad-revision-proposal-01-preservation.json).

Phase 01 remains **blocked**, now awaiting user approval of that concrete amendment before implementation. No reviewer launched/resumed: the current explicit instruction prohibits automatic reviewer launch despite the standing permission above. Existing reviewer findings/disposition and outstanding hardware gates remain. [Appended handoff](ledger/phase-01-20261024-01/handoff.md). Phase 02 remains unauthorized.

## Superseding Phase 01 continuation — voice deferred

2026-10-24 America/Los_Angeles: user interrupted VAD integration and directed **“Actually, stop. Let's just defer voice input for now. Establish the change to the plan and continue phase 1.”** [Applied amendment](ledger/phase-01-20261024-01/artifacts/voice-deferral-01.md). Voice feasibility/setup/permissions/offline speech/ten-probe timing gates move to separately authorized Phase04, retaining future grammar/offline/transcription/timing requirements. The prior awaiting-VAD-approval checkpoint above is historical and superseded. Existing failed speech evidence remains unresolved for Phase04.

PLAN.md and Phase01/04 prompts now match. Phase01 UI/main/helper keep voice unavailable; existing speech code and interrupted, unlinked VAD import preserved. Typecheck,32 JS,31 Swift,7 fake-process checks and nine asset hashes pass. Rebuild/package checks in progress; hardware/review still required. User reports both desk camera and external display available, not completed tests. No new reviewer or Phase02.


Latest checkpoint: nonvoice make/sign/package/e2e and signed-helper7 fake-process checks pass, alongside typecheck/32 JS/31 Swift/9 asset hashes. [Exact artifact/check record](ledger/phase-01-20261024-01/artifacts/voice-deferral-artifacts.json). Outside-checkout app opened for operator tests; current-artifact Head/desk-Palm reports requested. Phase01 **blocked** pending nondeferred hardware and affected review; no reviewer launch/Phase02. [Latest handoff](ledger/phase-01-20261024-01/handoff.md).

2026-10-24 16:51 America/Los_Angeles: current nonvoice Head30second collapsed/unfocused frame growth confirmed by operator (MacBook Pro Camera/GPU); [manual evidence](ledger/phase-01-20261024-01/artifacts/manual-hardware.md). Palm/desk-camera result requested next. Phase01 remains blocked on other nondeferred hardware/review; app/hash unchanged, no reviewer or Phase02.

2026-10-24 16:52 America/Los_Angeles: current desk-camera Palm30second collapsed/unfocused growth confirmed; [manual evidence](ledger/phase-01-20261024-01/artifacts/manual-hardware.md). External-left selected-display panel/focus check requested. Phase01 remains blocked on other nondeferred hardware/metadata/review; no code/hash change, reviewer or Phase02.

2026-10-24 16:54 America/Los_Angeles: operator confirms current external-left selected-display panel placement/fullscreen/Spaces/focus behavior; [manual evidence](ledger/phase-01-20261024-01/artifacts/manual-hardware.md). Bounded external native stroke/release requested next. Phase01 incomplete pending nondeferred native/offline/geometry metadata/review; no artifact changes, reviewer or Phase02.

2026-10-24 16:55 America/Los_Angeles: current external native probe produced no movement by operator report; no new acknowledgment journal entries. [Evidence](ledger/phase-01-20261024-01/artifacts/manual-hardware.md). Accessibility/status clarification pending before retry. Phase01 remains incomplete; no source/hash/reviewer/Phase02 changes.

2026-10-24 16:57 America/Los_Angeles: user reports prior helper Not granted but macOS Steady access already granted; exact nonvoice app reopened on request. [Evidence](ledger/phase-01-20261024-01/artifacts/nonvoice-reopen-01.json). Post-reopen permission/native retry pending; no artifact/source/reviewer/Phase02 changes.

2026-10-24 16:59 America/Los_Angeles: current Accessibility mismatch investigated read-only; app/helper path correct, signing identity differs from previous builds. Specific-entry manual replacement/relaunch requested; [evidence](ledger/phase-01-20261024-01/artifacts/manual-hardware.md). No TCC/source/artifact changes, native success, reviewer or Phase02.

2026-10-24 17:01 America/Los_Angeles: permission-entry replacement resolved current trust mismatch; operator confirms current external stroke/release,new28/28accepted native session and mixed-scale/negative-origin metadata. [Evidence](ledger/phase-01-20261024-01/artifacts/nonvoice-native-success-01.json). Physical offline camera and desk-camera metadata requested; affected review still pending,Phase01 incomplete,no code/hash/reviewer/Phase02 changes.

2026-10-24 17:06 America/Los_Angeles: user reports network-connected Head/Palm progression on MacBook Pro Camera/GPU; physical offline and distinct desk-facing setup remain unverified. [Correction](ledger/phase-01-20261024-01/artifacts/manual-hardware.md). App-only offline harness prepared,not launched; explained local/offline requirement. No host-network/app-binary/permission changes,reviewer or Phase02.

2026-10-24 17:09 America/Los_Angeles: app-scoped offline physical-camera trial active under user continuation: browser offline verified,host networking unchanged,operator starts camera. [Evidence](ledger/phase-01-20261024-01/artifacts/app-offline-hardware-01-result.json). Results/Palm placement pending;no app/pin/signature/permission changes,reviewer or Phase02.

2026-10-24 17:11 America/Los_Angeles: app-only offline physical Head/Palm progression confirmed by operator and numeric snapshots; Palm placement explicitly builtin aimed at desk. [Summary/limits](ledger/phase-01-20261024-01/artifacts/app-offline-hardware-01-summary.json). Harness exited cleanly;normal signed app restored,host network/source/pins/artifacts unchanged. Numeric journal does not prove two separate30second offline intervals;no scored timing claim. [Prepared review](ledger/phase-01-20261024-01/artifacts/nonvoice-review-preparation-01.md) awaits explicit scheduling;Phase01 blocked pending required review/coverage assessment,no reviewer or Phase02.

2026-10-24 17:15 America/Los_Angeles: user **“Yes I authorize phase 1 reviewer.”**;parent audited prior history,verified source/artifacts and launched exactly `/root/reviewer_02` for full integrated nonvoice Phase01 review. [Exact assignment](ledger/phase-01-20261024-01/artifacts/reviewer-02-assignment.md),[launch audit](ledger/phase-01-20261024-01/artifacts/reviewer-02-launch-audit.md). Prior `/root/reviewer` blocked history preserved;no current pass,no automatic further reviewer,no voice implementation or Phase02.

## Phase 01 closure — 2026-10-24 17:19 America/Los_Angeles

**Complete for the user-amended nonvoice shell/feasibility scope.** Explicitly authorized `/root/reviewer_02` returned [pass](ledger/phase-01-20261024-01/reviewer-02.md) after full integrated review,fresh affected checks and evidence assessment. One low-severity Settings-label attribution issue was corrected in derivative offline evidence;raw observations and prior blocked speech/review history retained. No application/signature/dependency change occurred during review. [Final audit](ledger/phase-01-20261024-01/artifacts/reviewer-02-final-audit.json).

Current app `/private/tmp/steady-phase01-20261024-01/nonvoice/Steady.app`;ZIP SHA256 `a7c5547a48efbce896bf9f74bbd56704d91987f2fb788b370a1d29a047ac5aee`;signed helper `d5fe938295f52209f58f97fe3c69770fb853b41620f327c6002480ba010c9ef6`. Sources/artifacts reverified unchanged at closure. All implementation/planning work remains uncommitted on original HEAD/branch. Voice remains disabled and unresolved/deferred to Phase04;all later performance/accuracy/accessibility/clean-account delivery gates remain unpassed. [Final handoff](ledger/phase-01-20261024-01/handoff.md). Stop:Phase02 requires separate authorization and a fresh orchestrator;no further reviewer launched.

## Phase 02 entry — 2026-10-24 America/Los_Angeles

User explicitly authorized tracking engine only. Fresh `/root` inspected actual baseline and final Phase01 COMPLETE checkpoint; earlier blocked checkpoints remain historical. [Ownership and execution record](ledger/phase-02-20261024-01/orchestrator.md). Voice deferred; Phase03 remains unauthorized.

Phase02 current checkpoint: two workers completed, integrated reviewer repairs applied, typecheck/79JS/33Swift/7fake-process/signature/make/package/e2e pass. Fresh operator app and checksums retained outside checkout. Head five-capture/mapping/recenter physically reported successful; numeric observer corroborates defaults and preserved extents. Mandatory both-mode background/baselines/Palm loss-confirmation/metadata and final review disposition still pending. [Running handoff](ledger/phase-02-20261024-01/handoff.md). Phase03 remains unauthorized.

Phase02 hardware-discovered failure: old Head capture continued when Stop awaited an unavailable helper; main/native generations diverged and later status text masked the fatal helper state. Trial01 stopped safely, archived; no Palm evidence. Current reviewer is repairing sample/configuration/clock overlap and Stop/error handling, then fresh artifact/affected hardware validation are required. Earlier running checkpoints are superseded; phase remains running, not complete.

Phase02 operator now self-tests: user requested direct app control because guidedprocess too slow. App/partialDeskcalibration preserved; no further assistedcapture requests queued. Passive numericobserver only. Software checks84JS/37Swift/7signedfake-process/typecheck/make/signature/e2epass; requiredDeskPalm gates and finalreview remain incomplete. [Latestmanualhandoff](ledger/phase-02-20261024-01/handoff.md). No Phase03.

Phase02 passive continuation: observer82400 verifiedlive; user now controls Samsung/Palm atNeutral (camera change superseded earlier partialDesk session). No furtherassistantcontrols. Same reviewer completedimplementationreview withBLOCKED hardwaredisposition; currentsoftware/artifacts unchanged and phase notcomplete. [Latestcheckpoint](ledger/phase-02-20261024-01/handoff.md).

## Phase 02 user amendment — desk-facing Palm validation deferred

Exact user instruction: **“It's okay, let's establish desk facing palm as deferred for later.”** [Applied scope/authorization](ledger/phase-02-20261024-01/artifacts/desk-palm-deferral-01.md). Active PLAN and Phase02/05 prompts now defer relaxed desk-facing Palm physical acceptance to Phase05; Phase02 may use raised-hand Palm. All numeric algorithms/defaults and other gates remain. Earlier failed desk attempts/blocked reviews are historical; raised-hand evidence is relabelled only in acceptance scope, not camera pose. Samsung raisedPalm calibration passed allfive52–53valid samples; remaining recenter/background/baseline/loss/persistence/review gates stay open. Same reviewer session will continue. No runtime/binary/app-control changes or laterphase authorization.

Desk-Palm amendment independently reviewed in the existing session: [audit](ledger/phase-02-20261024-01/artifacts/reviewer-desk-deferral-01-audit.json). Runtime/source/artifact hashes unchanged; amended Phase02 review remainsBLOCKED on remaining raisedPalm/hardware/persistence evidence. User self-testing continues without assistantcontrols.

## Phase 02 user approval — 2026-10-24 19:35:39 PDT

**Phase 02 implementation is approved by the user.** Exact instruction and accepted artifact: [approval record](ledger/phase-02-20261024-01/artifacts/approval-01.md). The index now separates user approval from verification status: unrun manual checks remain unverified and the existing blocked evidence review is preserved. Desk-facing validation remains deferred to Phase05. No runtime changes or Phase03 authorization.

## Phase 03 authorization — 2026-10-24 America/Los_Angeles

[Exact instruction](ledger/phase-03-20261024-01/artifacts/authorization.md) accepts Phase 02 as sufficient entry to Phase 03. Its historical blocked review and unverified checks are preserved; they do not reopen entry or block this implementation. Desk-facing Palm remains deferred to Phase 05. Phase 03 retains all its own mandatory safeguards and physical evidence gates.
