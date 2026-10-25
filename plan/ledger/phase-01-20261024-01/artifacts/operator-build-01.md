# Interim operator artifact 01

- 2026-10-24 America/Los_Angeles; pre-review-fix artifact, camera/panel checks only.
- Built with `npm run make`, exit0; [log](orchestrator-make-operator.log). Packaged synthetic e2e exit0; [log](orchestrator-e2e-operator.log). Root native check script exit0 with24 Swift/four process tests; [log](orchestrator-native-final.log).
- ZIP at `out/make/zip/darwin/arm64/Steady-darwin-arm64-0.1.0.zip` at copy time SHA256 `dd0d1a60f0d57eaf09dac89bdedb56346851182a3117387b0c8202a0690a0690`. This is interim; final reviewed rebuild supersedes it.
- Copy: `/private/tmp/steady-phase01-20261024-01/Steady.app`; copied with ditto and deep/strict codesign verification exit0. `open -n` exit0. Copy resource lookup independent of checkout, no dev server involved.
- Bundle metadata org.steady.local/0.1.0/minimum26.0; arm64 helper LC_BUILD_VERSION minos26.0/sdk27.0. otool reports only Apple system/Swift dylibs/frameworks, no runtime compiler/interpreter. Nine model/runtime/notice assets total52,256,556 bytes, hashes in manifest.
- User was asked to report camera/display/equipment/operator role and windowed/fullscreen/Spaces/unfocused/collapsed frame growth. User was explicitly told to leave microphone and native real-input probe off until reviewed cancellation/release fixes land. No response yet; **not run** for mandatory manual gates.

## Operator continuation

- User first reported: “I don't see the Steady app open. Krita is open too but I don't see anything”. This is a manual failed launch-observation; `open -n` exit0 was not proof of visible UI.
- Relaunched the same copied app with `env -u ELECTRON_RUN_AS_NODE /private/tmp/steady-phase01-20261024-01/Steady.app/Contents/MacOS/Steady`; process remained running. User confirmed: “It just opened” and “Panel is visible now”. This proves panel visibility for this launch only. It does not prove Finder launch, z-order/focus, fullscreen/Spaces or camera acceptance.
- Likely cause (inference): inherited Codex `ELECTRON_RUN_AS_NODE=1` environment; packaged e2e already strips it. No claim of definitive Finder launch diagnosis. Tool process query was sandbox-denied; no sensitive process enumeration or camera/microphone capture used.
- User was again directed to panel/camera-only checks; native real-input and microphone remain off pending reviewed fixes/documented speech blocker.
