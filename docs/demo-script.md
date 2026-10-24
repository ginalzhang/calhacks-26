# Steady demo script (judging table, ~3 min including the judge's turn)

**Roles:** *Driver* (team member, hand resting on the desk, runs steps 1–3) · *Narrator* (talks, watches the Demo panel) · *Judge* (takes over at step 4).

## Before the judge arrives (60 s, every time)

1. Chrome, `http://localhost:3000/?demo=1` (Demo panel open, "Next judge" tile visible). Camera allowed, posture chosen (see `NEEDS-HUMAN.md` §1).
2. Clip lamp on, aimed at the desk. Headset mic on the driver.
3. Status bar shows tracking green; no "key missing" (if it does, voice uses Web Speech and Claude uses mock data; say so honestly if asked).
4. Press **Next judge** → ✓ Confirm: clears the canvas, resets metrics, restarts the 10 s setup. Do the setup yourself: rest still 3 s, one slow circle 4 s.
5. Fallback ready: the 90 s video of this script on the desktop, and `?source=replay&fixture=word-tremor&skipIntro=1&demo=1` in a second tab (works with no camera at all).

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

## (4) The quote, then the judge (60 s+)

- Point to the interview sentence on the first demo screen (`docs/user-interview.md`).
- Press **Next judge** → ✓ Confirm. Hand the seat over: "Rest your wrist here, let your fingers curl; you don't need to point." Coach the 10 s setup.
- Suggested first task for the judge: hold still, draw a circle, hold still, say or type "make it a circle", then "export picture" and show the PNG in Downloads.

## If something goes wrong

| Symptom | Say / do |
|---|---|
| "Tracking lost: too dark" | Turn the lamp toward the hand. "It fails safe: the pen lifts and freezes instead of scribbling." |
| Hand not visible | Switch posture on the setup screen (laptop lid tilted down, or Head mode). |
| Voice not catching | Type the command in the box. "That's why nothing is voice-only." |
| Claude slow or offline | "Didn't catch that" with two closest tiles appears; tap one. Shape cleanup is local and always works. |
| Anything else | Play the 90 s fallback video. |
