"""Tests for the Steady desktop helper. Never touch the real mouse or keyboard: every test
injects a fake controller (or runs the helper with --dry-run in a subprocess).

Run: `npm run test:helper` (= `bash helper/run.sh --test`).
"""
from __future__ import annotations

import asyncio
import json
import os
import signal
import socket
import subprocess
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import steady_helper as sh  # noqa: E402
from websockets.asyncio.client import connect  # noqa: E402
from websockets.exceptions import InvalidStatus  # noqa: E402

ORIGIN = "http://localhost:3000"
HERE = os.path.dirname(os.path.abspath(__file__))


class FakeMouse:
    def __init__(self):
        self.events: list[tuple] = []
        self._pos = (0.0, 0.0)
        self.held = False
        self.raise_on_move_while_held = False

    @property
    def position(self):
        return self._pos

    @position.setter
    def position(self, p):
        if self.raise_on_move_while_held and self.held:
            raise RuntimeError("simulated failure while dragging")
        self._pos = p
        self.events.append(("move", round(p[0], 1), round(p[1], 1), self.held))

    def press(self, button):
        self.held = True
        self.events.append(("press", button, time.monotonic()))

    def release(self, button):
        self.held = False
        self.events.append(("release", button, time.monotonic()))

    def click(self, button, count=1):
        self.events.append(("click", button, count))

    def kinds(self):
        return [e[0] for e in self.events]

    def count(self, kind):
        return self.kinds().count(kind)

    def release_time(self):
        for e in self.events:
            if e[0] == "release":
                return e[2]
        return None


class FakeKeyboard:
    def __init__(self):
        self.events: list[tuple[str, str]] = []

    def press(self, k):
        self.events.append(("down", k))

    def release(self, k):
        self.events.append(("up", k))


class FakeActivator:
    def __init__(self, running=True, front=True):
        self.running = running
        self.front = front
        self.activated = []

    def is_frontmost(self, app):
        return self.front

    def activate(self, app):
        self.activated.append(app)
        if self.running:
            self.front = True
        return self.running


async def wait_for(pred, timeout=1.0, step=0.005):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        await asyncio.sleep(step)
    return pred()


class HelperTestBase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mouse = FakeMouse()
        self.kb = FakeKeyboard()
        self.activator = FakeActivator()
        self.logs: list[str] = []
        self.helper = sh.Helper(
            self.mouse,
            self.kb,
            screen={"w": 1000, "h": 800},
            origins=[ORIGIN],
            activator=self.activator,
            log=self.logs.append,
        )
        await self.helper.start(port=0)
        self.uri = f"ws://127.0.0.1:{self.helper.port}"
        self.sockets = []

    async def asyncTearDown(self):
        for ws in self.sockets:
            try:
                await ws.close()
            except Exception:
                pass
        await self.helper.stop()

    async def open(self, origin=ORIGIN):
        ws = await connect(self.uri, origin=origin)
        self.sockets.append(ws)
        hello = json.loads(await asyncio.wait_for(ws.recv(), 1))
        return ws, hello

    async def send(self, ws, **msg):
        await ws.send(json.dumps(msg))

    async def recv_type(self, ws, t, timeout=1.0):
        end = time.monotonic() + timeout
        while True:
            left = end - time.monotonic()
            if left <= 0:
                raise AssertionError(f"no {t!r} message within {timeout}s")
            m = json.loads(await asyncio.wait_for(ws.recv(), left))
            if m.get("t") == t:
                return m

    async def press(self, ws, x=500, y=400):
        await self.send(ws, t="move", x=x, y=y)
        await self.send(ws, t="down")
        await self.recv_type(ws, "state")
        self.assertTrue(self.helper.down)
        self.assertTrue(self.mouse.held)


class TestHello(HelperTestBase):
    async def test_hello_has_screen_version_permissions(self):
        _, hello = await self.open()
        self.assertEqual(hello["t"], "hello")
        self.assertEqual(hello["screen"], {"w": 1000, "h": 800})
        self.assertEqual(hello["version"], 1)
        self.assertEqual(hello["permissions"], {"accessibility": True, "inputMonitoring": True})
        self.assertEqual(hello["hotkeys"], {"pen": "f8", "pause": "f9"})

    async def test_missing_permissions_are_sent_as_errors_after_hello(self):
        self.helper.permissions = {"accessibility": False, "inputMonitoring": False}
        self.helper.app_name = "Terminal"
        ws, hello = await self.open()
        self.assertEqual(hello["permissions"], {"accessibility": False, "inputMonitoring": False})
        e1 = await self.recv_type(ws, "error")
        e2 = await self.recv_type(ws, "error")
        self.assertIn("Accessibility for Terminal", e1["msg"])
        self.assertIn("Privacy & Security › Accessibility", e1["msg"])
        self.assertIn("Input Monitoring for Terminal", e2["msg"])


class TestFailSafe(HelperTestBase):
    async def test_button_released_after_300ms_of_silence(self):
        ws, _ = await self.open()
        await self.press(ws)
        t_last = time.monotonic()  # the state reply arrives after our last message
        self.assertTrue(await wait_for(lambda: not self.mouse.held, timeout=1.0))
        dt = self.mouse.release_time() - t_last
        self.assertGreaterEqual(dt, 0.25, f"released too early ({dt:.3f}s)")
        self.assertLessEqual(dt, 0.45, f"released too late ({dt:.3f}s)")
        m = await self.recv_type(ws, "state")
        self.assertEqual(m["down"], False)
        self.assertIn("300 ms", m["reason"])
        self.assertEqual(self.mouse.count("press"), 1)
        self.assertEqual(self.mouse.count("release"), 1)

    async def test_pings_every_100ms_keep_the_button_held(self):
        ws, _ = await self.open()
        await self.press(ws)
        for _ in range(8):
            await asyncio.sleep(0.1)
            await self.send(ws, t="ping")
        self.assertTrue(self.mouse.held, "pings must keep the button held")
        self.assertTrue(await wait_for(lambda: not self.mouse.held, timeout=0.6))

    async def test_moves_while_held_are_drags_and_keep_it_held(self):
        ws, _ = await self.open()
        await self.press(ws, 100, 100)
        for i in range(10):
            await asyncio.sleep(0.05)
            await self.send(ws, t="move", x=100 + 10 * i, y=100)
        await asyncio.sleep(0.02)
        drags = [e for e in self.mouse.events if e[0] == "move" and e[3]]
        self.assertGreaterEqual(len(drags), 9)
        self.assertTrue(self.mouse.held)

    async def test_button_released_on_socket_close(self):
        ws, _ = await self.open()
        await self.press(ws)
        await ws.close()
        self.assertTrue(await wait_for(lambda: not self.mouse.held, timeout=0.2))
        self.assertTrue(any("socket closed" in l for l in self.logs))

    async def test_button_released_when_connection_drops_without_close_frame(self):
        ws, _ = await self.open()
        await self.press(ws)
        ws.transport.abort()
        self.assertTrue(await wait_for(lambda: not self.mouse.held, timeout=0.5))

    async def test_exception_while_held_releases_button_and_reports(self):
        ws, _ = await self.open()
        await self.press(ws)
        self.mouse.raise_on_move_while_held = True
        await self.send(ws, t="move", x=10, y=10)
        err = await self.recv_type(ws, "error")
        self.assertIn("simulated failure", err["msg"])
        self.assertFalse(self.mouse.held)
        # The connection keeps working afterwards.
        self.mouse.raise_on_move_while_held = False
        await self.send(ws, t="move", x=20, y=20)
        self.assertTrue(await wait_for(lambda: self.mouse.position == (20.0, 20.0)))

    async def test_stop_releases_button(self):
        ws, _ = await self.open()
        await self.press(ws)
        await self.helper.stop()
        self.assertFalse(self.mouse.held)

    async def test_release_is_idempotent(self):
        self.assertFalse(self.helper.release("nothing held"))
        self.assertEqual(self.mouse.events, [])


class TestOrigin(HelperTestBase):
    async def assert_rejected(self, origin):
        with self.assertRaises(InvalidStatus) as cm:
            ws = await connect(self.uri, origin=origin)
            self.sockets.append(ws)
        self.assertEqual(cm.exception.response.status_code, 403)

    async def test_bad_origin_is_rejected_and_no_mouse_action(self):
        await self.assert_rejected("http://evil.example")
        await self.assert_rejected("http://localhost:3000.evil.example")
        await self.assert_rejected("http://127.0.0.1:3000")
        await self.assert_rejected("https://localhost:3000")
        await self.assert_rejected("null")
        self.assertEqual(self.mouse.events, [])
        self.assertTrue(any("REJECTED connection from origin 'http://evil.example'" in l for l in self.logs))

    async def test_missing_origin_is_rejected(self):
        with self.assertRaises(InvalidStatus) as cm:
            ws = await connect(self.uri)  # websockets sends no Origin header unless asked
            self.sockets.append(ws)
        self.assertEqual(cm.exception.response.status_code, 403)
        self.assertEqual(self.mouse.events, [])

    async def test_bad_origin_does_not_disturb_the_real_client(self):
        ws, _ = await self.open()
        await self.press(ws)
        await self.assert_rejected("http://evil.example")
        await self.send(ws, t="ping")
        self.assertTrue(self.mouse.held)
        self.assertEqual(self.mouse.count("press"), 1)

    async def test_custom_origin_like_STEADY_ORIGIN(self):
        await self.helper.stop()
        self.helper = sh.Helper(self.mouse, self.kb, origins=["http://localhost:3217"], log=self.logs.append)
        await self.helper.start(port=0)
        self.uri = f"ws://127.0.0.1:{self.helper.port}"
        await self.assert_rejected(ORIGIN)
        ws, hello = await self.open(origin="http://localhost:3217")
        self.assertEqual(hello["t"], "hello")

    def test_origin_cli_and_env(self):
        from unittest import mock

        with mock.patch.dict(os.environ, {"STEADY_ORIGIN": "http://localhost:3217"}):
            self.assertEqual(sh.build_arg_parser().parse_args([]).origin, "http://localhost:3217")
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("STEADY_ORIGIN", None)
            self.assertEqual(sh.build_arg_parser().parse_args([]).origin, ORIGIN)


class TestOneClient(HelperTestBase):
    async def test_second_client_rejected_while_first_is_active(self):
        ws, _ = await self.open()
        with self.assertRaises(InvalidStatus) as cm:
            ws2 = await connect(self.uri, origin=ORIGIN)
            self.sockets.append(ws2)
        self.assertEqual(cm.exception.response.status_code, 409)
        await ws.close()
        await asyncio.sleep(0.05)
        ws3, hello = await self.open()
        self.assertEqual(hello["t"], "hello")

    async def test_silent_stale_client_is_replaced(self):
        ws, _ = await self.open()
        await self.press(ws)
        await asyncio.sleep(sh.STALE_CLIENT_S + 0.1)  # first client went silent (and the watchdog released)
        self.assertFalse(self.mouse.held)
        ws2, hello = await self.open()
        self.assertEqual(hello["t"], "hello")
        self.assertTrue(await wait_for(lambda: ws.state.name == "CLOSED", timeout=1.0))


class TestProtocol(HelperTestBase):
    async def test_double_down_presses_once_and_double_up_is_noop(self):
        ws, _ = await self.open()
        await self.press(ws)
        await self.send(ws, t="down")
        await self.send(ws, t="down")
        await self.send(ws, t="up")
        await self.send(ws, t="up")
        await self.send(ws, t="ping")
        await asyncio.sleep(0.05)
        self.assertEqual(self.mouse.count("press"), 1)
        self.assertEqual(self.mouse.count("release"), 1)

    async def test_up_without_down_does_nothing(self):
        ws, _ = await self.open()
        await self.send(ws, t="up")
        await asyncio.sleep(0.05)
        self.assertEqual(self.mouse.events, [])

    async def test_down_outside_drawing_area_is_refused(self):
        ws, _ = await self.open()
        await self.send(ws, t="config", area={"x": 100, "y": 100, "w": 200, "h": 200})
        await self.send(ws, t="move", x=50, y=50)
        await self.send(ws, t="down")
        err = await self.recv_type(ws, "error")
        self.assertIn("outside the drawing area", err["msg"])
        self.assertEqual(self.mouse.count("press"), 0)
        await self.press(ws, 150, 150)  # inside: allowed

    async def test_moving_out_of_the_area_while_held_releases_first(self):
        ws, _ = await self.open()
        await self.send(ws, t="config", area={"x": 100, "y": 100, "w": 200, "h": 200})
        await self.press(ws, 150, 150)
        await self.send(ws, t="move", x=400, y=400)
        m = await self.recv_type(ws, "state")
        self.assertFalse(m["down"])
        rel = self.mouse.kinds().index("release")
        self.assertEqual(self.mouse.events[rel + 1][:4], ("move", 400.0, 400.0, False), "never drag outside the area")

    async def test_moves_are_clamped_to_the_main_display(self):
        ws, _ = await self.open()
        await self.send(ws, t="move", x=-50, y=5000)
        await self.send(ws, t="move", x="12", y=None)
        err = await self.recv_type(ws, "error")
        self.assertIn("finite x and y", err["msg"])
        self.assertEqual(self.mouse.position, (0.0, 799.0))

    async def test_click_when_up_and_when_held(self):
        ws, _ = await self.open()
        await self.send(ws, t="click")
        self.assertTrue(await wait_for(lambda: self.mouse.count("click") == 1))
        await self.press(ws)
        await self.send(ws, t="click")
        self.assertTrue(await wait_for(lambda: self.mouse.count("click") == 2))
        k = self.mouse.kinds()
        self.assertLess(k.index("release"), len(k) - 1)
        self.assertEqual(k[-2:], ["release", "click"])

    async def test_keys_combo_presses_and_releases_in_order(self):
        ws, _ = await self.open()
        await self.send(ws, t="keys", combo="cmd+shift+z", app="krita")
        self.assertTrue(await wait_for(lambda: len(self.kb.events) == 6))
        self.assertEqual(
            self.kb.events,
            [("down", "cmd"), ("down", "shift"), ("down", "z"), ("up", "z"), ("up", "shift"), ("up", "cmd")],
        )

    async def test_keys_release_the_button_first(self):
        ws, _ = await self.open()
        await self.press(ws)
        await self.send(ws, t="keys", combo="e")
        self.assertTrue(await wait_for(lambda: len(self.kb.events) == 2))
        self.assertFalse(self.mouse.held)

    async def test_invalid_combos_are_refused(self):
        ws, _ = await self.open()
        for combo in ["cmd+space", "ctrl+alt+del", "", "cmd+", "hyper+z", "cmd+cmd+z", "f13", 42, "a" * 50]:
            await self.send(ws, t="keys", combo=combo)
            await self.recv_type(ws, "error")
        self.assertEqual(self.kb.events, [])

    async def test_keys_activate_krita_first_and_refuse_if_it_is_not_open(self):
        ws, _ = await self.open()
        self.activator.front = False
        await self.send(ws, t="keys", combo="b", app="krita")
        self.assertTrue(await wait_for(lambda: len(self.kb.events) == 2))
        self.assertEqual(self.activator.activated, ["krita"])
        self.activator.front = False
        self.activator.running = False
        await self.send(ws, t="keys", combo="e", app="krita")
        err = await self.recv_type(ws, "error")
        self.assertIn("Krita is not open", err["msg"])
        self.assertEqual(len(self.kb.events), 2)

    async def test_bad_messages_get_errors_and_connection_survives(self):
        ws, _ = await self.open()
        await ws.send("not json")
        self.assertIn("bad JSON", (await self.recv_type(ws, "error"))["msg"])
        await ws.send("[1,2]")
        await self.recv_type(ws, "error")
        await self.send(ws, t="teleport")
        self.assertIn("unknown message type", (await self.recv_type(ws, "error"))["msg"])
        await ws.send(b"\x00\x01")
        self.assertIn("binary", (await self.recv_type(ws, "error"))["msg"])
        await self.press(ws)


class TestHotkeys(HelperTestBase):
    async def test_pause_hotkey_releases_and_relays(self):
        ws, _ = await self.open()
        await self.press(ws)
        self.helper.on_hotkey_key("f9")
        m = await self.recv_type(ws, "hotkey")
        self.assertEqual(m["id"], "pause")
        self.assertFalse(self.mouse.held)

    async def test_pen_hotkey_relays_without_release(self):
        ws, _ = await self.open()
        await self.press(ws)
        self.helper.on_hotkey_key("f8")
        m = await self.recv_type(ws, "hotkey")
        self.assertEqual(m["id"], "pen")
        self.assertTrue(self.mouse.held)

    async def test_remap_and_refuse_space_letters_modifiers(self):
        ws, _ = await self.open()
        await self.send(ws, t="config", hotkeys={"pen": "f6"})
        await self.send(ws, t="ping")
        self.assertTrue(await wait_for(lambda: self.helper.hotkeys["pen"] == "f6"))
        for bad in ["space", "a", "cmd", "shift", "enter", 8]:
            await self.send(ws, t="config", hotkeys={"pause": bad})
            await self.recv_type(ws, "error")
        await self.send(ws, t="config", hotkeys={"pause": "f6"})  # same as pen
        self.assertIn("different keys", (await self.recv_type(ws, "error"))["msg"])
        self.assertEqual(self.helper.hotkeys, {"pen": "f6", "pause": "f9"})
        self.helper.on_hotkey_key("f8")  # no longer bound
        self.helper.on_hotkey_key("f6")
        m = await self.recv_type(ws, "hotkey")
        self.assertEqual(m["id"], "pen")


class FakeKey:
    def __init__(self, name):
        self.name = name


class FakeChar:  # pynput KeyCode: no .name
    def __init__(self, char):
        self.char = char


class TestHotkeyListenerFilter(unittest.TestCase):
    def test_only_function_keys_once_per_press(self):
        got = []
        hl = sh.HotkeyListener(got.append)
        for k in [FakeKey("f8"), FakeKey("f8"), FakeKey("f8")]:  # auto-repeat
            hl.on_press(k)
        hl.on_release(FakeKey("f8"))
        hl.on_press(FakeKey("f8"))
        for k in [FakeKey("space"), FakeKey("cmd"), FakeKey("shift"), FakeChar("a"), FakeKey("enter")]:
            hl.on_press(k)
        self.assertEqual(got, ["f8", "f8"])


class TestPure(unittest.TestCase):
    def test_parse_combo(self):
        self.assertEqual(sh.parse_combo("cmd+z"), (["cmd"], "z"))
        self.assertEqual(sh.parse_combo("CMD+Shift+Z"), (["cmd", "shift"], "z"))
        self.assertEqual(sh.parse_combo("]"), ([], "]"))
        self.assertEqual(sh.parse_combo("f12"), ([], "f12"))
        for bad in ["space", "cmd+", "+", "cmd+f13", "win+z", None]:
            with self.assertRaises(ValueError):
                sh.parse_combo(bad)

    def test_permission_messages_name_the_setting(self):
        msgs = sh.permission_messages({"accessibility": False, "inputMonitoring": False}, "iTerm")
        self.assertEqual(len(msgs), 2)
        self.assertIn("System Settings › Privacy & Security › Accessibility", msgs[0])
        self.assertIn("System Settings › Privacy & Security › Input Monitoring", msgs[1])
        self.assertEqual(sh.permission_messages({"accessibility": True, "inputMonitoring": None}, "x"), [])

    def test_detect_permissions_shape(self):
        p = sh.detect_permissions()  # read-only probes, no prompt
        self.assertEqual(set(p), {"accessibility", "inputMonitoring"})


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class TestProcessExit(unittest.IsolatedAsyncioTestCase):
    """Runs the real program with --dry-run (prints instead of moving the mouse) and kills it."""

    async def run_and_signal(self, sig):
        port = free_port()
        proc = subprocess.Popen(
            [sys.executable, os.path.join(HERE, "steady_helper.py"), "--dry-run", "--port", str(port), "--origin", ORIGIN],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        try:
            ws = None
            for _ in range(100):
                try:
                    ws = await connect(f"ws://127.0.0.1:{port}", origin=ORIGIN)
                    break
                except OSError:
                    await asyncio.sleep(0.05)
            self.assertIsNotNone(ws, "helper did not start")
            await ws.recv()
            await ws.send(json.dumps({"t": "move", "x": 10, "y": 10}))
            await ws.send(json.dumps({"t": "down"}))
            m = json.loads(await asyncio.wait_for(ws.recv(), 2))
            self.assertEqual(m, {"t": "state", "down": True})
            proc.send_signal(sig)
            out, _ = await asyncio.get_running_loop().run_in_executor(None, lambda: proc.communicate(timeout=5))
        finally:
            if proc.poll() is None:
                proc.kill()
        return proc.returncode, out

    async def test_sigterm_releases_button(self):
        code, out = await self.run_and_signal(signal.SIGTERM)
        self.assertIn("[dry-run] press left", out)
        self.assertIn("[dry-run] release left", out)
        self.assertIn("button released (signal SIGTERM)", out)
        self.assertLess(out.index("[dry-run] press left"), out.index("[dry-run] release left"))
        self.assertEqual(code, 0)

    async def test_ctrl_c_releases_button(self):
        code, out = await self.run_and_signal(signal.SIGINT)
        self.assertIn("button released (signal SIGINT)", out)
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
