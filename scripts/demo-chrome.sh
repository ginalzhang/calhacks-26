#!/usr/bin/env bash
# Launch Google Chrome for the Steady demo with background throttling OFF, so the camera loop
# keeps running when Krita sits beside (or partly over) the Chrome window (§6a).
# Belt and braces: still place Chrome BESIDE Krita, not behind it.
#
#   npm run demo-chrome                 → http://localhost:3000
#   STEADY_URL=http://localhost:3217 npm run demo-chrome
#
# Uses a separate profile under /tmp so the flags always apply (Chrome ignores flags when it
# hands the URL to an already-running instance of the same profile). Grant camera + mic once
# in that profile.
set -euo pipefail

URL="${STEADY_URL:-${1:-http://localhost:3000}}"
PROFILE="${STEADY_CHROME_PROFILE:-/tmp/steady-demo-chrome}"
FLAGS=(
  --disable-backgrounding-occluded-windows
  --disable-renderer-backgrounding
  --disable-background-timer-throttling
  --user-data-dir="$PROFILE"
  --no-first-run
  --no-default-browser-check
)

mkdir -p "$PROFILE"

if [[ "$(uname)" == "Darwin" ]]; then
  if [[ ! -d "/Applications/Google Chrome.app" && ! -d "$HOME/Applications/Google Chrome.app" ]]; then
    echo "Google Chrome is not installed. Install it from https://www.google.com/chrome/ and run again." >&2
    exit 1
  fi
  echo "Opening $URL in Google Chrome (profile $PROFILE, background throttling off)…"
  open -na "Google Chrome" --args "${FLAGS[@]}" "$URL"
else
  for bin in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$bin" >/dev/null 2>&1; then
      exec "$bin" "${FLAGS[@]}" "$URL"
    fi
  done
  echo "Google Chrome not found." >&2
  exit 1
fi
