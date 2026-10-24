/**
 * App state (React-visible). High-frequency pointer data does NOT live here; it lives in
 * the runtime (src/state/runtime.ts) and is drawn by the canvas rAF loop. Only discrete
 * changes (pen state, tracking state, status text, document edits) go through this store.
 */
import { useSyncExternalStore } from "react";
import type { ActionCategory, ActionId, ColourName } from "@/actions";
import type {
  CalibrationResult,
  History,
  Metrics,
  PenState,
  PipelineSettings,
  Stroke,
  TrackingLossReason,
  TrackingState,
  Vec2,
} from "@/pipeline/types";
import { DEFAULT_SETTINGS } from "@/pipeline/types";
import { createHistory } from "@/pipeline/document";

export type Phase = "intro" | "calibrating" | "ready";
export type Tool = "free" | "straight" | "eraser";
export type Posture = "external" | "laptop" | "head";

export interface StatusMsg {
  text: string;
  /** "alert" → role=alert region (tracking loss); "status" → role=status. */
  kind: "status" | "alert";
  id: number;
}

export interface DialogState {
  /** Destructive action waiting for confirmation. */
  pending: ActionId;
  title: string;
  description: string;
}

export interface ClarifyState {
  question: string;
  options: { label: string; actions: ActionId[] }[];
  heard: string;
}

export type OverlayState =
  | {
      kind: "dictation";
      /** "listening": read-only live transcript; "editing": textarea after Accept / Edit. */
      stage: "listening" | "review" | "editing";
      text: string;
      partial: string;
      at: Vec2;
      /** When editing an existing block. */
      editId?: string;
    }
  | {
      kind: "ghost";
      mode: "handwriting" | "cleanup" | "label";
      logId: string;
      /** Strokes the ghost would replace. */
      replaces: string[];
      /** Ghost content (rendered over the canvas, faded). */
      strokes: Stroke[];
      texts: { x: number; y: number; text: string; size: number }[];
      summary: string;
    }
  | { kind: "busy"; text: string };

export interface CalibrationUI {
  step: "posture" | "rest" | "circle" | "retry-circle" | "done";
  /** 0..1 progress of the current measuring step. */
  progress: number;
  message: string;
  askedLarger: boolean;
  /** Which part reruns: full, recenter (step 2 only), remeasure (step 1 only). */
  scope: "full" | "recenter" | "remeasure";
  measuring: boolean;
}

export interface MicUI {
  open: boolean;
  state: "idle" | "connecting" | "listening" | "finalizing" | "error";
  level: number;
  engine: "cartesia" | "webspeech" | "none";
  mode: "command" | "dictation";
  partial: string;
  detail?: string;
}

export interface AppState {
  phase: Phase;
  history: History;
  colour: ColourName;
  width: number;
  tool: Tool;
  settings: PipelineSettings;
  pen: PenState;
  tracking: TrackingState;
  lossReason: TrackingLossReason | null;
  trackingStarted: boolean;
  sourceError: string | null;
  status: StatusMsg;
  alert: StatusMsg | null;
  heard: string | null;
  paused: boolean;
  /** Category sub-panel open in the toolbar (null = main tiles). */
  subpanel: ActionCategory | null;
  panel: "help" | "settings" | "advanced" | null;
  demoOpen: boolean;
  demoQuoteSeen: boolean;
  dialog: DialogState | null;
  overlay: OverlayState | null;
  clarify: ClarifyState | null;
  /** "Didn't catch that" nearest-match tiles. */
  nearest: { heard: string; ids: ActionId[] } | null;
  mic: MicUI;
  sounds: boolean;
  speech: boolean;
  tremor: boolean;
  ghost: boolean;
  calibration: CalibrationResult | null;
  calib: CalibrationUI | null;
  posture: Posture;
  lastActions: ActionId[];
  selectedStrokeId: string | null;
  keys: { cartesia: boolean; anthropic: boolean; online: boolean } | null;
  online: boolean;
  metrics: Metrics;
  hasSavedSetup: boolean;
  /** Bumped whenever pixels that the committed canvas layer shows change. */
  renderVersion: number;
  /** Input methods that can be switched off independently (WCAG 2.5.4). */
  inputs: { dwell: boolean; voice: boolean; keys: boolean };
  /** Camera preview collapsed to the 120 px thumbnail. */
  previewCollapsed: boolean;
  /** Text block selected for Edit. */
  lastTextId: string | null;
  zoom: number;
  pan: Vec2;
  activeProfileId: string | null;
  profiles: { id: string; name: string }[];
  /** P2b Desktop mode (§6a) is on: the pipeline drives the real mouse through E's helper. */
  desktopOn: boolean;
  /** Non-blocking break reminder (10 min Head mode, 15 min Hand mode). */
  breakReminders: boolean;
  reminder: string | null;
  face: FaceUI;
}

export type FaceSignal = "jawOpen" | "browInnerUp";

export interface FaceUI {
  /** Face tap is on (only possible once calibrated). */
  enabled: boolean;
  /** Thresholds measured with "open your mouth comfortably twice". */
  calibration: { signal: FaceSignal; open: number; close: number } | null;
  signal: FaceSignal;
  /** The face model's blendshapes lacked jawOpen at startup: mouth tap disabled. */
  jawOpenMissing: boolean;
  /** Face-tap calibration in progress: 0..1. */
  calibrating: number | null;
}

export const INITIAL_METRICS: Metrics = {
  deviationRawPx: 0,
  deviationSmoothedPx: 0,
  lastStrokeMs: 0,
  commandsTotal: 0,
  commandsMatched: 0,
  claudeCalls: 0,
  claudeAccepted: 0,
  claudeRejected: 0,
  claudeTimeouts: 0,
  cameraFps: 0,
  detectionFps: 0,
};

let statusSeq = 1;
export function nextStatusId(): number {
  return statusSeq++;
}

const initial: AppState = {
  phase: "intro",
  history: createHistory(),
  colour: "black",
  width: 6,
  tool: "free",
  settings: { ...DEFAULT_SETTINGS },
  pen: "HOVER",
  tracking: "lost",
  lossReason: null,
  trackingStarted: false,
  sourceError: null,
  status: { text: "Starting Steady…", kind: "status", id: 0 },
  alert: null,
  heard: null,
  paused: false,
  subpanel: null,
  panel: null,
  demoOpen: false,
  demoQuoteSeen: false,
  dialog: null,
  overlay: null,
  clarify: null,
  nearest: null,
  mic: { open: false, state: "idle", level: 0, engine: "none", mode: "command", partial: "" },
  sounds: true,
  speech: true,
  tremor: false,
  ghost: false,
  calibration: null,
  calib: null,
  posture: "laptop",
  lastActions: [],
  selectedStrokeId: null,
  keys: null,
  online: true,
  metrics: { ...INITIAL_METRICS },
  hasSavedSetup: false,
  renderVersion: 0,
  inputs: { dwell: true, voice: true, keys: true },
  previewCollapsed: false,
  lastTextId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  activeProfileId: null,
  profiles: [],
  desktopOn: false,
  breakReminders: true,
  reminder: null,
  face: { enabled: false, calibration: null, signal: "jawOpen", jawOpenMissing: false, calibrating: null },
};

type Listener = () => void;
let state: AppState = initial;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const p = typeof patch === "function" ? patch(state) : patch;
  let changed = false;
  for (const k in p) {
    if ((p as Record<string, unknown>)[k] !== (state as unknown as Record<string, unknown>)[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Select a slice. The selector must return a stable reference (a field or primitive). */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initial),
  );
}

export function setStatus(text: string, kind: "status" | "alert" = "status"): void {
  const msg = { text, kind, id: nextStatusId() };
  if (kind === "alert") setState({ alert: msg, status: msg });
  else setState({ status: msg });
}
