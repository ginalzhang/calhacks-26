# Steady server API

Three route handlers are the only server code (`src/app/api/*/route.ts`). API keys live only in
`process.env` on the server (`.env.local`); `@anthropic-ai/sdk` and the Cartesia API key are never
imported client-side. Every route works **without keys**: it returns realistic mock data and sets
`"mock": true` so the client can show "key missing" in the status bar.

All bodies are JSON. All responses include `mock: boolean`. Errors use
`{ "error": "<code>", "message": "<human text>", "mock": boolean }` with a 4xx/5xx status.

---

## `GET /api/cartesia-token`: key probe

```json
{ "keyPresent": true, "mock": false }
```

## `POST /api/cartesia-token`: mint a short-lived Cartesia access token

Request: `{}` (no body needed).

Server calls Cartesia `POST https://api.cartesia.ai/access-token` with
`{ "grants": { "stt": true, "tts": true }, "expires_in": 3600 }` (headers: `Authorization: Bearer $CARTESIA_API_KEY`,
`Cartesia-Version: 2026-08-14`). The grants schema must be checked against Cartesia's access-token docs; see DECISIONS.md.

Response 200:
```json
{ "token": "<access token>", "expiresAt": 1761330000000, "mock": false }
```
Mock (no key): `{ "token": null, "expiresAt": null, "mock": true }`. The client then uses
the Web Speech fallback for STT and `speechSynthesis` for TTS and shows "Cartesia key missing".

The same token is used for the Ink 2 STT WebSocket (`access_token=` query param) and for Sonic TTS via
`@cartesia/cartesia-js` in the browser.

---

## `GET /api/command`: key probe

```json
{ "keyPresent": true, "mock": false }
```

## `POST /api/command`: Claude fallback for commands the local grammar could not match

Called only when the local grammar (exact, then fuzzy) found no match. Sends the **text only** (never audio)
plus the last three actions.

Request:
```json
{
  "transcript": "make the last thing look like a ball",
  "context": {
    "lastActions": ["pen.toggle", "pen.toggle", "colour.blue"],
    "selected": { "id": "s_12", "kind": "free", "colour": "blue", "width": 6 },
    "canvas": { "w": 1200, "h": 800 }
  },
  "dialogOpen": false
}
```
(`context` is `CommandContext` from `src/pipeline/types.ts`.)

Server: `claude-haiku-5-5` via `client.messages.parse({ model, max_tokens: 1024, thinking: { type: "disabled" },
output_config: { effort: "low", format: zodOutputFormat(ActionsSchema) }, system, messages })`,
client options `timeout: 2500`, `maxRetries: 0`. No forced `tool_choice`. `response.parsed_output === null` → `invalid`.

Response 200, one of:
```json
{ "kind": "actions", "actions": ["shape.circle"], "mock": false, "latencyMs": 812 }
```
```json
{
  "kind": "clarify",
  "question": "Which did you mean?",
  "options": [
    { "label": "Make it a circle", "actions": ["shape.circle"] },
    { "label": "Make it blue", "actions": ["colour.blue"] }
  ],
  "mock": false,
  "latencyMs": 950
}
```
```json
{ "kind": "none", "reason": "timeout", "mock": false, "latencyMs": 2500 }
```
`reason` ∈ `"timeout" | "invalid" | "no-match" | "key-missing"`. Every `actions[]` entry is an `ActionId` from
`src/actions.ts` (validated with zod on the server **and** the client). `options` has 2–3 entries.

Mock (no key): a small keyword matcher returns realistic `actions`/`clarify` responses with `mock: true`
and a simulated `latencyMs` of 300–700 ms.

The client turns these into `CommandResolution` (`src/pipeline/types.ts`); on `none` it shows
"Didn't catch that; I heard *<transcript>*" with the two closest grammar matches as tiles.

---

## `GET /api/cleanup`: key probe

```json
{ "keyPresent": true, "mock": false }
```

## `POST /api/cleanup`: AI cleanup on explicit request only

Request:
```json
{
  "mode": "handwriting",
  "imagePng": "<base64 PNG of the selection crop, no data: prefix>",
  "bbox": { "x": 120, "y": 80, "w": 400, "h": 160 },
  "strokes": [
    { "id": "s_1", "kind": "free", "colour": "black", "width": 6, "points": [{ "x": 130, "y": 90 }] }
  ]
}
```
`mode` ∈ `"handwriting"` (P2, "turn my writing into text") | `"cleanup"` (P3, "clean this up") | `"label"` (P3, "label this").
Stroke points are in canvas px; the crop's top-left is `bbox.x, bbox.y`.

Server: `claude-sonnet-5-5`, `client.messages.parse({ model, max_tokens: 8192, output_config: { effort: "low" | "medium",
format: zodOutputFormat(CleanupSchema) }, messages: [{ role: "user", content: [image block, text block with stroke JSON] }] })`,
`timeout: 15_000`, `maxRetries: 0`. `effort: "low"` for handwriting, `"medium"` for cleanup/label. Thinking cannot be disabled on Sonnet 5.5.

Response 200, by mode:
```json
{
  "mode": "handwriting",
  "text": "buy milk",
  "confidence": 0.82,
  "replaces": ["s_1", "s_2", "s_3"],
  "at": { "x": 120, "y": 80 },
  "size": 32,
  "mock": false,
  "latencyMs": 3400
}
```
```json
{
  "mode": "cleanup",
  "shapes": [
    { "kind": "rect", "x": 120, "y": 80, "w": 200, "h": 120 },
    { "kind": "circle", "cx": 400, "cy": 140, "r": 50 },
    { "kind": "line", "x1": 320, "y1": 140, "x2": 350, "y2": 140 },
    { "kind": "triangle", "points": [{ "x": 0, "y": 0 }, { "x": 10, "y": 0 }, { "x": 5, "y": 8 }] },
    { "kind": "text", "x": 140, "y": 150, "text": "Server", "size": 24 }
  ],
  "replaces": ["s_1", "s_2"],
  "mock": false,
  "latencyMs": 6100
}
```
```json
{
  "mode": "label",
  "labels": [{ "text": "Database", "x": 410, "y": 210, "size": 22 }],
  "mock": false,
  "latencyMs": 5200
}
```
Errors: `{ "error": "timeout" | "invalid" | "key-missing" | "bad-request", "message": "...", "mock": boolean }`.

The client always shows the result as a **ghost overlay** with Accept (`Enter`) / Reject (`Esc`, `Backspace`, `Z`);
nothing is replaced until Accept. Every call is logged to `localStorage["steady.claudeLog"]` as
`{ at, route, mode, summary, latencyMs, result: "accepted" | "rejected" | "timeout" | "error" | "pending" }`.
