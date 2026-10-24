# Needs a human (one ordered list, most important first)

Everything below was built and tested overnight without a real camera, microphone, API keys, Krita or a screen reader. Work top to bottom. The `[A]`–`[E]` tags show which agent wrote the detail (see DECISIONS.md for context).

## 1. Desk View / posture, and the deferred camera-picker decision
- **Confirm Desk View appears in Chrome's camera list and test the resting-hand posture on it.** The team demos with macOS **Desk View** (iPhone on top of the MacBook display via Continuity Camera).
- **Decide:** the updated spec wants a camera picker that defaults to "Desk View", per-camera Mirror/Rotate and a calibration direction check. These were **deferred** so P0–P2 behaviour stays unchanged (see DECISIONS.md "[lead] Desktop mode (§6a) is phase P2b"). Until they are built, Chrome uses its default camera: choose Desk View in Chrome's site settings › Camera.
- Try the postures in this order and record the choice in DECISIONS.md:
  - (a) Desk View camera (or any camera looking down at the desk);
  - (b) laptop pushed back, lid tilted ~30° down, built-in webcam;
  - (c) Head mode (see item 6).
- If Desk View does not appear as a camera in Chrome, use the iPhone as a regular Continuity Camera on a stand looking down (same code path).
- The preview and cursor are always mirrored today; Desk View may need Mirror off once that setting exists.

## 2. Keys
- `ANTHROPIC_API_KEY` and `CARTESIA_API_KEY` were **not** present during the overnight build. Everything that needs them runs behind a mock, and the status bar says "key missing".
- Put both in `.env.local` (never commit it) and restart `npm run dev`. `.env.example` lists exactly these two.

## 3. P0 on a real webcam: the six-item checklist, first thing in the morning
Overnight, P0 was checked only with synthesised landmarks (ReplaySource) and Playwright, never on a real camera. Run `npm run dev`, open desktop Chrome, start a timer, and tick each item:
- [ ] 1. **Cursor within 60 s:** within 60 s of `npm run dev` you can see your fingertip cursor following a hand that rests on the desk.
- [ ] 2. **Hold still to start drawing:** holding the fingertip still (about 1 s) puts the pen down (ring fills, canvas border turns coloured), with no stray ink while resting.
- [ ] 3. **Draw a legible word:** writing a short word (e.g. "hi") slowly gives a readable stroke.
- [ ] 4. **Hold still to stop:** holding still again (about 1.5 s) lifts the pen, and slow deliberate drawing never lifts it by accident.
- [ ] 5. **Backspace undoes and a PNG downloads:** Backspace removes the last stroke; "Save PNG" (or typed "export picture") downloads a PNG that opens.
- [ ] 6. **Steadiness slider visibly changes the result:** the same shaky word at Steadiness 0 vs 100 looks clearly different (try it with Simulate tremor on).

In the same session, also check:
- **Camera permission and model load** [B]: open `http://localhost:3217/` (or `:3000`) in desktop Chrome. The preview should show your (mirrored) camera within a few seconds, and the dot should turn green when your hand is visible. Models load from `public/mediapipe/` first and fall back to the jsDelivr / Google storage CDN. If the status says the model could not load, both the local files and the CDN failed.
- **Self-hosted models offline** [B]: with the network off after the first load, the app should still start tracking (`/mediapipe/` is served by Next). If the console says "loaded from the CDN fallback", the local files were not served.
- **Filter feel** [A]: beta was tuned to 0.01 on synthetic signals at gain 3 (see DECISIONS "[A] One Euro acceptance interpretation"). On a real hand, check that slow writing doesn't feel laggy and that a resting hand doesn't jitter. At high calibrated gains (6–10×) fast strokes lag more, because beta acts on camera px/s.
- **Handedness** [A]: check that calibration detects the left/right hand correctly (MediaPipe handedness is swapped for the unmirrored frame; we invert it).
- **Earcons** [B]: after the first click or key press, pen down and pen up should give two distinct clicks (Settings › Click sounds turns them off). Nothing is ever spoken on pen toggles.

## 4. Voice and Claude with real keys
Everything here ran only against mocks or a fake API.
1. **Cartesia token** [C]: with `CARTESIA_API_KEY` in `.env.local`, `curl -X POST localhost:3217/api/cartesia-token` returns `{"token":"…","mock":false}`. If you get a 4xx, check the grants body (`{grants:{stt:true,tts:true},expires_in:3600}`) and the `Cartesia-Version: 2026-08-14` header in `src/voice/server/cartesia.ts`.
2. **Ink 2 socket** [C]: press M and say "make it blue". The status should show partials, then "Heard: make it blue"; the browser console should show no "[voice] Cartesia failed". Confirm the keyterms are accepted (91 of them, sent as repeated `keyterm=` params), i.e. the socket does not close with 4xx/1008. If it does, try halving them in `commandKeyterms()`.
3. **Silence and cap** [C]: wait 5 s before speaking (the mic must stay open), say a command, then stay quiet: the mic should close about 2 s later. Then hold the mic open without speaking: it should close at 15 s.
4. **Dictation** [C]: say "note", dictate two sentences, and check that the text arrives without keyterm bias.
5. **Sonic** [C]: "read it back" should speak in the Cartesia voice (Skylar). If it sounds like the robotic browser voice, look in the console for "[tts] Sonic failed" (possible causes: CORS, the model id `sonic-3.6`, or the voice id).
6. **Turbopack + cartesia-js** [C]: the SDK's TTS module contains a `try { require('ws') } catch {}`. Confirm the client bundle compiles without a hard "Can't resolve 'ws'" error (`src/voice/tts.ts` is dynamically imported).
7. **Claude command** [C]: with `ANTHROPIC_API_KEY`, type "make the last thing look like a ball" and expect `shape.circle` with `mock:false` in about 1 s. The server log must not show "[claude] 400 with enum-restored schema" (if it does, the fallback works, but log it in DECISIONS). Also check that `thinking: {type:"disabled"}` + `effort: "low"` is accepted by `claude-haiku-5-5`.
8. **Claude cleanup** [C]: "turn my writing into text" on a real scribble should return text in under 15 s (Sonnet 5.5, effort low). "Clean this up" and "label this" should return shapes / labels (effort medium).
9. **Web Speech fallback** [B]: without a Cartesia key, press M and say "blue". Chrome asks for microphone permission once, and the status should show "Heard: blue". Then try "note", speak a sentence and press Enter: the text should appear on the page, and the box becomes editable.
10. **Claude counts for the README** (see item 8): while testing with keys, note the Demo panel's "Claude: N calls, X accepted, Y rejected, Z timeouts", and screenshot two wrong answers.

## 5. Desktop mode (Krita): permissions and the real test
1. **Permissions** [E]: run `npm run helper` in Terminal (or iTerm / VS Code). Grant **Accessibility** (moves and clicks the mouse, sends keys) and **Input Monitoring** (F8/F9 hotkeys) to *that terminal app* in System Settings › Privacy & Security. Then Ctrl-C and run `npm run helper` again; the start-up lines must no longer say "PERMISSION NEEDED". When testing against the agents' dev server, use `STEADY_ORIGIN=http://localhost:3217 npm run helper`.
2. **Install Krita** [E] (krita.org) and set its brush smoothing to **None** (Tool Options docker of the Freehand Brush tool › Brush Smoothing: None). Steady already smooths; double smoothing adds lag.
3. **Window layout** [E]: put Chrome (Steady's narrow Desktop panel) **beside** Krita, not behind it. A fully covered Chrome window stops the camera loop (the button is then released and nothing paints). `npm run demo-chrome` starts Chrome with background throttling off as a fallback; grant camera and mic once in that profile.
4. **F-keys on a Mac laptop** [E]: F8/F9 may be media keys. Either hold `fn`, or turn on System Settings › Keyboard › Keyboard Shortcuts › Function Keys › "Use F1, F2, etc. keys as standard function keys". Check that F8 toggles the pen and F9 pauses while Krita has focus.
5. **Real Krita test** [E] (the §6a acceptance test):
   - Turn on Desktop mode; the panel says Helper: Connected. Set the drawing area: hold still on the top-left, then the bottom-right corner of the Krita canvas (or press F8 at each).
   - Hold still inside the area: the pen goes down. Paint 3 strokes, then hold still to lift. The strokes should appear in Krita with no extra lag and no line between strokes.
   - Move outside the area and hold still on a Krita tool or menu: exactly one click; holding longer does not click again.
   - Say "undo" (and tap the Undo tile): the last Krita stroke disappears. Say "eraser": Krita switches to eraser mode; paint over a stroke, then say "eraser" again to switch back. Try the Bigger / Smaller / Save tiles.
   - Pen down and painting, then hide your hand (or cover the camera): within ~0.3 s the stroke stops and **the mouse button is released** (click elsewhere in Krita to confirm nothing is still held). Repeat with F9 (pause), with Ctrl-C in the helper terminal, and with closing the Steady tab mid-stroke.
   - Turn Desktop mode off: the button is released and the normal canvas returns.
6. **If the pointer moves but Krita does not paint** [E], Krita may not accept synthetic drags. Note it, then try another app (e.g. Preview's markup or Figma) to tell helper issues apart from Krita issues.
7. **Demo laptop prep** [D]: before judging, start Chrome with `npm run demo-chrome`, set the Krita drawing area once (it is remembered), then turn Desktop mode off again. The demo script's checklist (step 5) assumes this.
8. **README check** [D]: README › "Desktop mode" was written from the code, the helper's unit tests and a `--dry-run` run, not from painting in real Krita. After the first real Krita run, correct anything that differs (e.g. if Krita does not accept synthetic drags, or a permission name is different).

## 6. Head mode and face tap on a real camera
Both were tested only on synthetic replays (landmark and blendshape fixtures).
- **Head mode** [B]: Setup › Head mode (or say "head mode"). The camera keeps running while the face model loads (a few seconds the first time). Say "calibrate", look at the middle of the screen for 3 s, then move your nose gently: the cursor should reach the canvas corners without straining. Check that gain 6× feels right and that Recenter (R) works. Watch for neck fatigue.
- **jawOpen assertion** [B]: in Head mode, the console must NOT show "[Steady] face blendshapes lack jawOpen". If it does, Face tap stays disabled.
- **Face tap** [B]: Settings › Face tap, then open your mouth comfortably twice during the 6 s check. Afterwards one open-and-close should toggle the pen, and holding the mouth open should not. Talking with the mic open (M) must never toggle it. Also try the eyebrow option. Check the frame rate in Hand mode with Face tap on (the face model runs on every other frame).
- **Break reminders** [B]: they are timed at 10 min of tracking in Head mode and 15 min in Hand mode. Check once that the reminder appears, doesn't block anything, is dismissed by the next action, and can be turned off in Settings.
- [lead] The setup screen's "Head mode" posture is now enabled: Start switches to face tracking and runs the 3 s neutral step (verified on a replay only). Check it on the real camera.

## 7. Record the 5 s `hand.y4m` clip for the fake-camera test
`e2e/fake-camera.spec.ts` is skipped until `e2e/assets/hand.y4m` exists. A synthetic clip would contain no real hand for MediaPipe to detect, so none was generated.
- Record 5 s of a resting hand moving slowly, at 640×480 and 30 fps, e.g. `ffmpeg -f avfoundation -framerate 30 -video_size 640x480 -i "0" -t 5 -pix_fmt yuv420p e2e/assets/hand.y4m` (install ffmpeg first).
- Then run `npx playwright test --project=fake-camera`.

## 8. The interview quote and the README TODO slots
- Run the interview in `docs/user-interview.md` (consent line, five questions). The one real sentence goes into `docs/user-interview.md` › The quote, README › Who it's for, `docs/pitch.md` (the quote slot) and the first demo screen (which shows the placeholder until then).
- README › "Where Claude is used and where it goes wrong": the logged counts from the Demo panel (item 4.10) and two failure examples with screenshots (`docs/img/claude-failure-1.png`, `-2.png`).

## 9. Accessibility checks
- **Screen reader spot check** [B] (VoiceOver: Cmd+F5): routine updates are read politely, "Tracking lost: …" is read immediately, and the confirm dialog announces its title and lands on "✗ No, cancel".
- **Settings, Help and Advanced at 200 % zoom** [B]: at 1280×800 they are paginated and never scroll. At 200 % zoom the layout stacks and the page reflows; check that this is acceptable (every action in them also has a tile or voice phrase elsewhere).

## 10. Dev server stylesheet
- [B] After restarting `npm run dev` once, check the app still looks like `.context/screens/L-1280x800-demo.png`. The running server was serving an older build of `src/app/globals.css`; the round-2 rules are in `src/components/layout.css`.

## 11. Demo-day prep
- [D] Re-record the 90 s fallback video of the full demo script (`docs/demo-script.md`), including step (3b): Desktop mode on, two or three strokes in Krita beside Chrome, "undo", "eraser", Exit Desktop mode.
- Run the demo once under the judging table's lighting (spec §10).
