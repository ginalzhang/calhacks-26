# Phase 04 — Voice and accessible controls

## Authorization and entry

Use a fresh orchestrator after explicit phase-04 authorization and completed/reviewed phase 03. Read [Revision 2](../PLAN.md), [index](../LEDGER.md), [record rules](../ledger/README.md), repository instructions, prior handoffs, fixed contracts, and current implementation. Record exact authorization, baseline/dirty state, unique run, ownership, and prior-review audit.

Voice feasibility, speech permissions/assets, VAD integration, offline speech and the ten-probe latency gate were explicitly deferred here from Phase 01. Read the [deferral](../ledger/phase-01-20261024-01/artifacts/voice-deferral-01.md), completed speech experiment, and [approved VAD design reference](../ledger/phase-01-20261024-01/artifacts/vad-revision-proposal-01.md). Existing SpeechDetector boundaries failed with healthy audio/transcription; no voice feasibility pass transfers from Phase 01. This prompt does not authorize Phase 04.

## Fixed inputs and ownership

Implement [commands and voice](../PLAN.md#commands-and-voice), onboarding, panel/settings behavior, and accessibility controls exactly. Vocabulary, recognition identity, timing, state rules, and target shortcuts are fixed. Do not add synonyms, wake-session timers, cloud/browser/LLM fallbacks, or provisional-result actions.

The orchestrator owns shared command/interface integration, settings, manifests, and index. Delegate most work with exclusive paths:

1. **Voice worker:** native Apple SpeechAnalyzer/SpeechTranscriber lifecycle and on-device VAD boundaries following the approved design reference, en-US asset checks/install, `fastResults` and audio-time attributes, 400 ms silence finalization, finalized-span assembly, six-second utterance limit, session/utterance identity, deduplication, 1.5-second expiry, and tests. Mic enable is explicit; invalidated/disabled sessions cannot deliver later actions.
2. **Accessibility/UI worker:** first-launch sequence, assisted calibration/setup controls, fixed expanded/collapsed panel, settings, status/error messages, visible alternatives, keyboard navigation, VoiceOver labels, mic/device/permission/asset progress, and configurable global bindings. Preserve compact-panel nonactivation and local semantic clicks.

All shared edits go through the orchestrator. Microphone state is independent of pointer state and remains usable for Resume when explicitly enabled. Restart is always mic-off, paused, pen-up.

## Deliverables and mandatory checks

- Exact plan vocabulary, case/punctuation normalization only, rejection of unknown/synonym/missing-prefix/multiple-action phrases, and one action per finalized utterance. No backdated strokes; use the latest valid pointer at acceptance.
- Local-only speech after Apple-managed setup download. Missing/unsupported assets disable voice with actionable status, leaving other controls available. Application outbound traffic, including metrics, remains blocked.
- Grammar/lifecycle tests for split finalized spans, tentative updates, duplicates, utterance/session changes, mic disable, expired generations, late results, six-second limit, and unknown/multiple commands.
- Visible equivalents for all core commands and accessible setup/settings. Opening settings pauses drawing; returning to Krita requires Resume. Use configured global bindings for keyboard operation. Keep erase behavior a toggle.
- Real offline speech after explicit permission/asset setup, including all ten scheduled prefixed probes with individual speech-end-to-native-ack values and nearest-rank p95<=1second; missing/wrong/duplicate/expired commands fail the trial. Also microphone denial/disconnect recovery, keyboard operation, and VoiceOver smoke evidence from the packaged app. Verify command effects in Krita, not merely transcripts. Record the one-second p95 speech-end-to-action target and detector limitations.

Run type/unit/integration/e2e checks and packaging. Freeze the phase-05 script before scoring: four cycles of the ten exact commands specified by the plan, with explicit resume/setup between cycles as needed. Also freeze the five-minute unprefixed conversation script. No raw audio/transcripts are retained as execution records. Missing mandatory offline/accessibility/hardware evidence leaves the phase blocked.

## Review and handoff

After integration, audit prior review launches and instantiate the reviewer template. Include complete changes, exact vocabulary/timing contracts, scripts, automated results, speech/accessibility evidence, limitations, and prior unresolved findings. Follow the [standing reviewer continuation policy](../PLAN.md#reviewer-sessions-and-continuations); additional or replacement sessions are user-authorized when justified, with launch reasons/identities and separate records. Fixes/rechecks are recorded in the assigned session. Record pass or blocked and preserve prior findings/dispositions.

Hand off implemented recognition/session contracts, fixed test scripts, asset/offline behavior, accessibility findings, timing measurements, reviewer record, and remaining issues. Stop before phase 05; it requires separate authorization and a fresh orchestrator.
