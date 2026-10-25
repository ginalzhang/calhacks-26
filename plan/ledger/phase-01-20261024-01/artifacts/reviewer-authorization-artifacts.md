# Speech authorization callback repair artifact

2026-10-24 16:22 America/Los_Angeles. Same reviewer session; minimal explicit Sendable authorization completion repair. [Crash/source audit](reviewer-speech-authorization-crash.md) preserves sanitized failure evidence; no full crash report/audio/text copied.

- App: `out/Steady-darwin-arm64/Steady.app`.
- ZIP: `out/make/zip/darwin/arm64/Steady-darwin-arm64-0.1.0.zip`,140192101bytes.
- ZIP SHA-256: `586ade07a45cf215c01314e2dad83976b1dd547fb41124a57c14a69f47430715`.
- Signed packaged helper SHA-256: `389da062892932ac2c71f9218e99dd305fa35ba7c1235a476b8ab790c9017ef1`.
- Typecheck/32 JS tests:exit0 [log](reviewer-authorization-js.log).
- Native30 Swift tests/6 fake-process checks:exit0 [log](reviewer-authorization-native.log).
- Forge make:exit0 [log](reviewer-authorization-make.log); deep strict codesign verification:exit0.
- Packaged e2e:exit0(12.1s) [log](reviewer-authorization-e2e.log); native readiness/idle counters/local models/fake camera, no actual microphone or TCC request.
- Actual signed packaged helper6 fake-process checks:exit0 [log](reviewer-authorization-packaged-native.log).
- Actual permission completion and audio pipeline require parent-coordinated operator retry. This repair's compile/fake/package checks do not establish detector events, offline speech or ten-probe timing. Overall phase blocked; no policy/version/architecture/timing substitution.
