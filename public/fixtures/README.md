# Landmark fixtures for ReplaySource

Synthesised (not recorded) MediaPipe hand-landmark streams used by `ReplaySource`, Playwright and offline demos.
Open the app with `?source=replay&fixture=<name>` (add `&skipIntro=1` to skip the first-run screen and calibration).

- **Generate:** `npx tsx scripts/synth-fixtures.ts` (all) or `npx tsx scripts/synth-fixtures.ts word-tremor` (one). Output is deterministic (seeded mulberry32 RNG per fixture), so re-running gives byte-identical files.
- **Check:** `npx tsx scripts/verify-fixtures.ts [--canvas=960x600] [--landmark=8|5|9] [--svg=.context/fixtures-preview]` runs every fixture through a simulation of the §2/§3 rules that does not depend on the app code (One Euro 0.6 Hz / β 0.005 / dcutoff 1 → centred active box at 3× → pen-down dwell 800 ms within `r_in` = 15 px with `r_out` = 30 px → pen-up armed after moving > `r_in`, pen-up dwell 1200 ms within `r_in/2` → pen-down re-armed 600 ms after a dwell pen-up → tracking loss > 300 ms lifts the pen). It prints the pen events and strokes and exits non-zero if a fixture misses its expectation. With `--svg` it writes previews (raw path faded red, smoothed strokes black). `manifest.json` lists durations and the key timings.

## Format

`LandmarkFixture` v1 from `src/tracking/LandmarkSource.ts`: `fps: 30`, `videoWidth: 640`, `videoHeight: 480`, `mode: "hand"`.
Each frame is `{ t, lm, handedness }`, where `t` is ms from 0 in steps of 33.333 and `lm` is the full 21-point hand as `[x, y, z]` triples, **normalised and unmirrored** exactly as MediaPipe emits them (so a stroke moving right on screen has **decreasing x**). `lm: null` means no hand was detected. `too-dark` adds a top-level `luma: 25`.

The hand is a rigid template of a relaxed right hand with the other fingers loosely curled (design rule 1: no pointing pose needed), about 110 px tall in the 640×480 frame. The template is translated so the **index tip (8)** follows the path; the index knuckle (5) and middle knuckle (9) therefore trace the same path shape about 40 px lower, so all three pointer-landmark settings work. A low-pass rest jitter (about 0.5–0.6 px std, AR(1)) moves the whole hand, plus 0.12 px of independent noise per landmark.

All motion stays in a small box near the centre of the frame (landmark 8 within x 254–390, y 167–272 in mirrored camera px for the drawing fixtures; the calibration circle spans x 242–400, y 158–298). At the default 3× gain that maps onto most of the canvas without leaving it (checked for 700×450, 960×600 and 1200×700 canvases with landmarks 8, 5 and 9; the calibration circle is the only path that may leave a small canvas, which is expected because it defines the box).

## Fixtures

| Name | Duration | What happens | What the app should do |
|---|---|---|---|
| `still-10s` | 10.0 s | Hand resting still at the centre, ~1 px rest jitter. | At most one pen toggle, zero strokes (a resting hand never leaves ink). |
| `calibration` | 8.0 s | 0–3 s resting still (step 1: rest jitter); 3–7 s one slow clockwise circle about 156×140 camera px with ~2.5 % wobble, starting and ending at the top (step 2: active box, gain, hand); 7–8 s still. Handedness `Right`. | Calibration completes; gain roughly 4–6× depending on canvas width (circle box padded 20 %). |
| `dwell-stroke` | 5.8 s | 0–1.5 s still; 1.5–3.5 s a 130 px left-to-right stroke on screen (about 390 canvas px at 3×, cruise ~77 px/s, slight sag); 3.5–5.8 s still. | Pen down by dwell at about 0.8–1.1 s; pen up by dwell about 1.2–1.4 s after the stroke stops; exactly 1 stroke. |
| `word-tremor` | 8.7 s | 0–1.5 s still; 1.5–6.1 s a cursive **"hi"** (no i-dot; 389 camera px at ~90 px/s) with a ~6 Hz ±5 px tremor (dominant on y, ±2.75 px on x, slow phase drift) during movement and ±1.5 px at rest; 6.1–8.7 s still. | 1 stroke that reads as "hi" after smoothing (the P0 "draw a legible word" check). Ghost view shows the jittery raw path. |
| `circle-stroke` | 7.0 s | 0–1.5 s still; 1.5–4.7 s a roughly circular clockwise stroke (r ≈ 52 camera px, ~3 % radius wobble, about 5 px closing gap); 4.7–7.0 s still. | 1 stroke; typed "make it a circle" converts it (`lastStrokeKind` becomes `"circle"`). |
| `tracking-lost` | 5.5 s | 0–1.5 s still; 1.5–3.0 s a stroke in progress; **3.0–4.0 s `lm: null`**; the hand comes back somewhere else and moves for 1 s; 0.5 s still (too short to re-arm a pen-down dwell). | Pen lifts about 300 ms into the gap, tracking `"lost"` with a reason; after re-acquire the pen stays up ("Tracking back. Pen is up."); 1 stroke. |
| `too-dark` | 10.8 s | Like `still-10s` but `luma: 25`, rest jitter ~1.5 px and intermittent null runs (0.2–0.6 s gaps every 0.8–1.6 s). | "Too dark" lighting warning / `lossReason: "too-dark"`; no stray strokes. |

## Timing notes for test authors

- Every drawing fixture starts with ≥ 1.2 s of stillness (here 1.5 s), so the 800 ms pen-down dwell fires before movement starts, and ends with ≥ 1.8 s of stillness (2.3 s, 2.6 s for `word-tremor`), so the 1200 ms pen-up dwell fires after the One Euro output settles.
- The end stillness is deliberately shorter than pen-up + 600 ms re-arm + 800 ms dwell, so a resting hand at the end does not start a second stroke.
- The pen-up dwell only arms after the pointer has moved more than `r_in` (≥ 15 canvas px) from the pen-down anchor; every stroke moves far more than that.
- The fixture `t` values are rebased onto `performance.now()` by `ReplaySource`; poll `window.__steady.getState()` or await `window.__steady.replay.finished()` rather than sleeping a fixed time.

No webcam video is included: a synthetic Y4M clip would not contain a real hand for MediaPipe to detect. The fake-camera Playwright spec looks for `e2e/assets/hand.y4m` (a 5 s clip the team records) and skips with a message when it is missing.
