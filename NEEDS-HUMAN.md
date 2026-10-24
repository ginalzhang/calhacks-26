# Needs a human (most important first)

## 1. Confirm Desk View appears in Chrome's camera list and test the resting-hand posture on it
The team demos with macOS **Desk View** (iPhone on top of the MacBook display via Continuity Camera). **Decide:** the updated spec wants a camera picker that defaults to "Desk View", per-camera Mirror/Rotate and a calibration direction check; these were **deferred** so P0–P2 behaviour stays unchanged (see DECISIONS.md "[lead] Desktop mode (§6a) is phase P2b"). Until they are built Chrome uses its default camera (choose Desk View in Chrome's site settings › Camera). Try in this order and record the choice in DECISIONS.md:
(a) Desk View camera (or any camera looking down at the desk);
(b) laptop pushed back, lid tilted ~30° down, built-in webcam;
(c) Head mode.
If Desk View does not appear as a camera in Chrome, use the iPhone as a regular Continuity Camera on a stand looking down (same code path). Note that the preview and cursor are always mirrored today; Desk View may need Mirror off once that setting exists.

## 2. Keys
- `ANTHROPIC_API_KEY` and `CARTESIA_API_KEY` were **not** present during the overnight build. Everything that needs them runs behind a mock and the status bar says "key missing". Put both in `.env.local` (never commit) and restart `npm run dev`.


## [C] Verify voice + Claude with real keys (everything below ran only against mocks / a fake API)
1. **Cartesia token:** with `CARTESIA_API_KEY` in `.env.local`, `curl -X POST localhost:3217/api/cartesia-token` returns `{"token":"…","mock":false}`. If you get a 4xx, check the grants body (`{grants:{stt:true,tts:true},expires_in:3600}`) and the `Cartesia-Version: 2026-08-14` header in `src/voice/server/cartesia.ts`.
2. **Ink 2 socket:** press M, say "make it blue". The status should show partials and then "Heard: make it blue"; the browser console should show no "[voice] Cartesia failed". Confirm that keyterms (91, sent as repeated `keyterm=` params) are accepted, i.e. the socket does not close with 4xx/1008. If it does, try halving them in `commandKeyterms()`.
3. **Silence/cap:** wait 5 s before speaking (the mic must stay open), say a command, then stay quiet: the mic should close about 2 s later. Then hold the mic open without speaking: it should close at 15 s.
4. **Dictation:** say "note", dictate two sentences, and check that the text arrives without keyterm bias.
5. **Sonic:** "read it back" should speak in the Cartesia voice (Skylar). If it sounds like the robotic browser voice, look in the console for "[tts] Sonic failed" (possible causes: CORS, the model id `sonic-3.6`, or the voice id).
6. **Turbopack + cartesia-js:** the SDK's TTS module contains a `try { require('ws') } catch {}`. Confirm that the client bundle compiles without a hard "Can't resolve 'ws'" error once B imports `src/voice/tts.ts` (it is dynamically imported).
7. **Claude command:** with `ANTHROPIC_API_KEY`, type "make the last thing look like a ball" and expect `shape.circle` with `mock:false` in about 1 s. The server log must not show "[claude] 400 with enum-restored schema" (if it does, the fallback works but log it in DECISIONS). Also check that `thinking: {type:"disabled"}` + `effort: "low"` is accepted by `claude-haiku-5-5`.
8. **Claude cleanup:** "turn my writing into text" on a real scribble should return text in under 15 s (Sonnet 5.5, effort low), and "clean this up" / "label this" should return shapes / labels (effort medium).

## [D] Verify on a real webcam first thing in the morning
Overnight, P0 was checked only with synthesised landmarks (ReplaySource) and Playwright, never on a real camera. Run `npm run dev`, open desktop Chrome, start a timer, and tick each item:
- [ ] 1. **Cursor within 60 s:** within 60 s of `npm run dev` you can see your fingertip cursor following a hand that rests on the desk.
- [ ] 2. **Hold still to start drawing:** holding the fingertip still (about 1 s) puts the pen down (ring fills, canvas border turns coloured), with no stray ink while resting.
- [ ] 3. **Draw a legible word:** writing a short word (e.g. "hi") slowly gives a readable stroke.
- [ ] 4. **Hold still to stop:** holding still again (about 1.5 s) lifts the pen, and slow deliberate drawing never lifts it by accident.
- [ ] 5. **Backspace undoes and a PNG downloads:** Backspace removes the last stroke; "Save PNG" (or typed "export picture") downloads a PNG that opens.
- [ ] 6. **Steadiness slider visibly changes the result:** the same shaky word at Steadiness 0 vs 100 looks clearly different (try it with Simulate tremor on).

## [D] Record the 5 s hand.y4m clip for the fake-camera test
`e2e/fake-camera.spec.ts` skips until `e2e/assets/hand.y4m` exists. A synthetic clip would contain no real hand for MediaPipe to detect, so none was generated. Record 5 s of a resting hand moving slowly, at 640×480 and 30 fps, e.g. `ffmpeg -f avfoundation -framerate 30 -video_size 640x480 -i "0" -t 5 -pix_fmt yuv420p e2e/assets/hand.y4m` (install ffmpeg first), then run `npx playwright test --project=fake-camera`.

## [D] Fill the README/pitch slots
- The interview quote (`docs/user-interview.md` › The quote) goes into README › Who it's for, `docs/pitch.md` and the first demo screen.
- README › Where Claude is used: real logged counts from the Demo panel and two failure examples with screenshots (`docs/img/claude-failure-1.png`, `-2.png`).

### [A] Pipeline checks on a real webcam
- Beta was tuned to 0.01 on synthetic signals at gain 3 (see DECISIONS "[A] One Euro acceptance interpretation"). On a real hand, check that slow writing doesn't feel laggy and that a resting hand doesn't jitter; at high calibrated gains (6–10×) fast strokes lag more because beta acts on camera px/s.
- Check that the calibration's left/right hand detection is right (MediaPipe handedness is swapped for the unmirrored frame; we invert it).

## [B] App checks only a human can do
- **Camera permission + model load:** open `http://localhost:3217/` in desktop Chrome; the preview should show your (mirrored) camera within a few seconds and the dot turn green when your hand is visible. If the status says the model could not load, the jsDelivr/Google storage URLs are blocked on this network.
- **Earcons:** after the first click or key press, pen down/up should give two distinct clicks (Settings › Click sounds turns them off). Nothing is ever spoken on pen toggles.
- **Web Speech mic:** without a Cartesia key, press M and say "blue"; Chrome asks for microphone permission once and the status should show "Heard: blue". Then try "note", speak a sentence, press Enter: the text should appear on the page and the box becomes editable.
- **Screen reader spot check (VoiceOver: Cmd+F5):** routine updates are read politely, "Tracking lost: …" is read immediately, the confirm dialog announces its title and lands on "✗ No, cancel".
- **Settings panel scrolls** on small screens (sliders only; every action in it also has a tile or voice phrase elsewhere). Check it is acceptable at 200 % zoom.

## [E] Desktop mode (Krita) checks: only a human can do these
1. **Permissions:** run `npm run helper` in Terminal (or iTerm / VS Code). Grant **Accessibility** (moves/clicks the mouse, sends keys) and **Input Monitoring** (F8/F9 hotkeys) to *that terminal app* in System Settings › Privacy & Security, then Ctrl-C and run `npm run helper` again. The start-up lines must no longer say "PERMISSION NEEDED". (When testing against the agents' dev server: `STEADY_ORIGIN=http://localhost:3217 npm run helper`.)
2. **Install Krita** (krita.org) and set its brush smoothing to **None** (Tool Options docker of the Freehand Brush tool › Brush Smoothing: None). Steady already smooths; double smoothing adds lag.
3. **Window layout:** put Chrome (Steady's narrow Desktop panel) **beside** Krita, not behind it. A fully covered Chrome window stops the camera loop (then the button is released and nothing paints). `npm run demo-chrome` starts Chrome with background throttling off as a fallback; grant camera + mic once in that profile.
4. **F-keys on a Mac laptop:** F8/F9 may be media keys. Either hold `fn`, or turn on System Settings › Keyboard › Keyboard Shortcuts › Function Keys › "Use F1, F2, etc. keys as standard function keys". Check that F8 toggles the pen and F9 pauses while Krita has focus.
5. **Real Krita test (the §6a acceptance test):**
   - Turn on Desktop mode; the panel says Helper: Connected. Set drawing area: hold still on the top-left then the bottom-right corner of the Krita canvas (or press F8 at each).
   - Hold still inside the area: the pen goes down; paint 3 strokes, hold still to lift. Strokes appear in Krita with no extra lag and no line between strokes.
   - Move outside the area and hold still on a Krita tool or menu: exactly one click; holding longer does not click again.
   - Say "undo" (and tap the Undo tile): the last Krita stroke disappears. Say "eraser": Krita switches to eraser mode; paint over a stroke; say "eraser" again to switch back. Try Bigger / Smaller / Save tiles.
   - Pen down and painting, then hide your hand (or cover the camera): within ~0.3 s the stroke stops and **the mouse button is released** (click elsewhere in Krita to confirm nothing is still held). Same with F9 (pause), with Ctrl-C in the helper terminal, and with closing the Steady tab mid-stroke.
   - Turn Desktop mode off: the button is released and the normal canvas returns.
6. If the pointer moves but Krita does not paint, Krita may not accept synthetic drags: note it and try another app (e.g. Preview's markup or Figma) to separate helper vs. Krita issues.

## [D] Desktop mode: demo and docs follow-ups
- [ ] Re-record the 90 s fallback video so it includes demo step (3b): Desktop mode on, two or three strokes in Krita beside Chrome, "undo", "eraser", Exit Desktop mode.
- [ ] On the demo laptop, before judging: start Chrome with `npm run demo-chrome`, set the Krita drawing area once (it is remembered), then turn Desktop mode off again. The demo script's checklist (step 5) assumes this.
- [ ] README › "Desktop mode" was written from the code, the helper's unit tests and a `--dry-run` run, not from painting in real Krita. After the first real Krita run (E's checklist above), correct anything that differs, e.g. if Krita does not accept synthetic drags or a permission name is different.
