# Native worker: Phase 01 Swift feasibility

## Identity and authorization
- Run: phase-01-20261024-01 / phase 01.
- Agent: /root/native; parent: /root; model identity not exposed.
- Role: Swift package/native fake checks and guarded speech/input feasibility probe.
- Exact assigned prompt: [native-assignment.md](artifacts/native-assignment.md); [user authorization](artifacts/authorization.md).
- Started: approximately 2026-10-24 14:34 America/Los_Angeles; initial source-file creation observed at 14:35:49 PDT. Initial record written at 14:38:32 PDT.
- Baseline commit: `207669b43c3f270bf88b89f9e129f0e27c11e3aa`, branch `extension-version`; existing planning files untracked, parent shared contracts/fixtures created before assignment. No unrelated modifications.
- Ownership: `native/`, this record, `artifacts/native-*`. Shared `src/shared/contracts.ts` and `fixtures/protocol-v1.json` read-only.
- Inputs: Revision 2, phase prompt, ledger rules/index, shared contract. No prior native handoff.

## Execution events
- 2026-10-24 14:38 America/Los_Angeles (initial checkpoint): Read required plan, prompt, ledger, record rules and exact assignment; inspected installed Speech SDK swiftinterface (macOS SDK 27.0, APIs gated to deployment 26.0). Confirmed SpeechDetector reportResults, SpeechTranscriber fastResults/audioTimeRange, SpeechAnalyzer finalize(through:), AssetInventory install APIs. No runtime mic/camera access requested.
- Implemented Codable contracts, bounded UTF-8 newline framing, strict payload validation, sequence/session/generation handling, authoritative guarded state engine, fake backend, 250 ms capture freshness, parent EOF/emergency release and exact voice grammar/utterance assembler.
- Implemented CLI stdio runner with independent 10 ms Dispatch watchdog, actual permission/display reporting with fake posting by default, explicit packaged-only `--probe --real-input` bounded disposable-document probe, and release entry point.
- Implemented SDK-26 SpeechAnalyzer probe with explicit asset install, permission enable, audio conversion, finalized span assembly and detector silence finalization. Speech output is recognition-only; parent dispatches one accepted command.
- Build in progress; automated evidence pending. No real-input, packaged-identity, or speech hardware evidence produced.

## Decisions and blockers
- Native normal resume cannot independently verify calibration because fixed configure payload has no calibration field. Parent must gate prerequisites; phase-01 UI intentionally blocks normal resume pending later calibration/canvas UI. Explicit supervised probe is separately bounded.
- Speech detector/audio timing uses sample-time mapping to first audio buffer delivery and must be validated against real detector behavior; no final-result callback latency claim is made.

## Handoff
- Running, uncommitted; no hardware probes run.

## Continuation and corrections
- 2026-10-24 14:49 America/Los_Angeles, automated: first Swift build failed due sandbox denial on user module caches (its SDK-mismatch diagnostic was secondary). Repeated with `CLANG_MODULE_CACHE_PATH` and `SWIFTPM_MODULECACHE_OVERRIDE` under `/private/tmp`, explicit local cache and `--disable-sandbox`; core/SDK speech compiled. Fixed syntax/CGFloat errors in SystemBackend. Initial stdout wrapper returned cat's exit 0 while build log contained failure; subsequent build/test commands retain actual exit codes.
- Default SwiftPM `swiftbuild` backend initially failed to discover the installed Swift Testing macro plugin; explicit `-Xswiftc -load-plugin-library -Xswiftc /Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib` resolved it. Trying the alternate SwiftPM native backend for tests failed to locate Testing; that failure is retained. Release default backend failed on sandbox-restricted dSYM generation; root release script's SwiftPM native backend succeeds with identical pinned Swift/SDK/architecture.
- Process tests exposed a checked-continuation keepalive leak and Swift 6.4 actor isolation traps in DispatchSource callbacks. Replaced keepalive with async sleep, explicitly made background callbacks Sendable, and locked the framing object. Retained earlier failed process logs; final process checks pass. Final shared-output gate allocates reply/event sequences in write order without holding the engine lock during a pipe write. Watchdog state writes run on a separate queue; watchdog polls parent EOF independently of parser/stdout.
- Native backend now repeats exact foreground bundle/PID and Accessibility guards immediately before posting. Bounded supervised probe waits for explicit confirmation with 15-second deadline, uses the actual physical cursor, tests a maximum 10-point path, and has an independent 10 ms watchdog. Default invocation and all tests post no desktop events. The UI must own probe launch; a terminal-launched helper is not acceptance evidence.
- Audio capture uses the input tap's valid host timestamp, with no final-callback timestamp substitution. Missing host time, conversion errors, and bounded-buffer overflow fail closed. Unconsumed finalization watermark expires to retry. No audio/mic/speech hardware check occurred.
- Fixed Pause in FAULT to release without clearing FAULT; recovery still requires a fresh supervised protocol lifecycle. Added affected fake test.

## Final handoff
- Completed independent native implementation/automated scope: 2026-10-24 14:49 America/Los_Angeles. Phase hardware acceptance remains blocked/not run. Everything remains uncommitted; no commit created.
- Changed owned source: `native/Package.swift`, `native/README.md`, `native/Sources/SteadyCore/{Contracts,Engine,Voice}.swift`, `native/Sources/SteadyNative/{Main,SpeechProbe,SystemBackend}.swift`, `native/Tests/SteadyCoreTests/NativeTests.swift`, `native/Tests/integration.py`; worker record and native-prefixed artifacts. Root build integration copies the resulting binary outside ASAR to `resources/bin/SteadyNative`; parent owns that build configuration.
- Automated final release: `node scripts/build-native.mjs`, exit 0; [build log](artifacts/native-final-build9.log). SwiftPM native release backend with arm64/macOS26, pinned Swift6.4/SDK27.0. No application stack/version substitution.
- Automated final Swift checks: `npm run test:native`, exit 0, 24 Swift Testing checks; [test log](artifacts/native-final-swift-test3.log). Uses default SwiftPM backend plus the installed toolchain macro plugin, caches outside protected user paths.
- Automated final subprocess checks: `python3 native/Tests/integration.py resources/bin/SteadyNative`, exit 0, four process checks; [process evidence](artifacts/native-process-tests-final4.log). Actual stdio subprocess, deterministic fake backend only. Covers live-heartbeat starvation, parent stdin EOF while held, emergency/default fake entry point and oversized framing. Includes eight-RTT clock mapping; earlier harness omission of clock mapping rejected captures as intended and was fixed.
- Source interface agreement: fixed shared JSON fixtures are loaded by Swift tests; all positive lines parse and all negative lines reject. Contracts include TrackingSample, CalibrationV1, Command, Rect, NativeState and v1 request/reply wire types. No shared files modified by worker.
- Added `speech-assets-ready`, `microphone-enabled`, and `microphone-disabled` state-reason events after asynchronous success; reporting does not change the pointer state. All speech events remain recognition-only for parent dispatch and action-ack timing.
- Native executable resource lookup has no checkout dependency. Default CLI never posts desktop events, no mic activation or assets setup occurs automatically. Real emergency release flag precedes packaged path restriction. Real normal/probe path requires packaged location and per-event exact target bundle/PID plus Accessibility checks. Strict parent readiness remains essential because configure lacks a calibration-ready field.
- Not run: packaged-identity permission prompts, actual native movement/release, physical camera/background inference, fullscreen/Spaces, mixed-scale/negative-origin manual geometry, offline live speech and ten-probe timings. No operator interaction, disposable document, microphone permission, or Apple asset setup was performed by this worker. The speech SDK compiled, but detector boundaries/finalization watermark behavior and audio conversion timing require manual hardware evidence; ten-probe p95 cannot be claimed.
- Parent integration: use latest copied binary after final source; rebuild package/checksum for any earlier package. See native README for CLI and operator controls. Parent/reviewer own packaged checks and outstanding acceptance disposition. No reviewer or child agent launched by this worker; stop before phase02.

- Final release executable SHA-256 before packaging: `6a46b96ed9b74ad1ec58e7f158e980c20881fa5bda2dd5345a04564730f06558` (`resources/bin/SteadyNative`); package checksum belongs to parent. Final clock confirmation: 2026-10-24 14:48:59 PDT.
