# Steady architecture and module contracts

Contracts (lead-owned, read these first): `src/actions.ts`, `src/pipeline/types.ts`,
`src/tracking/LandmarkSource.ts`, `docs/API.md`. The spec is `PROMPT.md` (section numbers §0–§12 refer to it).

## Data flow

```
LandmarkSource (MediaPipeSource | ReplaySource)            src/tracking/**        [B]
   │ LandmarkFrame (normalised, unmirrored)
   ▼
pick pointer landmark (8/5/9 or face 1) → mirror → camera px  src/tracking/pointerLandmark.ts [B]
   ▼
PointerEngine.process()                                     src/pipeline/pointer.ts [A]
   simulated tremor (demo) → One Euro (per axis, camera px) → active-box map (canvas px)
   → ink dwell + pen state machine + arming + latch + tracking-loss → lazy brush → pointer
   ▼ PointerFrame (+ PenEvents)
React app: canvas renderer, stroke recorder, tiles, tile dwell, status bar, dialogs   src/components/**, src/state/** [B]
   ▲                                   ▲
   │ ActionInvocation                  │ CommandResolution
dispatcher (src/state/dispatch.ts) [B] ◄── voice + typed box: grammar → /api/command   src/voice/**, src/pipeline/grammar.ts [C]
   │
History/Doc (pure)                                          src/pipeline/document.ts [A]
```

## Ownership (disjoint; do not edit another agent's files)

| Agent | Owns |
|---|---|
| Lead | `src/actions.ts`, `src/pipeline/types.ts`, `src/tracking/LandmarkSource.ts`, `docs/API.md`, `docs/ARCHITECTURE.md`, `package.json`, configs. (C may edit `phrases` in actions.ts; B may append actions.) |
| A | `src/pipeline/**` except `types.ts` and `grammar.ts`; all `src/pipeline/*.test.ts` except grammar's; `src/actions.test.ts` is C's |
| B | `src/tracking/**` (except LandmarkSource.ts), `src/components/**`, `src/state/**`, `src/lib/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `public/sounds/**` |
| C | `src/app/api/**`, `src/voice/**`, `src/pipeline/grammar.ts` + `grammar.test.ts`, `src/actions.test.ts`, `public/worklets/**` |
| D | `docs/**` (except API.md/ARCHITECTURE.md), `README.md`, `.env.example`, `e2e/**`, `playwright.config.ts`, `scripts/**`, `public/fixtures/**`, `docs/pitch.md`, `docs/demo-script.md`, `docs/user-interview.md` |
| E | Desktop mode (§6a): `helper/**` (Python helper + its tests), `src/desktop/**` (bridge, pure mapping + Vitest, shortcut map, `DesktopPanel.tsx`), `scripts/demo-chrome.sh`. Edits nothing else. |
| Shared append-only | `DECISIONS.md`, `NEEDS-HUMAN.md`: append with `cat >> FILE <<'EOF'` under a `### [A] title` heading; never rewrite others' entries |

## Module exports (implement exactly these names; extra exports are fine)

### A: `src/pipeline/*` (pure, injected timestamps, zero DOM/React imports)
- `oneEuro.ts`: `createOneEuro2D(params: FilterParams): { filter(p: Vec2, tMs: number): Vec2; reset(): void; setParams(p: FilterParams): void }` (one `1eurofilter` instance per axis; ms→s for the lib).
- `activeBox.ts`: `defaultActiveBox(video: Size, canvas: Size, gain: number): Rect`; `mapToCanvas(p: Vec2, box: Rect, canvas: Size): Vec2` (no clamping; callers decide); `boxFromCircle(points: Vec2[], video: Size, canvas: Size, pad?: number): { box: Rect; gain: number; tooSmall: boolean }`.
- `lazyBrush.ts`: `createLazyBrush(radius: number): { update(p: Vec2): Vec2; reset(p?: Vec2): void; setRadius(r: number): void }` (friction 0).
- `steadiness.ts`: `steadinessToParams(s: number): { minCutoff: number; lazyRadius: number }`; `suggestSteadiness(restRms: number, kineticRms: number): number`.
- `dwell.ts`: `rIn(s: PipelineSettings): number` (= max(15, lazyRadius/2, 3 × restJitterRms)); `createTileDwell(): { update(pointer: Vec2 | null, tiles: TileRect[], t: number, opts: { radius: number; dwellMs: number; snapPx: number }): TileDwellState; reset(): void }`; plus the ink-dwell detector used by pointer.ts.
- `pointer.ts`: `createPointerEngine(settings: PipelineSettings, canvas: Size, video: Size): PointerEngine`.
- `tremor.ts`: `createTremorSimulator(seed?: number): { apply(p: Vec2, t: number): Vec2; reset(): void }` (band-limited 4–10 Hz; ±4 px at rest, rising to ±8 px above 100 px/s).
- `strokes.ts`: `finalizeStroke(points: TimedPoint[], o: { id: string; colour: ColourName; width: number; rIn: number; trimFromT?: number; raw?: Vec2[] }): Stroke | null` (trim, RDP ε 1.5 via simplify-js, dot rule); `strokeOutline(points: Vec2[], width: number): Vec2[]` (perfect-freehand, thinning 0, smoothing 0.5, streamline 0.4); `outlineToPath2DString(outline: Vec2[]): string`; `straighten(points: Vec2[]): Vec2[]`; `eraserHits(strokes: Stroke[], p: Vec2, radius: number): string[]`; `strokeBBox(points: Vec2[]): Rect`.
- `shapes.ts`: `fitShape(points: Vec2[]): ShapeFit`; `forceShape(points: Vec2[], target: ShapeTarget): ShapeFit`.
- `document.ts`: `createHistory(initial?: Doc): History`; `newDoc(): Doc`; `newPage(name: string): Page`; `applyCommands(h: History, label: string, cmds: DocCommand[]): History`; `undo(h: History): History`; `redo(h: History): History`; `undoLabel(h: History): string | null`; `currentPage(doc: Doc): Page`; `newId(prefix: string): string`.
- `calibration.ts`: `analyzeCalibration(input: { rest: TimedPoint[]; circle: TimedPoint[]; video: Size; canvas: Size; handedness: "Left" | "Right" | null; settings: PipelineSettings }): CalibrationResult` (`rest` = One Euro output in canvas px at current gain; `circle` = raw mirrored camera px).
- `metrics.ts`: `rms(values: number[]): number`; `rmsDeviation(a: Vec2[], b: Vec2[]): number`.
- `svg.ts`: `pageToSvg(page: Page, size: Size): string`; `svgToStrokes(svg: string): Pick<Stroke, "points" | "colour" | "width">[]` (round-trip test).
- `contrast.ts`: `contrastRatio(hexA: string, hexB: string): number`.

### C: voice
- `src/pipeline/grammar.ts`: `normalize(text: string): string`; `levenshtein(a: string, b: string): number`; `matchCommand(text: string, opts?: GrammarOptions): GrammarMatch`.
- `src/voice/resolve.ts`: `resolveCommand(text: string, ctx: CommandContext, opts?: GrammarOptions & { dialogOpen?: boolean }): Promise<CommandResolution>` (grammar first, then `/api/command`; offline → `none/offline`).
- `src/voice/VoiceController.ts`: `createVoiceController(cb: VoiceCallbacks): VoiceController` where
  `VoiceController = { open(mode: "command" | "dictation"): Promise<void>; close(): void; readonly isOpen: boolean; readonly engine: "cartesia" | "webspeech" | "none"; setCapMs(ms: number): void }` and
  `VoiceCallbacks = { onPartial(text: string, mode): void; onFinal(text: string, mode): void; onLevel(level0to1: number): void; onState(s: "idle" | "connecting" | "listening" | "finalizing" | "error", detail?: string): void }`.
  Closes on toggle, 2 s silence after first transcript delta, or cap (command 15 s, dictation 30 s).
- `src/voice/tts.ts`: `speak(text: string): Promise<void>`; `cancelSpeech(): void`; `setSpeechEnabled(on: boolean): void`; Sonic via `@cartesia/cartesia-js` with the minted token, fallback `speechSynthesis`.
- `src/voice/cleanupClient.ts`: `requestCleanup(req: CleanupRequest): Promise<CleanupResponse>` (types exported from `src/voice/apiTypes.ts`, zod schemas shared with the routes); Claude log: `logClaudeCall(entry): string`, `resolveClaudeCall(id, result)`, `getClaudeStats(): { calls; accepted; rejected; timeouts }`.
- `src/voice/keyStatus.ts`: `probeKeys(): Promise<{ cartesia: boolean; anthropic: boolean; online: boolean }>`.

### E: Desktop mode (`src/desktop/*`)
- `mapping.ts` (pure): `areaPoint(p: Vec2, area: Rect): Vec2` (engine px, which are drawing-area-relative in Desktop mode → screen points); `insideArea(p: Vec2, area: Size): boolean`; `desktopDwellAction(inside: boolean): "pen-toggle" | "click"`.
- `shortcuts.ts`: `SHORTCUTS: Record<string /* app id, "krita" */, Partial<Record<ActionId, string /* combo */>>>`; Krita macOS: `undo` cmd+z, `redo` cmd+shift+z, `tool.free` b, `tool.eraser` e, `width.thicker` ], `width.thinner` [, `export.png` cmd+s.
- `bridge.ts`: `export const desktop: DesktopBridge` (singleton, client-only):
  ```ts
  interface DesktopBridge {
    readonly state: "off" | "connecting" | "connected" | "error";
    readonly error: string | null;          // "Helper not running: run npm run helper" / permission text from the helper
    readonly screen: Size | null;           // from hello
    readonly drawingArea: Rect;             // screen points; default whole main display
    readonly dwellClick: boolean;
    enable(): Promise<void>;                // connect ws://127.0.0.1:8765, start 100 ms ping
    disable(): void;                        // sends up, closes socket
    setDrawingArea(r: Rect): void;          // persisted in localStorage
    setDwellClick(on: boolean): void;
    startAreaSetup(): void;                 // corner-dwell flow (top-left, bottom-right) driven by onFrame
    onFrame(frame: PointerFrame): void;     // B calls every engine frame while enabled (move, dwell-click outside area, up on tracking loss)
    onPenEvent(ev: PenEvent): void;         // B forwards engine pen events (down/up only inside area)
    isInside(p: Vec2 | null): boolean;      // engine px → inside drawing area?
    sendActionKeys(id: ActionId): boolean;  // true if the focused-app shortcut map handled it (B's dispatch then stops)
    onHotkey(cb: (id: "pen" | "pause") => void): () => void;
    subscribe(cb: () => void): () => void;  // for useSyncExternalStore
  }
  ```
- `DesktopPanel.tsx`: the narrow side panel (camera thumbnail slot passed as a prop/children, tracking dot, pen state, Mic, Pause, Desktop-mode off, Undo, Krita tool tiles, drawing-area setup, helper status + fix-it text). Uses the shared `Tile` component and `dispatch` from B.

B integrates: when `desktop.toggle` is on → `engine.setCanvasSize({ w: area.w, h: area.h })`, per frame pass `overCanvas = desktop.isInside(pointer)` and `inRestZone = !overCanvas`, forward frames + pen events to `desktop`, route `dispatch()` through `desktop.sendActionKeys(id)` first for app-facing actions (pen, pause, latch, steadier/looser, mic stay in Steady), map hotkeys pen → `pen.toggle`, pause → `pause.toggle` (which must also release the button), render `<DesktopPanel/>` instead of the full layout, and say "Not available in Desktop mode" for canvas-only actions (shape fits, AI cleanup, dictation, ghost view). Tracking loop is driven by `requestVideoFrameCallback` (not rAF) in this mode.

### B: app
- `src/state/dispatch.ts`: `dispatch(inv: ActionInvocation): void`; the single place actions execute.
- Installs `window.__steady: SteadyTestHooks` (see `LandmarkSource.ts`).
- `src/tracking/MediaPipeSource.ts`, `src/tracking/ReplaySource.ts` implementing `LandmarkSource`.

## Dev loop rules for agents
- One shared dev server is already running: **http://localhost:3217** (`next dev -p 3217`). Never start another dev server and never run `next build` (both fight over `.next/`). It hot-reloads.
- Type-check with `npx tsc --noEmit` (whole repo; ignore errors in files you don't own, report them). Unit tests: `npx vitest run <path>`.
- Don't `npm install` new packages without need; if you must, install one package with `--save-exact` and note it in DECISIONS.md.
- Never commit; the lead commits after each merge.
- No API keys exist in this environment: every Cartesia/Anthropic integration must work behind a mock.
