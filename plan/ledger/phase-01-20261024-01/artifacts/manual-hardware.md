# Manual hardware evidence — Phase 01

Date:2026-10-24 America/Los_Angeles. Operator is the user; role (developer/intended-use artist) and camera/display equipment names not yet supplied. Known environment from automated system inspection: Apple M5 MacBook Pro/Mac17,2/16GB, macOS26.7.1/25G241, Krita5.3.4/org.krita. Do not infer unspecified equipment/configuration.

## Interim artifact01

Artifact/configuration: [operator-build-01.md](operator-build-01.md), fake default native backend, mic off, app copied outside checkout. Final reviewed build changes require affected rechecks; this record preserves the actual interim outcomes.

- **Manual hardware, observed launch failure:** User did not see app after tool `open -n` returned0. A subsequent env-unset direct app launch became visible. User: “It just opened” and “Panel is visible now”. Finder launch not verified.
- **Manual hardware, pass by operator report:** User: “It does stay above Krita across windowed and fullscreen mode and across spaces without taking focus”. This supports windowed/fullscreen/Spaces z-order and focus behavior on the operator's unspecified current display.
- **Manual hardware, pass by operator report:** User: “Steady does stay up on top of Krita between windowed and full screen. and when I click x it does close.” App closed before review's final e2e to release global bindings.
- **Manual hardware, unresolved:** User reports camera frame count stays0. Whether Start camera probe was pressed, camera permission result, selected mode/device and exact status/error have not been established. User asked how to reopen app after × quit. Do not label this a MediaPipe initialization failure or a passing camera check. Final app will be reopened for an explicit step-by-step camera retry.
- **Not run:** collapse30s/unfocused frame growth, both physical tracking modes, external/mixed-scale/negative-origin layouts, actual native movement/down/up/emergency release, packaged TCC permission findings, offline speech and ten timings. Mic/live native probes explicitly held off during interim artifact use.

## Fixed speech gate

[Official detector limitation](speech-feasibility-blocker.md) prevents a supported claim for the required speech-boundary/timing behavior. No raw camera/audio/transcript evidence retained; no p95 result invented. This remains an overall phase blocker independent of the limited panel successes above.

## Reviewed artifact02 — 2026-10-24 America/Los_Angeles

- Source from the same single reviewer session resumed after usage-limit interruption, not a replacement. Reviewer packaged fake-camera check passes through actual Settings Start→panel capture→model results, continued while collapsed and successful Stop. This is synthetic camera evidence only.
- Refreshed copy `/private/tmp/steady-phase01-20261024-01/reviewed/Steady.app`, ditto exit0, deep/strict codesign verify exit0. ZIP SHA256 reported by reviewer `4acf621796a00027c77c6384225e5ceb7777838fa2faf31210ac161b468fd469`; final checksum artifact pending reviewer closure.
- `env -u ELECTRON_RUN_AS_NODE open -n <reviewed app>` exit0; targeted process check confirms reviewed executable running. This LaunchServices launch succeeded with the inherited Node-mode variable removed. No development server or terminal-launched helper.
- **Manual hardware, pass by operator report:** user explicitly guided through Settings→Head→Start camera probe; response: “Frames are increasing”. Confirms actual camera/probe frame progression after explicit Start. Camera name, delegate, permission prompt details and operator role remain unspecified. Earlier zero was not established as an initialization defect and must not be treated as one.
- **Pending manual:** asked for Head count increase after30s with Settings closed/panel collapsed/Krita foreground, Palm Start/count, camera/display names and operator role. Live native and microphone remain off; no implied hardware pass beyond the reported head-camera progression.

### Camera/background follow-up

- **Manual hardware, pass by operator report:** in response to the Head collapsed/unfocused30s procedure, user said: “Yes, the count increased.” This supports continuing real capture/inference with Settings closed, panel collapsed and Krita foreground on the reviewed artifact.
- Operator identifies as a **developer**, not an intended-use artist. Equipment: MacBook Pro built-in camera and integrated display, nothing else attached. Exact camera model/display ID/scale/delegate not supplied. Artist testing is planned later; no accessibility-effectiveness claim made.
- The reply did not distinguish Palm from Head; asked explicitly whether Palm also progressed. No external camera/display, mixed-scale or negative-origin hardware evidence exists.
- User was given the final reviewed UI-only bounded native procedure: disposable Krita document, operator-granted Accessibility, explicit confirmation checkbox, five-second switch to Krita, tiny stroke/release, F9/emergency cancellation. No agent invokes real input. Awaiting actual permission/movement/release result. Microphone remains off and no speech trial performed.

### Palm and initial native-probe result

- **Manual hardware, pass by operator report:** user explicitly confirms: “Yes, the palm mode also produced increasing frames.” Built-in MacBook Pro camera; no dedicated desk camera attached. No physical tracking update-rate/latency target measured.
- **Manual hardware, failed/unresolved:** user reports: “For testing the bounded native probe, nothing happened.” No movement/down/up success or release claim. Asked for current Accessibility Granted/Not granted and status/error after countdown; permission/foreground/confirmation guard cause not yet determined.
- Read-only evidence check finds no native-probe acknowledgment file under either Steady/steady application-data evidence directory. This is consistent with a pre-handshake rejection but does not identify the cause. Confirmed installed Krita bundle ID is org.krita. No agent invokes actual input or changes permissions.

### Native permission and successful supervised probe

- User located the Accessibility row and reported **Not granted**. This explains the initial guard rejection; no unsupported native-input assumption is inferred from that first attempt. Assisted the user with the reviewed app path and opened macOS Accessibility settings only; user manually granted access. No agent toggled/granted TCC permissions.
- **Manual hardware, pass by operator report:** after permission setup and disposable-document/confirmation procedure, user reports: “Stroke occurred and released”. This confirms actual packaged native movement/stroke/release on the integrated display. Release deadline was not independently measured with hardware timestamps; do not claim a measured300ms result.
- [Sanitized native acknowledgment summary](native-operator-summary.json) retains one successful probe with28 acknowledgments, all28 accepted, no rejection codes, HOVER/DRAWING transitions and native timestamps. Reported packaged native permission state: accessibility=true,camera=authorized,microphone=notDetermined,speech=notDetermined. The two differently cased userData paths refer to the same case-insensitive filesystem location, not two independent trials.
- The parent invokes the packaged `--release-and-exit --real-input` fallback on probe completion; default/fake entry was independently tested against the signed app. No isolated real-fallback-only release latency measurement performed.
- Overall manual results available: developer/built-in MacBook Pro camera+display; both Head and Palm frame growth; Head after30s collapsed/unfocused; interim windowed/fullscreen/Spaces z-order/focus; × quit; final packaged Accessibility+camera permission operation and native tiny stroke/release. Remaining: external/desk-camera/mixed-scale/negative-origin equipment, physical offline telemetry/inference and mic/speech/offline timing, plus intended-use artist trial (later phase). Official speech assumption remains unresolved, no p95 available.

## Speech continuation — permission repair and live counter trial

- Apple en-US speech assets installed explicitly; user reports ready. First microphone request crashed in an incorrectly actor-isolated speech-authorization callback before audio started; preserved as inconclusive history, then repaired/rechecked in the same reviewer session. [Crash summary](speech-experiment-01-crash-summary.json).
- Permission-repaired app: `/private/tmp/steady-phase01-20261024-01/speech-permission-fix/Steady.app`, ZIP SHA256586ade07a45cf215c01314e2dad83976b1dd547fb41124a57c14a69f47430715. This and the preceding diagnostic build changed native internals; prior camera/native-input observations remain tied to their earlier artifact rather than blanket hardware acceptance for this build.
- **Manual hardware, healthy pipeline:** operator explicitly enabled mic/allowed permissions and reports listening/audio increases; completed the prescribed3 phrases and silence intervals, then disabled microphone. Journal ends stopped.27 final transcription spans/135.8audioSeconds/1,358buffers, no errors.
- **Manual hardware, failed fixed detector assumption:** public detector results, speech/silence events and accepted commands all0 throughout this positive-control trial. No word correctness/transcript or perceived-delay claim. [Counters](speech-experiment-01-counters.jsonl), [structured result](speech-experiment-01-result.json), [full experiment](speech-experiment-01.md).
- Microphone/speech permission path and asset setup now operate, but offline operation was not verified and no detector speech-end timestamp exists. Ten-probe timing/p95 remains not run/unavailable. No recording or transcript persisted. User's microphone-off report corroborated by stopped counters. Overall phase remains blocked on the boundary requirement and missing external/offline gates; no architecture substitution or Phase02.

## Voice deferral continuation — equipment availability,2026-10-24 America/Los_Angeles

User explicitly deferred voice; [effective scope](voice-deferral-01.md), [current procedure](operator-procedure-nonvoice-01.md). Prior speech failure remains historical and unresolved for Phase04, not a current Phase01 exit blocker. Asked about desk-facing camera/external display availability; user replied **“I have both, can you please explain why an external display is required?”** Explained this validates selected-display mapping/panel placement under mixed scaling and negative origins; built-in-only operation remains supported. Availability confirmed, not test completion; device names/layout/current-artifact results remain unreported. No new hardware gate claimed.

## Current nonvoice camera checkpoint — 2026-10-24 16:51 America/Los_Angeles

Operator replied to the current-build hardware request: **“Macbook Pro Camera to GPU. I'm not sure what you mean by "results"”**. This confirms reported camera name **MacBook Pro Camera** and delegate **GPU** in the current nonvoice-app context. It does not establish which mode was selected, completed30second background/collapse frame progression, desk-camera Palm, or offline operation. No voice-deferred/microphone-off visual confirmation inferred from this partial answer.

Clarified that the requested outcome is simply whether the processed frame count grows with Settings closed, panel collapsed and Krita foreground for30seconds. Asked only the Head count-growth question first; Palm/desk-camera and other hardware gates remain pending. No source/binary/test changes, no reviewer or Phase02.

## Current nonvoice Head background result — 2026-10-24 16:51 America/Los_Angeles

**Manual hardware, pass by operator report:** answering the explicit Head-mode30second Settings-closed/panel-collapsed/Krita-foreground procedure, user reports **“Yes, the count increased”**. Together with the prior current-build setup reply, this supports Head capture/inference progression on **MacBook Pro Camera / GPU** in the nonvoice operator app `/private/tmp/steady-phase01-20261024-01/nonvoice/Steady.app` (ZIP `a7c5547a48efbce896bf9f74bbd56704d91987f2fb788b370a1d29a047ac5aee`). This is qualitative progression, not a measured update rate, latency, tracking accuracy, physical offline test or accessibility-effectiveness result. No images retained.

Next requested the same30second check in Palm mode with the desk-facing camera. Its outcome/device identity remain pending, as do external-display/physical-offline/native-input and required affected review gates. No app/source/checksum changes or reviewer/Phase02.

## Current nonvoice Palm desk-camera background result — 2026-10-24 16:52 America/Los_Angeles

**Manual hardware, pass by operator report:** answering the explicit Palm/desk-facing-camera30second Settings-closed/panel-collapsed/Krita-foreground procedure, user reports **“Yes, the desk-camera count increased”**. This supports physical Palm probe background progression on the current nonvoice app (ZIP `a7c5547a48efbce896bf9f74bbd56704d91987f2fb788b370a1d29a047ac5aee`). Exact desk-camera name/delegate/format not yet reported; do not transfer the earlier MacBook Pro Camera/GPU identification to this separate device. No throughput/latency/accuracy/offline claim or raw frames retained.

Next requested external display arranged left of built-in, selected via Native status/Display, with windowed/fullscreen/Spaces panel visibility/placement and no keyboard-focus theft. Outcome and display identity/scaling/native geometry pending. Current-artifact native input/release, physical offline inference, equipment metadata and required affected review remain outstanding. No app/source/hash changes, reviewer or Phase02.

## Current nonvoice external-display panel result — 2026-10-24 16:54 America/Los_Angeles

**Manual hardware, pass by operator report:** answering the explicit procedure to connect an external display, arrange it left of the built-in screen, select it in Steady Native status/Display, and move Krita there, user reports **“Yes, all of those work”** for panel placement on that display, above windowed/fullscreen Krita, across Spaces and without keyboard-focus theft. Current nonvoice artifact ZIP `a7c5547a48efbce896bf9f74bbd56704d91987f2fb788b370a1d29a047ac5aee`. This supports the requested left-of-built-in arrangement/selection and qualitative panel/focus behavior; exact display name, native bounds/origin/scale and mixed-scale configuration are not yet supplied. Do not infer numeric geometry, a verified scale difference, native stroke-coordinate correctness or offline behavior from panel success.

Next requested the existing explicit bounded real-input probe on the selected external display: disposable Krita document, physical pointer inside canvas with clear room right, confirmation checkbox, five-second switch to Krita, tiny stroke and release; F9/Emergency release if needed. Prior current-artifact fake watchdog/EOF/process checks already pass. Operator outcome pending; agents do not invoke real input. No source/binary/checksum changes, reviewer or Phase02.

## Current nonvoice external native probe — no movement, 2026-10-24 16:55 America/Los_Angeles

**Manual hardware, failed/unresolved:** operator reports **“Nothing happened”** for the requested bounded real-input probe on the selected external display. No current native movement/down/up/release pass is claimed. Asked Accessibility Granted/Not granted and the status/error after countdown before retrying.

Read-only numeric journal check finds only the historical28accepted acknowledgments, source modified2026-10-24T15:15:15-07:00, SHA256 `684c0c6b4e10a970d4981acd6f5953b21ad46881326f5d22c0b3a5578f53e8ae`, unchanged by this attempt. [Observation02](nonvoice-native-probe-observation-02.json). Case-varied Steady/steady paths resolve to the same inode and count as one source. No new native handshake evidence exists in this journal. This is consistent with an early probe guard rejection/startup issue, not proof of its cause or a coordinate-mapping failure. The helper requires confirmation,Krita foreground,Accessibility and selected display before emitting its first acknowledgment; parent currently discards native probe stderr, so the saved log cannot identify the guard. Historical display geometry in [observation01](nonvoice-native-probe-observation-01.json) is explicitly labeled old, not current-layout evidence.

No automatic real input, TCC change, source/binary/hash change, reviewer or Phase02. Current native gate remains unresolved; permission/status clarification pending.

## Native permission clarification and requested reopen — 2026-10-24 16:57 America/Los_Angeles

Operator reports the status **“Native probe exited (0); inspect disposable document and record movement/release.”** and Accessibility **Not granted**, then requests app reopen. Exit0 is process completion, not action acceptance; the reported missing permission is an unmet probe prerequisite. Operator subsequently clarifies **“I already granted access in macos accessibility for Steady.”** Preserve both observations: OS setting reportedly granted, prior helper/UI reported not granted; post-reopen status is pending, not yet established.

Verified current nonvoice helper against recorded SHA256 `d5fe938295f52209f58f97fe3c69770fb853b41620f327c6002480ba010c9ef6`. Requested exact app `/private/tmp/steady-phase01-20261024-01/nonvoice/Steady.app` reopened through LaunchServices with inherited Node mode unset (exit0); exact current-app process found afterward. No matching current-copy main process existed at the initial check, so none was terminated. Opened macOS Accessibility pane (exit0) for operator navigation only; tools did not grant/toggle permission or run real input/microphone. [Reopen record](nonvoice-reopen-01.json).

Asked whether the reopened app now reports Accessibility Granted. No native retry or successful stroke/release claimed yet. Sources/artifact hashes unchanged; nondeferred native/offline/geometry metadata/review gates remain, no reviewer or Phase02.

## Accessibility mismatch after reopen — 2026-10-24 16:59 America/Los_Angeles

Operator reports **“Not granted, but under apple system settings, for accessibility, Steady has permissions.”** Treat this as a real mismatch between the visible OS setting and the current helper trust report, not user failure to grant permission. No native success claimed.

Read-only [process identity](nonvoice-accessibility-processes-01.json) confirms current app and its SteadyNative child both run from the nonvoice operator path. [Signing comparison](nonvoice-accessibility-signing-01.json) confirms all three retained builds have different cdhash-based designated requirements for app and native helper; current app requirement `ac4d8f8da48dc0914c5845db20ab203bd0ccf7f4`, current helper `932c133aa5d919b27b5a0d6a1b60be3380c1c14c`. Apple [TN3127](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements) documents ad-hoc identity being tied to a specific code version; [Accessibility help](https://support.apple.com/guide/mac-help/allow-accessibility-apps-to-access-your-mac-mh43185/mac) documents operator-managed app access/addition. **Inference:** stale permission identity for an earlier same-named build is a likely explanation. No TCC database inspected, so the exact stored entry/attribution is not proven.

Closed only exact current app by SIGTERM, revealed its bundle in Finder, opened Accessibility pane; [preparation record](nonvoice-accessibility-recovery-01.json). Tools did not reset/read/write TCC, toggle permission, change signing/source, or execute real input. Requested manual replacement of the Steady Accessibility entry with `/private/tmp/steady-phase01-20261024-01/nonvoice/Steady.app`, enable, relaunch and report current Granted/Not granted status. Response pending before native retry. No source/build/hash changes, reviewer or Phase02.

## Current nonvoice external native probe succeeds after entry replacement — 2026-10-24 17:01 America/Los_Angeles

**Manual hardware, pass by operator report with numeric acknowledgments:** user reports **“Granted and i just tested the bounded real input probe and it worked”** after manually replacing the app-specific Accessibility entry with the exact current copy and relaunching. Explicit follow-up confirms **“Stroke and release on external”**. Thus current packaged Accessibility and bounded real external-display movement/down/release are supported. No tool granted permissions or triggered the real probe.

[Current numeric evidence](nonvoice-native-success-01.json) contains one new session `655A9CDC-0F12-4854-BC22-2AE8BE3D6A68` with28/28accepted acknowledgments,no rejection codes,PAUSED/HOVER/DRAWING and buttonDown=true observations; Accessibility=true,camera=authorized,microphone/speech=notDetermined. Source modified16:59:42-07:00,after current trial; older session remains historical. Native current display geometry: built-inID1,1512x982 at(0,0),scale2; externalID4,1920x1080 at(-205,-1080),scale1. This independently records mixed-scale and negative-origin geometry, more precise than the earlier requested “left” description. Selected external stroke/release is established by the operator follow-up. Release deadline was not independently measured; do not claim a measured300ms result or a coordinate-error distribution.

Specific-entry replacement resolved the current trust mismatch. This is consistent with the measured changed ad-hoc identities; the exact old stored TCC attribution was not read. Prior failed attempts and permission mismatch remain preserved. Current app/ZIP/helper unchanged.

Next requested operator-disconnected network,Finder relaunch,Head and desk-Palm30second collapsed/unfocused frame growth without network/download failures,then network restoration before replying; also desk-camera menu name/delegate. Physical offline outcomes/device identity and required affected review pending. No voice work, reviewer or Phase02.

## Network-connected camera follow-up and device correction — 2026-10-24 17:06 America/Los_Angeles

User declined disconnecting the computer: **“I don't need to disconnect my computer from network. Also, that would mean chatgpt would stop. BUt both worked without download prompt or network error; both numbers increased.”** Treat both modes as qualitative successful camera progression with host network connected. No physical offline pass or waiver of offline capability is inferred. Tools did not change host networking.

User identifies the supposed desk-camera test device as **“Macbook Pro Camera, show GPU.”** This supersedes any implication in earlier “desk-camera count increased” shorthand that a separate desk-facing camera was verified. Both reported modes name MacBook Pro Camera/GPU; actual desk-facing placement or distinct external-camera use is not established. Preserve earlier reports but narrow their interpretation accordingly.

Prepared [operator-only app-scoped offline harness](app-offline-hardware-01.mjs),syntax check exit0; it would launch the same signed app with no fake devices,no automatic camera/microphone/input actions,and Chromium offline emulation while host/ChatGPT stay connected. **Harness not launched**; no new camera/offline outcome exists. User asks why offline testing is needed; explained original local/offline tracking requirement and difference between automated local-model/network-blocking evidence and physical-camera evidence. No further hardware action initiated while clarifying. App binaries/signature/pins unchanged; source changes limited to development-only evidence harness,not application implementation.

## App-scoped offline physical-camera trial started — 2026-10-24 17:09 America/Los_Angeles

After explanation of the prepared app-only offline method,user directs **“Continue with Phase 1”**. Closed only the current nonvoice copy and relaunched the exact same signed executable through installed Playwright,with no fake-device flags,no camera/input/microphone activation,and unchanged host networking/permissions/app bits. Waited for native clock readiness and verified fake output/mic off; set the browser context offline and verified `navigator.onLine=false`. Opened Settings only; operator must click Start. New Settings window also reports browserOnline=false. [Harness](app-offline-hardware-01.mjs),[live numeric evidence](app-offline-hardware-01-result.json),[log](app-offline-hardware-01.log).

Requested operator Head and Palm30second collapsed/unfocused count growth in this specific session without network/download errors,and clarified actual Palm camera placement/device. No current offline result or distinct desk-facing setup claimed yet. Host/ChatGPT stay connected. The scope is Chromium network deprivation plus existing app outbound-denial/native-source checks; no host-wide disconnection or blanket native-network isolation claim. An8minute test bound and operator finish marker control cleanup. No app build/signature/pin changes,voice work,reviewer or Phase02.

## App-only offline physical-camera outcome and desk placement — 2026-10-24 17:11 America/Los_Angeles

**Manual hardware with bounded numeric observations:** in the specifically launched browser-offline session,user reports **“Both increased without errors”** and identifies Palm placement as **“Built-in aimed at desk”**. Thus the same MacBook Pro Camera/GPU was used in head-facing and desk-facing configurations. This establishes the requested desk-facing placement,not a separate external camera device; prior shorthand is corrected without claiming two sensors.

[Trial summary](app-offline-hardware-01-summary.json),[raw numeric observations](app-offline-hardware-01-result.json) show browserOnline=false in every captured Head/Palm settings snapshot; positive Head counts up to209,Palm up to98,GPU for both. Harness exit0,no error; final microphoneEnabled=false,realInput=false,nativeClockReady=true. App browser networking was offline while host/ChatGPT stayed connected. This supports physical camera/model progression with application browser networking unavailable,combined with existing local asset/hash/outbound-denial/native-source checks. It is not host-wide or native OS network isolation or a claim that every possible telemetry attempt was independently observed. No frames/audio/transcripts stored.

**Timing limitation:** the numeric journal captures short mode transitions and does not corroborate two separate30second offline background intervals. Keep the operator's successful progression report and earlier online30second background reports as separate evidence; do not score a new timed offline throughput/latency/background benchmark. Affected review must assess this coverage rather than treating absent timings as zero/passing.

Created the managed finish marker,awaited clean harness exit,verified signed operator helper/ASAR hashes unchanged,and reopened normal app through LaunchServices(exit0). Host networking and permissions untouched. No app source,pin,signature or binary changes. Review preparation updated; no reviewer launched,resumed or Phase02.

## No visible camera preview — 2026-10-24 17:12 America/Los_Angeles

User reports **“By the way, I'm not seeing my camera when I'm doing these tests, just to let you know.”** Read-only source inspection confirms current CameraProbe creates a video element in memory but never mounts it in the DOM; Settings/panel render frame counts/status/delegate only. This explains absence of a live camera image. No preview feature is implemented or newly requested here.

Frame progression supports capture/inference pipeline liveness (fresh video-frame progression,bitmap submission and worker sample reports); it does not establish that face/hand is framed correctly or that tracking accuracy meets later-phase targets. No blanket visual-tracking correctness claim is added. Offline harness used no fake-device flags and operator manually started capture. Current source/app/hash unchanged; report retained for affected review. No reviewer or Phase02.

## Reviewer02 offline mode-attribution correction — 2026-10-24 17:16 America/Los_Angeles

Reviewer found that the offline harness reads Settings mode selector rather than worker active-model identity. Settings remount defaults that selector to Head even while panel may retain Palm. Therefore the late Head-labelled183/209 rows do **not** establish active Head counts;previous up-to209 Head wording is superseded. [Corrected derivative summary](app-offline-hardware-01-summary.json) retains the original UI-label grouping and immutable raw journal,and uses only initial pre-remount Head11→37 and Palm24→50→78→98 intervals for model-specific progression. All these rows browserOnline=false/GPU. No timed benchmark or30second interval claim. No product/runtime/test source change or rebuild required for this evidence correction.
