# Worker: Phase 02 capture/inference

## Identity and authorization
- Run / phase: `phase-02-20261024-01` / 02.
- Agent / parent: `/root/worker_capture` / `/root`; model identity not exposed.
- Exact task prompt: [instantiated assignment](artifacts/worker-capture-assignment.md); [exact user authorization](artifacts/authorization.md).
- Started: 2026-10-24 17:24 America/Los_Angeles.
- Baseline: `extension-version`, HEAD `207669b43c3f270bf88b89f9e129f0e27c11e3aa`, existing application/planning files untracked; no commits made, preserved existing work.
- Owned files: `src/renderer/{tracking.ts,probe.ts,vision.worker.ts}`, `tests/shell/tracking.test.ts`, new `tests/shell/capture*.test.ts`, this record and capture-* artifacts. Shared interfaces/schema/fixtures/UI/manifests/index remain parent-owned.
- Dependencies: plan Revision 2, phase02 prompt, ledger rules, final Phase01 COMPLETE handoff and review02. Parent approved optional TrackingSample.selectedHand and CameraProbe APIs before implementation.

## Execution events
- 2026-10-24 17:24 America/Los_Angeles: read assignment/frozen ownership/rules, inspected existing capture modules and tests. Proposed API to parent and received approval: `setSelectedHand`, `confirmHand`, `preview`; optional report camera format/continuity/count/p95 fields.
- 2026-10-24 17:25 America/Los_Angeles: implemented conservative selected-hand model-label/proximity continuity, .12 Euclidean jump rejection, 250ms declared loss watchdog, explicit confirmation only for a recent single matching hand, retained selected label through explicit restarts. Added original-capture-time generation/mode/order/staleness rejection and one-outstanding-frame matching. Mirrored canvas preview is independent of unflipped inference input. Preserved local models, exact .6 thresholds, up-to-two-hand detection, GPU-first/one-CPU initialization and explicit inference-error restart.
- 2026-10-24 17:26 America/Los_Angeles: automated focused checks passed 15 tests, then 18 tests after fake media/worker lifecycle checks. Tests use synthetic coordinates and fake timers/media, never real desktop input. Initial `npm run typecheck` exit1: parent settings imported engine index before it existed. Retry exit1: in-progress engine calibration extents index TS7053; no capture type errors. Reported both transient integration dependencies to parent.

## Decisions and blockers
- Continuity is a conservative heuristic, not biometric recognition. Model handedness is retained as provided; inference sees original unmirrored video, anchor and visual preview each mirror horizontally once in their separate paths.
- `inferenceMsP95` is nearest-rank p95 over the most recent <=1800 bitmap-dispatch-to-worker-result-receipt intervals, including stale result receipts. It is not native-event latency or perceived smoothing delay.
- Physical camera evidence is **not run by this worker**; parent/operator must validate the final packaged app. No Phase01 hardware evidence relabeled as Phase02.
- Head starvation pause/reset remains parent engine/main integration responsibility. Palm watchdog invokes existing fault callback to pause; capture keeps running to obtain explicit confirmation candidate.

## Handoff
- In progress: final focused checks and full typecheck retry pending integration readiness. All edits uncommitted.

## Final worker handoff — 2026-10-24 17:28 America/Los_Angeles
- Implementation complete within owned paths; all work remains uncommitted on original HEAD/branch.
- Changed: `src/renderer/tracking.ts`, `src/renderer/probe.ts`, `src/renderer/vision.worker.ts`; added `tests/shell/capture-continuity.test.ts` and `tests/shell/capture-probe.test.ts`. Existing `tests/shell/tracking.test.ts` retained unchanged and passes.
- **Automated:** focused 18 tests / 3 files pass, exit0; [log](artifacts/capture-tests.log). Final `npm run typecheck` passes exit0; [log](artifacts/capture-typecheck.log). Earlier transient failures remain recorded above.
- Integration: attach preview canvas in panel; `setSelectedHand(savedLabelOrNull)` before `start`; saved/restarted palm selection requires `confirmHand()` with exactly one recent matching model label. After automatic first selection, label survives restart until explicitly reset with `setSelectedHand(null)`. Confirmation remains paused; parent resets mapping/filter readiness.
- Optional reports: selectedHand, confirmationRequired, actual cameraId/width/height/frameRate, validFrames, staleFrames, inferenceMsP95. ProbeReport fixed legacy fields remain compatible. No raw camera frames/recordings persisted.
- Parent owns remaining setup/persistence/fake-mapping integration, head freshness pause/reset, whole-suite/package/review and physical head/desk-palm observations. No later phase or speech/VAD work performed.
