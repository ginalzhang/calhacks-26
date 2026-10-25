# Orchestrator: Phase 02 tracking engine

## Identity and authorization
- Run / phase: phase-02-20261024-01 / 02.
- Agent / parent: `/root` / none; model identity not exposed.
- Exact authorization: [authorization](artifacts/authorization.md).
- Started: 2026-10-24 America/Los_Angeles.
- Baseline: `extension-version`, HEAD `207669b43c3f270bf88b89f9e129f0e27c11e3aa`; all prior application/planning files untracked, preserved. [Status](artifacts/baseline-status.txt), [hash inventory](artifacts/baseline-inventory.json).
- Applicable AGENTS.md: none found in repository or readable ancestor locations. Parent-directory enumeration was denied; direct ancestor checks succeeded.
- Prior handoff: final Phase01 COMPLETE closure at 17:19 and reviewer-02 pass; historical blocked checkpoints and deferred voice failure retained. No Phase02 attempt/review existed at entry.
- Owned: all files except worker-exclusive paths frozen below. Shared contracts, fixtures, settings schema, manifests, UI/main/preload and ledger are centrally owned.

## Frozen ownership and shared integration
- Capture worker: `src/renderer/tracking.ts`, `src/renderer/probe.ts`, `src/renderer/vision.worker.ts`, `tests/shell/tracking.test.ts`, new `tests/shell/capture*.test.ts`, its worker record and capture-* artifacts.
- Engine worker: new `src/renderer/engine/` and `tests/engine/`, its worker record and engine-* artifacts. Persistence helpers are pure; schema/file IO belong to orchestrator.
- Orchestrator: all other files, including shared fixtures, contracts, settings, main/preload, setup UI, integrated tests and index.
- TrackingSample retains fixed fields; centrally approved optional `selectedHand?: 'Left'|'Right'|null` transports model label (never biometric identity).
- Capture API retains constructor/start/stop; add `setSelectedHand(label, confirmed?)`, `confirmHand()`, `preview(canvas|null)` and optional report fields for selectedHand/confirmation/camera format. Notify parent of exact exports.
- Engine imports existing shared CalibrationV1/TrackingSample/Point/Rect types. Export pure five-capture calibration, validator/key helpers, recenter, One Euro + mapping, generation/order/freshness rejection; notify parent of exact API. No shared-file edits.
- Canvas remains unconfirmed and normal resume/drawing fail closed until separately authorized Phase03. Mapping presented as fake probe data only.

## Execution events
- 2026-10-24: read required plan/prompts/rules and Phase01 final closure/review. Inspected actual branch/HEAD/status and implementation. No commits created. Baseline hashes recorded before application edits.

## Decisions and blockers
- Hardware gates require fresh artifact/operator observations; Phase01 feasibility evidence is context only and cannot prove Phase02 calibration/continuity/performance.
- Voice remains disabled; no speech/VAD implementation.

## Handoff
- Running; implementation, validation, reviewer and physical camera evidence pending.

## Integration checkpoint — 2026-10-24 America/Los_Angeles
- Both workers completed assigned code/tests: capture18, engine30. Source API integrated centrally into persistent setup UI with preview, five captures/retry/cancel, tuning, recenter, fake mapping and 10s+60s baseline. Engine settings validator reused by atomic file store; TS/Swift fixtures added centrally.
- Typecheck exit0; full JS76 tests exit0; native32 tests +7 fake-process checks exit0. Sandboxed make failed fetch exit1, network-enabled identical-pins retry exit0. Sandboxed GUI e2e aborted exit1; escalated fake GUI run in progress. Logs retained in artifacts.
- First Phase02 reviewer launch audit/complete assignment saved; all application files frozen to reviewer for integrated review/repairs. Parent retains ledger and physical evidence. User available for guided hardware checks; no Phase02 hardware evidence yet.

## Reviewer repairs checkpoint — 2026-10-24 America/Los_Angeles
- `/root/reviewer` launched for first whole integrated review under user/phase authorization. Exact prompt/audit and integrated baseline retained. No previous Phase02 reviewer.
- Packaged e2e failed with30s disabled Capture; diagnostic01 exposed cancellation rather than ready neutral. Diagnostic02 numeric output shows stale previous-run GPU18 report followed by new synthetic CPU2/gen4 report: automated test began calibration before second Start was delivered. Reviewer assigned explicit new-run readiness assertion; no calibration threshold relaxed. All failed logs retained.
- Reviewer also found recenter before release acknowledgment and unsaved selected-hand label lost across restart. Repairs approved; runtime rebuild will follow. Approved serialized shared-main camera/calibration/display changes and canonical display-context comparison to prevent request/key-order races. Parent owns all operator evidence; no physical trial launched against the superseded initial artifact.
- Native tests32+7process pass; JS77/typecheck pass after initial review repairs. Initial make succeeded only on network-enabled retry after restricted fetch failure; local resources/pins unchanged. No Phase03 or voice enabled.

## Packaged workflow repair continuation — 2026-10-24 America/Los_Angeles
- Repaired build01 make/signature and signed-helper7fake-process checks pass. [Artifact01 hashes](artifacts/repaired-artifact-01.json). Packaged synthetic workflow reaches all five captures (59/59valid final); recenter assertion fails, retained [log](artifacts/reviewer-e2e-repaired-01.log). No physical trial against this superseded artifact.
- Parent traced default nonposting SystemBackend with actual metadata: configure canvas=null enters SETUP, valid mapped samples may invoke native foreground guards for synthetic PID123 and fail the supervisor. Approved reviewer repair: configure then Pause acknowledged, mapped ingress only in PAUSED. Keep native safeguards and exact mapping algorithm intact. All repairs/rechecks stay within first reviewer session.
- Toolchain observed unchanged: Node26.12.1/npm11.20.0/Swift6.4/SDK27.0, target arm64/macOS26. All prior files/history present per reviewer audit. README centrally updated for Phase02 setup/metric definitions.

- Evidence-retention correction: all failed e2e logs remain uniquely named, but Playwright's default ignored test-results directory was reused across attempts. Earliest trace ZIPs were not copied before subsequent attempts and are unavailable; their retained logs plus diagnostic02 observations preserve failures. Repaired01 trace copied to artifacts/repaired-01-failed-trace.zip before next run. Future trial traces use unique copies. No physical frames were captured.

## Current artifact and physical trial — 2026-10-24 17:40 America/Los_Angeles
- Repaired02 `npm run make` exit0, strict signature exit0, packaged e2e1test exit0/20.7s (actual bundled model initialization/offline syntheticframes, fake-camera progression/background, five synthetic calibration captures and recenter, voice disabled, normal resume blocked). Logs/artifact02/operator-copy hashes retained; frozen source/build inputs saved. Reviewer independently verified hashes/signature.
- Current operator app `/private/tmp/steady-phase02-20261024-01/operator/Steady.app`; ZIP retained beside it. ZIP140205625bytes SHA256 `a1e2e6aefc3d0d476c02d92b998aa866b264278b332d7d7b04ee12874e27f93e`, ASAR `e7eaefa340040c0fde562a4d637ba309f90a067b53b5c5bbbf138f3ffab85c32`, signedhelper `6a689dcda3a238c88b9ab5e5259175ba618b6c3604c781ea1985634ef68867e4`.
- Hardware observer01 launched new packaged artifact (no fake-camera flags), reported HARDWARE_READY. Operator manually starts camera; observer records numeric summaries only. Asked Head five captures/preview/mapping/recenter first. No physical result yet.
- Fresh host reads: macOS26.7.1/build25G241/arm64; installed Krita5.3.4. `sysctl -n hw.model` restricted/exit1, machine model remains operator-supplied. No host permissions/network changed.
- Standard ignored out/ build products regenerated by Forge; prior Phase01 outside-checkout app copies and all tracked/untracked source/history/evidence logs preserved. Old out/ ZIP path now refers to Phase02; prior Phase01 artifact claims remain historical with original hashes/operator app copies (not fresh Phase02 evidence).

## Hardware-discovered defect — 2026-10-24 17:52:24 PDT
- Operator reported camera Stop ineffective before Palm. Live read-only/control-safe diagnostics disprove suspected cross-window transport failure; helper unavailable and main/native generation mismatch were observed. Parent completed safe camera Stop via existing channel. Current artifact requires repair/rebuild/rechecks before continuing hardware.
- Reviewer remains same assigned session. Approved sample/configuration queue lifecycle repair, camera Stop independence, durable fatal-status diagnostics. Preserve raw trials/current operator app; carry Head evidence forward only with explicit unchanged-module/affected-check justification after corrected artifact validation. Palm gates still absent.

## Repair03 freeze — 2026-10-24 17:55:57 PDT
Reviewer reproduced both generation/configure and periodicclock synchronization overlap failures with delayed acknowledgments. Repairs drop/clear samples during transitions, keep Stop in finally, persist nativeFault, expose active model in ProbeReport.mode; calibration/filter/model algorithms unchanged. Typecheck/81JS pass. New e2e adds Settings close/reopen plus intentional fake helper fault/Stop/fatal-status retention. Parent building make03; old app/data preserved and trial01closed. Fresh operator-v2 and all affected checks required before physical continuation.

## Repaired03/operator-v2 checkpoint — 2026-10-24 17:58:33 PDT
- make03 and strictsignature exit0; initial e2e03 failed only on evaluating CloseSettings in the destroyed Settings page. Trace/log retained; reviewer changed test to invoke from still-live panel. Same binary e2e04 exit0/18.9s including Settings remount, intentional fake helper fault, independent Stop and preserved nativeFault. Typecheck/81JS pass; prior33Swift+7fake-process checks remain unaffected (native helper bytes identical).
- New app/ZIP archived at `/private/tmp/steady-phase02-20261024-01/operator-v2/`; previous operator artifact preserved. [Hashes](artifacts/operator-artifact-02.json), [inputs](artifacts/frozen-build-inputs-03.json). ASAR `be74370635f625acc886d4c78e2137ed22573bbe3793d5a1f6b7900ebc63f7a1`; ZIP140205820bytes/SHA256 `080e704f43f93b24d05a2bc3a849ea7cf44d7d4aa35d6218d80818ecb202b600`; signedhelperunchanged `6a689dcda3a238c88b9ab5e5259175ba618b6c3604c781ea1985634ef68867e4`.
- [Unchanged algorithm audit](artifacts/repair03-unchanged-algorithm-audit.json): all8calibration/filter/anchor/model-worker/schema/validation modules hash-identical to artifact02. Reviewer approves retaining prior Head all-five/visual mapping observations with limitation; new Head control/recenter/native-health/background and full baseline are being repeated against operator-v2. Palm still entirely pending.
- Numeric-only hardware trial02 opened (new active-mode/nativeFault/clock/generation fields). Asked operator to start Head and recenter saved calibration; no automatic camera activation. Parent UI utility performs only reversible Settings/collapse/diagnostic baseline actions through existing app APIs; records each separately.

## Hardware display-event defect — 2026-10-24 18:03:10 PDT
User confirmed only app/fullscreen/Spaces switch; unchanged geometry generated raw display events, canceling baseline and separating main/native generations. Current helper transition repair remained healthy; new issue is false/unsynchronized display invalidation. Approved reviewer semantic geometry (id/bounds/scale/rotation) dedup, mapping-context comparison ignoring workArea-only changes, and serialized genuine display configuration with regressions. Safe camera stop, trial02 archive, corrected package/affected rechecks/fresh baseline required. Same reviewer session, all prior failures retained.

## Display repair04 validation / native follow-up — 2026-10-24 18:07:44 PDT
- make04/signature/e2e05 pass (1test/21.2s),84JS/typecheck pass. Operator-v3 artifact copied and hashed (operator-artifact-03.json) but NOT launched physically; archived/superseded pending native follow-up. Trial02 closed0; Head camera background228.104s observed but no completed baseline due reset; no Palm evidence.
- Reviewer examined local pinned Electron45 types (metrics distinguishes workArea from bounds/scale/rotation) and local SDK CGDisplayConfiguration.h. Main now dedups layout semantics and serializes genuine geometry changes; SetupController key excludes workArea/primary metadata. Tests cover no-op/workArea capture continuity and real geometry invalidation.
- Approved native callback repair: begin releases/PAUSES and marks reconfiguration pending, forbidding rearm/configure until end metadata refresh; end compares actual id/bounds/scale/topology, preserves equivalent geometry in PAUSED, invalidates real geometry/canvas changes. Unconditional clearing on equivalent callbacks is a known hazard even with renderer fix. No auto resume/Phase03 input. Native tests/build/helper/signature/package/affected e2e required anew. All prior artifact copies and evidence retained.

## Native display repair05 package checkpoint — 2026-10-24 18:12:44 PDT
- Reviewer implemented pending native display state with immediate release/Pause, blocked Resume/configure/samples while pending, end metadata outside lock, semantic actual-geometry invalidation/equivalent retention, epoch protection against late blocked refresh. Native36tests+7fake-process/typecheck/84JS pass.
- make05/signature and new signed-helper7fake-process checks pass. New operator-v4 helper hash recorded in operator-artifact-04.json; old v1/v2/v3 artifacts retained. Extended e2e06 failed at second camera Start (Camera off after initial model/camera/Stop succeeded). Log and trace retained; reviewer diagnosing transient pending-display rejection/Start feedback without weakening guard. New app not physically launched until affected packaged check passes.
- Exact operator clarification appended: **“Well to clarify I switched desktops and apps”**. This reinforces required background/Spaces behavior; no physical reconfiguration claim. Same reviewer session remains active.

## Callback-token build and Palm continuation — 2026-10-24 18:27:06 PDT
- Reviewer confirmed queued-end epoch race and fixed callback-time token capture/check-before-and-aftermetadata;37Swift+7fakeprocess tests pass,84JS/typecheck. make06/signature pass, operator-v5 archived separately with same ASAR asv4 and token-only native helper change. Parent initial signedprocesscheck timedout firsthello2s (no checks executed); reviewer reran exact signedpath/unchanged timeout and all7checks passed. Earlier failure retained/causeunproven. No GUI overlap during current physical trial.
- Current v4 Head run has complete fresh fivecaptures and healthy27.9Hz baseline; user physically confirmed desktop/app continuation. Palm currently blocked on valid hand detection/confirmation, minimum40 capture failures retained. Working with operator; do not claim completed Palm or final pass.

## Desk Palm validation continuation — 2026-10-24 18:49:04 PDT
SavedPalm57/57success is raised-hand per explicit operator clarification, not desk gate. Failed recenter/highjitter retained and cal unchanged. User readied MacBook desk-camera placement; root started newcalibrationsemantically under explicit readiness and is assisting actualcapturewindows to avoid secondhand/control-motion interference. No samples fabricated/thresholds loosened/automatic hand identity confirmation. Final-v5 app/source stays frozen;37native/84JS/package/e2e07/signature/signedprocesschecks pass with retained transient firstattempt logs. ReviewerinterimBLOCKED pending mandatorydeskPalm/recenter/baseline/background/loss/currentaffected/persistence evidence.

## Live continuation checkpoint — 2026-10-24 19:07:06 PDT
- Final app is unchanged operator-v5: ASARded0a6..., helper41732e..., ZIP404dab...; all tests/package/signature checks and reviewer verification linked above. No more app source changes currently pending.
- Earlier trial04 stopped0; repeated CDP attachments/possible pipeline stall cause remains unproven. New hardware-control.mjs trial05 uses one persistent Electron connection, no hard autoquit deadline, numeric observations and known semantic action inbox. CameraStart operator-directed after exactMacBookdesk readiness. No raw frames/native input/automatic identity confirmation.
- **Preserve current running app/in-memory desk calibration; do not close/restart now.** Controller currentlystepUp after actualDeskNeutral57/57, Left55/55, Right55/55 success. Raised-hand savedPalm calibration is still on disk until allfive newDesk captures succeed. CameraMacBookPro, modePalm, selectedmodelLeft, GPU640×480/30fps, same intended resting desk hand physically readied by operator.
- Runtime process execsession82400; actionfiles in artifacts/control-trial-05/. Requests001start,002neutral,003left,004right have immutable responses. Next expected005Up then006Down, each only after new explicit intended-hand/readiness response,3s settle, fresh frame progress, guarded confirmation then actual2sCapture. User may rest between positions; no deadline.
- Reviewer found generic harness.success evidence postcondition gaps (step!=requested could includecancel); root treats that flag advisory and reads exact actualafterstep/countmessage/camera/label/native generation. Current rawresponses explicitly neutral→left57/57, left→right55/55, right→up55/55 with live frame/valid increases, selectedLeft/samecamera. No null/cancel incorrectly accepted. Further captures held pending reviewer pure externalpostcondition verifier, so valid partialwork need not be discarded.
- Still missing mandatory: DeskUp/Down/fullsave, deskrecenter,70sbaseline/background, scripted handloss/confirmation/ambiguity, finalHead/current-v5 affectedhealth+persistence/reviewdisposition. Current run remainsrunning; reviewerinterimBLOCKED accurately records pending gates. User is available and requestedreopen; do not repeat availability questions.

## Operator takes over manual controls — 2026-10-24 19:13:35 PDT
Exact steering: **“Can i just test myself?”**, **“Letting you do this is taking forever”**. Root acknowledged guidedprocess too slow and stopped all assisted captures/control questions. No new control requests will be sent until operator reports. Current app remains open, passive single-connection numericobserver only; no automatic quit deadline.

CurrentDesk session preserves Neutral57/57,Left55/55,Right55/55; Up005 failed insufficientdirectionalrange, remainsUp. External strictverifier validates first4responses and rejectsUp; failedattemptretained. User may finishUp/Down, recenter, baseline andloss tests with actual appcontrols. No phase completion/native drawing/voice enabled. Pending final review/hardware gates remain, not waived. Existing native/helper/package checks unchanged.

## Passive self-test continuation — 2026-10-24 19:15:17 PDT
- Previous goal turn classified progress: user control handoff and durable checkpoint completed. Current observer handle82400 re-polled and confirmed live/running; no app controls sent. Branch/HEAD unchanged, prior uncommitted work intact.
- Authoritative new observation after operator takeover: selectedcameraSamsung/modePalm, generation4matchesnative4, healthyclock/noNativeFault, currentcapturestepNeutral. The previous MacBookDesk partialcalibration was superseded by this camera/context change; preserve its successfulrecords as earlierattempt evidence, not currentin-memoryprogress. OnlyexistingHead+raisedPalm calibrations are saved. [Snapshot](artifacts/manual-selftest-checkpoint-01.json).
- Existing `/root/reviewer` returned final **BLOCKED on mandatory physical evidence**, with software/source/package reviewcomplete and all fixes/checks retained; same-sessioncontinuation available after operatorresults. This is not phasecompletion. No more assistedcapture requests queued; passiveobserver remains alive under operatorcontrols.

## Self-test calibration report and gate audit — 2026-10-24 19:18:10 PDT
User completednewSamsungPalmcal manually. Passiveproof saved53/53,53/53,52/52,52/52,52/52 andvalidateddirectionalbounds/defaults/healthygen5. User explicitlyidentifiedsuccessfulpose asraisedhand, so mandatorydeskgate remainsunverified. No controls changed, no threshold/gatewaived. Same-sessionreviewcontinuation requested read-only to reconcile newevidence andblockedhandoff. Rootleavesapp/usercontrolsuntouched.

## User-authorized desk-Palm deferral — 2026-10-24 19:20:38 PDT
Exact request **“It's okay, let's establish desk facing palm as deferred for later.”** Applied documentation-only amendment: physical relaxed desk-facing Palm gate moves to Phase05 integratedhardwarevalidation; Phase02 may use accurately labelled raised-hand Palm. All algorithms/thresholds/defaults/other physicalgates/review remainfixed. [Authorization/scope](artifacts/desk-palm-deferral-01.md), [before-docsnapshot](artifacts/desk-palm-deferral-01-before.json). PLANstatus/table/hardwareacceptance, Phase02/05prompts and READMEupdated; oldrecords/failures intact. No appcode/binary/control changed; no laterphaseexecutionauthorized. Same reviewer continuation will reassesscurrentevidence againstamendedscope.

## Amendment review/handoff — 2026-10-24 19:24:42 PDT
Existing `/root/reviewer` completed same-session amendment audit, independently verified no runtime/artifact changes, and appended amended **BLOCKED** disposition. [Audit](artifacts/reviewer-desk-deferral-01-audit.json). SamsungraisedPalmallfive noweligible; missingraisedPalmrecenter/mapping/background/performancebaseline/lossconfirmation andremainingpersistence/currentaffected evidence stillpreventphasecompletion. Desk-facingphysicalgate explicitlyPhase05; no Phase03/05executionauthorized. Userretainsappcontrols/passiveobserveronly.

## Phase02 user approval — 2026-10-24 19:35:39 PDT
Exact instruction **“Mark phase 2 as approved.”** Recorded [user approval](artifacts/approval-01.md) for implementation/packagedhandoff. Added separateapprovalfield toexecutionindex; technicalverification remainsblocked onunverifiedmanualgates, reviewerhistoryunchanged. PLANsummary andhandoffreflectuserapproval without claimingunrunchecks passed. Desk-facingPhase05deferral preserved; no Phase03action or appcontrols. Allbinaries unchanged.
