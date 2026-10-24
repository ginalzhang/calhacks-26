#!/usr/bin/env python3
"""Steady desktop helper (PROMPT.md §6a, protocol in docs/API.md "Desktop-mode helper WebSocket").

Steady's browser tab sends filtered pointer positions and shortcut keystrokes here; this
program moves and clicks the real macOS mouse pointer (pynput) so the user can paint in
Krita or any other app without holding a mouse.

Safety rules (the most important part of this file):
  * Listens on 127.0.0.1 only and rejects any connection whose Origin header is not the
    allowed origin (default http://localhost:3000, env STEADY_ORIGIN overrides; a
    comma-separated list is accepted). Otherwise any website could move your mouse.
  * One client at a time.
  * The left button is RELEASED: after 300 ms without any message (the browser pings every
    100 ms), when the socket closes, on the pause hotkey, on exit, Ctrl-C, SIGTERM/SIGHUP and
    on any exception. The button is never left held.
  * A `down` is ignored while the button is already held; a second `up` is a no-op.
  * If the browser told us the drawing area (config.area), `down` outside it is refused and a
    move that leaves it releases the button first (never drag outside the drawing area).
  * Global hotkeys (default F8 = pen, F9 = pause) are only ever function keys: never Space,
    letters or modifiers (Krita uses those).

Run: `npm run helper` (creates helper/.venv, installs requirements, starts this file).
     `python steady_helper.py --dry-run` prints mouse actions instead of performing them.
"""
from __future__ import annotations

import argparse
import asyncio
import atexit
import ctypes
import http
import json
import math
import os
import signal
import sys
import threading
import time
from typing import Any, Callable, Iterable, Optional

VERSION = 1
HOST = "127.0.0.1"
DEFAULT_PORT = 8765
DEFAULT_ORIGIN = "http://localhost:3000"
#: Release the button when no message has arrived for this long (seconds).
SILENCE_S = 0.300
#: Watchdog poll period (seconds). Worst-case release latency = SILENCE_S + WATCHDOG_TICK_S.
WATCHDOG_TICK_S = 0.020
#: A connected client silent for this long is considered dead and may be replaced.
STALE_CLIENT_S = 1.0
#: Max time to wait for the target app (e.g. Krita) to come to the front before sending keys.
ACTIVATE_WAIT_S = 0.6

MODIFIERS = ("cmd", "ctrl", "alt", "shift")
NAMED_KEYS = {"esc", "enter", "tab", "delete"} | {f"f{i}" for i in range(1, 13)}
CHAR_KEYS = set("abcdefghijklmnopqrstuvwxyz0123456789[]")
#: Keys allowed as global hotkeys: function keys only (never Space, letters or modifiers).
HOTKEY_KEYS = {f"f{i}" for i in range(1, 21)}
DEFAULT_HOTKEYS = {"pen": "f8", "pause": "f9"}

#: App ids used by src/desktop/shortcuts.ts → macOS bundle id + display name.
APPS = {"krita": ("org.krita", "Krita")}


# ----------------------------------------------------------------------------- pure helpers


def parse_combo(combo: Any) -> tuple[list[str], str]:
    """Parse "cmd+shift+z" → (["cmd", "shift"], "z"). Raises ValueError on anything else."""
    if not isinstance(combo, str) or not combo or len(combo) > 40:
        raise ValueError("combo must be a short string like cmd+z")
    parts = combo.strip().lower().split("+")
    if any(p == "" for p in parts):
        raise ValueError(f"bad combo {combo!r}")
    *mods, key = parts
    for m in mods:
        if m not in MODIFIERS:
            raise ValueError(f"unknown modifier {m!r} in {combo!r}")
    if len(set(mods)) != len(mods):
        raise ValueError(f"repeated modifier in {combo!r}")
    if key not in NAMED_KEYS and key not in CHAR_KEYS:
        raise ValueError(f"key {key!r} is not allowed in {combo!r}")
    return mods, key


def finite(v: Any) -> Optional[float]:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    f = float(v)
    return f if math.isfinite(f) else None


def parse_area(v: Any) -> Optional[tuple[float, float, float, float]]:
    if not isinstance(v, dict):
        return None
    vals = [finite(v.get(k)) for k in ("x", "y", "w", "h")]
    if any(x is None for x in vals):
        return None
    x, y, w, h = vals  # type: ignore[misc]
    if w <= 0 or h <= 0:
        return None
    return (x, y, w, h)


def inside(area: tuple[float, float, float, float], x: float, y: float) -> bool:
    ax, ay, aw, ah = area
    return ax <= x <= ax + aw and ay <= y <= ay + ah


# ----------------------------------------------------------------------------- macOS probes


def _framework(name: str):
    try:
        return ctypes.cdll.LoadLibrary(f"/System/Library/Frameworks/{name}.framework/{name}")
    except OSError:
        return None


def _bool_fn(lib, name: str) -> Optional[bool]:
    if lib is None:
        return None
    try:
        fn = getattr(lib, name)
    except AttributeError:
        return None
    fn.restype = ctypes.c_bool
    fn.argtypes = []
    try:
        return bool(fn())
    except Exception:
        return None


def detect_permissions() -> dict[str, Optional[bool]]:
    """Best-effort, prompt-free check of the two macOS privacy permissions.

    accessibility: AXIsProcessTrusted (ApplicationServices); needed to post mouse/key events.
      CGPreflightPostEventAccess (CoreGraphics, 10.15+) is used when AX is unavailable.
    inputMonitoring: CGPreflightListenEventAccess (CoreGraphics, 10.15+); needed for the
      global F8/F9 listener. None = unknown (the hotkey listener start-up is the fallback).
    The permission belongs to the app that launched this process (Terminal, iTerm, VS Code…).
    """
    if sys.platform != "darwin":
        return {"accessibility": True, "inputMonitoring": True}
    cg = _framework("CoreGraphics") or _framework("ApplicationServices")
    ax = _bool_fn(_framework("ApplicationServices"), "AXIsProcessTrusted")
    if ax is None:
        ax = _bool_fn(cg, "CGPreflightPostEventAccess")
    im = _bool_fn(cg, "CGPreflightListenEventAccess")
    return {"accessibility": ax, "inputMonitoring": im}


class _CGPoint(ctypes.Structure):
    _fields_ = [("x", ctypes.c_double), ("y", ctypes.c_double)]


class _CGSize(ctypes.Structure):
    _fields_ = [("width", ctypes.c_double), ("height", ctypes.c_double)]


class _CGRect(ctypes.Structure):
    _fields_ = [("origin", _CGPoint), ("size", _CGSize)]


def detect_screen() -> dict[str, int]:
    """Main display size in points (top-left origin, what pynput positions use)."""
    try:
        import Quartz  # type: ignore  # pyobjc, installed with pynput on macOS

        b = Quartz.CGDisplayBounds(Quartz.CGMainDisplayID())
        return {"w": int(round(b.size.width)), "h": int(round(b.size.height))}
    except Exception:
        pass
    cg = _framework("CoreGraphics")
    if cg is not None:
        try:
            cg.CGMainDisplayID.restype = ctypes.c_uint32
            cg.CGDisplayBounds.restype = _CGRect
            cg.CGDisplayBounds.argtypes = [ctypes.c_uint32]
            r = cg.CGDisplayBounds(cg.CGMainDisplayID())
            if r.size.width > 0 and r.size.height > 0:
                return {"w": int(round(r.size.width)), "h": int(round(r.size.height))}
        except Exception:
            pass
    return {"w": 1440, "h": 900}


_TERMINALS = {
    "com.apple.Terminal": "Terminal",
    "com.googlecode.iterm2": "iTerm",
    "com.microsoft.VSCode": "Visual Studio Code",
    "com.todesktop.230313mzl4w4u92": "Cursor",
    "dev.warp.Warp-Stable": "Warp",
    "com.mitchellh.ghostty": "Ghostty",
    "net.kovidgoyal.kitty": "kitty",
    "io.alacritty": "Alacritty",
    "com.github.wez.wezterm": "WezTerm",
}
_TERM_PROGRAMS = {"Apple_Terminal": "Terminal", "iTerm.app": "iTerm", "vscode": "Visual Studio Code", "WarpTerminal": "Warp", "ghostty": "Ghostty"}


def terminal_app_name() -> str:
    bundle = os.environ.get("__CFBundleIdentifier", "")
    if bundle in _TERMINALS:
        return _TERMINALS[bundle]
    tp = os.environ.get("TERM_PROGRAM", "")
    if tp in _TERM_PROGRAMS:
        return _TERM_PROGRAMS[tp]
    return "the terminal app that runs the helper"


def permission_messages(perms: dict[str, Optional[bool]], app: str) -> list[str]:
    msgs = []
    if perms.get("accessibility") is False:
        msgs.append(
            f"Enable Accessibility for {app} in System Settings › Privacy & Security › Accessibility, "
            "then quit and restart the helper (npm run helper). Without it Steady cannot move or click the mouse."
        )
    if perms.get("inputMonitoring") is False:
        msgs.append(
            f"Enable Input Monitoring for {app} in System Settings › Privacy & Security › Input Monitoring, "
            "then restart the helper. Without it the F8 / F9 hotkeys do not work (tiles and voice still do)."
        )
    return msgs


# ----------------------------------------------------------------------------- controllers


class PrintingMouse:
    """--dry-run mouse: prints instead of moving the real pointer."""

    def __init__(self, out=None):
        self.out = out or sys.stdout
        self._pos = (0.0, 0.0)
        self._moves = 0

    @property
    def position(self):
        return self._pos

    @position.setter
    def position(self, p):
        self._pos = p
        self._moves += 1
        if self._moves % 30 == 1:
            print(f"[dry-run] move {p[0]:.1f},{p[1]:.1f} (printing 1 in 30)", file=self.out, flush=True)

    def press(self, button):
        print(f"[dry-run] press {button}", file=self.out, flush=True)

    def release(self, button):
        print(f"[dry-run] release {button}", file=self.out, flush=True)

    def click(self, button, count=1):
        print(f"[dry-run] click {button} x{count}", file=self.out, flush=True)


class PrintingKeyboard:
    def __init__(self, out=None):
        self.out = out or sys.stdout

    def press(self, key):
        print(f"[dry-run] key down {key}", file=self.out, flush=True)

    def release(self, key):
        print(f"[dry-run] key up {key}", file=self.out, flush=True)


def real_controllers():
    """(mouse, keyboard, left_button, key_resolver) backed by pynput."""
    from pynput import keyboard, mouse  # imported lazily: tests never touch the real devices

    named = {
        "cmd": keyboard.Key.cmd,
        "ctrl": keyboard.Key.ctrl,
        "alt": keyboard.Key.alt,
        "shift": keyboard.Key.shift,
        "esc": keyboard.Key.esc,
        "enter": keyboard.Key.enter,
        "tab": keyboard.Key.tab,
        "delete": keyboard.Key.backspace,  # the Mac "delete" key
    }
    for i in range(1, 13):
        named[f"f{i}"] = getattr(keyboard.Key, f"f{i}")

    def resolve(name: str):
        return named.get(name, name)

    return mouse.Controller(), keyboard.Controller(), mouse.Button.left, resolve


class AppActivator:
    """Brings the target app (Krita) to the front before keystrokes; uses AppKit via pyobjc."""

    def _apps(self, app_id: str):
        from AppKit import NSWorkspace  # type: ignore

        bundle, name = APPS.get(app_id, (None, app_id))
        out = []
        for a in NSWorkspace.sharedWorkspace().runningApplications():
            if (bundle and a.bundleIdentifier() == bundle) or (str(a.localizedName() or "").lower() == name.lower()):
                out.append(a)
        return out

    def is_frontmost(self, app_id: str) -> bool:
        try:
            from AppKit import NSWorkspace  # type: ignore

            front = NSWorkspace.sharedWorkspace().frontmostApplication()
            bundle, name = APPS.get(app_id, (None, app_id))
            return bool(front) and (front.bundleIdentifier() == bundle or str(front.localizedName() or "").lower() == name.lower())
        except Exception:
            return True  # can't tell: just send to the frontmost app

    def activate(self, app_id: str) -> bool:
        """False if the app is not running."""
        try:
            apps = self._apps(app_id)
            if not apps:
                return False
            apps[0].activateWithOptions_(1 << 1)  # NSApplicationActivateIgnoringOtherApps
            return True
        except Exception:
            return True


class NullActivator:
    def is_frontmost(self, app_id: str) -> bool:
        return True

    def activate(self, app_id: str) -> bool:
        return True


# ----------------------------------------------------------------------------- the helper


class Helper:
    def __init__(
        self,
        mouse,
        keyboard,
        *,
        button: Any = "left",
        key_resolver: Callable[[str], Any] = lambda n: n,
        screen: Optional[dict[str, int]] = None,
        permissions: Optional[dict[str, Optional[bool]]] = None,
        origins: Iterable[str] = (DEFAULT_ORIGIN,),
        activator=None,
        clock: Callable[[], float] = time.monotonic,
        log: Callable[[str], None] = lambda s: print(s, flush=True),
        app_name: str = "the terminal app that runs the helper",
    ):
        self.mouse = mouse
        self.keyboard = keyboard
        self.button = button
        self.resolve_key = key_resolver
        self.screen = screen or {"w": 1440, "h": 900}
        self.permissions = permissions or {"accessibility": True, "inputMonitoring": True}
        self.origins = [o.strip() for o in origins if o and o.strip()]
        self.activator = activator or NullActivator()
        self.clock = clock
        self.log = log
        self.app_name = app_name
        self.hotkeys = dict(DEFAULT_HOTKEYS)
        #: True = listener running, False = it failed (likely Input Monitoring), None = turned off on purpose.
        self.hotkeys_available: Optional[bool] = True
        self.area: Optional[tuple[float, float, float, float]] = None
        self.down = False
        self.pos: Optional[tuple[float, float]] = None
        self.last_msg = clock()
        self.client = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.server = None
        self._lock = threading.RLock()
        self._watchdog: Optional[asyncio.Task] = None
        self._stop: Optional[asyncio.Event] = None
        self._tasks: set[asyncio.Task] = set()

    # ------------------------------------------------------------------ fail safe

    def release(self, reason: str) -> bool:
        """Release the left button if held. Safe to call from anywhere, any number of times."""
        with self._lock:
            if not self.down:
                return False
            err = None
            for _ in range(2):
                try:
                    self.mouse.release(self.button)
                    err = None
                    break
                except Exception as e:  # retry once, then give up loudly
                    err = e
            self.down = False
        self.log(f"button released ({reason})" + (f"; release raised {err!r}" if err else ""))
        self._send({"t": "state", "down": False, "reason": reason})
        return True

    async def watchdog(self) -> None:
        while True:
            await asyncio.sleep(WATCHDOG_TICK_S)
            try:
                if self.down and self.clock() - self.last_msg > SILENCE_S:
                    self.release("no message for 300 ms")
            except Exception as e:  # never let the watchdog die
                self.log(f"watchdog error {e!r}")

    # ------------------------------------------------------------------ outbound

    def _send(self, obj: dict) -> None:
        ws, loop = self.client, self.loop
        if ws is None or loop is None or loop.is_closed():
            return
        text = json.dumps(obj)

        async def go():
            try:
                await ws.send(text)
            except Exception:
                pass

        def schedule():
            t = loop.create_task(go())
            self._tasks.add(t)
            t.add_done_callback(self._tasks.discard)

        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            schedule()
        elif loop.is_running():
            loop.call_soon_threadsafe(schedule)

    def _error(self, msg: str) -> None:
        self.log(f"error → browser: {msg}")
        self._send({"t": "error", "msg": msg})

    def hello(self) -> dict:
        return {
            "t": "hello",
            "screen": dict(self.screen),
            "version": VERSION,
            "permissions": dict(self.permissions),
            "hotkeys": dict(self.hotkeys),
            "hotkeysAvailable": self.hotkeys_available,
        }

    def permission_errors(self) -> list[str]:
        return permission_messages(self.permissions, self.app_name)

    # ------------------------------------------------------------------ hotkeys

    def on_hotkey_key(self, name: str) -> None:
        """Called (on the loop thread) when a global key is pressed (auto-repeat already dropped)."""
        for hid, key in self.hotkeys.items():
            if key == name:
                if hid == "pause":
                    self.release("pause hotkey")
                self.log(f"hotkey {name} → {hid}")
                self._send({"t": "hotkey", "id": hid})

    # ------------------------------------------------------------------ inbound

    def _clamp(self, x: float, y: float) -> tuple[float, float]:
        w, h = self.screen["w"], self.screen["h"]
        return (min(max(x, 0.0), w - 1.0), min(max(y, 0.0), h - 1.0))

    async def handle_message(self, raw: Any) -> None:
        self.last_msg = self.clock()
        if not isinstance(raw, str):
            self._error("binary frames are not supported; send JSON text")
            return
        try:
            msg = json.loads(raw)
        except ValueError:
            self._error("bad JSON")
            return
        if not isinstance(msg, dict) or not isinstance(msg.get("t"), str):
            self._error('messages look like {"t": "move", ...}')
            return
        t = msg["t"]
        if t == "ping":
            return
        if t == "move":
            x, y = finite(msg.get("x")), finite(msg.get("y"))
            if x is None or y is None:
                self._error("move needs finite x and y (screen points)")
                return
            x, y = self._clamp(x, y)
            if self.down and self.area is not None and not inside(self.area, x, y):
                self.release("move left the drawing area")
            with self._lock:
                self.mouse.position = (x, y)
                self.pos = (x, y)
            return
        if t == "down":
            if self.down:
                return  # never double-press
            if self.area is not None and self.pos is not None and not inside(self.area, *self.pos):
                self._error("down refused: the pointer is outside the drawing area")
                return
            with self._lock:
                self.mouse.press(self.button)
                self.down = True
            self._send({"t": "state", "down": True})
            return
        if t == "up":
            self.release("up")
            return
        if t == "click":
            self.release("click")
            with self._lock:
                self.mouse.click(self.button, 1)
            return
        if t == "keys":
            try:
                mods, key = parse_combo(msg.get("combo"))
            except ValueError as e:
                self._error(str(e))
                return
            self.release("keys")
            app = msg.get("app")
            if isinstance(app, str) and app:
                if not self.activator.is_frontmost(app):
                    if not self.activator.activate(app):
                        name = APPS.get(app, (None, app))[1]
                        self._error(f"{name} is not open. Open {name}, then try again.")
                        return
                    deadline = self.clock() + ACTIVATE_WAIT_S
                    while not self.activator.is_frontmost(app) and self.clock() < deadline:
                        await asyncio.sleep(0.03)
                    await asyncio.sleep(0.05)
            self.send_combo(mods, key)
            return
        if t == "config":
            self.apply_config(msg)
            return
        self._error(f"unknown message type {t!r}")

    def send_combo(self, mods: list[str], key: str) -> None:
        pressed = []
        with self._lock:
            try:
                for m in mods:
                    k = self.resolve_key(m)
                    self.keyboard.press(k)
                    pressed.append(k)
                k = self.resolve_key(key)
                self.keyboard.press(k)
                self.keyboard.release(k)
            finally:
                for k in reversed(pressed):  # modifiers are never left held
                    try:
                        self.keyboard.release(k)
                    except Exception:
                        pass
        self.log(f"keys {'+'.join(mods + [key])}")

    def apply_config(self, msg: dict) -> None:
        hk = msg.get("hotkeys")
        if hk is not None:
            if not isinstance(hk, dict):
                self._error("config.hotkeys must be an object like {\"pen\": \"f8\", \"pause\": \"f9\"}")
            else:
                new = dict(self.hotkeys)
                ok = True
                for hid, key in hk.items():
                    if hid not in DEFAULT_HOTKEYS:
                        self._error(f"unknown hotkey id {hid!r}")
                        ok = False
                        continue
                    k = str(key).lower() if isinstance(key, str) else ""
                    if k not in HOTKEY_KEYS:
                        self._error(f"hotkey {key!r} is not allowed: use a function key F1–F20 (never Space, letters or modifiers)")
                        ok = False
                        continue
                    new[hid] = k
                if ok and len(set(new.values())) != len(new):
                    self._error("pen and pause need different keys")
                    ok = False
                if ok:
                    self.hotkeys = new
                    self.log(f"hotkeys {self.hotkeys}")
        if "area" in msg:
            if msg["area"] is None:
                self.area = None
            else:
                a = parse_area(msg["area"])
                if a is None:
                    self._error("config.area must be {x, y, w, h} in screen points")
                else:
                    self.area = a
                    if self.down and self.pos is not None and not inside(a, *self.pos):
                        self.release("drawing area changed")

    # ------------------------------------------------------------------ connections

    def process_request(self, connection, request):
        origin = request.headers.get("Origin")
        if origin not in self.origins:
            self.log(f"REJECTED connection from origin {origin!r} (allowed: {', '.join(self.origins)})")
            return connection.respond(http.HTTPStatus.FORBIDDEN, "Origin not allowed\n")
        cur = self.client
        if cur is not None and cur is not connection:
            closed = getattr(getattr(cur, "state", None), "name", "") == "CLOSED"
            if not closed and self.clock() - self.last_msg <= STALE_CLIENT_S:
                self.log("REJECTED a second client (one Steady page at a time)")
                return connection.respond(http.HTTPStatus.CONFLICT, "Another Steady page is already connected\n")
            self.release("replaced by a new client")
            if not closed and self.loop is not None:
                t = self.loop.create_task(cur.close(4000, "replaced by a new client"))
                self._tasks.add(t)
                t.add_done_callback(self._tasks.discard)
        self.client = connection
        self.last_msg = self.clock()
        return None

    async def handler(self, ws) -> None:
        if self.client is not ws:
            await ws.close(4001, "not the active client")
            return
        self.log("client connected")
        try:
            await ws.send(json.dumps(self.hello()))
            for m in self.permission_errors():
                await ws.send(json.dumps({"t": "error", "msg": m}))
            if self.hotkeys_available is False and self.permissions.get("inputMonitoring") is not False:
                await ws.send(json.dumps({"t": "error", "msg": permission_messages({"inputMonitoring": False}, self.app_name)[0]}))
            async for raw in ws:
                try:
                    await self.handle_message(raw)
                except Exception as e:
                    self.release("exception")
                    self._error(f"helper error: {e!r}")
        except Exception as e:
            if type(e).__name__ not in ("ConnectionClosedOK", "ConnectionClosedError", "ConnectionClosed"):
                self.log(f"connection error {e!r}")
        finally:
            self.release("socket closed")
            if self.client is ws:
                self.client = None
            self.log("client disconnected")

    async def start(self, port: int = DEFAULT_PORT, host: str = HOST):
        from websockets.asyncio.server import serve

        self.loop = asyncio.get_running_loop()
        self.loop.set_exception_handler(self._loop_exception)
        self.server = await serve(
            self.handler,
            host,
            port,
            origins=list(self.origins),
            process_request=self.process_request,
            max_size=4096,
            compression=None,
        )
        self._watchdog = asyncio.create_task(self.watchdog())
        return self.server

    @property
    def port(self) -> int:
        return self.server.sockets[0].getsockname()[1]

    async def stop(self) -> None:
        self.release("shutdown")
        if self._watchdog:
            self._watchdog.cancel()
        if self.server is not None:
            self.server.close()
            await self.server.wait_closed()
        self.release("shutdown")

    def _loop_exception(self, loop, context):
        self.release("unhandled exception")
        loop.default_exception_handler(context)

    async def run_forever(self, port: int, host: str = HOST) -> None:
        self._stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            try:
                loop.add_signal_handler(sig, self._on_signal, sig)
            except (NotImplementedError, RuntimeError):
                pass
        try:
            await self.start(port, host)
            self.log(
                f"Steady helper v{VERSION} listening on ws://{host}:{self.port} "
                f"(allowed origin: {', '.join(self.origins)}; screen {self.screen['w']}×{self.screen['h']} pt; "
                f"hotkeys pen={self.hotkeys['pen'].upper()} pause={self.hotkeys['pause'].upper()})"
            )
            self.log("Press Ctrl-C to stop. The mouse button is released on exit.")
            await self._stop.wait()
        finally:
            await self.stop()

    def _on_signal(self, sig) -> None:
        self.release(f"signal {signal.Signals(sig).name}")
        if self._stop is not None:
            self._stop.set()


# ----------------------------------------------------------------------------- hotkey listener
#
# The pynput keyboard listener runs in a CHILD process (`--hotkey-child`). If the listener ever
# crashes (macOS input-source APIs are picky about threads), only the child dies: the parent,
# which owns the mouse button and its fail-safe, keeps running. The child prints only
# function-key names ("key f8"), so no other keystrokes ever leave it.


class HotkeyListener:
    """pynput global keyboard listener; calls on_key(name) once per press (no auto-repeat)."""

    def __init__(self, on_key: Callable[[str], None]):
        self.on_key = on_key
        self.pressed: set[str] = set()
        self.listener = None

    @staticmethod
    def key_name(key) -> Optional[str]:
        name = getattr(key, "name", None)  # pynput Key enum members (f8, space, cmd…); KeyCode has none
        return name if isinstance(name, str) else None

    def on_press(self, key):
        name = self.key_name(key)
        if name is None or name not in HOTKEY_KEYS:
            return  # letters, Space, modifiers: never hotkeys
        if name in self.pressed:
            return  # auto-repeat while held
        self.pressed.add(name)
        self.on_key(name)

    def on_release(self, key):
        name = self.key_name(key)
        if name:
            self.pressed.discard(name)

    def start(self) -> bool:
        """True if the listener is running (False usually means Input Monitoring is missing)."""
        from pynput import keyboard

        self.listener = keyboard.Listener(on_press=self.on_press, on_release=self.on_release)
        self.listener.daemon = True
        self.listener.start()
        self.listener.wait()
        time.sleep(0.3)
        return self.listener.is_alive()

    def stop(self) -> None:
        if self.listener is not None:
            try:
                self.listener.stop()
            except Exception:
                pass


def hotkey_child_main() -> int:
    """Entry point of the hotkey child: prints "ready" / "dead", then "key fN" lines until stdin closes."""
    lock = threading.Lock()

    def emit(line: str) -> None:
        with lock:
            try:
                sys.stdout.write(line + "\n")
                sys.stdout.flush()
            except Exception:
                os._exit(0)

    listener = HotkeyListener(lambda name: emit(f"key {name}"))
    try:
        ok = listener.start()
    except Exception as e:
        emit(f"dead {e!r}")
        return 2
    emit("ready" if ok else "dead listener stopped (Input Monitoring?)")
    if not ok:
        return 2
    try:
        sys.stdin.read()  # parent closes the pipe (or dies) → EOF → exit
    finally:
        listener.stop()
    return 0


class HotkeyChild:
    """Parent side: spawns the hotkey child and relays its keys to helper.on_hotkey_key."""

    def __init__(self, helper: Helper):
        self.helper = helper
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.task: Optional[asyncio.Task] = None

    async def start(self) -> bool:
        try:
            self.proc = await asyncio.create_subprocess_exec(
                sys.executable,
                os.path.abspath(__file__),
                "--hotkey-child",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
            )
            assert self.proc.stdout is not None
            first = await asyncio.wait_for(self.proc.stdout.readline(), 8)
        except Exception as e:
            self.helper.log(f"hotkey listener failed to start: {e!r}")
            return False
        line = first.decode(errors="replace").strip()
        if line != "ready":
            self.helper.log(f"hotkey listener not running: {line or 'no output'}")
            return False
        self.task = asyncio.create_task(self._pump())
        return True

    async def _pump(self) -> None:
        assert self.proc is not None and self.proc.stdout is not None
        while True:
            raw = await self.proc.stdout.readline()
            if not raw:
                break
            parts = raw.decode(errors="replace").split()
            if len(parts) == 2 and parts[0] == "key" and parts[1] in HOTKEY_KEYS:
                self.helper.on_hotkey_key(parts[1])
        self.helper.hotkeys_available = False
        self.helper.log("hotkey listener stopped; F8/F9 are unavailable until the helper restarts")
        self.helper._error("The F8 / F9 hotkey listener stopped. Restart the helper (npm run helper). Tiles and voice still work.")

    def stop(self) -> None:
        if self.task:
            self.task.cancel()
        if self.proc and self.proc.returncode is None:
            try:
                if self.proc.stdin:
                    self.proc.stdin.close()
                self.proc.terminate()
            except Exception:
                pass


# ----------------------------------------------------------------------------- main


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Steady desktop helper: moves the mouse for Steady's Desktop mode.")
    p.add_argument("--port", type=int, default=int(os.environ.get("STEADY_PORT", DEFAULT_PORT)))
    p.add_argument(
        "--origin",
        default=os.environ.get("STEADY_ORIGIN", DEFAULT_ORIGIN),
        help="allowed page origin(s), comma-separated (default http://localhost:3000; env STEADY_ORIGIN)",
    )
    p.add_argument("--dry-run", action="store_true", help="print mouse/keyboard actions instead of performing them")
    p.add_argument("--no-hotkeys", action="store_true", help="do not start the global F8/F9 listener")
    p.add_argument("--hotkey-child", action="store_true", help=argparse.SUPPRESS)
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    if args.hotkey_child:
        return hotkey_child_main()
    origins = [o.strip() for o in args.origin.split(",") if o.strip()]
    app = terminal_app_name()
    if args.dry_run:
        mouse, kb, button, resolve = PrintingMouse(), PrintingKeyboard(), "left", (lambda n: n)
        perms: dict[str, Optional[bool]] = {"accessibility": True, "inputMonitoring": True}
        activator: Any = NullActivator()
        print("DRY RUN: mouse and keyboard actions are printed, not performed.", flush=True)
    else:
        if sys.platform != "darwin":
            print("Warning: the Steady helper is built and tested for macOS only.", flush=True)
        mouse, kb, button, resolve = real_controllers()
        perms = detect_permissions()
        activator = AppActivator() if sys.platform == "darwin" else NullActivator()

    helper = Helper(
        mouse,
        kb,
        button=button,
        key_resolver=resolve,
        screen=detect_screen(),
        permissions=perms,
        origins=origins,
        activator=activator,
        app_name=app,
    )

    # Fail safe on every exit path: atexit, thread exceptions, signals (run_forever), finally below.
    atexit.register(helper.release, "exit")
    prev_thread_hook = threading.excepthook

    def thread_hook(a):
        helper.release(f"exception in thread {a.thread.name if a.thread else '?'}")
        prev_thread_hook(a)

    threading.excepthook = thread_hook

    for m in permission_messages(perms, app):
        print("\n*** PERMISSION NEEDED ***\n" + m + "\n", flush=True)
    if perms.get("accessibility") is None:
        print(
            "Could not check the Accessibility permission. If the pointer does not move, enable Accessibility for "
            f"{app} in System Settings › Privacy & Security › Accessibility.",
            flush=True,
        )

    hot: Optional[HotkeyChild] = None

    async def amain():
        nonlocal hot
        if args.no_hotkeys or args.dry_run:
            helper.hotkeys_available = None
            print("Global hotkeys are off (--no-hotkeys / --dry-run).", flush=True)
        else:
            hot = HotkeyChild(helper)
            ok = await hot.start()
            helper.hotkeys_available = ok
            if not ok and perms.get("inputMonitoring") is not False:
                print("\n*** PERMISSION NEEDED ***\n" + permission_messages({"inputMonitoring": False}, app)[0] + "\n", flush=True)
        try:
            await helper.run_forever(args.port)
        finally:
            if hot is not None:
                hot.stop()

    try:
        asyncio.run(amain())
    except OSError as e:
        helper.release("exit")
        print(f"Could not listen on {HOST}:{args.port}: {e}. Is another Steady helper already running?", flush=True)
        return 1
    except KeyboardInterrupt:
        pass
    finally:
        helper.release("exit")
    print("Steady helper stopped. Mouse button released.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
