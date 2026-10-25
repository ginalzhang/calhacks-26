# Phase 01 mandatory gate evidence

All statuses below are interim until the single review closes. Automated/fake/synthetic checks never substitute for manual hardware evidence.

| Mandatory criterion | Evidence classification and observed result | Remaining gate |
| --- | --- | --- |
| Fixed toolchain and exact npm pins/lock | Automated: exact environment checks; install and offline npm ci pass; [locked versions](locked-versions.json) | None for version availability; retain lockfile |
| Strict TS, JS and Swift checks | Automated: typecheck,18 JS,24 Swift checks pass before review fixes | Affected checks after reviewer fixes |
| Framing, validation, sequence/session/generation, ack/clock | Automated: shared fixtures, supervisor tests, Swift tests and actual fake subprocesses pass | Reviewer audits full coverage/contract limits |
| Stale capture despite live heartbeats | Automated fake process: independent timer releases; pings do not refresh sample capture | Real bounded probe timing requires operator |
| Parent EOF / emergency release | Automated fake process: held fake button releases and process exits; fake emergency entry posts fake up | Packaged real release and reviewed probe EOF checks |
| Forge arm64 app/ZIP,0.1.0/org.steady.local/macOS26 | Automated: make/package and deep strict code-sign verification pass; helper minos26/sdk27 | Final reviewed artifact/checksum |
| Swift executable outside ASAR, local resources/hash manifest | Automated: packaged resources inspected; both models actually initialize/infer synthetic frame via packaged worker | Physical camera/inference offline behavior |
| No runtime compiler/interpreter/native service | Automated source/package inspection; helper links only Apple runtime; stdio; development Python harness absent from ASAR | No terminal-free Finder launch claim yet |
| Panel320x560 /320x96/nonactivating/fullscreen/Spaces | Automated: packaged window flags/dimensions; manual user confirms panel visible after env-unset launch | Actual z-order/focus/fullscreen/Spaces/collapse observation pending |
| Settings pauses; close quits/releases | Implemented; reviewer discovered separate real-probe cancellation gap and is repairing | Affected fake recheck plus operator observation |
| Background head/palm camera inference, one in flight/GPU→CPU once | Synthetic module tests and packaged actual model worker pass | Physical head/desk cameras, foreground/collapsed frame growth pending |
| Block application outbound/telemetry, no CDN | Implemented CSP/webRequest; actual packaged outbound fetch rejects; assets local | Offline physical inference/telemetry hardware observation pending |
| Display geometry/mixed-scale/negative-origin | Native authoritative geometry; negative-origin synthetic tests pass | Reviewer adding selected-display probe control; real external/mixed-scale checks pending |
| Packaged-identity Accessibility/camera/mic/speech permissions | Implemented status/explicit requests; no automatic TCC grants | Actual operator evidence pending |
| Native movement/down/up guarded and bounded | Fake/native checks pass; default fake; explicit packaged real probe implemented | Hold real probe until review cancellation/EOF fixes pass; manual results pending |
| Offline en-US SpeechAnalyzer/fastResults/SpeechDetector,400ms/six-sec/1.5sec policy | SDK compiles; finalized assembler/grammar synthetic tests pass | **Blocked assumption:** Apple documents detector results empty except errors; no timing-policy substitution |
| Ten prefixed speech-end-to-ack values, nearest-rank p95<=1sec | Scoring/ack timing recorder implemented; no transcript/audio persisted | **Not run, blocked**; cannot derive required detector boundaries under documented API |
| One fresh reviewer | `/root/reviewer` launched once after complete baseline/change inventory and meaningful automated evidence | Same session disposition pending; no replacement |

No overall phase pass can be declared while mandatory manual evidence is missing or the documented speech detector assumption is unresolved. Phase02 remains separately unauthorized.

## Final review correction — 2026-10-24 America/Los_Angeles

The same single reviewer session concluded **blocked**; see [reviewer.md](../reviewer.md). All identified code defects repaired; affected type checks,26 JS/25 Swift/five actual fake-process checks pass, including dedicated probe EOF. Packaged signed helper passes the same process checks. Final packaged e2e additionally verifies Settings↔panel transport, fake-camera capture and count growth while collapsed, and Stop. Final make, deep/strict signing and asset verification pass; [artifact/checksum record](reviewer-artifacts.md). The reviewed source/package is frozen; subsequent operator reports append evidence without code changes.

Manual evidence now supports interim windowed/fullscreen/Spaces focus/z-order and × quit, plus actual Head frame progression after explicit Start on the reviewed app. Collapsed/unfocused Head, physical Palm, equipment details, packaged Accessibility/real-input/emergency release and offline speech timing are still unverified at this checkpoint. The hard speech assumption blocker remains unchanged. No p95 is available; ten measurements were not performed.

## Closing manual correction — 2026-10-24 America/Los_Angeles

Subsequent user reports establish Head count growth after30s collapsed/unfocused; Palm count growth; developer role with built-in MacBook Pro camera/display only; and actual packaged native tiny stroke/release after the operator manually granted Accessibility. Camera=authorized and Accessibility=true in28/28 accepted native probe acknowledgments; mic/speech=notDetermined. [Manual record](manual-hardware.md) and [native summary](native-operator-summary.json). No source/artifact changes resulted. External/desk-camera/mixed-scale/negative-origin and physical offline/speech evidence remain missing. No independently measured real release deadline or speech p95 is claimed. Phase remains **blocked**.

## Completed speech investigation correction — 2026-10-24 16:26 America/Los_Angeles

User-authorized focused speech continuation added bounded diagnostics, fixed a startup clock/reporting issue without changing thresholds, then fixed an observed permission-callback crash. Latest package passes typecheck/32 JS/30 Swift/six process checks, make/sign/e2e. Current ZIP586ade07a45cf215c01314e2dad83976b1dd547fb41124a57c14a69f47430715; earlier hardware observations remain historical to their artifacts.

Mic/speech permission startup and Apple asset setup now have live operational evidence. Positive audio/transcription controls pass:135.8processed seconds/1,358buffers/27final result spans, noerrors. Public detector/speech/silence/accepted-command counts all0. Operator completed3 scripted prefixed phrases/pauses and disabled mic; stopped snapshot corroborates. [Result](speech-experiment-01-result.json), [reviewer audit](reviewer-speech-runtime-audit.json). No transcript/audio saved, no command-accuracy/27-command claim.

Required detector boundaries/timing remain **blocked by observed runtime behavior**, consistent with official docs. Ten-probe p95 unavailable/not run; offline network behavior not verified. No architecture/VAD/policy substitution or Phase02. Targeted boundary requirement decision and remaining external/offline hardware gates are next.

## Superseding voice deferral and current nonvoice build — 2026-10-24 America/Los_Angeles

[User amendment](voice-deferral-01.md) supersedes the speech exit gates in the historical table above. Current source remains uncommitted; no reviewer launched/resumed. [Exact check/artifact record](voice-deferral-artifacts.json), [package contents audit](voice-deferral-package-audit.json).

| Current Phase 01 criterion | Latest evidence | Status |
| --- | --- | --- |
| Dependency pins/lockfile/Swift baseline/model manifest | Existing files unchanged; typecheck,32 JS,31 Swift,9 asset hashes pass | Automated pass |
| Protocol/freshness/watchdog/EOF/emergency release | 7 fake-process checks on development and signed packaged helper | Automated pass; physical outcomes require current build |
| Voice deferred and microphone kept off | UI removes activation/setup; main and helper reject requests; native unit/process and packaged e2e confirm rejection and disable path | Implemented and automated pass; voice feasibility is deferred, not passed |
| Packaged arm64 app/ZIP/signature | Make retry passes after retained restricted-fetch failure; deep strict codesign and outside-checkout copy verify | Automated pass; affected review pending |
| Local models/background transport/outbound rejection | Packaged synthetic Head/Palm inference under Chromium offline emulation; fake-camera frame progression while collapsed; no renderer Node; outbound fetch rejects | Automated pass; physical offline/telemetry observation pending |
| Partial VAD import |25upstream files hash-verified, Package.swift unchanged; no C target/linkage; excluded from ASAR | Inactive preserved work; no VAD acceptance claim |
| Panel/fullscreen/Spaces/Finder launch and physical cameras | Prior observations retained against earlier hashes; new outside-checkout app opened; Head/desk-Palm results requested | Manual hardware pending on current artifact |
| Accessibility/native input/release under current identity | Prior successful stroke/release retained; bounded probe and safety checks pass synthetically | Current-artifact manual confirmation pending |
| External selected display/mixed-scale/negative origin | User confirms equipment available; native geometry and synthetic tests retained | Actual layout/placement/input evidence pending |
| Physical network-off camera/inference/telemetry | Current operator procedure prepared; Chromium offline emulation is not host network disconnection | Manual hardware pending |
| Required affected review | Prior review and speech failure retained; no automatic review under current instruction | Pending user scheduling |
| Speech permissions/assets/offline/10-probe p95 | Measured SpeechDetector failure retained; moved to Phase04 with future fixed targets | Deferred, not a Phase01 exit blocker |

Phase01 remains incomplete pending the nondeferred manual hardware and review gates. Phase02 not authorized. No raw camera/audio/transcript evidence retained.

### Current Head manual follow-up — 2026-10-24 16:51 America/Los_Angeles

Current nonvoice Head30second background/collapsed frame growth **passes by operator report**, MacBook Pro Camera/GPU. [Manual record](manual-hardware.md). Palm/desk-camera, external/negative-origin/mixed-scale, current native-input/panel and physical-offline outcomes plus required affected review remain pending. No overall phase pass.

2026-10-24 16:52 America/Los_Angeles: current desk-facing Palm30second collapsed/unfocused frame growth **passes by operator report**, following Head pass. [Manual record](manual-hardware.md). Desk-camera metadata/external geometry/current native input/physical offline and affected review remain pending.

2026-10-24 16:54 America/Los_Angeles: external-left selected-display panel placement/windowed/fullscreen/Spaces/no-focus-theft **passes by operator report** on current nonvoice artifact. [Manual record](manual-hardware.md). Numeric geometry/scales, native stroke/release, physical offline/equipment metadata and affected review remain pending.

2026-10-24 16:55 America/Los_Angeles: current external native-input probe **failed/unresolved**: user reports nothing happened; saved acknowledgment log remains historical with no new handshake. Accessibility/status clarification requested. [Manual record](manual-hardware.md). Native gate not passed; no coordinate/release success inferred.

2026-10-24 17:01 America/Los_Angeles: current packaged Accessibility and external-display native stroke/release **pass by explicit operator report**,supported by a new28/28accepted session. Native metadata confirms scales2/1 and external negative origin(-205,-1080). [Evidence](nonvoice-native-success-01.json). No measured300ms release claim. Physical offline camera tests,desk-camera identity/delegate and required affected review remain pending.

2026-10-24 17:06 America/Los_Angeles: **evidence correction:** user kept host online; both camera modes progress without download/network errors,each named MacBook Pro Camera/GPU. This does not establish physical offline inference or a distinct desk-facing camera/placement. Earlier desk-camera shorthand is superseded accordingly. App-scoped offline harness prepared but not run; no new pass. Required review remains pending.

## Current evidence consolidated for affected review — 2026-10-24 17:11 America/Los_Angeles

| Criterion | Current evidence and limits | Review status |
| --- | --- | --- |
| Head/Palm camera configurations | MacBook Pro Camera/GPU,head-facing and explicitly desk-facing builtin placement; same sensor,no separate external camera claim | Operator progression evidence available |
| Background/collapse | Earlier current-build online30second Head/Palm reports retained | Manual report available; no scored performance benchmark |
| App-network unavailable physical inference | Current operator report and Head/Palm positive/GPU snapshots with browserOnline=false; app-only offline harness exit0 | Evidence available; host/native OS not globally isolated |
| Offline timed intervals | Saved journal is brief; two separate30second offline intervals not established | Limitation for reviewer assessment,not a timed pass |
| External panel/input/geometry | Current manual external windowed/fullscreen/Spaces/focus and stroke/release; new28/28acks,scales2/1,external(-205,-1080) | Evidence available; no independently measured release deadline |
| Local-only resources/outbound/telemetry policy | Frozen source/asset manifest,packaged outbound-denial and offline-emulation tests; native voice download disabled | Existing automated/source evidence; no universal telemetry-absence claim |
| Build/pins/signature/source consistency | Existing checks pass; current source/helper/ASAR hashes unchanged | Automated pass retained |
| Required review | Concrete assignment/evidence prepared,no reviewer launched | Pending explicit user scheduling and disposition |

Normal app reopened;host network untouched;voice deferred;Phase02 not started. Overall phase not marked complete before affected review assesses every nondeferred gate and limitation.

## Final reviewed disposition — 2026-10-24 17:19 America/Los_Angeles

**PASS / Phase01 COMPLETE for user-amended nonvoice feasibility scope.** [Reviewer02](../reviewer-02.md) individually assesses current mandatory gates and finds sufficient evidence,with corrected nonblocking Settings-label attribution. [Final audit](reviewer-02-final-audit.json). All earlier blocked/interim rows remain history;voice is deferred/unresolved,not passed. No new application/signature/artifact changes during review.

Background current online reports and separate scoped offline physical Head11→37/Palm24→98 intervals support feasibility without a new timed benchmark. Desk-facing builtin placement is verified;separate sensor not claimed. Native external stroke/release and mixed-scale/negative-origin metadata verified. Preview/accuracy/performance/artist/clean-account/later-voice gates remain unpassed. No Phase02 or further reviewer.
