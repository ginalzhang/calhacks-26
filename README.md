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

- **Camera:** an external webcam, or a phone used as a webcam (Continuity Camera / Phone Link), on a stand looking down at the desk tracks a resting hand best. Second choice: push the laptop back and tilt the lid about 30° down. Third: Head mode.
- **Rest your wrist** on the desk, a book or a rolled towel. Let your other fingers curl loosely; you don't need to point.
- **Light:** a clip lamp aimed at the desk. Dim light lowers detection confidence (more so for darker skin tones); the app warns when the frame is too dark.
- **Microphone:** a headset mic. Laptop mics in a loud hall miss commands.
- **Keys and switches:** any USB/Bluetooth switch that sends Space or Enter works as a one-switch pen toggle. If pressing two keys together is hard, turn on your operating system's **Sticky Keys** (macOS: Accessibility › Keyboard; Windows: Settings › Accessibility › Keyboard). Steady itself never needs a key combination.

**Without a camera** (demos, tests): `http://localhost:3000/?source=replay&fixture=word-tremor&skipIntro=1` replays a synthesised hand. Fixtures are described in `public/fixtures/README.md`; `?demo=1` opens the Demo panel.

**Key map** (every other key does nothing; keys type normally inside text boxes):
`Space` pen toggle · `Enter` activate the focused control / Accept · `Esc` cancel · `Backspace` or `Z` undo · `Y` redo · `M` mic · `R` recenter · `P` pause tracking · `1`–`3` choose an option.

**Tests**

```bash
npm test                     # Vitest: pipeline, grammar, action table
npx playwright install chromium
npm run test:e2e             # Playwright with ReplaySource (no camera needed)
```

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

- **Deviation (roughness), raw vs smoothed, px.** Over the last 1.5 s of pointer samples `p_1 … p_N` in canvas px, with `m_i` the centred moving average of `p_{i−4} … p_{i+4}` (about ±130 ms at 30 fps):
  `deviation = sqrt( (1 / (N − 8)) · Σ_{i=5}^{N−4} |p_i − m_i|² )`.
  It is computed twice: on the raw landmark mapped to the canvas with no filtering, and on the smoothed pointer after the One Euro filter and the dead zone. Slow intended movement barely changes the moving average, so this isolates the high-frequency shake that smoothing is meant to remove. Lower is steadier; the drop from raw to smoothed is what Steadiness buys.
- **Task time (last stroke), ms.** `t_pen-up − t_pen-down` for the most recent stroke, whatever caused each event (dwell, key, voice, tile). For a whole task (e.g. "write your name") time from the first pen-down to the last pen-up.
- **Command success rate.** `matched / total`, where `total` counts every voice or typed command submitted and `matched` counts those that resolved to at least one action (by the local grammar or by Claude). "Didn't catch that" (no match, timeout or invalid output) counts as a miss.
- **Claude calls.** `N calls, X accepted, Y rejected, Z timeouts` from the local call log.
- **Camera / detection fps.** Frames per second over the last second. The app warns below 25 detection fps, because at low rates an 8–12 Hz tremor aliases into the 3–7 Hz drawing band where no filter can remove it.

## Privacy

Camera frames never leave the browser. Microphone audio goes to Cartesia (or Google, in the Web Speech fallback) only while the mic is open. A command the local grammar cannot match (its text, never audio, plus your last three actions) and, only when you explicitly ask for AI cleanup, stroke data plus a PNG crop go to our server and on to Anthropic. Nothing else leaves the browser.

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
- Neck fatigue in Head mode; break reminders are on by default.
- Two hands in the frame: only one is tracked, and it may switch.
- Everything above was built and tested overnight with synthesised landmark data (ReplaySource) and Playwright; see `NEEDS-HUMAN.md` for what still has to be verified on a real webcam.
