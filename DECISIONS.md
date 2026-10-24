# Decisions

Every non-obvious choice made during the unattended build. Newest entries go at the bottom of each agent's section.
Format: `### [owner] title` + what was decided + why.

### [lead] Repo scaffold
- Next.js 16.4.3 (App Router, TS, Tailwind 4, `src/` dir) from `create-next-app@latest`. `@mediapipe/tasks-vision` pinned to `1.1.1` (output of `npm view @mediapipe/tasks-vision version` on 2026-10-24).
- Vitest runs `src/**/*.test.ts` in the node environment; Playwright lives in `e2e/`.

### [lead] Action table shape
- Colours, shapes and numbered options are separate action ids (`colour.blue`, `shape.circle`, `choose.1`) so the grammar never needs arguments. Phrases were chosen so no pair is within fuzzy distance (e.g. "thick"/"thin" only, since "thicker"/"thinner" are distance 2; "add page" instead of "new page" because "new page"/"next page" are distance 2; "export picture"/"export drawing" instead of "save png"/"save svg").
- `key` uses `KeyboardEvent.key` values (`" "` for Space). Undo has `altKeys: ["z","Z"]`.

### [lead] Agent team
- Four agents with disjoint ownership (see `docs/ARCHITECTURE.md`): A pipeline + Vitest, B tracking/canvas/UI, C voice + API routes, D fixtures/Playwright/docs. They share one working tree and one dev server on port 3217; the lead merges, runs the tests and commits after each round.

### [lead] Ask Steady (P3 research assistant) cut
- No sponsor credentials for the index/search services exist in this environment and the run is unattended, so the feature cannot work end to end. Per the spec's delete-if-incomplete rule it is not built and those services are not mentioned in the app, README or pitch.

### [A] One Euro acceptance interpretation and beta sweep (TUNED_BETA = 0.01)
- The §2 targets are "measured at the One Euro output in canvas px" and are stated as percentages of the input (0.75 px = 15 % of ±5 px; 32.5 px = 65 % of ±50 px), so the synthetic inputs are specified in **canvas px** too. Faithful pipeline test: each canvas-px sample is mapped into camera px through the real default active box (gain 3, 640×480 video, 1280×720 canvas), filtered by the real One Euro **in camera px** (filter before gain), then mapped back to canvas px and measured. 30 fps, measured from t ≥ 1 s. Amplitude for (b) is the peak (max−min)/2 (more conservative than the lock-in amplitude, which the test also checks). Lag (c) = shift in 0..500 ms (1 ms steps) minimising RMS x error.
- Consequence: beta multiplies speed in camera px/s, which at gain 3 is 1/3 of the canvas speed, so the spec default beta 0.005 **fails (b)** here: (a) 0.369 px, (b) 25.5 px, (c) 88 ms. Sweep over 0.003–0.01 in 0.0005 steps (mincutoff 0.6, dcutoff 1): the smallest value passing all three is **beta = 0.01**: (a) 0.385 px, (b) 33.1 px peak / 33.8 px lock-in, (c) 63 ms. 0.0095 gives 32.49 px peak (fails by 0.01 px). Exported as `TUNED_BETA` / `TUNED_FILTER` from `src/pipeline/oneEuro.ts`; requested in `.context/contract-requests.md` that `DEFAULT_FILTER.beta` in types.ts become 0.01.
- For reference (also asserted in the tests): if the filter space is taken as the canvas space (gain 1) the spec default 0.005 passes everything ((a) 0.40, (b) 37.3, (c) 51 ms). The One Euro (this library computes the derivative from the previous *filtered* value) is scale-equivariant only if beta is rescaled by the gain, so "filter before gain" changes nothing except the units of beta.
- Known limitation: because beta is in camera px/s, the 2 Hz amplitude falls as calibrated gain rises (beta 0.01: gain 2 → 37.3 px, 4 → 29.7, 6 → 25.5, 10 → 21.2). A higher gain means the user's comfortable movement is smaller in camera px, so the filter adapts less. Not changed (spec says beta acts on camera px); a possible fix is scaling beta by gain/3.

### [A] Pen-down dwell re-arm also needs a move away
- §3 says the pen-down dwell re-arms 600 ms after a pen-up dwell. Taken literally, a hand that keeps resting after a pen-up dwell would put the pen down again ~1.05 s later, then never lift it (pen-up needs a move), which breaks "a hand that simply rests toggles at most once and never leaves ink". So after any pen-up (dwell, key, voice, tracking loss) the pen-down dwell re-arms only after 600 ms AND once the filtered point has moved > r_in from where the pen lifted ("deliberate second dwell after moving away and back"). Option `createInkDwell({ requireMoveAfterPenUp: false })` restores the literal rule.
- Pen-down dwell timing: the 800 ms runs from the start of the 250 ms stillness window, so total stillness is 800 ms. Anchor = centroid of that window; the stroke starts there and the lazy brush is reset onto it.
- Pen-up dwell ring (DwellState kind "pen-up") is reported only after 250 ms of stillness so slow drawing never shows a flickering ring; the fill fraction still counts from where stillness began.

### [A] Canvas exit / re-entry and tracking loss in the PointerEngine
- `frame.pen` is the logical pen. Leaving the canvas (input.overCanvas === false) with the pen down emits `pen-up` cause "left-canvas" (trimFromT = that frame) while `pen` stays DRAWING; re-entering emits `pen-down` cause "left-canvas" at the re-entry pointer (new stroke, no connecting line). Applies with or without Latch. Extra frame field `inking` says when to append points. UI rule: every pen-down starts a stroke, every pen-up ends the open one (ignore pen-ups with no open stroke).
- Tracking loss: > 300 ms without a camera point (null frames or a stall) → pen-up "tracking-lost" even under Latch, pen HOVER, pointer frozen. Re-acquire resets One Euro + lazy brush at the new point (`frame.reacquired`). lossReason: luma < 40 → too-dark, else detection fps < 25 → low-fps, else no-hand. `frame.quality` carries the same too-dark/low-fps warning while tracking is still ok.
- Active box: a calibrated `activeBox` supplies the centre and the live `gain` supplies the size (canvas ÷ gain, uniform on both axes so circles stay round), so the Gain slider edits the calibrated value live. `boxFromCircle` expands the padded (×1.2) circle bbox to the canvas aspect ratio.
- `updateSettings({ steadiness })` without explicit `filter`/`lazyRadius` derives mincutoff + lazyRadius via `steadinessToParams` (Advanced panel values win when given).

### [A] Lazy brush hand-rolled
- `lazy-brush` 2.0.2 treats radius 0 as 30 (`radius || 30`) and rounds the overshoot to 0.1 px, which would break the exact "ends 12 px short" test. `lazyBrush.ts` is a faithful friction-0 equivalent of its `update()`.

### [C] Grammar normalisation and candidates
- `normalize()` lower-cases, strips diacritics, deletes apostrophes ("don't" -> "dont"), turns every other non-alphanumeric run into one space, then strips filler. **Stripped anywhere:** um, umm, uh, uhh, erm, er, hmm, please, pls. **Stripped at the start only:** "can you (please)", "could you (please)", "okay", "ok", "hey steady", "now". **Stripped at the end only:** "thank you", "thanks", "now". A Vitest asserts that `normalize()` leaves every phrase and typed form in `actions.ts` unchanged, so stripping can never break a real phrase. "steady" is deliberately NOT stripped ("steady but sore").
- Candidates are every voice phrase **plus every typed form** (so the typed box accepts `1`/`2`/`3` for choose.N) plus `opts.extra`. Table phrases win exact ties against `extra`. The fuzzy threshold is chosen per candidate phrase (<= 5 chars: 1, otherwise 2). A tie means two different (id, arg) pairs at the best distance; two phrases of the same action at the same distance still match. On a tie, `nearest` returns the tied actions so the "Didn't catch that" tiles show exactly the two candidates.
- `matchCommand()` returns `GrammarMatch & { arg?: string }` so an `extra` phrase's `arg` (e.g. a profile id) reaches `CommandResolution.arg`.

### [C] Anthropic SDK 1.3.0: API names checked, plus two quirks
- `client.messages.parse`, `output_config: { effort, format }`, `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` (it imports `zod/v4`, which works with the installed zod 4.6.7) and `response.parsed_output` all exist with exactly the names in the spec. The `claude-haiku-5-5` and `claude-sonnet-5-5` ids are in the SDK's `Model` union. Haiku 5.5 accepts `thinking: {type:"disabled"}` at effort <= high. For Sonnet 5.5, `thinking` is omitted: `disabled` returns a 400 and adaptive is the default.
- **Quirk 1:** `parse()` does not return `parsed_output: null` when the output fails zod validation. It **throws** a plain `AnthropicError` (not an `APIError`). `parsed_output` is null only when there is no text block (e.g. a refusal). Both cases map to `invalid`, and the server re-runs `safeParse` as well.
- **Quirk 2:** the SDK's `transformJSONSchema` moves `enum`/`const` into the `description` string (e.g. `"{enum: [...]}"`), so the decoder would not be constrained to real action ids. `strictOutputFormat()` in `src/voice/server/claude.ts` puts those back as `enum` constraints; the structured-outputs docs list `enum`/`const` as supported. If the API ever answers that schema with a 400, the call is retried **once** with the SDK's default format and the strict schema stays off for the rest of the process (tested against a local fake API).
- Error mapping: `APIConnectionTimeoutError` -> timeout; 401/403 -> key-missing; any other API error -> `/api/command` returns `none/invalid` (the spec's reason enum has no "upstream"), while `/api/cleanup` returns a 502 `{error:"upstream"}`. `maxRetries: 0`, so the timeout is a real wall-clock limit: 2.5 s for command (the retry gets whatever is left), 15 s for cleanup.
- Server-side refusal `fallbacks` were not added. `messages.parse` is on the stable namespace, the spec fixes the call shape, and a crop of handwriting is very unlikely to be refused. A refusal shows up as `invalid`.

### [C] /api/command output schema
- Claude returns a discriminated union: `{kind:"actions", actions: ActionId[1..4]}` | `{kind:"clarify", question, options[2..3]}` | `{kind:"none"}`. Claude's `none` becomes `reason: "no-match"`. Up to 4 actions are allowed so that "make it a blue circle" -> `[shape.circle, colour.blue]` works.
- The system prompt lists every action as `- id: "label" (says: "phrase", ...)`, marks destructive actions, and tells Claude to prefer clarify over guessing. It carries no medical language.
- With `dialogOpen: true` the server returns `none/no-match` without calling Claude, and the client never sends that request in the first place.

### [C] /api/cleanup output shapes
- Claude returns only what it can know, per mode: handwriting `{text, confidence, replaces}`, cleanup `{shapes, replaces}`, label `{labels[1..10]}`. The route then adds the rest: handwriting `at` = bbox top-left and `size` = clamp(0.6 x bbox.h / lines, 18, 64) px. `replaces` is filtered to ids that were in the request on both server and client, and an empty handwriting `replaces` means all strokes.
- Strokes are compacted before sending: coordinates rounded, at most 64 points per stroke. `imagePng` may be empty, in which case only the stroke JSON is sent.
- `requestCleanup()` keeps the documented signature `Promise<CleanupResponse>` and adds `logId` to the result. On failure it throws a `CleanupError` with `.code` and a status-bar-ready `.message` ("Nothing was changed ..."). B should call `resolveClaudeCall(result.logId, "accepted" | "rejected")` from the ghost overlay.

### [C] Claude log semantics
- `localStorage["steady.claudeLog"]` holds at most 300 entries; every change fires a `steady:claudelog` window event. Cleanup calls are logged as `pending`, and the ghost overlay resolves them. Command calls are logged once they finish: actions and clarify -> `accepted`, timeout -> `timeout`, invalid, no-match or network -> `error`. Mock calls are logged with `mock: true`, so the Demo counts still move without keys. `clearClaudeLog()` is there for "Next judge".

### [C] Cartesia: what was verified (docs.cartesia.ai, 2026-10-24) and how it is used
- **Access token:** `POST https://api.cartesia.ai/access-token` with `Authorization: Bearer <key>`, `Cartesia-Version: 2026-08-14` and body `{ grants: { stt: true, tts: true }, expires_in: 3600 }`. This matches the spec; 3600 s is the documented maximum. The response is `{ token }` only, with no expiry, so the route computes `expiresAt` itself (now + 3600 s - 30 s margin). The token route uses `fetch`, not the SDK, to keep the route free of SDK dependencies.
- **STT:** the manual endpoint `wss://api.cartesia.ai/stt/websocket`. Models are `ink-2 | ink-preview | ink-whisper`; `access_token` is accepted as a query param. `keyterm` is **singular and repeated**, ink-2/ink-preview only, **at most 100 terms / 1200 chars**. The table currently has 91 unique phrases / 816 chars; `commandKeyterms()` caps in table order, so phrases B appends cannot break the socket. Audio goes as binary PCM frames of about 100 ms in real time. The text command `"finalize"` -> transcripts + `flush_done`; `"close"` -> `done` + socket close 1000. `transcript.text` is a delta, and only `is_final: true` chunks are concatenated, without trimming whitespace between them. `/stt/turns/websocket` is not used.
- **Could not verify:** the raw OpenAPI/AsyncAPI yml files were blocked by a Vercel checkpoint, so the `.md` copies of the reference pages were used instead. Nothing was exercised against the live API because there is no key.

### [C] Voice controller behaviour
- Silence: 2 s with neither a non-empty transcript delta nor an audio chunk louder than level 0.08 closes the mic. This timer is armed only by the **first** transcript delta. The cap timer starts when listening begins: command uses `setCapMs` (clamped 15-60 s, default 15 s), dictation uses max(30 s, command cap). `setCapMs` also adjusts the cap of a session that is already open.
- Close sequence (Cartesia): the worklet flushes its partial chunk -> audio stops -> `"finalize"` -> wait for `flush_done` (4 s safety) -> close 1000. `onFinal` fires once, and only if text was heard. Otherwise `onState("idle","no-speech")`; for other idle states, detail is the close reason (toggle / silence / cap / socket-closed).
- Fallback order: Cartesia (token + WebSocket + AudioWorklet) -> Web Speech -> `none` with an error that points to the typed box. A socket failure skips Cartesia for 60 s, and the next session falls back immediately. A mic-permission error does NOT fall through to Web Speech, because it would be denied too. Web Speech restarts itself when Chrome ends a continuous session, and ignores `no-speech`, so silence before speech never closes the mic. Its level meter uses a second `getUserMedia` stream with an `AnalyserNode`.
- `open()` calls `cancelSpeech()` so Sonic or speechSynthesis never feed the recogniser.

### [C] Sonic TTS
- The SDK is loaded with a dynamic `import("@cartesia/cartesia-js")`, then `new Cartesia({ token })`. `client.tts.generate({ model_id: "sonic-3.6", voice: { id: "db6b0ed5-…" (Skylar, en-US) }, output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 24000 } })` returns a fetch `Response`, which is decoded with `AudioContext.decodeAudioData`. `sonic-3.6` is current GA per the docs; the SDK's type list stops at 3.5 but also accepts any string.
- Spoken replies default to **on** and persist in `localStorage["steady.speech"]`. A new `speak()` cancels the previous one. Sonic failures fall back to `speechSynthesis` and skip Sonic for 60 s. `speak()` must never be called for pen toggles; that is a rule for B's call sites, also written in the tts.ts header.

### [C] Server/client isolation
- The `server-only` package is not installed, and installing it was not needed. All SDK and API-key code lives in `src/voice/server/*` and is imported only by `src/app/api/**`. Client modules (`resolve`, `VoiceController`, `tts`, `cleanupClient`, `keyStatus`, `token`, `apiTypes`) never import from `src/voice/server`.
- `next.config.ts` has `cacheComponents: true`, so every GET probe calls `await connection()` first. Otherwise the probe could be prerendered at build time with the build machine's env.

### [D] Synthesised fixtures, not recorded
- `scripts/synth-fixtures.ts` builds all seven fixtures from a rigid 21-point template of a relaxed right hand (other fingers curled), translated so landmark 8 follows the path. Landmarks 5 and 9 therefore trace the same shape about 40 px lower. Seeded mulberry32 per fixture, so the output is byte-identical on every run. Values are rounded to 5 decimals (about 0.006 px).
- Paths stay in a centre box (landmark 8 within x 254–390, y 167–272 camera px; calibration circle x 242–400, y 158–298) so they stay on the canvas at the default 3× gain on 700×450 to 1200×700 canvases, for all three pointer landmarks.
- Drawing fixtures start with 1.5 s of stillness and end with 2.3 s (2.6 s for `word-tremor`, whose One Euro output settles more slowly after the tremor). The end stillness is long enough for the 1200 ms pen-up dwell, but shorter than pen-up + 600 ms re-arm + 800 ms dwell, so a resting hand at the end does not start a second stroke. 2.5 s end stillness did start a second stroke in simulation, so it was shortened.
- `word-tremor` is a cursive "hi" without the i-dot (a dot would need a second pen-down), at about 90 camera px/s, with a ~6 Hz ±5 px tremor during movement and ±1.5 px at rest.
- `scripts/verify-fixtures.ts` checks the fixtures against an independent simulation of §2/§3 (1eurofilter + the dwell rules as written in the spec), so a fixture problem can be told apart from an app problem.

### [D] No synthetic hand.y4m
- Without real footage, nothing MediaPipe would detect as a hand can be produced (and ffmpeg is not installed). The fake-camera spec `test.skip`s with a message, and recording the clip is in NEEDS-HUMAN.md.

### [D] Playwright drives replay through window.__steady
- Tests open `?source=replay&fixture=…&skipIntro=1&autoplay=0` and start replay themselves (`__steady.replay.play()` / `finished()`), so timing is deterministic. Calibration is started with `__steady.command("calibrate")` before play, because the runtime times the 3 s + 4 s steps from the first tracked frame.
- Locators use roles and the `ACTIONS[].label` names, opening a category tile when a tile is grouped; the typed box is found by a label containing "command". Each spec lists its assumptions at the top.
- `too-dark` asserts only the lighting warning, not zero strokes: the spec allows a dwell pen-down after re-acquire, so a still hand in flickery light could legitimately leave dots. Whether it should is a product question for A/B.
- One shared dev server: `webServer.reuseExistingServer: true` with `npm run dev -- -p 3217`. Workers: 3.

### [D] README privacy text
- §0 rule 9 is copied verbatim, minus the Ask Steady sentence (the feature was cut, see [lead]). The README, pitch and docs do not mention the cut feature's services.

### [A] Shapes, calibration and SVG details
- Shapes: polygons (rect/triangle) are tried before the circle because a clean square's Kåsa residual/r is ≈ 0.096, close to the 0.08 circle threshold, while a circle never simplifies to 3–4 corners at RDP ε = 5 % of the diagonal. Corner clean-up after RDP: vertices closer than 8 % of the diagonal are merged (rounded corners) and vertices with an interior angle > 150° are dropped (stroke started mid-edge). Triangles need every angle ≥ 15°. `forceShape("square")` returns a true square (side = mean of the oriented bbox sides, kind "rect"); `fitShape` keeps the rectangle's aspect.
- Calibration: rest jitter = 2D RMS after removing a linear drift per axis, rescaled from the gain at measurement time to the new calibrated gain (the map is linear) and normalised to mincutoff 0.6 for the suggestion. Kinetic residual = circle mapped to canvas px at the new gain minus a local quadratic fit over ±150 ms (no curvature bias on the slow circle; 6 Hz tremor is kept). Suggestions: rest → smallest Steadiness with lazyRadius ≥ 4 × rest RMS × mc/0.6; kinetic → smallest Steadiness with mincutoff ≤ 6 Hz × 0.5 px / kinetic RMS (first-order attenuation estimate); suggested = max of the two.
- Handedness: MediaPipe labels assume a mirrored selfie image, and LandmarkFrame carries the label for the unmirrored frame, so `analyzeCalibration` maps "Left" → right hand, "Right" → left hand. Needs a real-webcam check (NEEDS-HUMAN).
- SVG export: round-capped `<path>` polylines (dots as `<circle>`) with data-kind/colour/width/id attributes, coordinates at 2 decimals; `svgToStrokes` parses them back (falls back to the nearest ink colour for foreign SVGs). Dark page background in exports is `#161616` (`PAGE_BACKGROUND_HEX`).

### [A] No pen-down dwell after re-acquire until a move (lead fix for flicker dots)
- Problem (seen by D with the `too-dark` fixture): each re-detection let the pen-down dwell fire on a resting hand, and the next loss lifted the pen, leaving a dot.
- Fix (`dwell.ts` `disarmUntilMoved()`, called from `pointer.ts` on EVERY tracking loss, pen up or down): the pen-down dwell stays disarmed until the filtered point has moved > r_in from the first re-acquired point. Space / voice / typed / tile / face pen-downs work immediately. If the pen was down, the usual 600 ms re-arm also applies.
- Also: a `tracking-lost` pen-up on a stroke that never moved > r_in since its pen-down carries `trimFromT` = the stroke's start, so `finalizeStroke` returns null and no dot is left behind. This covers a still hand whose first gap comes after the initial dwell (≤ 1 toggle, zero ink).
- Behaviour change: a hand re-acquired at rest no longer pens down by dwell after 800 ms; the user moves a little and dwells, or uses an explicit toggle.

### [lead] Desktop mode (§6a) is phase P2b
- Per the user: Desktop mode is added as P2b, integrated only after P1 is green, and must not change P0–P2 behaviour. Agent E builds `helper/**` and `src/desktop/**` in parallel (disjoint files); B wires it in after P0–P2, gated entirely behind `desktop.toggle`.
- The updated spec's §1 camera changes (camera picker defaulting to "Desk View", per-camera Mirror/Rotate, calibration direction check) and the Hour-0 posture default change would alter P0/P1 behaviour, so they are deferred pending the team's call. The current camera/mirroring/posture defaults are unchanged.
- The helper's allowed Origin defaults to `http://localhost:3000` (the spec) and can be overridden with `STEADY_ORIGIN` (the agents' shared dev server runs on :3217).

### [B] App architecture: one store, one runtime, one dispatcher
- `src/state/store.ts` is a tiny `useSyncExternalStore` store for discrete UI state (pen, tracking, status, history, panels). High-frequency data (every PointerFrame, the live stroke, tile-dwell progress) stays in the mutable `runtime` (`src/state/runtime.ts`) and is drawn by the canvas's own rAF loop (`src/lib/render.ts`), so React never re-renders per camera frame.
- Committed strokes are painted once into an offscreen layer keyed on `renderVersion`; each frame only blits it and draws the live stroke, ghost overlay and cursor.
- The cursor, dwell ring and "?" ring are drawn on a separate full-viewport `aria-hidden` canvas so the cursor stays visible over the toolbar (tiles are dwelled with the same pointer).
- The pointer engine maps to canvas px without clamping; the toolbar is reached by moving past the canvas edge. Tile hit-testing converts canvas px → viewport px via the canvas's bounding rect.

### [B] Stroke recording follows the engine's boundaries
- Points are appended only while `frame.inking` is true; `pen-up`/`pen-down` with `cause: "left-canvas"` (and engine re-entry pen-downs while the store pen is already DRAWING) only end/start the live stroke: no earcon, no pen-state change, no status line (A's contract request 4).
- Eraser: strokes hit during one pen-down are hidden live and committed as a single `remove-strokes` entry on pen-up, so one Undo restores the whole erase.

### [B] Tile activation and focus
- Tiles are `<button data-tile=…>`. Dwell fires `el.click()` with `runtime.pendingVia = "tile-dwell"` so the same onClick knows the input method. Mouse click and dwell call `canvas.focus()` afterwards; keyboard activation (`event.detail === 0`) keeps focus on the tile (§3).
- The main grid holds the 8 core tiles (Pen, Latch, Undo, Redo, Mic, Note, Dot, Save PNG) plus category tiles (Colours, Tools, View, Pages, Voice, AI help, Setup), Demo and Help. Categories always open a sub-panel with a Back tile instead of measuring fit: the grid can never overflow or scroll. Zoom/move, Head mode, Face tap and Desktop-mode tiles are hidden until those features exist; their voice/typed commands answer with a clear status message.
- In modal contexts (first run, setup, confirm dialog, open panel) tile dwell works anywhere on screen, including over the canvas; otherwise only off-canvas (rest zone).

### [B] Calibration UX
- First run → "Set up" shows the posture step (radio group, default (b) laptop tilted, as the spec said at the time) with coaching, the one-line wrist diagram and a Start tile; measuring then runs 3 s rest + 4 s circle, timed from the first tracked frame (no time limit while the hand is not visible). Typed/voice "calibrate" starts measuring immediately (D's Playwright relies on this). Recenter reruns step 2 for 3 s; Re-measure reruns step 1 without changing the box. "Ask once for a larger circle" uses `circleTooSmall`.
- Ink dwell is disabled in the engine while measuring and restored afterwards. Calibration result, settings and posture persist in `localStorage["steady.setup"]`; first run offers "Use last setup" when it exists. The doc autosaves to `steady.doc` (raw ghost points stripped).

### [B] Demo metrics formula (for README › Metrics)
- "Deviation" = RMS distance of each point from the centred moving average of its ±4 neighbours (≈ ±130 ms at 30 fps), computed over the last 1.5 s, separately for the raw mapped camera point (`rawCanvas`) and the smoothed cursor (`pointer`). It measures high-frequency shake only; slow intended movement contributes almost nothing. Uses A's `rmsDeviation`.
- "Last stroke time" = pen-down to pen-up of the last stroke. "Command success" = typed/voice commands that resolved to actions ÷ all commands. Claude counts come from C's `getClaudeStats()`, refreshed on the `steady:claudelog` event.

### [B] Replay controls are exposed only after the fixture has loaded
- `window.__steady.replay` used to appear before the fixture JSON arrived, so a test calling `play()` immediately got a silent no-op and `finished()` never resolved (D's 15-minute hang). Now `runtime.replay` is set only after `start()` loaded the fixture, and `play()` called during loading is queued.

### [B] Smaller choices
- Fonts: dropped `next/font` Geist for the system UI font stack (no font download, nothing to fail offline). Base font size 18 px; nothing smaller.
- CSS `round()` inside `calc()` silently broke Turbopack's CSS compile (the old stylesheet kept being served); the reduced-motion stepped tile fill is quantised in JS instead.
- Privacy text on first run is rule 9 without the Ask Steady sentence (feature cut). The Desktop-mode sentence is added only together with the P2b integration.
- The first Demo screen shows D's placeholder from `docs/user-interview.md`, rendered without quote marks so nobody mistakes it for a real person's words (`src/lib/quote.ts`).
- Earcons are WebAudio-synthesised (one bright click down, two soft clicks up); no files in `public/sounds/`. They need one user gesture before Chrome allows audio.
- Ink-contrast warning: status warns when `contrastRatio(ink, page) < 3` on colour or background change. Dictated text placed on a light page uses black instead of white/yellow ink.
- After a calibration the resting hand may put the pen down once (normal dwell rules apply, status says "Hold still to start drawing"); a resting hand still never leaves ink.

### [E] Desktop mode: protocol additions (helper ↔ bridge)
- Helper → browser `{"t":"state","down":bool,"reason"?}` whenever the button changes (including helper-side releases: 300 ms silence, pause hotkey, leaving the area). The bridge treats it as authoritative, so after a helper-side release the next in-area frame with the pen down presses again (a new Krita stroke, no connecting line), the same as Steady's canvas re-entry rule.
- `hello` also carries `hotkeys` and `hotkeysAvailable` (false = the listener failed, usually Input Monitoring; null = turned off with `--no-hotkeys`).
- Browser → helper `config.area` (drawing area in screen points) gives defence in depth: the helper refuses `down` outside the area and releases before a move that leaves it, so "never drag outside the drawing area" holds even if the browser is wrong.
- `keys.app: "krita"`: the helper releases the button, brings Krita to the front (AppKit `NSRunningApplication.activateWithOptions_`, no Automation permission needed) and only then sends the keys. Reason: tapping a Desktop-panel tile (Undo, Eraser…) focuses Chrome, and `cmd+z` would otherwise go to Chrome. If Krita is not running nothing is sent and the panel says "Krita is not open".
- `delete` in a combo means the Mac delete key (backspace). `STEADY_ORIGIN` may be a comma-separated list (exact matches only).

### [E] Desktop mode: helper fail-safe design
- One asyncio loop on the main thread owns the mouse; a 20 ms watchdog releases after 300 ms without any message (worst case ≈ 320 ms). Release also runs on socket close (incl. TCP drop), any exception in a message handler (then the connection keeps working), SIGINT/SIGTERM/SIGHUP (loop signal handlers), `atexit`, `threading.excepthook`, the loop exception handler and the `finally` around `asyncio.run`.
- The pynput global keyboard listener runs in a **child process** (`--hotkey-child`) that prints only function-key names. If the listener crashes (macOS input-source APIs are thread-sensitive), only the child dies; the parent that holds the button keeps its fail-safe. It also means no other keystrokes ever leave the listener.
- One client at a time: a second connection gets HTTP 409 while the first is active; a client silent for > 1 s is considered dead and is replaced (page reload / crashed tab). Bad or missing Origin gets HTTP 403 before the WebSocket opens.
- Permission detection: `AXIsProcessTrusted` (ApplicationServices) for Accessibility and `CGPreflightListenEventAccess` (CoreGraphics) for Input Monitoring, via ctypes (no prompts); plus the heuristic that the hotkey child's listener thread died. The terminal app is named from `__CFBundleIdentifier` / `TERM_PROGRAM`.

### [E] Desktop mode: browser-side choices
- The button state is reconciled every frame (`shouldHoldButton`: pen DRAWING + engine `inking` + inside the area + tracking ok + not paused/setting up), instead of mirroring pen events; any pen-up event additionally sends `up` immediately. After (re)connecting or finishing area setup the button is not pressed until the engine pen has been seen up once (a pen left down never starts painting by surprise).
- Dwell-click outside the area reuses A's `createInkDwell` (pen-down rule + arming): a resting hand clicks once, then must move > r_in away and wait 600 ms before it can click again; after tracking loss it must move first. Radius = `tileRadius(settings)` (honours the "Hard to hold still" 60 px override), time = `tileDwellMs`. Dwell-click is off while the pen is logically down (Latch users lift the pen first) and when the dwell input is switched off.
- Area setup uses the same detector anywhere on screen; during setup `drawingArea` reports the whole screen and `isInside()` is false (so the engine's ink dwell is blocked and the button is never held). F8 marks a corner during setup instead of toggling the pen. Areas < 40 pt per side are rejected.
- Watchdog in the bridge: if frames stop for 300 ms while the button is held (rVFC stalled, Pause returns early, covered window) the bridge sends `up` itself, independent of the helper's silence rule (pings keep coming from the timer in that case). The watchdog uses the arrival time (`performance.now()`), not `frame.t`, so ReplaySource timestamps can't trip it.
- `sendActionKeys` returns true for mapped actions even when the helper is down (with a status saying why), so "undo" in Desktop mode never silently undoes Steady's hidden canvas. "dot" in Desktop mode = one click at the pointer inside the area.
- Krita "eraser" (`e`) is a toggle in Krita; saying "eraser" twice switches back. "Brush" = `b` (freehand brush tool).
- Helper URL is fixed at `ws://127.0.0.1:8765` (not `localhost`, to avoid an IPv6 `::1` miss). Settings persist in `localStorage["steady.desktop"]` (`area` null = whole screen, `dwellClick`, `hotkeys`).

### [B] Desktop mode (P2b) integration is fully gated on `store.desktopOn`
- `desktopOn` is never persisted (it starts off on every load, so the real mouse is never driven without an explicit action). With it off, the runtime, render loop, layout and dispatch take exactly the P0–P2 paths (22/22 e2e unchanged).
- On: the engine's canvas size follows `desktop.drawingArea` (subscription), frames go through a separate `onDesktopLandmarks` path (overCanvas = `desktop.isInside(prev pointer)`, no Steady ink, no tile dwell, no Steady cursor since the canvas is unmounted), every pen event (engine and explicit) is forwarded to `desktop.onPenEvent`, then `desktop.onFrame(f)`.
- dispatch: pen, pause, latch, steadier/looser, mic and the desktop.* ids stay in Steady; everything else tries `desktop.sendActionKeys(id)` first, then canvas-only ids answer "… is not available in Desktop mode". `pen.toggle` during area setup calls `desktop.markCorner()`; pause also calls `desktop.release()`.
- Helper hotkeys map pen → `pen.toggle`, pause → `pause.toggle`. The Desktop layout is E's `<DesktopPanel camera={<CameraPreview/>}/>` plus the typed box (narrow, 440 px). The rule-9 Desktop-mode sentence was added to the first-run privacy text with this integration.
- Not done (deferred by the lead): camera picker, Mirror/Rotate, direction check, Desk View posture default.

### [D] README round 2 (Desktop mode, metrics, tests)
- Metrics are documented exactly as B implemented them (`roughness()` over the last 1.5 s, 9-sample centred moving average, recomputed every 300 ms, rounded to 0.1 px; `lastStrokeMs` for every pen-up including tracking loss; command success = resolved-to-actions ÷ submitted). A **clarify reply counts as a miss** in the success rate, and whole-task times are timed by hand (the app does not compute them); the README says both plainly instead of describing a nicer formula.
- Privacy is §0 rule 9 from the updated spec, verbatim including the Desktop-mode sentence, minus the Ask Steady sentence (checked by script against PROMPT.md).
- The README Tests section pastes the real summary lines from runs on 2026-10-24 (Vitest 227, Playwright 22 + 1 skipped, helper 37), not the counts from the brief.
- Hardware tips now lead with Desk View (the spec's new option (a)) and say Head mode is not available in this build; the earlier "break reminders are on by default" line was removed because none are built.
