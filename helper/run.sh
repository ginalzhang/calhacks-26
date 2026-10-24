#!/usr/bin/env bash
# Steady desktop helper launcher.
#   npm run helper              → create helper/.venv, install requirements, start the helper
#   npm run test:helper         → same venv, run the Python tests (fake mouse; never moves the real pointer)
#   bash helper/run.sh --dry-run  → start without touching the mouse (prints actions)
# Env: STEADY_ORIGIN (allowed page origin, default http://localhost:3000), STEADY_PORT (default 8765),
#      PYTHON (interpreter used to create the venv).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$HERE/.venv"

pick_python() {
  if [[ -n "${PYTHON:-}" ]]; then echo "$PYTHON"; return; fi
  for p in /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
    if command -v "$p" >/dev/null 2>&1; then echo "$p"; return; fi
  done
  echo "Python 3 not found. Install it (brew install python) and run again." >&2
  exit 1
}

if [[ ! -x "$VENV/bin/python" ]]; then
  PY="$(pick_python)"
  echo "Creating $VENV with $("$PY" --version 2>&1)…"
  "$PY" -m venv "$VENV"
fi

STAMP="$VENV/.requirements-installed"
if [[ ! -f "$STAMP" || "$HERE/requirements.txt" -nt "$STAMP" ]]; then
  echo "Installing helper requirements…"
  "$VENV/bin/python" -m pip install --disable-pip-version-check -q -r "$HERE/requirements.txt"
  touch "$STAMP"
fi

if [[ "${1:-}" == "--test" ]]; then
  shift
  cd "$HERE"
  exec "$VENV/bin/python" -m unittest -v test_steady_helper "$@"
fi

exec "$VENV/bin/python" "$HERE/steady_helper.py" "$@"
