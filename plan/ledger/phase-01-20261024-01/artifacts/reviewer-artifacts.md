# Final reviewed artifacts

2026-10-24 15:04 America/Los_Angeles. Evidence classification: **automated**. No hardware/speech acceptance implied.

- Application: `out/Steady-darwin-arm64/Steady.app`,304MiB displayed /311216KiB disk usage.
- ZIP: `out/make/zip/darwin/arm64/Steady-darwin-arm64-0.1.0.zip`,140171200 bytes.
- ZIP SHA-256: `4acf621796a00027c77c6384225e5ceb7777838fa2faf31210ac161b468fd469`.
- Packaged signed helper SHA-256: `8ecd8509e896053c228ddd74a2dac07b51d62b12ca376032c2bfacd2ea28cf13`, path `Steady.app/Contents/Resources/bin/SteadyNative`.
- Identity verified from packaged Info.plist: `org.steady.local`,version0.1.0,minimum macOS26.0. Helper is arm64; `otool -L` lists only Apple frameworks/system Swift runtime, no checkout/compiler/interpreter dependency.
- `codesign --verify --deep --strict out/Steady-darwin-arm64/Steady.app`: exit0. Local ad-hoc signing only; no Developer ID/notarization claim.
- `npm run make`: exit0; [final reviewed build log](reviewer-make-final2.log). Prior successful reviewed build retained at [earlier log](reviewer-make-final.log); final checksum above supersedes earlier builds.
- `npm run test:e2e`: exit0; [synthetic fake-camera log](reviewer-e2e-fake-camera.log). One packaged test confirms nonfocusable/topmost/all-Spaces320x560 panel flags, default fake helper handshake, local outbound fetch denial, both bundled model initializations/blank-frame inference, actual file-window BroadcastChannel transport, no renderer require, Settings-started synthetic camera frame growth, continued growth collapsed, and explicit Stop. Chromium fake-device/fake-UI flags mean no real camera/microphone/native input. Earlier packaged model/transport-only check passed and is [retained](reviewer-e2e-final.log).
- `python3 native/Tests/integration.py out/Steady-darwin-arm64/Steady.app/Contents/Resources/bin/SteadyNative`: exit0,5 checks against the actual signed packaged helper, including the dedicated bounded-probe EOF path with deterministic fake input; [log](reviewer-packaged-native.log).
- Packaged helper `--release-and-exit` without `--real-input`: exit0, explicitly reports fake mode; no desktop event. Real release remains operator-only.
- Asset restore/verification source and hashes remain in `resources/asset-manifest.json`; final `npm run verify:assets` exit0,nine verified files. No assets changed during review.
