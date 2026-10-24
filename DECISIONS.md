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
