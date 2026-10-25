# Reviewed speech-diagnostic artifact

2026-10-24 15:49 America/Los_Angeles. Same single reviewer session; user-authorized focused speech feasibility continuation. Evidence classification **automated**, live microphone trial pending operator.

- App: `out/Steady-darwin-arm64/Steady.app`.
- ZIP: `out/make/zip/darwin/arm64/Steady-darwin-arm64-0.1.0.zip`,140192145bytes.
- ZIP SHA-256: `dff50b4282973cfb35003674aed96303c7ccf8523d71cac79327060baa7be3cf`.
- Signed packaged helper SHA-256: `b6ee61931a973ef04596af2fc4693a377607c31fc3d1ef5402fb45e2ba2f4c6c`.
- Forge make exit0: [log](reviewer-speech-diagnostics-final-make.log). `codesign --verify --deep --strict` exit0.
- Typecheck and32 JS tests pass: [log](reviewer-speech-js-metadata-final.log).
- Native30 Swift tests and6 fake-process checks pass: [log](reviewer-native-metadata-tests-final.log).
- Actual signed packaged helper independently passes the same6 fake-process checks: [log](reviewer-speech-packaged-native-final.log). Packaged fake emergency entry and bounded-probe EOF included; no real input.
- [Final source inventory/hashes](reviewer-source-inventory-speech.json) covers the uncommitted continuation implementation; previous review inventory preserved.
- Packaged e2e exit0(5.4s): [log](reviewer-speech-diagnostics-final-e2e.log). Includes exact native startup clock readiness, zero idle speech diagnostics with microphone off, both bundled models, local transport and collapsed synthetic camera. No actual device/native event.
- Numeric evidence output: Electron userData `phase01-evidence/speech-diagnostics.jsonl`, at most1Hz,1MiB cap, unchanged snapshots suppressed, stopped counters associated through `trialSession`. No audio/recognized text in this journal. These observation timestamps do not measure speech-end latency.
- Original speech blocker remains until authoritative/runtime evidence establishes the required detector boundary behavior. No alternate VAD/recognizer/final-callback timing substituted. No phase02 authorization.
