# Live speech authorization crash — sanitized evidence

Evidence classification: **manual hardware crash report plus source audit**. Same Phase01 reviewer session; no replacement/new reviewer.

- Source: existing `SteadyNative-2026-10-24-161800.ips` supplied by parent from the user's DiagnosticReports directory. Read only selected diagnostic fields; raw report not copied to the repository.
- Capture:2026-10-24 16:17:59.3263 -0700.
- Exception:EXC_BREAKPOINT /SIGTRAP.
- Triggered queue:`com.apple.root.default-qos`.
- Relevant symbol chain:`_dispatch_assert_queue_fail` → `dispatch_assert_queue` → `_swift_task_checkIsolatedSwift` → `closure #1 in closure #1 in SpeechProbe.set(enabled:session:)` → authorization-status completion → `__TCCAccessRequest_block_invoke.229`.
- Parent's numeric journal evidence:phase=permission,audioBuffers=0,transcriberResults=0,detectorResults=0. This trial did not reach audio capture. It is not evidence of an empty detector after healthy recognition.
- Cause supported by source/stack: authorization completion created inside MainActor-isolated `SpeechProbe.set` inherited actor isolation, while TCC called it from its own queue.
- Repair:`SFSpeechRecognizer.requestAuthorization` completion explicitly `@Sendable`, capturing only its checked continuation; it resumes the continuation without touching actor state. Existing activation check runs after awaiting authorization on MainActor. No permission bypass, TCC change, microphone auto-enable, detector or timing-policy change.
- Callback audit: AVAudioEngine tap, diagnostic/metadata/watchdog/probe timers, stdio/signal handlers and native workspace observer already have explicit Sendable callbacks. Quartz display callback is a file-scope nonisolated function. Audio converter input block lives in nonactor AudioFeed; its callbacks into SpeechProbe are typed Sendable and explicitly create MainActor tasks. Async AVCaptureDevice/AssetInventory APIs add no application-owned external completion closure. Writer/engine closures execute synchronously rather than through external callback queues.
- Automated checks do not request microphone/speech permissions. Compiler/fake/native/package checks cannot replace the operator's actual authorization callback retry; live recovery remains pending.
