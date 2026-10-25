# Phase 02 handoff — running checkpoint

2026-10-24 America/Los_Angeles. Authorized tracking engine only; stop before Phase03. Current branch `extension-version`, HEAD `207669b43c3f270bf88b89f9e129f0e27c11e3aa`; all work uncommitted. Entry hashes/status and exact user authorization are in [orchestrator record](orchestrator.md). Final Phase01 COMPLETE/Review02 pass was used; earlier blocked records and deferred voice failure remain history.

Two workers implemented exclusive capture/inference and calibration/engine modules; parent owned shared contracts, TS/Swift fixtures, schema/atomic settings, main/preload, UI/manifests/integration and ledger. First integrated [reviewer session](reviewer.md) repaired reset/order/continuity/configuration issues and remains open for mandatory physical evidence. Failed builds/tests and corrections retained in artifacts. No Phase03 drawing or Phase04 voice/VAD work enabled.

Implemented contracts/modules:
- `src/shared/contracts.ts`: existing fixed TrackingSample/CalibrationV1; optional selectedHand transports model label, with matching Swift Codable/validators. `fixtures/tracking-v1.json` positive/negative TS/Swift compatibility authority; protocol-v1 unchanged.
- `src/renderer/tracking.ts`, `probe.ts`, `vision.worker.ts`: local models, GPU-first/oneCPU initialization fallback, ideal640×480@30fps/nearest format, oneframe in flight, original capture timestamps and generation/staleness checks, once-mirrored nose/palm anchors/preview, .6 confidence/twohands, .12 jump guard,250ms loss and explicit selected-hand confirmation. Conservative heuristic only.
- `src/renderer/engine/`: five2s captures, >=40valid/80%, medians/scaledMAD1.4826, directional extents strictly>.01 and>3jitter, exact One Euro/gain/directional absolute mapping. Default gain1/S50; no extra prediction/stabilizer. Recenter preserves extents and resets filters.
- `src/shared/settings.ts`, `src/main/settings.ts`: strict versioned per-camera/mode calibration array, atomic writes under userData/settings-v1.json; invalid settings fall back to setup. No saved mic/pen/armed/canvas state.
- `setup-controller.ts`, renderer main, typed preload/main: keyboard-accessible calibration/retry/cancel/tuning/recenter/confirmation, panel-owned background capture, visual mapped pointer and numeric baseline. Camera/mode/calibration/display changes serialized, release/pause; normal helper stays PAUSED/nonposting and canvas unconfirmed. Resume/drawing fail closed for Phase03.

Current automated checks: typecheck pass;79JS/15files;33Swift+7actual-process fake checks. make/package/ZIP pass with unchanged pinned versions; sandboxed fetch and GUI-launch failures retained with successful authorized retries. Packaged e2e1pass/20.7s initializes real bundled models offline on synthetic frames and exercises fake-camera/background, synthetic fivecaptures/recenter, voice deferral and drawing gates. Strict signature/hash checks pass. Synthetic jitter replay only: defaultS50 RMS .002121→.000528 normalized, no physical/medical effectiveness claim.

Current operator artifact: `/private/tmp/steady-phase02-20261024-01/operator/Steady.app`, ZIP beside it; [copy hashes](artifacts/operator-artifact-01.json), [build hashes](artifacts/repaired-artifact-02.json), [frozen inputs](artifacts/frozen-build-inputs-02.json). ZIP140205625bytes/SHA256 `a1e2e6aefc3d0d476c02d92b998aa866b264278b332d7d7b04ee12874e27f93e`; ASAR `e7eaefa340040c0fde562a4d637ba309f90a067b53b5c5bbbf138f3ffab85c32`; signed helper `6a689dcda3a238c88b9ab5e5259175ba618b6c3604c781ea1985634ef68867e4`. Artifact01 is superseded; no physical evidence attributed to it. Standard ignored out/ paths were regenerated; previous Phase01 outside-checkout app copies/logs/history remain preserved.

Hardware trial01 now open against this frozen artifact with no fake devices or automatic camera start. Operator available; Head calibration requested. [Manual hardware record](artifacts/manual-hardware.md), [guide](artifacts/operator-guide.md), [numeric observer](artifacts/hardware-trial-01.json). Current hardware gates/reviewer disposition pending; this checkpoint is not completion.

Limitations: Phase02 baseline is renderer mapped updates/receipt-to-map p95 and inference dispatch-to-result p95, not posted native throughput/latency or smoothing/perceived lag. Full native25Hz/<150ms/real300ms release scoring belongs Phase05. Canvas/Krita product integration Phase03, voice/VAD/permissions/voice timing Phase04, clean-account delivery Phase06 remain unauthorized/unpassed. No effectiveness/accessibility claims.

Next owner: current `/root` coordinates both physical modes/all calibration steps/background/recenter/selectedhand loss+confirmation/performance baseline and metadata/feedback, supplies evidence to existing `/root/reviewer`, addresses findings and updates final ledger/handoff honestly. Missing mandatory physical evidence prevents COMPLETE. Do not start Phase03.

## Superseding repair checkpoint — 2026-10-24 17:54:42 PDT

The earlier running snapshot's native-health implication is superseded: during the attempted Palm transition, Stop failed because helper Pause rejected Native helper unavailable. Safe camera stop was completed, trial01 exited0, old app retained. No Palm hardware gates occurred; mode-transition rows with old Head report are excluded from Palm attribution. Head five captures/mapping/recenter and renderer baseline are retained as physical/renderer observations, without native-health or new-artifact claims.

Current reviewer session is repairing independently reproduced sample/configure and clock-refresh overlap failures, Stop dependence and fatal-error masking. New artifact/rechecks/fresh hardware are required. Native protocol safeguards/algorithms remain fixed; no Phase03/voice enabled. New trial02 observer includes active mode and native fault/generation/clock evidence. See [manual record](artifacts/manual-hardware.md), [diagnostic](artifacts/settings-reopen-diagnostic-01.json), [reviewer](reviewer.md). This run remains running, not COMPLETE.

## Current manual-testing checkpoint — 2026-10-24 19:13:35 PDT

User explicitly takes app controls after guidedprocess proved slow. **Do not send more assisted capture/control actions or close/restart the app while user tests.** Running app `/private/tmp/steady-phase02-20261024-01/operator-v5/Steady.app`; same frozenASAR `ded0a6e478b9c8e46a5b505052faf3c083d44347d53eb3d3d40e713b674faed1`, helper `41732e9e125d368fc028a50a034ca72627132bce57eca6eef6b1308832e81034`, ZIP140207754bytes/SHA256 `404dab35e1a652834a34aef47d91f8340922142f6747c883cfbcd7ecb9dab1a0`. [Finalartifact](artifacts/operator-artifact-05.json), [independentverification](artifacts/reviewer-operator-v5-verification.json).

Current softwarechecks:typecheck/84JS/37Swift/7signedfake-process/finalpackaged e2e1test21.1s/make/signaturepass; all failedpriorattempts retained. Source auditedbyexisting reviewer; interimreviewBLOCKED onmandatoryhardware. Nativeinputstaysfake/PAUSED, voiceoff, canvasunconfirmed; noPhase03.

PhysicalHead currentproof includes newfivecaptures and27.9mappedHz/.10msrendererp95/11.2msinferencep95 baseline withnativeframes/generationshealthy; userconfirmeddesktop/appcontinuation. Exactartifactscopes andtoken-onlysameASARreusejustification retainedinmanual/reviewerrecords. Raised-handPalm57/57fullcal saved butdoesnotfulfilldesk gate; raisedPalmrecenterfailedjitter.

ActiveDesk session in memory:Neutral57/57,Left55/55,Right55/55; Upfailedinsufficientrange andmustretry; Downnotcaptured. Do notdiscard partialwork. [`control-trial-05`](artifacts/control-trial-05/) requests001–005/responsesimmutable; externalproof acceptsfirst4 andcorrectlyrejectsUp005. No more assistantrequests queued. CameraMacBookPro/GPU640×48030fps/Palm/modelLeft; operatorconfirmeddesksetup.

Passiveobserverexecsession82400 viahardware-control.mjs, noautoquitdeadline; rawnumericjournal hardware-trial-05.json. No frames/recordings. PendingDeskUpDown/fullsave/recenter/background70sbaseline/handloss-confirmation/ambiguity, finalcurrentHead/persistence/metadata andsame-sessionreviewdisposition. Rootwaitsforuserresults, no additionalquestionsnow. Goal/phase notcomplete; stopbeforePhase03.

## Superseding self-test/review checkpoint — 2026-10-24 19:15:17 PDT

App controls remain exclusively with the user; do not close/restart/sendcapturecommands. Observer82400 confirmed live by toolpoll. User subsequently changed selectedcamera toSamsung inPalm: currentgeneration4/native4, stepNeutral, clockready/noNativeFault. This supersedes the earlier “currentDeskpartialatUp” description; the prior three successfulMacBookDesk captures remain historicalattempt evidence. No completeddeskcalibration/baseline is currentlyproved. [Passive snapshot](artifacts/manual-selftest-checkpoint-01.json).

Reviewer `/root/reviewer` completed source/implementation review with **BLOCKED** disposition for missing mandatoryhardware, [record](reviewer.md). Softwarechecks remaintypecheck/84JS/37Swift/7signedfakeprocess/make/signature/packaged-e2e pass onoperator-v5. Current source/binaries unchanged. Missinggates: completeddeskfive-capturecalibration/mapping/recenter/background+performancebaseline/handloss-confirmation/ambiguity, finalaffectedHead/persistence/metadata and reviewercontinuation. Originalscope preserved; no Phase03. Rootawaits self-test results using passiveevidence only.

## Superseding authorized scope amendment — 2026-10-24 19:20:38 PDT

User explicitly deferred desk-facing Palm validation: [exact request/appliedscope](artifacts/desk-palm-deferral-01.md). Mandatory relaxed desk-facing Palm physical gate now belongs to Phase05; Phase02 can assess Head and accurately labelled raised-hand Palm. Algorithms/numeric targets/other gates unchanged, oldblocked checkpoints retained. Current Samsung raisedPalm allfive53/53,53/53,52/52,52/52,52/52 now qualify for Phase02 calibration evidence underamendment; they still do not prove desk behavior. SuccessfulPalmrecenter/background+baseline/loss/persistence/currentreview evidence still pending; no automaticphasecompletion. User retains controls; observerpassive; app/binaries unchanged.

## Amendment reviewed — 2026-10-24 19:24:42 PDT

[Same-session audit](artifacts/reviewer-desk-deferral-01-audit.json) confirms user-authorized desk-Palm deferral is applied consistently, numerical algorithms/runtime/artifacts unchanged. Review remains **BLOCKED under the amended Phase02 scope** on other mandatory physical evidence (Palm mapping/recenter/background/baseline/lossconfirmation andremainingpersistence/currentaffected checks). SavedSamsungRaisedPalmcalibration qualifies forPhase02 only; eventualrelaxeddesk gate isPhase05. No appcontrols changed; operatorcontinues self-testing.

## User-approved Phase 02 implementation handoff — 2026-10-24 19:35:39 PDT

**Approved by the user:** “Mark phase 2 as approved.” [Approval record](artifacts/approval-01.md). This is the accepted implementation/package checkpoint; empirical verification and historical reviewerblockeddisposition remain recorded separately.

Implemented camera/localinference/continuity, five-capturecalibration/scaledMAD, exactOneEuro/gain/directional mapping, atomicper-camera/modesettings, recenter, typedfake-onlyintegration andsetupUI. Softwarechecks pass:typecheck,84JS,37Swift,7signedhelperfake-process,9asset hashes,make/package/signature andpackaged-e2e. Finalappoperator-v5/Steady.app andZIP404dab35e1a652834a34aef47d91f8340922142f6747c883cfbcd7ecb9dab1a0unchanged.

Physicalevidence:Headfivecaptures/backgroundhealthy27.9mappedHz/.10msrendererprocessing/11.2msinferencebaseline; SamsungraisedPalmallfive52–53valid each. RemainingPalmrecenter/background/baseline/loss-confirmation andfinalpersistence/manualobservations unverified. Desk-facingPalmvalidation expresslydeferred toPhase05. No claimofnative-eventlatency orcompletedfutureperformance/usabilityacceptance.

Voiceoff, normalnativeinputfake/PAUSED, unrestricteddrawinggated. StopbeforePhase03; separateauthorizationrequired. Allworkuncommitted onextension-version/originalHEAD. Preserveallpriorattempts/evidence/reviewrecords; userkeepsappcontrols.
