/**
 * Desktop mode bridge (§6a): the browser side of the helper WebSocket (docs/API.md, bottom).
 * Client-only singleton `desktop` implementing the DesktopBridge interface from
 * docs/ARCHITECTURE.md. Heavy logic lives in core.ts / mapping.ts (pure, Vitest-tested);
 * this file owns the socket, timers, persistence and page-lifecycle listeners.
 *
 * Fail safe on this side: `up` on tracking loss (core.step), on any pen-up event, on Pause
 * (store subscription), on disable, on page hide / pagehide / beforeunload, and from the 100 ms
 * watchdog when frames stop while the button is held. The helper independently releases after
 * 300 ms without a message and on socket close.
 */
import { ACTION_BY_ID, type ActionId } from "@/actions";
import { tileRadius } from "@/pipeline/dwell";
import type { PenEvent, PointerFrame, Rect, Size, Vec2 } from "@/pipeline/types";
import { getState, setStatus, subscribe as subscribeStore } from "@/state/store";
import { createDesktopCore, type CoreConfig, type DesktopCore, type OutMsg, type SetupStage } from "./core";
import { fullScreenArea, sanitizeArea } from "./mapping";
import { APP_LABELS, DEFAULT_APP, desktopRoute, isValidHotkey, prettyCombo, shortcutFor, type DesktopAppId } from "./shortcuts";

export const HELPER_URL = "ws://127.0.0.1:8765";
/** The origin the helper allows by default (STEADY_ORIGIN overrides on the helper side). */
export const DEFAULT_HELPER_ORIGIN = "http://localhost:3000";
export const STORAGE_KEY = "steady.desktop";
export const PING_MS = 100;
export const BACKOFF_MS = [500, 1000, 2000, 4000, 5000] as const;
export const HELLO_TIMEOUT_MS = 2000;
export const NOT_RUNNING = "Helper not running: run `npm run helper` in a terminal";

export type DesktopState = "off" | "connecting" | "connected" | "error";
export type HotkeyId = "pen" | "pause";

export interface DesktopBridge {
  readonly state: DesktopState;
  readonly error: string | null;
  readonly screen: Size | null;
  readonly drawingArea: Rect;
  readonly dwellClick: boolean;
  enable(): Promise<void>;
  disable(): void;
  setDrawingArea(r: Rect): void;
  setDwellClick(on: boolean): void;
  startAreaSetup(): void;
  onFrame(frame: PointerFrame): void;
  onPenEvent(ev: PenEvent): void;
  isInside(p: Vec2 | null): boolean;
  sendActionKeys(id: ActionId): boolean;
  onHotkey(cb: (id: HotkeyId) => void): () => void;
  subscribe(cb: () => void): () => void;
}

export interface DesktopSnapshot {
  state: DesktopState;
  error: string | null;
  /** Non-blocking problem (e.g. Input Monitoring missing: hotkeys off, mouse still works). */
  warning: string | null;
  screen: Size | null;
  drawingArea: Rect;
  /** true when the area is the whole main display (default). */
  wholeScreen: boolean;
  dwellClick: boolean;
  setupStage: SetupStage | null;
  buttonDown: boolean;
  inside: boolean;
  /** 0..1 in tenths: click / corner dwell fill. */
  progress: number;
  hotkeys: { pen: string; pause: string };
  hotkeysAvailable: boolean | null;
  app: DesktopAppId;
  /** Last thing sent to the app, for the panel ("Krita: Undo (⌘Z)"). Not a live region. */
  lastSent: string | null;
}

interface WSLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface BridgeDeps {
  createSocket(url: string): WSLike;
  storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
  now(): number;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(h: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  /** Dwell radius/time, dwell input switch, pause: read from the app store. */
  appConfig(): CoreConfig;
  status(text: string, kind?: "status" | "alert"): void;
  /** Store subscription (pause → release). */
  subscribeApp(cb: () => void): () => void;
  listenPage(h: { hide(): void; unload(): void }): () => void;
  pageOrigin(): string | null;
  screenFallback(): Size | null;
  url: string;
}

const isBrowser = () => typeof window !== "undefined";

function defaultDeps(): BridgeDeps {
  return {
    url: HELPER_URL,
    createSocket: (url) => new WebSocket(url) as unknown as WSLike,
    storage: isBrowser()
      ? {
          getItem: (k) => {
            try {
              return window.localStorage.getItem(k);
            } catch {
              return null;
            }
          },
          setItem: (k, v) => {
            try {
              window.localStorage.setItem(k, v);
            } catch {
              /* quota / private mode */
            }
          },
        }
      : null,
    now: () => performance.now(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    appConfig: () => {
      const st = getState();
      const s = st.settings;
      return {
        rIn: tileRadius(s),
        dwellMs: s.tileDwellMs || s.penDownDwellMs,
        dwellEnabled: s.dwellEnabled && st.inputs.dwell,
        paused: st.paused,
      };
    },
    status: (text, kind) => setStatus(text, kind),
    subscribeApp: (cb) => subscribeStore(cb),
    listenPage: (h) => {
      if (!isBrowser()) return () => {};
      const vis = () => {
        if (document.visibilityState === "hidden") h.hide();
      };
      document.addEventListener("visibilitychange", vis);
      window.addEventListener("pagehide", h.unload);
      window.addEventListener("beforeunload", h.unload);
      return () => {
        document.removeEventListener("visibilitychange", vis);
        window.removeEventListener("pagehide", h.unload);
        window.removeEventListener("beforeunload", h.unload);
      };
    },
    pageOrigin: () => (isBrowser() ? window.location.origin : null),
    screenFallback: () => (isBrowser() && window.screen ? { w: window.screen.width, h: window.screen.height } : null),
  };
}

interface Persisted {
  area: Rect | null;
  dwellClick: boolean;
  hotkeys: { pen: string; pause: string };
}

/** Text for a failed connection (browsers hide the HTTP status of a refused WebSocket). */
export function notRunningText(pageOrigin: string | null): string {
  if (pageOrigin && pageOrigin !== DEFAULT_HELPER_ORIGIN) {
    return `${NOT_RUNNING}. This page is ${pageOrigin}, so start it with STEADY_ORIGIN=${pageOrigin} npm run helper.`;
  }
  return `${NOT_RUNNING}.`;
}

export class DesktopBridgeImpl implements DesktopBridge {
  private deps: BridgeDeps;
  private core: DesktopCore;
  private enabled = false;
  private ws: WSLike | null = null;
  private helloSeen = false;
  private everConnected = false;
  private connError: string | null = null;
  private permError: string | null = null;
  private permWarning: string | null = null;
  private attempt = 0;
  private pingTimer: unknown = null;
  private retryTimer: unknown = null;
  private helloTimer: unknown = null;
  private unlistenPage: (() => void) | null = null;
  private unsubApp: (() => void) | null = null;
  private wasPaused = false;
  private loaded = false;
  private hotkeys = { pen: "f8", pause: "f9" };
  private hotkeysAvailable: boolean | null = null;
  private wholeScreen = true;
  private lastSent: string | null = null;
  private inside = false;
  private progress = 0;
  private firstWaiters: (() => void)[] = [];
  private listeners = new Set<() => void>();
  private hotkeyListeners = new Set<(id: HotkeyId) => void>();
  private snap: DesktopSnapshot;
  readonly app: DesktopAppId = DEFAULT_APP;

  constructor(deps: Partial<BridgeDeps> = {}) {
    this.deps = { ...defaultDeps(), ...deps };
    this.core = createDesktopCore({ dwellClick: true });
    this.snap = this.makeSnapshot();
  }

  // ------------------------------------------------------------------ readonly interface

  get state(): DesktopState {
    if (!this.enabled) return "off";
    if (this.helloSeen && this.ws) return this.permError ? "error" : "connected";
    if (!this.everConnected && !this.connError) return "connecting";
    return "error";
  }

  get error(): string | null {
    if (!this.enabled) return null;
    return this.connError ?? this.permError ?? null;
  }

  get warning(): string | null {
    return this.enabled ? this.permWarning : null;
  }

  get screen(): Size | null {
    return this.core.screen;
  }

  get drawingArea(): Rect {
    this.ensureLoaded();
    return this.core.area;
  }

  get dwellClick(): boolean {
    this.ensureLoaded();
    return this.core.dwellClick;
  }

  get setupStage(): SetupStage | null {
    return this.core.setupStage;
  }

  get buttonDown(): boolean {
    return this.core.buttonDown;
  }

  /** For useSyncExternalStore: a new object only when something visible changed. */
  getSnapshot = (): DesktopSnapshot => this.snap;

  // ------------------------------------------------------------------ lifecycle

  enable(): Promise<void> {
    this.ensureLoaded();
    const p = new Promise<void>((res) => this.firstWaiters.push(res));
    if (this.enabled) {
      if (this.state !== "connecting") this.resolveFirst();
      return p;
    }
    this.enabled = true;
    this.connError = null;
    this.everConnected = false;
    this.attempt = 0;
    this.wasPaused = this.deps.appConfig().paused;
    this.unlistenPage = this.deps.listenPage({ hide: () => this.release(), unload: () => this.unload() });
    this.unsubApp = this.deps.subscribeApp(() => this.onAppChange());
    this.pingTimer = this.deps.setInterval(() => this.onTick(), PING_MS);
    this.connect();
    this.notify();
    return p;
  }

  disable(): void {
    if (!this.enabled) return;
    this.send(this.core.release());
    this.core.cancelSetup();
    this.enabled = false;
    this.teardownSocket(1000, "Desktop mode off");
    this.deps.clearInterval(this.pingTimer);
    this.deps.clearTimeout(this.retryTimer);
    this.pingTimer = this.retryTimer = null;
    this.unlistenPage?.();
    this.unsubApp?.();
    this.unlistenPage = this.unsubApp = null;
    this.permError = this.permWarning = this.connError = null;
    this.resolveFirst();
    this.notify();
  }

  /** Release the button now (Pause, page hidden). Safe to call any time. */
  release(): void {
    this.send(this.core.release());
    this.notify();
  }

  /** Skip the backoff wait and try to connect now (the panel's "Try again" tile). */
  retryNow(): void {
    if (!this.enabled || this.ws) return;
    this.deps.clearTimeout(this.retryTimer);
    this.attempt = 0;
    this.connect();
    this.notify();
  }

  private unload(): void {
    this.send(this.core.release());
    this.teardownSocket(1001, "page closed");
  }

  private connect(): void {
    if (!this.enabled) return;
    let ws: WSLike;
    try {
      ws = this.deps.createSocket(this.deps.url);
    } catch {
      this.onSocketClosed(null, {});
      return;
    }
    this.ws = ws;
    this.helloSeen = false;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.deps.clearTimeout(this.helloTimer);
      this.helloTimer = this.deps.setTimeout(() => {
        if (this.ws === ws && !this.helloSeen) {
          this.connError = "The helper connected but did not answer. Restart it (Ctrl-C, then npm run helper).";
          ws.close(4002, "no hello");
        }
      }, HELLO_TIMEOUT_MS);
    };
    ws.onmessage = (ev) => this.onMessage(ws, ev.data);
    ws.onclose = (ev) => this.onSocketClosed(ws, ev, opened);
    ws.onerror = () => {};
  }

  private teardownSocket(code: number, reason: string): void {
    const ws = this.ws;
    this.ws = null;
    this.helloSeen = false;
    this.core.setConnected(false);
    this.deps.clearTimeout(this.helloTimer);
    if (ws) {
      ws.onclose = ws.onmessage = ws.onerror = ws.onopen = null;
      try {
        ws.close(code, reason);
      } catch {
        /* already closed */
      }
    }
  }

  private onSocketClosed(ws: WSLike | null, ev: { code?: number }, opened = false): void {
    if (ws && ws !== this.ws) return;
    const wasConnected = this.helloSeen;
    this.ws = null;
    this.helloSeen = false;
    this.core.setConnected(false);
    this.deps.clearTimeout(this.helloTimer);
    if (!this.enabled) return;
    if (ev.code === 4000) this.connError = "Another Steady page took over the helper. Close the other tab, then reload this one.";
    else if (wasConnected) this.connError = "Lost the helper. Reconnecting… If it keeps failing, check the terminal running npm run helper.";
    else if (!opened || !this.connError) this.connError = notRunningText(this.deps.pageOrigin());
    if (wasConnected) this.deps.status(`Desktop mode: ${this.connError}`, "alert");
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt++;
    this.deps.clearTimeout(this.retryTimer);
    this.retryTimer = this.deps.setTimeout(() => this.connect(), delay);
    this.resolveFirst();
    this.notify();
  }

  private onMessage(ws: WSLike, data: unknown): void {
    if (ws !== this.ws) return;
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    switch (m.t) {
      case "hello": {
        const sc = m.screen as Size | undefined;
        const screen = sc && sc.w > 0 && sc.h > 0 ? { w: sc.w, h: sc.h } : this.deps.screenFallback();
        this.core.setScreen(screen);
        this.reloadArea();
        const perms = (m.permissions ?? {}) as { accessibility?: boolean | null; inputMonitoring?: boolean | null };
        this.permError = perms.accessibility === false ? this.permError ?? "Enable Accessibility for your terminal app in System Settings › Privacy & Security › Accessibility, then restart the helper." : null;
        this.permWarning = perms.inputMonitoring === false ? this.permWarning : null;
        this.hotkeysAvailable = typeof m.hotkeysAvailable === "boolean" ? m.hotkeysAvailable : m.hotkeysAvailable === null ? null : true;
        this.helloSeen = true;
        this.everConnected = true;
        this.connError = null;
        this.attempt = 0;
        this.deps.clearTimeout(this.helloTimer);
        this.core.setConnected(true);
        this.send([{ t: "config", area: this.core.savedArea, hotkeys: this.hotkeys }]);
        this.deps.status(
          perms.accessibility === false
            ? "Desktop mode: the helper needs the Accessibility permission (see the panel)."
            : `Desktop mode on. Drawing area: ${this.wholeScreen ? "whole screen" : "set"}. ${this.hotkeys.pen.toUpperCase()} = pen, ${this.hotkeys.pause.toUpperCase()} = pause.`,
        );
        this.resolveFirst();
        break;
      }
      case "error": {
        const msg = String(m.msg ?? "");
        if (/Accessibility/.test(msg) && /System Settings/.test(msg)) this.permError = msg;
        else if (/Input Monitoring/.test(msg) || /hotkey listener stopped/.test(msg)) {
          this.permWarning = msg;
          if (/hotkey listener stopped/.test(msg)) this.hotkeysAvailable = false;
        } else if (msg) this.deps.status(msg);
        break;
      }
      case "hotkey": {
        const id = m.id === "pen" || m.id === "pause" ? m.id : null;
        if (!id) break;
        if (id === "pen" && this.core.setupStage) {
          this.markCorner();
          break;
        }
        this.hotkeyListeners.forEach((cb) => cb(id));
        break;
      }
      case "state":
        this.core.onHelperState(m.down === true);
        break;
    }
    this.notify();
  }

  private onTick(): void {
    this.send(this.core.tick(this.deps.now()));
    if (this.snap.buttonDown !== this.core.buttonDown) this.notify();
  }

  private onAppChange(): void {
    const paused = this.deps.appConfig().paused;
    if (paused && !this.wasPaused) this.release();
    this.wasPaused = paused;
  }

  private send(msgs: OutMsg[]): void {
    const ws = this.ws;
    if (!msgs.length || !ws || ws.readyState !== 1) return;
    for (const m of msgs) {
      if (m.t !== "config" && m.t !== "ping" && !this.helloSeen) continue;
      try {
        ws.send(JSON.stringify(m));
      } catch {
        /* socket closing: the helper's own fail-safe releases */
      }
    }
  }

  private resolveFirst(): void {
    const w = this.firstWaiters;
    this.firstWaiters = [];
    w.forEach((r) => r());
  }

  // ------------------------------------------------------------------ persistence

  private ensureLoaded(): void {
    if (this.loaded || !this.deps.storage) return;
    this.loaded = true;
    try {
      const raw = this.deps.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<Persisted>;
      if (typeof p.dwellClick === "boolean") this.core.setDwellClick(p.dwellClick);
      if (p.hotkeys && isValidHotkey(String(p.hotkeys.pen)) && isValidHotkey(String(p.hotkeys.pause))) this.hotkeys = { pen: p.hotkeys.pen, pause: p.hotkeys.pause };
      this.reloadArea(p.area ?? null);
    } catch {
      /* bad JSON: defaults */
    }
  }

  private storedArea(): unknown {
    try {
      const raw = this.deps.storage?.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Partial<Persisted>).area ?? null : null;
    } catch {
      return null;
    }
  }

  private reloadArea(raw: unknown = this.storedArea()): void {
    const r = raw ? sanitizeArea(raw, this.core.screen) : null;
    this.wholeScreen = !r;
    this.core.setArea(r);
  }

  private persist(): void {
    if (!this.deps.storage) return;
    const p: Persisted = { area: this.wholeScreen ? null : this.core.savedArea, dwellClick: this.core.dwellClick, hotkeys: this.hotkeys };
    try {
      this.deps.storage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* quota / private mode */
    }
  }

  // ------------------------------------------------------------------ settings

  setDrawingArea(r: Rect): void {
    this.ensureLoaded();
    const a = sanitizeArea(r, this.core.screen);
    if (!a) {
      this.deps.status("That drawing area is too small. Try again.");
      return;
    }
    const screen = this.core.screen;
    this.wholeScreen = !!screen && a.x === 0 && a.y === 0 && a.w === screen.w && a.h === screen.h;
    this.core.setArea(this.wholeScreen ? null : a);
    this.persist();
    this.send([{ t: "config", area: this.core.savedArea }]);
    this.notify();
  }

  /** Back to the default: the whole main display. */
  resetDrawingArea(): void {
    this.ensureLoaded();
    this.core.cancelSetup();
    this.wholeScreen = true;
    this.core.setArea(null);
    this.persist();
    this.send([{ t: "config", area: this.core.savedArea }]);
    this.deps.status("Drawing area: whole screen.");
    this.notify();
  }

  setDwellClick(on: boolean): void {
    this.ensureLoaded();
    this.core.setDwellClick(on);
    this.persist();
    this.deps.status(on ? "Dwell click on: hold still outside the drawing area to click." : "Dwell click off.");
    this.notify();
  }

  /** Remap the global hotkeys (function keys only). Returns false if invalid. */
  setHotkeys(h: { pen: string; pause: string }): boolean {
    const pen = h.pen.toLowerCase();
    const pause = h.pause.toLowerCase();
    if (!isValidHotkey(pen) || !isValidHotkey(pause) || pen === pause) return false;
    this.hotkeys = { pen, pause };
    this.persist();
    this.send([{ t: "config", hotkeys: this.hotkeys }]);
    this.notify();
    return true;
  }

  /** Only if B's engine canvas size differs from the drawing-area size (the contract says it matches). */
  setEngineSize(s: Size | null): void {
    this.core.setEngineSize(s);
  }

  startAreaSetup(): void {
    this.ensureLoaded();
    if (!this.enabled || !this.helloSeen) {
      this.deps.status(`Connect the helper first. ${this.error ?? NOT_RUNNING}`);
      return;
    }
    this.send(this.core.release());
    this.core.startSetup();
    this.deps.status(
      `Set drawing area: move to the TOP-LEFT corner of the ${APP_LABELS[this.app]} canvas and hold still (or press ${this.hotkeys.pen.toUpperCase()}).`,
    );
    this.notify();
  }

  cancelAreaSetup(): void {
    if (!this.core.setupStage) return;
    this.core.cancelSetup();
    this.deps.status("Drawing area setup cancelled. The old area is kept.");
    this.notify();
  }

  /** Mark the current setup corner at the pointer (F8 or the pen toggle during setup). */
  markCorner(): boolean {
    if (!this.core.setupStage) return false;
    const r = this.core.markCorner(this.deps.now());
    this.send(r.msgs);
    this.afterSetupResult(r);
    this.notify();
    return true;
  }

  private afterSetupResult(r: { corner: { stage: SetupStage } | null; areaDone: Rect | null; areaRejected: boolean }): void {
    if (r.areaDone) {
      this.wholeScreen = false;
      this.persist();
      this.send([{ t: "config", area: r.areaDone }]);
      this.deps.status(`Drawing area set: ${r.areaDone.w} × ${r.areaDone.h} points. Hold still inside it to put the pen down.`);
    } else if (r.areaRejected) {
      this.deps.status("That area is too small. Start again: move to the TOP-LEFT corner and hold still.");
    } else if (r.corner?.stage === "top-left") {
      this.deps.status(`Top-left corner set. Now move to the BOTTOM-RIGHT corner and hold still (or press ${this.hotkeys.pen.toUpperCase()}).`);
    }
  }

  // ------------------------------------------------------------------ per frame

  onFrame(frame: PointerFrame): void {
    if (!this.enabled) return;
    const r = this.core.step(frame, this.deps.appConfig(), frame.t, this.deps.now());
    this.send(r.msgs);
    if (r.corner || r.areaDone || r.areaRejected) this.afterSetupResult(r);
    if (r.clicked) this.lastSent = "Clicked";
    const progress = Math.round(r.progress * 10) / 10;
    if (r.inside !== this.inside || progress !== this.progress || r.clicked || r.corner || this.snap.buttonDown !== this.core.buttonDown) {
      this.inside = r.inside;
      this.progress = progress;
      this.notify();
    }
  }

  onPenEvent(ev: PenEvent): void {
    if (!this.enabled) return;
    this.send(this.core.penEvent(ev));
    if (this.snap.buttonDown !== this.core.buttonDown) this.notify();
  }

  isInside(p: Vec2 | null): boolean {
    return this.core.isInside(p);
  }

  sendActionKeys(id: ActionId): boolean {
    if (!this.enabled) return false;
    const route = desktopRoute(id, this.app);
    if (route === "keys") {
      const combo = shortcutFor(id, this.app)!;
      const label = `${APP_LABELS[this.app]}: ${ACTION_BY_ID[id]?.label ?? id} (${prettyCombo(combo)})`;
      if (!this.helloSeen) {
        this.deps.status(`Not sent to ${APP_LABELS[this.app]}: ${this.error ?? NOT_RUNNING}`);
        return true;
      }
      this.send(this.core.release());
      this.send([{ t: "keys", combo, app: this.app }]);
      this.lastSent = label;
      this.deps.status(label);
      this.notify();
      return true;
    }
    if (route === "click") {
      if (this.helloSeen && this.core.isInside(this.core.lastPointer)) {
        this.send([...this.core.release(), { t: "click" }]);
        this.lastSent = "Dot (click)";
        this.notify();
      } else {
        this.deps.status("Dot works inside the drawing area.");
      }
      return true;
    }
    return false;
  }

  onHotkey(cb: (id: HotkeyId) => void): () => void {
    this.hotkeyListeners.add(cb);
    return () => {
      this.hotkeyListeners.delete(cb);
    };
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  private makeSnapshot(): DesktopSnapshot {
    return {
      state: this.state,
      error: this.error,
      warning: this.warning,
      screen: this.core.screen,
      drawingArea: this.core.area,
      wholeScreen: this.wholeScreen,
      dwellClick: this.core.dwellClick,
      setupStage: this.core.setupStage,
      buttonDown: this.core.buttonDown,
      inside: this.inside,
      progress: this.progress,
      hotkeys: this.hotkeys,
      hotkeysAvailable: this.hotkeysAvailable,
      app: this.app,
      lastSent: this.lastSent,
    };
  }

  private notify(): void {
    const next = this.makeSnapshot();
    const prev = this.snap;
    const same =
      prev.state === next.state &&
      prev.error === next.error &&
      prev.warning === next.warning &&
      prev.screen === next.screen &&
      sameRect(prev.drawingArea, next.drawingArea) &&
      prev.wholeScreen === next.wholeScreen &&
      prev.dwellClick === next.dwellClick &&
      prev.setupStage === next.setupStage &&
      prev.buttonDown === next.buttonDown &&
      prev.inside === next.inside &&
      prev.progress === next.progress &&
      prev.hotkeys === next.hotkeys &&
      prev.hotkeysAvailable === next.hotkeysAvailable &&
      prev.lastSent === next.lastSent;
    if (same) return;
    this.snap = next;
    this.listeners.forEach((l) => l());
  }
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** Server-render snapshot (Desktop mode is client-only). */
export const OFF_SNAPSHOT: DesktopSnapshot = {
  state: "off",
  error: null,
  warning: null,
  screen: null,
  drawingArea: fullScreenArea({ w: 1440, h: 900 }),
  wholeScreen: true,
  dwellClick: true,
  setupStage: null,
  buttonDown: false,
  inside: false,
  progress: 0,
  hotkeys: { pen: "f8", pause: "f9" },
  hotkeysAvailable: null,
  app: DEFAULT_APP,
  lastSent: null,
};

export function createDesktopBridge(deps: Partial<BridgeDeps> = {}): DesktopBridgeImpl {
  return new DesktopBridgeImpl(deps);
}

/** The singleton agent B integrates (see docs/ARCHITECTURE.md "E: Desktop mode"). */
export const desktop: DesktopBridgeImpl = createDesktopBridge();
