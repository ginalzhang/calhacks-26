# Steady demo script (judging table, ~3.5 min including the judge's turn)

**Roles:** *Driver* (team member, hand resting on the desk, runs steps 1–3b) · *Narrator* (talks, watches the Demo panel) · *Judge* (takes over at step 4).

## Before the judge arrives (60 s, every time)

1. Chrome, `http://localhost:3000/?demo=1` (Demo panel open, "Next judge" tile visible). Camera allowed, posture chosen (see `NEEDS-HUMAN.md` §1).
2. Clip lamp on, aimed at the desk. Headset mic on the driver.
3. Status bar shows tracking green; no "key missing" (if it does, voice uses Web Speech and Claude uses mock data; say so honestly if asked).
4. Press **Next judge** → ✓ Confirm: clears the canvas, resets metrics, restarts the 10 s setup. Do the setup yourself: rest still 3 s, one slow circle 4 s.
5. For step (3b): the helper is running in a terminal (`npm run helper`, no "PERMISSION NEEDED" lines), Chrome was opened with `npm run demo-chrome`, and **Krita is open beside Chrome, not behind it**, with a blank canvas and brush smoothing set to None. The drawing area was set once beforehand (it is remembered), and Desktop mode is **off**.
6. Fallback ready: the 90 s video of this script on the desktop, and `?source=replay&fixture=word-tremor&skipIntro=1&demo=1` in a second tab (works with no camera at all).

## (0) Framing (Narrator, 10 s)

"Steady lets you draw and take notes without holding anything. The driver's wrist is resting on the desk; the camera follows a fingertip, and holding still is the pen."

## (1) The problem: Simulate tremor on (Driver, 30 s)

- Tap **Simulate tremor** (Demo panel). It adds a 4–10 Hz shake to the raw camera signal, before any smoothing.
- Steadiness slider at **0**. Hold still → pen down (ring fills, border turns coloured). Write a short name, e.g. "Ana". Hold still → pen up.
- Narrator: "That's what writing with a shake looks like with no help. Unreadable."

## (2) Steadiness up, ghost view (Driver, 40 s)

- Say or type **"undo"** (or press Backspace).
- Drag the **Steadiness** slider to about **70** (or say "steadier" a few times). Tap **Ghost view**.
- Write the same name again.
- Narrator, pointing at the Demo panel: "The faded line underneath is the raw signal: still shaking. The ink is the smoothed pointer. The deviation readout drops from *raw* to *smoothed* live: that's the filter removing the shake while keeping the slow, intended movement."

## (3) Voice + shape cleanup + Claude + read-back (Driver, 50 s)

- Draw a rough square next to the name (one stroke). Tap **Mic** (or press `M`), say **"make it a square"**. It snaps; Sonic says "Made it a square". Undo is one tap away.
- Tap **Mic**, say **"turn my writing into text"**. A ghost of the recognised text appears over the strokes with **Accept / Reject**. Say or press **Enter** to accept.
- Tap **Mic**, say **"read it back"**. Sonic reads the page's text aloud.
- If voice misfires: type the same phrase into the **command box**. Same grammar, matched locally (only "turn my writing into text" itself needs the network).
- Narrator: "Every action is a tile, a voice phrase, a typed command, and the core nine are single keys. Nothing is voice-only, nothing is dwell-only."

## (3b) Desktop mode: the same steady hand in Krita (Driver, 30 s)

- Tap **Desktop mode** (or say "desktop mode"). Steady shrinks to its side panel and shows "Helper: Connected".
- Move the cursor onto the Krita canvas beside it. Hold still → pen down; paint two or three strokes; hold still → pen up. (F8 toggles the pen too.)
- Say **"undo"**: the last Krita stroke disappears. Say **"eraser"**: Krita switches to its eraser; rub out part of a stroke. Say "eraser" again to switch back.
- Narrator: "Same filter, same hold-still pen, same voice, but now it's driving the real mouse in Krita. The same steady hand works in any app. And it fails safe: lose the hand or press F9 and the mouse button is released."
- Tap **Exit Desktop mode** (or say "desktop mode") before step 4; the normal canvas returns.

## (4) The quote, then the judge (60 s+)

- Point to the interview sentence on the first demo screen (`docs/user-interview.md`).
- Press **Next judge** → ✓ Confirm. Hand the seat over: "Rest your wrist here, let your fingers curl; you don't need to point." Coach the 10 s setup.
- Suggested first task for the judge: hold still, draw a circle, hold still, say or type "make it a circle", then "export picture" and show the PNG in Downloads.

## If something goes wrong

| Symptom | Say / do |
|---|---|
| "Tracking lost: too dark" | Turn the lamp toward the hand. "It fails safe: the pen lifts and freezes instead of scribbling." |
| Hand not visible | Switch posture on the setup screen (desk camera, or laptop lid tilted down). |
| Voice not catching | Type the command in the box. "That's why nothing is voice-only." |
| Claude slow or offline | "Didn't catch that" with two closest tiles appears; tap one. Shape cleanup is local and always works. |
| Desktop panel says "Helper not running" or names a permission | Skip (3b) and say "it needs a small local helper with two macOS permissions"; fix it after the judge leaves (`NEEDS-HUMAN.md`). |
| Krita doesn't paint / cursor freezes in Desktop mode | Chrome is probably covered: move Krita so Chrome is fully visible. Press F9 if in doubt (releases the button). |
| Anything else | Play the 90 s fallback video. |
