# Worker: calibration and tracking engine

## Identity and authorization
- Run / phase: phase-02-20261024-01 / 02.
- Agent / parent: `/root/worker_engine` / `/root`; model identity not exposed.
- Exact assigned prompt: [worker-engine-assignment.md](artifacts/worker-engine-assignment.md); supplemental parent instruction: “Implement frozen calibration/engine assignment. Read exact prompt at plan/ledger/phase-02-20261024-01/artifacts/worker-engine-assignment.md and ownership in orchestrator.md. Own only assigned paths/record/artifacts. Save prompt reference and actual identity. Send concrete proposed public API early so parent can integrate UI. Parent owns shared fixtures/settings schema/file IO and all main/preload/UI. Do not spawn agents. Complete implementation and deterministic tests.”
- Exact user authorization: [authorization.md](artifacts/authorization.md).
- Started: 2026-10-24 America/Los_Angeles.
- Baseline: `extension-version`, HEAD `207669b43c3f270bf88b89f9e129f0e27c11e3aa`, prior application/planning work untracked and preserved; inspected git status/HEAD.
- Exclusive ownership: new `src/renderer/engine/`, `tests/engine/`, this record and engine-* artifacts. Parent owns shared types/fixtures/schema/IO/UI/main/preload/index.
- Dependencies: existing CalibrationV1, TrackingSample (with optional selectedHand), Point/Rect. Read Phase02 prompt, plan calibration/mapping requirements, ledger rules and final Phase01 COMPLETE/pass handoff.

## Execution events
- 2026-10-24: sent and received parent approval for pure engine API. Parent additionally requires receipt-time window closure, out-of-order rejection, in-window invalid-frame denominator and palm label consensus. No shared files changed.
- Implemented pure capture/session, scaled MAD, strict versioned calibration validation/key helper, recenter, One Euro and directional absolute mapping. Tests/checks in progress.

## Decisions and blockers
- A Capture window uses `[startedAt, startedAt+2000)` for captures/receipts; duplicate/out-of-order/foreign-generation frames cannot inflate sample count. In-window invalid observations contribute to validity denominator.
- Recenter keeps directional extents; if new jitter invalidates their required minimum, explicit recalibration is required rather than inventing bounds.
- Physical camera observations are not run by this worker; parent coordinates operator evidence. No medical-effectiveness claim.

## Handoff
- In progress; no commits created. Files remain uncommitted.

## Validation and corrections — 2026-10-24 17:28 America/Los_Angeles
- Initial `npm run typecheck` exited 1: TypeScript unknown-object narrowing did not persist inside extent callback. Fixed by storing validated extent record before callback; no algorithm change.
- First combined typecheck/tests: typecheck exited 0; Vitest exited 1 with 28/29 passing. The failed session fixture expected jitter 0.001 despite every neutral sample being identical; corrected expectation to scaled MAD=0. No implementation behavior weakened.
- Fresh `npm run typecheck` exited 0 ([log](artifacts/engine-typecheck.log)). `npx vitest run tests/engine` exited 0: **30 tests / 3 files** ([log](artifacts/engine-tests.log)). All tests use synthetic landmarks and fake clocks; no desktop input.
- `npx vitest run tests/engine/jitter-replay.test.ts --silent=false --reporter=verbose` exited 0: deterministic 300-frame,30Hz replay with30warmup frames. [Replay log](artifacts/engine-jitter-replay.log), [numeric summary](artifacts/engine-jitter-metrics.json). Raw RMS0.002121 normalized units; filtered RMS S0=0.0007591,S50=0.0005282,S100=0.0001733. These stationary synthetic results establish algorithm behavior only,not camera performance,responsiveness or medical effectiveness.
- Parent approved strict validation and five-step helper; directional failures now retain current step for Retry. Parent owns cross-language/shared fixture agreement and hardware evidence.

## Handoff — implemented,2026-10-24 17:28 America/Los_Angeles
- Changed paths: `src/renderer/engine/{index,calibration,filter,mapping}.ts`; `tests/engine/{calibration,mapping,jitter-replay}.test.ts`; this record; `artifacts/engine-{typecheck.log,tests.log,jitter-replay.log,jitter-metrics.json}`. All uncommitted; no commit created.
- Approved exports are live in `src/renderer/engine/index.ts`: capture/session helpers, CalibrationV1 validator, camera/mode key, build/recenter, OneEuroFilter, mapPosition and TrackingEngine.
- Capture `.add(sample,receiptTimestamp)` uses renderer monotonic milliseconds before preload conversion. A session creates each two-second window only on `.start(now)`; `.finish(now)` succeeds/advances or returns visible failure while preserving the current step for Retry. `.cancel()` clears capture history. `.build()` requires all five positions.
- Parent integrates IO/settings/schema, fixtures and UI. After saving calibration or recentering, call `TrackingEngine.reset(newCalibration,display,generation)`; parent must release input and remain paused. Pure engine does not post native input or control armed state.
- Physical camera/background/loss/confirmation/performance checks are **not run** by this worker and remain parent/operator gates. No Phase03/voice work.
