# Steady

Draw and take notes without holding a pen. Steady is a browser app that turns a webcam and your voice into a pen: a hand resting on the desk moves the cursor, holding still puts the pen down and lifts it, a tremor-aware filter smooths the line, and every action is also a big tile, a voice phrase, a typed command and (for the core nine) a single key.

Built in 36 hours at Cal Hacks 13.0. Desktop Chrome on `localhost`.

## Who it's for

Students and adults with arthritis or essential tremor who still want to sketch diagrams and take their own notes. More broadly: anyone for whom gripping a pen, stylus or mouse hurts or is unreliable, including people with hand osteoarthritis or rheumatoid arthritis (especially at the base of the thumb), carpal tunnel syndrome, repetitive strain injury, Parkinson's or mild cerebral palsy.

The design rules come from that group's needs: no pinch, no grip, no thumb-to-finger touch, no hovering hand; a wrist that rests on the desk; small movements scaled up; nothing that is voice-only or dwell-only; no time limits; undo that is one action and never timed.

> **TODO (team): the interview quote goes here.** One sentence, no name, from the person interviewed with `docs/user-interview.md`. Until then the app shows the placeholder from that file.
>
> "<quote>": a person who <one-line description of how they write or draw today, no condition named>.

## How to run

```bash
npm install
cp .env.example .env.local   # optional: add keys (see below)
npm run dev                  # http://localhost:3000 (the team's shared dev server uses -p 3217)
```

Open the page in **desktop Chrome**, allow the camera, follow the two-step setup (rest still for 3 s, then draw one slow, easy circle for 4 s), then hold your fingertip still to put the pen down.

**Environment variables** (`.env.local`, never committed; both are optional):

| Variable | Used for | Without it |
|---|---|---|
| `CARTESIA_API_KEY` | Ink 2 streaming speech-to-text and Sonic text-to-speech (server mints a short-lived token; the browser never sees the key) | Voice falls back to Chrome's Web Speech API and `speechSynthesis`; the status bar says "key missing" |
| `ANTHROPIC_API_KEY` | Claude fallback for commands the local grammar cannot match, and "turn my writing into text" | Both routes return realistic mock data (`mock: true`) and the status bar says "key missing" |

The local grammar, the typed-command box, drawing, shape cleanup, undo and export all work with no keys and no network.

**Hardware tips**

- **Camera:** a camera looking down at the desk tracks a resting hand best. The team demos with macOS **Desk View** (an iPhone on top of the MacBook display via Continuity Camera); pick it in Chrome's site settings › Camera (an in-app camera picker is not built yet). Any external webcam or phone-as-webcam on a stand looking down works the same way. Second choice: push the laptop back and tilt the lid about 30° down. Third: **Head mode** (below).
- **Rest your wrist** on the desk, a book or a rolled towel. Let your other fingers curl loosely; you don't need to point.
- **Light:** a clip lamp aimed at the desk. Dim light lowers detection confidence (more so for darker skin tones); the app warns when the frame is too dark.
- **Microphone:** a headset mic. Laptop mics in a loud hall miss commands.
- **Keys and switches:** any USB/Bluetooth switch that sends Space or Enter works as a one-switch pen toggle. If pressing two keys together is hard, turn on your operating system's **Sticky Keys** (macOS: Accessibility › Keyboard; Windows: Settings › Accessibility › Keyboard). Steady itself never needs a key combination.

**Head mode and face tap** (for when a hand can't be used or isn't visible):

- **Head mode** (tile under Setup, or say or type "head mode") moves the cursor with your nose tip instead of your hand. It has its own gain (default 6×, slider 3–10×) and its own setup: a 3 s "look at the middle of the screen and hold your head still" that sets the neutral position. "Recenter" re-measures only the neutral point. Hand mode keeps its own gain and calibration, so you can switch back and forth.
- **Face tap** ("Face tap" tile or phrase) toggles the pen with a mouth-open *tap*: open and close, never hold. It starts with a short "open your mouth comfortably twice" check that sets your own thresholds. Raising your eyebrows works as an alternative (Settings). Face tap only toggles the pen. It is ignored while the mic is open and for 500 ms afterwards, and it is never on when the page loads.
- **Break reminders:** after 10 min of tracking in Head mode, or 15 min in Hand mode, a non-blocking status line suggests a break. Your next action or pen-down dismisses it. Turn it off in Settings.
- Head mode and face tap have been **tested only on synthetic replays** (landmark and blendshape fixtures), never on a real camera.

**Zoom and move:** "zoom in", "zoom out", "fit page", "move up/down/left/right" (tiles under View) change only the view. They are not undo steps, and exports always cover the whole page at 100 %.

**Offline-capable model loading:** the MediaPipe hand and face models and the wasm runtime are served from `public/mediapipe/` (37 MB, included in the repo), so tracking starts without internet access. If the local files can't load, the app falls back to the jsDelivr / Google storage CDN automatically. Voice (Cartesia or Web Speech) and Claude still need the network; the typed box and the local grammar don't.

**Without a camera** (demos, tests): `http://localhost:3000/?source=replay&fixture=word-tremor&skipIntro=1` replays a synthesised hand. Fixtures are described in `public/fixtures/README.md`; `?demo=1` opens the Demo panel.

**Key map** (every other key does nothing; keys type normally inside text boxes):
`Space` pen toggle · `Enter` activate the focused control / Accept · `Esc` cancel · `Backspace` or `Z` undo · `Y` redo · `M` mic · `R` recenter · `P` pause tracking · `1`–`3` choose an option.

Tests: see [Tests](#tests) below.

## Desktop mode (draw in Krita and any app)

Desktop mode lets the same filtered pointer, hold-still pen, Latch, voice and safety rules drive the **real macOS mouse pointer**, so you can paint in **Krita** (our demo app), Figma, Photoshop or any other app without holding a mouse or stylus. Steady's own canvas stays the place to calibrate, practise and show the Demo panel. macOS only.

**Set up (once)**

1. **Start the helper** in a terminal and leave it open:
   ```bash
   npm run helper        # creates helper/.venv, installs pynput + websockets, starts the helper
   ```
   Add `-- --dry-run` to print mouse and key actions instead of performing them.
2. **macOS permissions**, for *the app that runs the terminal* (Terminal, iTerm, VS Code…), in System Settings › Privacy & Security:
   - **Accessibility**: to move and click the mouse and send shortcut keys.
   - **Input Monitoring**: for the global F8 / F9 hotkeys while Krita has focus.

   Quit the helper (Ctrl-C) and run `npm run helper` again after granting them. The helper prints which permission is missing, and Steady's Desktop panel shows the same text.
3. **`STEADY_ORIGIN`:** the helper only accepts the page at `http://localhost:3000`. If Steady runs anywhere else, tell it, e.g. `STEADY_ORIGIN=http://localhost:3217 npm run helper` (a comma-separated list is allowed; exact matches only).
4. **Krita:** install it from krita.org and set **brush smoothing to None** (Tool Options docker of the Freehand Brush tool › Brush Smoothing: None). Steady already smooths; smoothing twice adds lag.
5. **Window layout:** place Chrome **beside** Krita, never behind it. Chrome pauses the camera loop in a fully covered window, and then nothing paints (the button is released). As a fallback, `npm run demo-chrome` opens Chrome at `http://localhost:3000` with background throttling off (`--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling`) in a separate profile under `/tmp`; grant camera and mic once in that profile. `STEADY_URL=http://localhost:3217 npm run demo-chrome` opens another address.

**Use it**

- Turn on **Desktop mode** (tile under Setup, or say or type "desktop mode"). Steady shrinks to a narrow side panel (camera thumbnail with tracking dot, pen state, Mic, Pause, Exit Desktop mode, Undo and the Krita tool tiles) and shows "Helper: Connected". Desktop mode always starts off when the page loads.
- **Set drawing area:** hold still (or press F8) on the top-left and then the bottom-right corner of the Krita canvas. Without it, the drawing area is the whole main display. Your calibrated active box maps onto this area.
- **Inside the area,** holding still puts the pen down (the mouse button is held, so Krita paints) and holding still again lifts it, exactly as on Steady's canvas. **Outside the area,** holding still does one left click, so you can pick Krita tools and menus (turn this off with the **Dwell click** toggle). Steady never presses the button outside the area.
- **Keys:** while Krita has focus the browser gets no key presses, so the helper owns two global hotkeys: **F8 = pen toggle**, **F9 = pause tracking (and release the button)**. They can be remapped to other function keys in Settings, never to Space, letters or modifiers (Krita uses those). On a Mac laptop the F-keys may be media keys: hold **`fn`** (`fn`+F8), or turn on System Settings › Keyboard › "Use F1, F2, etc. keys as standard function keys". A USB switch can be programmed to send F8.
- **Voice and typed commands** use the same grammar. App actions become Krita shortcuts sent through the helper (Krita is brought to the front first): "undo" `cmd+z`, "redo that" `cmd+shift+z`, "free" = Brush tool `b`, "eraser" `e` (a toggle in Krita: say it again to switch back), "thick" = bigger brush `]`, "thin" = smaller brush `[`, "export picture" = save the Krita document `cmd+s`. The panel's Brush, Eraser, Bigger, Smaller and Save tiles send the same keys. Pen, pause, Latch, steadier / looser and the mic stay inside Steady. Canvas-only features (shape fits, AI cleanup, dictation, ghost view, colours, pages) say "not available in Desktop mode".

**Fail-safe rules** (the mouse button is never left held):

- The helper listens on `127.0.0.1:8765` only and rejects any page whose `Origin` is not the allowed one (otherwise any website could move your mouse). One page at a time.
- The helper releases the button if no message arrives for **300 ms** (Steady pings every 100 ms), when the connection closes or drops, on F9, and on exit, Ctrl-C, SIGTERM or any error.
- Steady releases the button on tracking loss (> 300 ms, the same rule as on the canvas), on Pause, when Desktop mode is turned off, and by itself if camera frames stop for 300 ms (for example a covered window).
- Pen-down is refused outside the drawing area, and a move that leaves the area releases the button first, so it never drags outside it.
- Before sending shortcut keys the button is released and modifiers are always released afterwards, even on error. The hotkey listener runs in a separate child process and reports only function keys; no other keystrokes are read. Nothing leaves this computer.

**What was verified:** the helper's 37 unit tests (fake mouse controller) and a `--dry-run` run against the browser bridge. Nobody has painted in real Krita yet; that is the first item in `NEEDS-HUMAN.md` › "[E] Desktop mode (Krita) checks".

## Cartesia features used

- **Ink 2 streaming speech-to-text** over a WebSocket (`/stt/websocket`, `model=ink-2`, 16 kHz PCM from an AudioWorklet in 100 ms chunks).
- **Keyterm biasing:** every voice phrase in the action table is sent as a `keyterm`, which is what makes short commands ("pen", "undo", "make it a circle") survive a noisy room.
- **Manual finalize for push-to-talk:** the mic opens only when you tap `M` or the Mic tile; on close the client sends `finalize` and reads final transcript chunks until `flush_done`. Silence before you start speaking never closes the mic.
- **Access-token flow:** `/api/cartesia-token` mints a short-lived token server-side; the browser uses the token, never the API key.
- **Sonic text-to-speech:** short confirmations you can't see at a glance ("Made it a circle"), "read it back" for the current page's text, and reading clarify options aloud. Can be turned off.

### Limitations

- Accuracy on dysarthric speech has **not been measured**. Every action also has a tile, a typed form and (for the core nine) a key, so nothing depends on speech.
- Hall noise: keyterms help, a headset mic helps more.
- Token expiry: tokens are minted for one hour (`expires_in: 3600`); a longer session needs a fresh token, and if minting fails voice falls back to Web Speech.
- English only.

## Where Claude is used and where it goes wrong

Claude is used in exactly two places, both server-side:

1. **Command fallback** (`/api/command`, `claude-haiku-5-5`): only when the local grammar (exact, then fuzzy) cannot match what you said or typed. It receives the text (never audio) plus your last three actions and returns either actions from the same action table or a 2–3 option clarify question shown as numbered tiles. Timeout 2.5 s; on timeout or invalid output the app says "Didn't catch that; I heard *…*" and offers the two closest commands as tiles.
2. **"Turn my writing into text"** (`/api/cleanup`, `claude-sonnet-5-5`): only when you ask. It receives a PNG crop of the selection plus the stroke data and returns text to replace the strokes.

Every Claude result that changes the page is shown as a **ghost overlay first** with **Accept** (`Enter`) and **Reject** (`Esc`, `Backspace`, `Z`). Nothing is replaced until you accept, and an accepted result is still one Undo away. Every call is logged locally (summary, latency, result, accepted / rejected / timeout) and counted in the Demo panel.

**Logged counts from our own testing** (TODO, team: copy from the Demo panel, "Claude: N calls, X accepted, Y rejected, Z timeouts", after a real testing session with keys):

| Route | Calls | Accepted | Rejected | Timeouts |
|---|---|---|---|---|
| `/api/command` | TODO | TODO | TODO | TODO |
| `/api/cleanup` (handwriting) | TODO | TODO | TODO | TODO |

**Two concrete failures** (TODO, team: replace with real examples and screenshots):

1. TODO: *what was written or said*, *what Claude returned*, *why it was wrong*, *how Accept/Reject or the clarify tiles caught it*.
   `![failure 1](docs/img/claude-failure-1.png)` (TODO: add screenshot)
2. TODO: same format.
   `![failure 2](docs/img/claude-failure-2.png)` (TODO: add screenshot)

## Metrics

The Demo panel (`?demo=1`) shows these live, so the numbers on screen are evidence rather than decoration.

- **Deviation (roughness), raw vs smoothed, px.** Take the pointer samples `p_1 … p_N` (canvas px) from the last 1.5 s. Let `m_i` be the centred moving average of the 9 samples `p_{i−4} … p_{i+4}` (about ±130 ms at 30 fps, including `p_i` itself). Then
  `deviation = sqrt( (1 / (N − 8)) · Σ_{i=5}^{N−4} |p_i − m_i|² )`, and it is 0 when `N < 9`.
  It is computed twice from the same frames:
  - **raw:** the landmark mapped to the canvas with no filtering (after simulated tremor, when that is on);
  - **smoothed:** the visible cursor after the One Euro filter and the dead zone.

  It is recomputed every 300 ms and shown to 0.1 px. Slow intended movement barely moves away from its own moving average, so this isolates the high-frequency shake that smoothing is meant to remove. Lower is steadier; the drop from raw to smoothed is what Steadiness buys. (Code: `roughness()` in `src/state/runtime.ts`, using `rmsDeviation()` from `src/pipeline/metrics.ts`.)
- **Task time (last stroke).** `round(t_pen-up − t_pen-down)` in ms for the most recent pen-up, whatever caused each event (dwell, key, voice, tile or tracking loss). The panel shows it in seconds to 0.1 s. Whole-task times (e.g. "write your name": first pen-down to last pen-up) are timed by hand; the app does not compute them.
- **Command success rate.** `matched / total`, shown as "X of Y (Z %)". `total` counts every voice or typed command submitted (including `window.__steady.command` in tests). `matched` counts those that resolved directly to actions, by the local grammar or by Claude. A clarify question (numbered options) and "Didn't catch that" (no match, timeout, invalid output, offline) both count as misses.
- **Claude calls.** `N calls, X accepted, Y rejected, Z timeouts` from the local call log.
- **Camera / detection fps.** Frames per second over the last second. The app warns below 25 detection fps, because at low rates an 8–12 Hz tremor aliases into the 3–7 Hz drawing band where no filter can remove it.

## Privacy

Camera frames never leave the browser. Microphone audio goes to Cartesia (or Google, in the Web Speech fallback) only while the mic is open. A command the local grammar cannot match (its text, never audio, plus your last three actions) and, only when you explicitly ask for AI cleanup, stroke data plus a PNG crop go to our server and on to Anthropic. Nothing else leaves the browser. In Desktop mode the browser also sends pointer positions and shortcut keystrokes to a helper program on this same computer (`127.0.0.1` only); the helper never sends anything off the machine.

## Tests

Run on 2026-10-24 against the current tree (no camera, no keys, no network needed):

```bash
npm test                          # Vitest: pipeline, grammar, action table, API schemas, Desktop-mode mapping, view/face-tap/breaks
npx playwright install chromium   # once
npm run test:e2e                  # Playwright: ReplaySource fixtures drive the real app in Chromium
npm run test:helper               # Python unittest for the Desktop-mode helper (fake mouse controller)
```

`npm test` (Vitest):
```
 Test Files  26 passed (26)
      Tests  246 passed (246)
```
`npm run test:e2e` (Playwright, Chromium):
```
  1 skipped
  22 passed (48.5s)
```
`npm run test:helper` (Python unittest):
```
Ran 37 tests in 3.939s

OK
```

- **Playwright** (`e2e/`, fixtures in `public/fixtures/`): calibration completes; hold-still pen-down and pen-up draw exactly one stroke; a hand resting for 10 s leaves no ink; the shaky word "hi" is one stroke; typed "make it a circle" converts the last stroke; Save PNG and typed "export picture" download a real PNG; tracking loss mid-stroke lifts the pen and keeps it up; the too-dark warning; the Demo panel metrics; Backspace / Y / Z undo-redo; Space toggles the pen; keys type normally inside the command box; Esc and Enter cancel a destructive dialog and typed "yes" confirms; tile size, names, aria-pressed and focus ring; canvas, live region and slider labels; Steadiness 0 vs 100 draws visibly different strokes; "steadier" / "looser".
- **Skipped:** the fake-webcam run (`e2e/fake-camera.spec.ts`) needs a real 5 s recording at `e2e/assets/hand.y4m`, which is not in the repo yet (see `NEEDS-HUMAN.md`).
- **Not covered by automated tests:** a real webcam and MediaPipe (including Head mode and face tap on a real face), a real microphone, the live Cartesia and Anthropic APIs (keys were absent; mocks were used), a screen reader, and painting in real Krita.

## From hackathon to Monday

- **Pilot:** five users through an occupational-therapy clinic, two weeks each, with the therapist choosing posture and presets in the first session.
- **Package as a desktop app** so camera permission and setup persist and the app starts in one click.
- **On-device speech-to-text option** for people who don't want audio to leave the machine.
- **WCAG 2.2 audit** by an external auditor, including switch-access and screen-reader passes.
- **Target metrics for the pilot:** smoothed deviation at most 40 % of raw for every participant; a five-word note in under 90 s; command success at least 90 % with the typed box and at least 80 % by voice; zero unintended strokes from a resting hand; median setup under 10 s and "Use last setup" under 3 s.

## Known limitations

- Wheelchair and bed camera angles are untested.
- Glasses (reflections and Head mode) are untested.
- Hand detection confidence is lower for darker skin tones in low light; the app surfaces tracking confidence and a lighting warning, and a desk lamp fixes most cases.
- Dysarthric and accented speech: accuracy not measured.
- English only.
- Multiple tabs open on Steady compete for the camera.
- Neck fatigue in Head mode; break reminders (10 min in Head mode, 15 min in Hand mode) are on by default. Head mode and face tap are tested only on synthetic replays, not on a real camera.
- Two hands in the frame: only one is tracked, and it may switch.
- **Desktop mode is macOS only** (no Windows or Linux helper).
- **No pressure or tilt in other apps:** Krita and other apps get a plain mouse drag, so brush pressure dynamics do nothing.
- **Single monitor:** Desktop mode drives the main display only; the drawing area must be on it.
- Desktop mode's shortcut map covers Krita only: in other apps the pointer, painting and dwell-clicks work, but "undo", "eraser" and the tool tiles are sent only to Krita (if Krita is not open, nothing is sent and the panel says so).
- Everything above was built and tested overnight with synthesised landmark data (ReplaySource) and Playwright; see `NEEDS-HUMAN.md` for what still has to be verified on a real webcam.
