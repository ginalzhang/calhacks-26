# Development CSP investigation (pinned local source)

Inspected `@vitejs/plugin-react` 6.1.2 local `dist/index.js` and Vite 8.3.5 local `dist/client/client.mjs` / `dist/node/chunks/node.js`.

- React plugin injects an inline module preamble from `transformIndexHtml`. Its `calculateSkipFastRefresh` returns true when `server.hmr === false` (or production/build).
- Vite runtime CSS creates style elements and applies the nonce from `meta[property=csp-nonce]`. Hashing only the React preamble will therefore leave development CSS blocked by the shell's strict `style-src 'self'`.
- Vite's `html.cspNonce` adds the configured nonce to generated script/style tags and emits the meta entry consumed by runtime CSS.

Recommended parent-owned configuration: generate a fresh random nonce in each development-server configuration evaluation; set `html.cspNonce`; add a dev-only (`apply: 'serve'`) `transformIndexHtml` plugin that augments the existing `script-src` and `style-src` directives with exactly `'nonce-<the random nonce>'`. Build output keeps the strict original CSP and has no development nonce. Use `server.hmr: false` when network policy deliberately forbids development WebSocket connections. If retaining HMR, explicitly scope its connection to the development Vite origin in main's development-only allowlist and CSP.

If a hash plugin is preferred for scripts: a post-order HTML transform must hash the exact final text of every inline `<script>` after the React plugin injection, using SHA-256/base64, and append each `'sha256-<digest>'` to `script-src`. Computing `react.preambleCode.replace('__BASE__', resolvedConfig.base)` matches the pinned ordinary dev preamble; bundled dev uses `/` instead. The nonce route avoids depending on those internal string details and covers Vite CSS injection. Do not add `unsafe-inline` or allow remote origins.

No parent configuration was edited by this worker.
