import { describe, expect, it } from "vitest";
import type { PenState, PointerFrame, Vec2 } from "@/pipeline/types";
import { createDesktopBridge, HELPER_URL, STORAGE_KEY, type BridgeDeps } from "./bridge";
import type { CoreConfig } from "./core";

class FakeSocket {
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  closedWith: number | null = null;
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(public url: string) {}
  send(d: string) {
    if (this.readyState !== 1) throw new Error("not open");
    this.sent.push(JSON.parse(d));
  }
  close(code?: number) {
    this.closedWith = code ?? 1000;
    this.readyState = 3;
    this.onclose?.({ code });
  }
  // server side
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  serverSend(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  types() {
    return this.sent.map((m) => m.t);
  }
}

function harness(opts: { origin?: string; storage?: Map<string, string> } = {}) {
  let now = 0;
  type Timer = { fn: () => void; at: number; every?: number; id: number };
  let timers: Timer[] = [];
  let nextId = 1;
  const sockets: FakeSocket[] = [];
  const statuses: string[] = [];
  const store = opts.storage ?? new Map<string, string>();
  const cfg: CoreConfig = { rIn: 15, dwellMs: 800, dwellEnabled: true, paused: false };
  let appCb: (() => void) | null = null;
  let page: { hide(): void; unload(): void } | null = null;
  const deps: Partial<BridgeDeps> = {
    url: HELPER_URL,
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    now: () => now,
    setInterval: (fn, ms) => {
      const t = { fn, at: now + ms, every: ms, id: nextId++ };
      timers.push(t);
      return t.id;
    },
    clearInterval: (h) => void (timers = timers.filter((t) => t.id !== h)),
    setTimeout: (fn, ms) => {
      const t = { fn, at: now + ms, id: nextId++ };
      timers.push(t);
      return t.id;
    },
    clearTimeout: (h) => void (timers = timers.filter((t) => t.id !== h)),
    appConfig: () => cfg,
    status: (t) => void statuses.push(t),
    subscribeApp: (cb) => {
      appCb = cb;
      return () => (appCb = null);
    },
    listenPage: (h) => {
      page = h;
      return () => (page = null);
    },
    pageOrigin: () => opts.origin ?? "http://localhost:3000",
    screenFallback: () => null,
  };
  const bridge = createDesktopBridge(deps);
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      if (due.every) due.at += due.every;
      else timers = timers.filter((t) => t !== due);
      due.fn();
    }
    now = end;
  };
  const sock = () => sockets[sockets.length - 1];
  const connect = async (hello: Record<string, unknown> = {}) => {
    const p = bridge.enable();
    sock().open();
    sock().serverSend({ t: "hello", screen: { w: 1500, h: 1000 }, version: 1, permissions: { accessibility: true, inputMonitoring: true }, ...hello });
    await p;
    bridge.onFrame(frame({ x: 2000, y: 2000 })); // pen seen up once after connecting
    return sock();
  };
  let ft = 0;
  const frame = (p: Vec2 | null, pen: PenState = "HOVER"): PointerFrame => {
    ft += 1000 / 30;
    return {
      t: ft,
      tracking: p ? "ok" : "lost",
      lossReason: p ? null : "no-hand",
      rawCamera: null,
      filteredCamera: null,
      rawCanvas: p,
      filtered: p,
      pointer: p,
      pen,
      dwell: { kind: null, progress: 0, anchor: null, armed: true },
      events: [],
    };
  };
  const frames = (p: Vec2 | null, ms: number, pen: PenState = "HOVER") => {
    for (let i = 0; i < ms / (1000 / 30); i++) {
      advance(1000 / 30);
      bridge.onFrame(frame(p, pen));
    }
  };
  return { bridge, sockets, sock, statuses, store, cfg, advance, connect, frames, frame, app: () => appCb, page: () => page };
}

describe("connection", () => {
  it("connects to ws://127.0.0.1:8765, reads hello, sends config, pings every 100 ms", async () => {
    const h = harness();
    expect(h.bridge.state).toBe("off");
    const p = h.bridge.enable();
    expect(h.bridge.state).toBe("connecting");
    expect(h.sock().url).toBe("ws://127.0.0.1:8765");
    h.sock().open();
    h.sock().serverSend({ t: "hello", screen: { w: 1500, h: 1000 }, version: 1, permissions: { accessibility: true, inputMonitoring: true } });
    await p;
    expect(h.bridge.state).toBe("connected");
    expect(h.bridge.error).toBeNull();
    expect(h.bridge.screen).toEqual({ w: 1500, h: 1000 });
    expect(h.bridge.drawingArea).toEqual({ x: 0, y: 0, w: 1500, h: 1000 });
    expect(h.sock().sent[0]).toEqual({ t: "config", area: { x: 0, y: 0, w: 1500, h: 1000 }, hotkeys: { pen: "f8", pause: "f9" } });
    h.advance(1000);
    expect(h.sock().types().filter((t) => t === "ping")).toHaveLength(10);
  });

  it("helper not running: clear error and reconnect with backoff", async () => {
    const h = harness();
    const p = h.bridge.enable();
    h.sock().drop();
    await p;
    expect(h.bridge.state).toBe("error");
    expect(h.bridge.error).toContain("Helper not running: run `npm run helper` in a terminal");
    expect(h.sockets).toHaveLength(1);
    h.advance(500);
    expect(h.sockets).toHaveLength(2);
    h.sock().drop();
    h.advance(999);
    expect(h.sockets).toHaveLength(2);
    h.advance(1);
    expect(h.sockets).toHaveLength(3);
    h.sock().open();
    h.sock().serverSend({ t: "hello", screen: { w: 800, h: 600 }, permissions: { accessibility: true, inputMonitoring: true } });
    expect(h.bridge.state).toBe("connected");
    h.sock().drop(); // lost after connecting: retry starts from 500 ms again
    expect(h.bridge.error).toContain("Lost the helper");
    h.advance(500);
    expect(h.sockets).toHaveLength(4);
  });

  it("explains STEADY_ORIGIN when the page is not on localhost:3000", async () => {
    const h = harness({ origin: "http://localhost:3217" });
    const p = h.bridge.enable();
    h.sock().drop();
    await p;
    expect(h.bridge.error).toContain("STEADY_ORIGIN=http://localhost:3217 npm run helper");
  });

  it("shows the helper's permission text; Accessibility missing is an error, Input Monitoring a warning", async () => {
    const h = harness();
    const s = await h.connect({ permissions: { accessibility: false, inputMonitoring: false } });
    const ax = "Enable Accessibility for Terminal in System Settings › Privacy & Security › Accessibility, then quit and restart the helper";
    s.serverSend({ t: "error", msg: ax });
    s.serverSend({ t: "error", msg: "Enable Input Monitoring for Terminal in System Settings › Privacy & Security › Input Monitoring" });
    expect(h.bridge.state).toBe("error");
    expect(h.bridge.error).toBe(ax);
    expect(h.bridge.warning).toContain("Input Monitoring");

    const h2 = harness();
    const s2 = await h2.connect({ permissions: { accessibility: true, inputMonitoring: false } });
    s2.serverSend({ t: "error", msg: "Enable Input Monitoring for Terminal in System Settings › Privacy & Security › Input Monitoring" });
    expect(h2.bridge.state).toBe("connected");
    expect(h2.bridge.error).toBeNull();
    expect(h2.bridge.warning).toContain("Input Monitoring");
  });

  it("other helper errors become status text", async () => {
    const h = harness();
    const s = await h.connect();
    s.serverSend({ t: "error", msg: "Krita is not open. Open Krita, then try again." });
    expect(h.statuses.at(-1)).toBe("Krita is not open. Open Krita, then try again.");
    expect(h.bridge.state).toBe("connected");
  });

  it("replaced by another page (close 4000) says so", async () => {
    const h = harness();
    const s = await h.connect();
    s.drop(4000);
    expect(h.bridge.error).toContain("Another Steady page");
  });

  it("disable sends up, closes the socket and stops pinging", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    expect(s.types()).toContain("down");
    h.bridge.disable();
    expect(s.types().at(-1)).toBe("up");
    expect(s.closedWith).toBe(1000);
    expect(h.bridge.state).toBe("off");
    const n = s.sent.length;
    h.advance(1000);
    expect(s.sent.length).toBe(n);
    expect(h.sockets).toHaveLength(1);
  });
});

describe("fail safe from the browser side", () => {
  it("tracking loss → up", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    h.bridge.onFrame(h.frame(null, "DRAWING"));
    expect(s.types().at(-1)).toBe("up");
  });

  it("pause (store) → up immediately", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    h.cfg.paused = true;
    h.app()!();
    expect(s.types().at(-1)).toBe("up");
  });

  it("page hidden → up; pagehide/beforeunload → up and close", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    h.page()!.hide();
    expect(s.types().at(-1)).toBe("up");
    h.frames({ x: 101, y: 100 }, 100, "DRAWING");
    expect(s.types().at(-1)).not.toBe("up");
    h.page()!.unload();
    expect(s.types().at(-1)).toBe("up");
    expect(s.closedWith).toBe(1001);
  });

  it("frames stop while held (rVFC stalled / covered window) → watchdog up within ~400 ms", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    expect(h.bridge.buttonDown).toBe(true);
    h.advance(250);
    expect(s.types()).not.toContain("up");
    h.advance(150);
    expect(s.types()).toContain("up");
    expect(h.bridge.buttonDown).toBe(false);
  });

  it("pen-up events lift immediately", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    h.bridge.onPenEvent({ type: "pen-up", t: 0, cause: "voice" });
    expect(s.types().at(-1)).toBe("up");
  });

  it("helper state messages update the button", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    s.serverSend({ t: "state", down: false, reason: "pause hotkey" });
    expect(h.bridge.buttonDown).toBe(false);
  });
});

describe("drawing area", () => {
  it("isInside uses the area; down only inside; dwell-click outside", async () => {
    const h = harness();
    const s = await h.connect();
    h.bridge.setDrawingArea({ x: 200, y: 100, w: 800, h: 600 });
    expect(s.sent.at(-1)).toEqual({ t: "config", area: { x: 200, y: 100, w: 800, h: 600 } });
    expect(h.bridge.isInside({ x: 10, y: 10 })).toBe(true);
    expect(h.bridge.isInside({ x: -10, y: 10 })).toBe(false);
    expect(h.bridge.isInside(null)).toBe(false);
    h.frames({ x: -100, y: 100 }, 1500, "HOVER");
    expect(s.types().filter((t) => t === "click")).toHaveLength(1);
    expect(s.types()).not.toContain("down");
  });

  it("is persisted in localStorage and restored (clamped to the screen)", async () => {
    const storage = new Map<string, string>();
    const h = harness({ storage });
    await h.connect();
    h.bridge.setDrawingArea({ x: 200, y: 100, w: 800, h: 600 });
    expect(JSON.parse(storage.get(STORAGE_KEY)!).area).toEqual({ x: 200, y: 100, w: 800, h: 600 });
    const h2 = harness({ storage });
    const s2 = await h2.connect({ screen: { w: 900, h: 1000 } });
    expect(h2.bridge.drawingArea).toEqual({ x: 200, y: 100, w: 700, h: 600 });
    expect(s2.sent[0]).toMatchObject({ t: "config", area: { x: 200, y: 100, w: 700, h: 600 } });
  });

  it("setup by dwelling on two corners; F8 marks a corner during setup and is not forwarded", async () => {
    const h = harness();
    const s = await h.connect();
    const got: string[] = [];
    h.bridge.onHotkey((id) => got.push(id));
    h.bridge.startAreaSetup();
    expect(h.bridge.drawingArea).toEqual({ x: 0, y: 0, w: 1500, h: 1000 });
    expect(h.statuses.at(-1)).toContain("TOP-LEFT");
    h.frames({ x: 700, y: 500 }, 200);
    h.frames({ x: 300, y: 200 }, 1500);
    expect(h.statuses.at(-1)).toContain("BOTTOM-RIGHT");
    h.frames({ x: 1200, y: 900 }, 300);
    s.serverSend({ t: "hotkey", id: "pen" });
    expect(got).toEqual([]);
    expect(h.bridge.drawingArea).toEqual({ x: 300, y: 200, w: 900, h: 700 });
    expect(h.statuses.at(-1)).toContain("Drawing area set");
    expect(s.sent.at(-1)).toEqual({ t: "config", area: { x: 300, y: 200, w: 900, h: 700 } });
    s.serverSend({ t: "hotkey", id: "pen" });
    s.serverSend({ t: "hotkey", id: "pause" });
    expect(got).toEqual(["pen", "pause"]);
  });

  it("setup needs the helper", () => {
    const h = harness();
    h.bridge.startAreaSetup();
    expect(h.bridge.setupStage).toBeNull();
    expect(h.statuses.at(-1)).toContain("Connect the helper first");
  });

  it("dwell click can be turned off (persisted)", async () => {
    const h = harness();
    const s = await h.connect();
    h.bridge.setDwellClick(false);
    expect(h.bridge.dwellClick).toBe(false);
    expect(JSON.parse(h.store.get(STORAGE_KEY)!).dwellClick).toBe(false);
    h.frames({ x: -100, y: 100 }, 2000, "HOVER");
    expect(s.types()).not.toContain("click");
  });
});

describe("sendActionKeys", () => {
  it("app-facing actions become Krita keystrokes; Steady and canvas-only actions are not handled", async () => {
    const h = harness();
    expect(h.bridge.sendActionKeys("undo")).toBe(false); // Desktop mode off
    const s = await h.connect();
    expect(h.bridge.sendActionKeys("undo")).toBe(true);
    expect(s.sent.at(-1)).toEqual({ t: "keys", combo: "cmd+z", app: "krita" });
    expect(h.statuses.at(-1)).toBe("Krita: Undo (⌘Z)");
    expect(h.bridge.sendActionKeys("tool.eraser")).toBe(true);
    expect(s.sent.at(-1)).toEqual({ t: "keys", combo: "e", app: "krita" });
    expect(h.bridge.sendActionKeys("pen.toggle")).toBe(false);
    expect(h.bridge.sendActionKeys("mic.toggle")).toBe(false);
    expect(h.bridge.sendActionKeys("shape.circle")).toBe(false);
  });

  it("keys release a held button first", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100, "DRAWING");
    h.bridge.sendActionKeys("undo");
    expect(s.types().slice(-2)).toEqual(["up", "keys"]);
  });

  it("not connected: handled (so the Steady canvas is not changed) with a status explaining why", async () => {
    const h = harness();
    const p = h.bridge.enable();
    h.sock().drop();
    await p;
    expect(h.bridge.sendActionKeys("undo")).toBe(true);
    expect(h.statuses.at(-1)).toContain("Helper not running");
  });

  it("dot clicks inside the area", async () => {
    const h = harness();
    const s = await h.connect();
    h.frames({ x: 100, y: 100 }, 100);
    expect(h.bridge.sendActionKeys("dot")).toBe(true);
    expect(s.types().at(-1)).toBe("click");
  });
});

describe("subscribe / snapshot", () => {
  it("notifies on discrete changes only and keeps a stable snapshot otherwise", async () => {
    const h = harness();
    let n = 0;
    h.bridge.subscribe(() => n++);
    await h.connect();
    const before = n;
    const snap = h.bridge.getSnapshot();
    h.advance(1000); // pings only
    expect(n).toBe(before);
    expect(h.bridge.getSnapshot()).toBe(snap);
    expect(snap.state).toBe("connected");
  });
});
