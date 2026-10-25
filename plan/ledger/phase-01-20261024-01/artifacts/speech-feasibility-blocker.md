# SpeechDetector feasibility blocker

Evidence: **authoritative documentation + SDK inspection**, not a live microphone test. Checked 2026-10-24 America/Los_Angeles.

Apple's current [SpeechDetector.results documentation](https://developer.apple.com/documentation/speech/speechdetector/results) states: “This sequence may throw an error, but will otherwise remain empty.” (13 quoted words.) The [Result documentation](https://developer.apple.com/documentation/speech/speechdetector/result) also describes current VAD reporting as error handling.

Verification procedure: web search/open of the official Apple pages, followed by direct `curl -fLsS --connect-timeout 15 --max-time 30 https://developer.apple.com/documentation/speech/speechdetector/results.md`, exit0. Current Markdown availability includes macOS26.0+. Installed SDK27.0 swiftinterface exposes `SpeechDetector.Result.speechDetected` and the sequence, but an exposed/compiled API is not evidence that boundary events are delivered.

Implication (inference from Apple documentation): the fixed implementation cannot rely on this stream to deliver speech/silence boundaries. Without those events it cannot implement the specified400ms detected silence, six-second boundary handling or measured detector-speech-end-to-action acceptance. Ten-probe p95 is **not run / unavailable**, not zero or passing. SDK compilation and synthetic utterance-assembler tests do not prove this assumption.

No custom detector, amplitude heuristic, cloud recognizer, alternative speech architecture or final-result-callback timing has been substituted. Revision2 explicitly says failed native/speech assumptions leave phase01 blocked. Reviewer independently verifies and records disposition. Any change to that fixed requirement needs an explicit user-approved plan revision; phase02 remains unauthorized.

## Runtime corroboration — 2026-10-24 16:26 America/Los_Angeles

The initial permission-callback crash was repaired in the same reviewer session and was inconclusive about detector behavior. The subsequent live operator trial on macOS26.7.1 successfully processed135.8seconds of audio(1,358buffers) and produced27 finalized transcription result spans, with **zero public detector events** and no diagnostic errors. Operator confirmed scripted phrases/pauses and microphone disabled; stopped counter phase corroborates shutdown. [Full protocol/outcome](speech-experiment-01.md), [counter result](speech-experiment-01-result.json).

This now supports the blocker with actual runtime positive controls, not documentation/compilation alone. It establishes no detector results during this configuration/trial; it does not prove universal behavior across future OS versions. No raw audio or transcripts saved. No offline claim or ten-probe p95 was made. Recognition operates, but the fixed boundary-source assumption remains unsatisfied.
