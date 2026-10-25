# Focused live speech experiment — fixed design

Authorized continuation: user **“Okay, please continue.”** after the proposal to investigate actual SpeechDetector runtime behavior. Phase01 only; no approved detector/recognizer/timing substitution. Original app/ZIP checksum remains historical; counter-instrumented app requires affected checks/review/checksum in the same existing reviewer session.

## Preparation and privacy

- Environment remains macOS26.7.1/25G241, SDK27.0/Swift6.4, developer's MacBook Pro built-in equipment. Record any changes before interpreting results.
- Operator clicked Set up speech assets on the existing reviewed app and reports **“Speech assets are ready.”** No microphone enable performed yet. Operator then closed Steady using× for diagnostic-build packaged checks.
- Diagnostic build adds numeric/lifecycle counters through bounded reserved stderr; stdout protocol design and command behavior unchanged. No microphone recordings or recognized text/transcripts retained. Scripted phrases below are test inputs, not saved transcripts. Mic starts off, user explicitly enables it and grants permissions.
- Use default fake input backend. No native real probe running. Stop camera for this focused experiment; speech commands use release-only actions so no actual pointer action is required.

## Preliminary trial, before latency scoring

1. Open counter-instrumented packaged app, verify assets-ready (repeat explicit setup if needed), and enable mic through visible control. Operator handles any macOS mic/speech permission prompts.
2. Confirm audio seconds/buffers increase with mic listening. Observe5seconds silence.
3. Speak “Steady pause”, wait2seconds; “Steady pen up”, wait2seconds; “Steady pause”. Leave at least5seconds silence afterward. Observe numeric counts for approximately30seconds total, then Disable microphone.
4. Collect only phase/session/counter/timestamp/error/action-ack metadata. Require a functioning audio positive control and transcription results before attributing missing detector output to the detector. No final-result callback timestamp substitutes for detector boundaries.

Interpretation:
- Audio buffers/seconds and final transcription counts increase, but detector result/speech/silence counts remain0: document no detector boundary events observed during this bounded positive-control trial, consistent with current Apple docs. Fixed speech gate remains blocked; no latency values/p95 can be computed.
- Audio fails, assets missing, permissions denied, converter/overrun/host-clock faults, or no transcription positive control: **inconclusive detector experiment**. Diagnose pipeline/setup first; do not label it proof of an empty detector.
- Detector speech and silence events occur: save counters/timing evidence and audit full400ms/six-second/1.5second finalized policy before proceeding to acceptance. Counter presence alone is not voice acceptance.

## Conditional offline ten-probe trial

Only if the preliminary trial demonstrates usable detector events: user disables network after Apple asset setup, starts a fresh mic session, and speaks alternating “Steady pause”/“Steady pen up” five times, leaving2seconds silence between utterances. Record all ten speech-end-to-native-action-ack times, all accepted actions and nearest-rank p95<=1000ms. Use existing `scripts/score-speech.mjs`; no missing/failed probe discarded. Disable microphone at end. Preserve detector/audio timing limitations. No separate voice architecture or phase02 work.

## Outcome

Pending diagnostic build and explicit operator microphone enable. Asset-ready report is setup evidence only; no runtime detector or latency result claimed yet.

## Diagnostic-build checkpoint

Same existing reviewer session reports source freeze after strict typecheck,32 JS tests,27 Swift tests and five fake subprocess checks pass. Added <=1/second allowlisted native counters,2048-byte diagnostic line bound, active-session filtering, UI throttling and a1MiB capped/deduplicated numeric/lifecycle journal. Stopped counts retain trialSession; no raw text/audio is written. No stdout protocol types or fixed voice timing behavior changed. New make/e2e/sign/checksum pending before operator microphone use. Prior failing counter test retained by reviewer and corrected before source freeze.

Operator completed Apple speech-asset setup on the earlier reviewed app and then confirmed Steady closed. No actual microphone trial yet. Planned measurements are audioBuffers/audioSeconds, transcriberResults/transcriberFinals, detectorResults/speechResults/silenceResults, acceptedUtterances, phases/errors and action-ack timing only. Any detector interpretation requires successful audio/transcription positive controls.

## Packaged readiness correction and operator build03

- The initial packaged diagnostic test failed because no idle snapshot arrived. Direct signed-helper and Node-supervisor checks received valid snapshots. First hypothesis was reporter scheduling/inspector interference; changing the emitter alone and reordering inspector calls did **not** resolve readiness. Subsequent evidence showed actual native clock synchronization exceeding the unchanged10ms uncertainty gate and closing the helper before diagnostics arrived. This is a startup failure, not detector evidence.
- Reviewer separated platform permission/foreground/display collection from ping/snapshot/watchdog critical paths. Native callbacks still pause/release on foreground/display changes; immediate per-post guards remain. Emergency release now occurs before metadata initialization, fake process tests avoid real desktop observers, and monitor cleanup unregisters callbacks. Added/read nativeReady scalar so packaged e2e waits for completed synchronization, not merely the first hello state.
- Final affected checks pass: strict TS,32 JS tests,30 Swift tests,six fake-process checks, make, deep strict code signature and packaged e2e(5.4s) with nativeClockReady=true/idle counters before model/fake-camera checks. Exact8 RTT/10ms clock bound,250ms freshness/10ms watchdog and speech policy unchanged. Same reviewer session only.
- Diagnostic build ZIP SHA256 `dff50b4282973cfb35003674aed96303c7ccf8523d71cac79327060baa7be3cf`,140,192,145 bytes; signed helper SHA256 `b6ee61931a973ef04596af2fc4693a377607c31fc3d1ef5402fb45e2ba2f4c6c`. Prior reviewed ZIP/app remains historical; no blanket transfer of prior live hardware results to changed native code.
- Operator copy `/private/tmp/steady-phase01-20261024-01/speech/Steady.app`, copied from current out build, strict signature verification exit0, launched through env-unset LaunchServices exit0. Microphone remains operator-controlled. User asked to Enable microphone and allow OS prompts, then report listening phase and increasing audio counters before any detector conclusion.

### Same-session review closure for the diagnostic build

Reviewer completed [continuation review](../reviewer.md), [new artifact/checksum record](reviewer-speech-diagnostic-artifacts.md) and [source inventory](reviewer-source-inventory-speech.json). Signed packaged helper passes the same six fake-process checks. Source/ZIP frozen at dff50b4282973cfb35003674aed96303c7ccf8523d71cac79327060baa7be3cf. Parent retains prior app copies/checksum records. All code remains uncommitted; no phase02 or plan revision.

Timing caveat for the **conditional** ten-probe trial: default SystemBackend(real:false) currently acknowledges actions using its pre-metadata request timestamp, while real mode timestamps after posting. The preliminary counter-only trial makes no latency claim. If usable detector events appear and latency scoring becomes possible, correct fake-mode acceptance timestamps (retaining injected times only for deterministic FakeBackend tests), rerun affected checks/rebuild/checksum in this same reviewer session, then score. Do not call the existing fake-mode timing artifact an accepted p95.

## Operator checkpoint — 2026-10-24 15:53 America/Los_Angeles

Diagnostic app process is running at the speech operator path (targeted process check). User was asked to Enable microphone/allow prompts and report listening/audio progression. That question is still unanswered. No speech-diagnostics journal/session is recorded yet at the expected application-data evidence path. Therefore the live positive-control trial has **not been established**, and no conclusion about actual detector delivery or latency follows. Apple asset-ready is confirmed setup evidence only. Next step remains the explicit operator microphone enable/status report, followed by the three scripted phrases if listening/audio progression succeeds. No source changes after reviewed diagnostic hash.

## First microphone attempt — native permission-callback crash

- 2026-10-24 16:18 America/Los_Angeles: user initially reported app not visible, then **“I got native helper exited explicit restart required.”** Main app process was still running. The new native crash was captured16:17:59 on `com.apple.root.default-qos`: SIGTRAP/EXC_BREAKPOINT from Swift queue isolation checking in the `SFSpeechRecognizerAuthorizationStatus` completion inside `SpeechProbe.set`.
- [Sanitized crash summary](speech-experiment-01-crash-summary.json) retains exception/queue/symbols only, not the full private crash report. The diagnostic journal has one permission-phase snapshot for trial4b838dfb-7c00-4891-9030-5924d597a5ee, audioBuffers/audioSeconds/transcriber/detector/accepted counts all0. **Inconclusive detector experiment:** audio never reached the positive-control stage. Do not attribute zero detector results to the documented detector limitation.
- Root closed only the faulted speech-copy process by exact-path SIGTERM(exit0). Resumed the existing reviewer session for a minimal callback fix: explicitly Sendable completion resumes the continuation without actor state. Native taps/timers/stdio/signals/Workspace/Quartz/converter callback contexts audited; no VAD, policy or dependency change. Affected checks/new package/checksum pending before operator retry.

### Permission callback repair ready

- Same reviewer session changed only the authorization completion's sendability and audited the other externally invoked callbacks. Typecheck,32 JS,30 Swift,six fake-process checks, make/sign and packaged e2e(12.1s) pass. The automated suite does not request real microphone permission; actual recovery requires operator retry.
- [Crash audit](reviewer-speech-authorization-crash.md), [repair artifact/checksum](reviewer-authorization-artifacts.md). ZIP SHA256 `586ade07a45cf215c01314e2dad83976b1dd547fb41124a57c14a69f47430715`,140,192,101 bytes. Signed helper SHA256 `389da062892932ac2c71f9218e99dd305fa35ba7c1235a476b8ab790c9017ef1`. Prior copies/hashes preserved; no later-phase work or detector substitution.
- New operator app `/private/tmp/steady-phase01-20261024-01/speech-permission-fix/Steady.app`; ditto+deep strict signature check exit0, env-unset LaunchServices open exit0. User explicitly asked to Enable mic again, approve any remembered/new prompts and report listening/audio progression or the exact failure. Live repair result still pending.

## Completed live preliminary trial — 2026-10-24 16:26 America/Los_Angeles

**Manual hardware with numeric diagnostic evidence.** Operator reports **“Listening; audio increases”**, then confirms the prescribed3 prefixed utterances/pauses and **“Trial complete; microphone disabled.”** The stopped snapshot corroborates microphone shutdown. Source/app hash remained the permission-repair build above.

[Counter-only journal](speech-experiment-01-counters.jsonl), [structured result](speech-experiment-01-result.json): trial9b941d68-9b6b-492a-8344-1f6e17110f20,80 snapshots, phasespermission→checkingAssets→listening→stopped, no error codes.

| Measurement | Observed |
| --- | --- |
| Audio buffers processed | 1,358 |
| Audio duration processed | 135.8 seconds |
| Transcriber results / finalized results | 27 /27 |
| Public detector results | 0 |
| Detector speech /silence results | 0 /0 |
| Accepted command utterances | 0 |

Audio and transcription positive controls **pass**. No public SpeechDetector results were observed while audio and finalized transcription results progressed on macOS26.7.1/25G241 with installed en-US assets, fastResults and reportResults=true/medium sensitivity. This is direct runtime evidence consistent with the documented empty result stream; it is not a generic failure to start audio. The permission-callback repair also has actual recovery evidence.

The trial lasted longer than nominal30seconds while the operator completed the steps. Finalized-result count means result spans, **not27 correctly recognized commands**; no text/audio was retained or inspected. Exact input format/device model was not logged; system-default audio input on the developer's MacBook Pro. Network was not disabled/verified, so this is not offline acceptance.

No boundary timestamps or acknowledged command actions exist for this trial. The conditional ten-probe latency trial was **not run**, nearest-rank p95 is **unavailable**, not0. No alternative VAD/recognizer/timing source was substituted. Overall Phase01 remains **blocked**. Next prerequisite is an explicit targeted revision of the speech-boundary requirement or new supported runtime evidence; no Phase02 work.
