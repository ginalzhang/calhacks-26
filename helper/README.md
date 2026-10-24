# Steady desktop helper

A small Python program that lets Steady's **Desktop mode** move and click the real macOS mouse
pointer, so you can paint in Krita (or Figma, Photoshop, any app) with the same steady,
no-grip webcam pointer. macOS only.

## Run it

```bash
npm run helper            # creates helper/.venv, installs pynput + websockets, starts the helper
```

Leave that terminal open. In Steady (Chrome, `http://localhost:3000`) turn on **Desktop mode**.

Options (after `--`, e.g. `npm run helper -- --dry-run`):

| Option / env | Meaning |
|---|---|
| `STEADY_ORIGIN=http://localhost:3217` | Allowed page origin (default `http://localhost:3000`). Comma-separated list allowed. |
| `--port 8765` / `STEADY_PORT` | Port (Steady connects to 8765). |
| `--dry-run` | Print mouse and key actions instead of performing them (safe to try anywhere). |
| `--no-hotkeys` | Don't start the global F8 / F9 listener. |

Tests (never touch the real mouse: a fake controller, or `--dry-run` in a subprocess):

```bash
npm run test:helper
```

## macOS permissions (one time)

System Settings › Privacy & Security, for **the app that runs the terminal** (Terminal, iTerm,
VS Code…):

- **Accessibility**: needed to move and click the mouse and to send shortcut keys.
- **Input Monitoring**: needed for the global hotkeys (F8 / F9) while Krita has focus.

Quit and restart the helper after granting. The helper checks both at start-up, prints which
one is missing and where to turn it on, and Steady's Desktop panel shows the same text.

## Safety

- Listens on `127.0.0.1:8765` only, and **rejects any page whose Origin is not
  `http://localhost:3000`** (otherwise any website could move your mouse). One page at a time.
- The mouse button is **released** if no message arrives for 300 ms (Steady pings every
  100 ms), when the connection closes, on the pause hotkey, and on exit, Ctrl-C, SIGTERM or any
  error. It is never left held.
- A second `down` while held is ignored; `down` outside the drawing area is refused, and a
  move that leaves the drawing area releases the button first (never drags outside it).
- Shortcut keys: modifiers are always released, even on error; before keys are sent the
  button is released and Krita is brought to the front (if Krita is not open, nothing is sent).
- The hotkey listener runs in a separate child process and reports only function keys
  (F1–F20); no other keystrokes are read or sent anywhere. Nothing leaves this computer.

## Hotkeys

**F8 = pen toggle, F9 = pause tracking (and release the button).** Remappable from Steady to
other function keys; never Space, letters or modifiers (Krita uses those). On a Mac laptop
press `fn`+F8, or turn on System Settings › Keyboard › "Use F1, F2, etc. keys as standard
function keys". A USB switch can be programmed to send F8.

## Protocol

JSON over WebSocket, documented in `docs/API.md` ("Desktop-mode helper WebSocket"), plus:
`{"t":"state","down":bool,"reason"?}` (helper → browser whenever the button changes),
`hello.hotkeys` / `hello.hotkeysAvailable`, `config.area` (drawing area in screen points), and
`keys.app` (`"krita"`: bring Krita to the front first).
