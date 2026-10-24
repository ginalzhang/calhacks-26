# Steady: 2-minute pitch (demo first)

**Rule: the demo starts before the slides.** The driver's hand is already resting on the desk when the judges sit down. Follow `docs/demo-script.md` steps 1–3 while saying the lines below; the numbers come after the audience has seen it work.

## 0:00–1:00 Demo (talk over it)

- "Watch the line, not the hand. The wrist is resting on the desk. No pen, no grip, no pinch. The camera follows a fingertip; holding still puts the pen down, holding still again lifts it."
- *(Simulate tremor on, Steadiness 0, write a name.)* "This is what writing with a shake looks like. Unreadable."
- *(Steadiness up, ghost view, same name.)* "Same hand, same shake. The faded line is the raw signal; the ink is what Steady draws. The deviation number on the right drops live."
- *(Voice: "make it a square", "turn my writing into text", "read it back".)* "And when drawing is hard, you can talk. Every action is also a big tile, a typed command, and the core ones are single keys, so nothing depends on speech alone."

## 1:00–1:30 Why it matters

- **53.2 million US adults have arthritis** (CDC). Hand and thumb-base pain is one of the most common ways it shows up, and gripping a pen is exactly the motion that hurts.
- Voice alone isn't the answer: **one study measured about 36 % word error** for off-the-shelf speech recognition on Parkinson's speech. That's why Steady never makes voice the only way.
- The clinical alternative, **eye-gaze devices, costs $3,500 and up**. Steady needs a webcam you already own and a browser.

## 1:30–1:45 The person we built it for

> **TODO (team): the interview quote.** "<one sentence>", *<one-line description, no name, no condition named>*. Until the interview is done, skip this beat and give the time to the demo; never present a made-up sentence as a quote.

## 1:45–2:00 What's new, and the ask

- **No-grip webcam input + tremor-aware smoothing + voice + shape cleanup: no existing tool combines these.**
  - Hands-free input exists without a canvas: Talon (voice + eye/head control for coding), Project Gameface, Camera Mouse and Enable Viacam (face/head as a mouse), Apple Head Pointer and Voice Control, Windows Voice Access. They move a cursor; they don't help you draw a steady line.
  - Stabilisers exist only for people who can already hold a stylus: Procreate's and Krita's stroke stabilisers, Lazy Nezumi.
  - Voice drawing exists without hand input: VoiceDraw, ARTiculate.
- **The same steady hand works in any app:** Desktop mode drives the real mouse, so you paint in Krita (or Figma, Photoshop) with the same filter, hold-still pen and voice commands ("undo", "eraser"), and the mouse button is released the moment tracking is lost.
- Smoothing that's measured, not vibes: a One Euro filter tuned against tremor frequencies, a dead zone for slow movement, and a calibration that sets it for *your* hand in 10 seconds.
- Privacy by default: camera frames never leave the browser.
- "Next: a five-person pilot with an occupational therapist. Come try it; hold still to start."

## Facts and sources (for Q&A)

| Claim | Source / note |
|---|---|
| 53.2 M US adults with diagnosed arthritis | CDC arthritis prevalence estimate (NHIS) |
| ~36 % word error on Parkinson's speech | One published study of off-the-shelf ASR on dysarthric Parkinson's speech; say "one study", not "ASR fails" |
| Clinical eye-gaze devices $3.5 k+ | Typical list price of dedicated eye-gaze communication/computer-access systems |
| Tremor bands | Essential tremor ~4–12 Hz, Parkinson's rest tremor 4–6 Hz, intention tremor 2–5 Hz; intended strokes ~1–3 Hz |

If a judge asks "does it diagnose anything?": no. Steady never names a condition or shows a tremor frequency; presets describe what the hand does ("shakes when reaching", "steady but sore").
