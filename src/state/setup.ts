/** App boot + first-run choices (Use last setup / Set up / Skip). */
import type { CalibrationResult, PipelineSettings } from "@/pipeline/types";
import { DEFAULT_SETTINGS } from "@/pipeline/types";
import { KEYS, load } from "@/lib/persist";
import { getParams } from "@/lib/params";
import { focusCanvas } from "@/lib/focus";
import { probeKeys } from "@/voice/keyStatus";
import { runtime } from "./runtime";
import { getState, setState, setStatus, type Posture } from "./store";
import { restoreDoc } from "./docOps";
import { dispatch, restorePrefs } from "./dispatch";
import { desktop } from "@/desktop/bridge";
import { syncProfilesToStore } from "./profiles";
import { refreshClaudeMetrics } from "./ai";
import { CLAUDE_LOG_EVENT } from "@/voice/cleanupClient";

interface SavedSetup {
  calibration?: CalibrationResult | null;
  settings?: Partial<PipelineSettings>;
  posture?: Posture;
  deviceId?: string | null;
  savedAt?: number;
}

function savedSetup(): SavedSetup | null {
  const s = load<SavedSetup | null>(KEYS.setup, null);
  return s && (s.calibration || s.settings) ? s : null;
}

export function boot() {
  const params = getParams();
  restorePrefs();
  restoreDoc();
  syncProfilesToStore();
  refreshClaudeMetrics();
  const saved = savedSetup();
  setState({ hasSavedSetup: !!saved, demoOpen: params.demo, posture: saved?.posture ?? "laptop" });
  if (params.skipIntro) {
    setState({ phase: "ready", previewCollapsed: true });
    setStatus("Ready. Hold still to put the pen down, or press Space.");
  } else {
    setState({ phase: "intro" });
    setStatus("Welcome to Steady.");
  }
  void runtime.start();
  void probeKeys()
    .then((k) => {
      setState({ keys: k, online: k.online && navigator.onLine });
      if (!k.cartesia || !k.anthropic) {
        const missing = [!k.cartesia && "voice (Cartesia)", !k.anthropic && "AI (Anthropic)"].filter(Boolean).join(" and ");
        console.info(`[Steady] key missing: ${missing}; using fallbacks`);
      }
    })
    .catch(() => setState({ keys: { cartesia: false, anthropic: false, online: navigator.onLine } }));
  const onOnline = () => {
    setState({ online: true });
    setStatus("Back online. Voice and AI help are available again.");
  };
  const onOffline = () => {
    setState({ online: false });
    setStatus("The internet is down. Drawing, undo and typed commands still work; voice and AI help are off.");
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener(CLAUDE_LOG_EVENT, refreshClaudeMetrics);
  // P2b Desktop mode: helper hotkeys (F8/F9 by default) and drawing-area changes.
  const offHotkey = desktop.onHotkey((id) => dispatch({ id: id === "pen" ? "pen.toggle" : "pause.toggle", via: "key" }));
  const offArea = desktop.subscribe(() => {
    if (getState().desktopOn) runtime.engine?.setCanvasSize(runtime.desktopEngineSize());
  });
  if (!navigator.onLine) setState({ online: false });
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener(CLAUDE_LOG_EVENT, refreshClaudeMetrics);
    offHotkey();
    offArea();
  };
}

export function startSetup() {
  setState({
    phase: "calibrating",
    previewCollapsed: false,
    calib: { step: "posture", progress: 0, message: "", askedLarger: false, scope: "full", measuring: false },
  });
  setStatus("Setup: pick how your camera sees your hand, then press Start.");
}

export function skipSetup() {
  setState({ phase: "ready", calib: null, previewCollapsed: true });
  setStatus("Using default settings. Say “calibrate” any time. Hold still to put the pen down, or press Space.");
  setTimeout(focusCanvas, 0);
}

export function applyLastSetup() {
  const s = savedSetup();
  if (!s) return skipSetup();
  const settings = { ...DEFAULT_SETTINGS, ...(s.settings ?? {}), simulateTremor: false };
  runtime.updateSettings(settings);
  setState({ calibration: s.calibration ?? null, posture: s.posture ?? getState().posture, phase: "ready", calib: null, previewCollapsed: true });
  setStatus(`Using your last setup (Steadiness ${settings.steadiness}, gain ${settings.gain.toFixed(1)}×). Hold still to start drawing.`);
  setTimeout(focusCanvas, 0);
}
