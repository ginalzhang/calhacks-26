/**
 * dispatch(): the single place every action id executes (tiles, keys, voice, typed, Claude).
 * Destructive actions go through the §0 alertdialog first.
 */
import { ACTION_BY_ID, COLOUR_HEX, type ActionId, type ActionInvocation, type ColourName, type InputMethod } from "@/actions";
import { contrastRatio } from "@/pipeline/contrast";
import { forceShape } from "@/pipeline/shapes";
import { newId, newPage } from "@/pipeline/document";
import { pageToSvg } from "@/pipeline/svg";
import type { PenCause, ShapeTarget, Stroke } from "@/pipeline/types";
import { exportPng, downloadBlob, slug } from "@/lib/render";
import { setEarconsEnabled } from "@/lib/earcons";
import { focusCanvas } from "@/lib/focus";
import { KEYS, remove, save, load } from "@/lib/persist";
import { BG_HEX, persistSetup, runtime } from "./runtime";
import { commit, lastStroke, page, redoDoc, resetDoc, undoDoc } from "./docOps";
import { getState, INITIAL_METRICS, setState, setStatus } from "./store";
import { applySpeechSetting, closeMic, say, speakNow, toggleMic } from "./voice";
import { acceptGhost, refreshClaudeMetrics, rejectGhost, startCleanup } from "./ai";
import { clearClaudeLog } from "@/voice/cleanupClient";
import { acceptDictation, cancelDictation, editLastText, fixDictation, startDictation } from "./dictation";
import { activateProfile, hasUnsavedChanges, loadProfiles, nextProfile, PRESETS, saveActiveProfile, withSteadiness, type PresetId } from "./profiles";
import { DEFAULT_SETTINGS } from "@/pipeline/types";
import { desktop } from "@/desktop/bridge";
import { desktopRoute } from "@/desktop/shortcuts";

const WIDTHS = [2, 4, 6, 10, 16, 24];

/** Optional argument carried by some invocations (e.g. which profile). */
let pendingArg: string | undefined;

function causeOf(via: InputMethod): PenCause {
  switch (via) {
    case "key":
      return "key";
    case "voice":
    case "claude":
      return "voice";
    case "typed":
      return "typed";
    case "face":
      return "face";
    default:
      return "tile";
  }
}

const DIALOG_ALLOWED: ActionId[] = ["confirm.yes", "confirm.no", "cancel", "mic.toggle", "help"];

const CONFIRM_COPY: Partial<Record<ActionId, (arg?: string) => { title: string; description: string }>> = {
  "page.clear": () => ({ title: "Clear this page?", description: `Everything on “${page().name}” will be removed. You can still undo it afterwards.` }),
  "page.delete": () => ({ title: "Delete this page?", description: `“${page().name}” and everything on it will be deleted. You can still undo it afterwards.` }),
  "calibration.reset": () => ({ title: "Reset your setup?", description: "Your measured setup and slider positions go back to the defaults. Your drawings stay." }),
  "judge.next": () => ({ title: "Start over for the next person?", description: "This clears the canvas, resets the demo numbers and starts the 10-second setup." }),
  "profile.next": (arg) => {
    const target = arg ? loadProfiles().list.find((p) => p.id === arg) : nextProfile();
    return { title: `Switch to “${target?.name ?? "next profile"}”?`, description: "Your slider changes since this profile was saved will be lost. Save first from Settings if you want to keep them." };
  },
};

export function dispatch(inv: ActionInvocation): void {
  execute(inv, false);
}

/** Run the destructive action that was waiting for confirmation. */
function execute(inv: ActionInvocation, confirmed: boolean): void {
  const def = ACTION_BY_ID[inv.id];
  if (!def) {
    setStatus(`Unknown action ${inv.id}`);
    return;
  }
  const st = getState();
  if (st.dialog && !DIALOG_ALLOWED.includes(inv.id) && !confirmed) {
    setStatus(`${st.dialog.title} Choose ✓ Confirm or ✗ No first.`);
    return;
  }
  // Reminders never block: the user's next action dismisses them and still executes.
  if (st.nearest && !inv.id.startsWith("choose.")) setState({ nearest: null });

  let needsConfirm = def.destructive && !confirmed;
  if (inv.id === "profile.next" && !hasUnsavedChanges()) needsConfirm = false;
  if (needsConfirm) {
    const copy = CONFIRM_COPY[inv.id]?.(inv.text) ?? { title: `${def.label}?`, description: "This can be undone afterwards." };
    pendingArg = inv.text;
    setState({ dialog: { pending: inv.id, ...copy } });
    say(copy.title);
    return;
  }

  if (def.category !== "dialog") {
    setState((s) => ({ lastActions: [...s.lastActions, inv.id].slice(-3) }));
  }
  run(inv);
}

/** Actions that always run inside Steady, even in Desktop mode (§6a). */
const DESKTOP_STEADY: ReadonlySet<ActionId> = new Set<ActionId>([
  "pen.toggle", "pause.toggle", "latch.toggle", "steadier", "looser", "mic.toggle",
  "desktop.toggle", "desktop.area", "desktop.dwellclick",
]);

function run(inv: ActionInvocation): void {
  const { id, via } = inv;
  const st = getState();
  if (st.desktopOn && !DESKTOP_STEADY.has(id)) {
    // App-facing actions become keystrokes to the focused app (Krita) through the helper.
    if (desktop.sendActionKeys(id)) return;
    if (desktopRoute(id) === "canvas-only") {
      setStatus(`${ACTION_BY_ID[id].label} is not available in Desktop mode. Turn Desktop mode off to use it on Steady's page.`);
      return;
    }
  }
  switch (id) {
    // ---------------------------------------------------------------- pen
    case "pen.toggle":
      // P2b: during drawing-area setup the pen key marks a corner instead (E's step 7).
      if (st.desktopOn && desktop.getSnapshot().setupStage !== null) {
        desktop.markCorner();
        return;
      }
      runtime.togglePen(causeOf(via));
      return;
    case "latch.toggle": {
      const on = !st.settings.latch;
      runtime.updateSettings({ latch: on });
      setStatus(on ? "Latch on: the pen stays down until you lift it with Space, voice or the Pen tile." : "Latch off: holding still lifts the pen.");
      return;
    }
    case "dot":
      if (!runtime.placeDot()) setStatus("Move the cursor over the page to place a dot.");
      else setStatus("Dot placed");
      return;
    case "undo": {
      if (st.overlay?.kind === "ghost") return rejectGhost();
      const label = undoDoc();
      setStatus(label ? `Undid ${label}` : "Nothing to undo");
      if (label && via === "voice") say(`Undid ${label}`);
      return;
    }
    case "redo": {
      const label = redoDoc();
      setStatus(label ? `Redid ${label}` : "Nothing to redo");
      return;
    }

    // ---------------------------------------------------------------- dialog / overlay
    case "accept":
      if (st.overlay?.kind === "ghost") return acceptGhost();
      if (st.overlay?.kind === "dictation") return acceptDictation();
      setStatus("Nothing to accept right now.");
      return;
    case "cancel":
    case "confirm.no":
      return cancelAnything(id);
    case "confirm.yes": {
      const d = st.dialog;
      if (!d) {
        setStatus("Nothing to confirm right now.");
        return;
      }
      setState({ dialog: null });
      execute({ id: d.pending, via, text: pendingArg }, true);
      pendingArg = undefined;
      return;
    }
    case "choose.1":
    case "choose.2":
    case "choose.3": {
      const n = Number(id.slice(-1));
      if (st.clarify) {
        const opt = st.clarify.options[n - 1];
        if (!opt) {
          setStatus(`There is no option ${n}.`);
          return;
        }
        setState({ clarify: null });
        opt.actions.forEach((a) => dispatch({ id: a, via }));
        return;
      }
      if (st.overlay?.kind === "dictation" && n === 1) return fixDictation();
      if (st.nearest && st.nearest.ids[n - 1]) {
        const target = st.nearest.ids[n - 1];
        setState({ nearest: null });
        dispatch({ id: target, via });
        return;
      }
      setStatus("There are no options to choose from right now.");
      return;
    }

    // ---------------------------------------------------------------- colours
    case "colour.black":
    case "colour.white":
    case "colour.red":
    case "colour.blue":
    case "colour.green":
    case "colour.yellow":
    case "colour.orange":
    case "colour.purple": {
      const c = id.slice("colour.".length) as ColourName;
      setState({ colour: c });
      const sel = st.selectedStrokeId ? page().strokes.find((s) => s.id === st.selectedStrokeId) : null;
      if (sel) commit(`make it ${c}`, [{ type: "style-stroke", pageId: page().id, id: sel.id, colour: c }]);
      const ratio = contrastRatio(COLOUR_HEX[c], BG_HEX[page().background]);
      if (ratio < 3) setStatus(`Ink is ${c}. Warning: ${c} is hard to see on this page (contrast ${ratio.toFixed(1)}:1). Try a darker colour or “${page().background === "light" ? "dark page" : "light page"}”.`);
      else setStatus(`Ink is ${c}`);
      persistPrefs();
      return;
    }

    // ---------------------------------------------------------------- tools
    case "width.thicker":
    case "width.thinner": {
      const i = WIDTHS.findIndex((w) => w >= st.width);
      const cur = i < 0 ? WIDTHS.length - 1 : i;
      const next = id === "width.thicker" ? WIDTHS[Math.min(WIDTHS.length - 1, cur + 1)] : WIDTHS[Math.max(0, cur - 1)];
      setState({ width: next });
      setStatus(next === st.width ? `Line width is already ${id === "width.thicker" ? "the thickest" : "the thinnest"} (${next} px)` : `Line width ${next} px`);
      persistPrefs();
      return;
    }
    case "tool.free":
      setState({ tool: "free" });
      setStatus("Freehand drawing");
      persistPrefs();
      return;
    case "tool.straight":
      setState({ tool: st.tool === "straight" ? "free" : "straight" });
      setStatus(st.tool === "straight" ? "Freehand drawing" : "Straight lines: each stroke becomes a line until you choose Freehand.");
      persistPrefs();
      return;
    case "tool.eraser":
      setState({ tool: st.tool === "eraser" ? "free" : "eraser" });
      setStatus(st.tool === "eraser" ? "Freehand drawing" : "Eraser: put the pen down and pass over a stroke to remove it.");
      persistPrefs();
      return;
    case "shape.circle":
    case "shape.line":
    case "shape.square":
    case "shape.triangle":
      return makeShape(id.slice("shape.".length) as ShapeTarget);

    // ---------------------------------------------------------------- view
    case "zoom.in":
    case "zoom.out":
    case "zoom.fit":
    case "move.up":
    case "move.down":
    case "move.left":
    case "move.right":
      setStatus(`${ACTION_BY_ID[id].label} isn't available yet. The whole page always fits on screen.`);
      return;
    case "bg.light":
    case "bg.dark": {
      const bg = id === "bg.light" ? "light" : "dark";
      if (page().background === bg) {
        setStatus(`The page is already ${bg}`);
        return;
      }
      commit(`${bg} page`, [{ type: "set-page-props", pageId: page().id, background: bg }]);
      const ratio = contrastRatio(COLOUR_HEX[st.colour], BG_HEX[bg]);
      setStatus(ratio < 3 ? `${bg === "light" ? "Light" : "Dark"} page. Warning: ${st.colour} ink is hard to see here (contrast ${ratio.toFixed(1)}:1).` : `${bg === "light" ? "Light" : "Dark"} page`);
      return;
    }
    case "guides.toggle": {
      const on = !page().guides;
      commit(on ? "guide lines on" : "guide lines off", [{ type: "set-page-props", pageId: page().id, guides: on }]);
      setStatus(on ? "Guide lines on" : "Guide lines off");
      return;
    }

    // ---------------------------------------------------------------- pages
    case "page.new": {
      const n = st.history.doc.pages.length + 1;
      const p = newPage(`Notes ${n}`);
      commit("new page", [{ type: "add-page", page: p }, { type: "switch-page", pageId: p.id }]);
      setStatus(`New page: ${p.name}`);
      say(`New page, ${p.name}`);
      return;
    }
    case "page.next":
    case "page.prev": {
      const pages = st.history.doc.pages;
      const i = pages.findIndex((p) => p.id === st.history.doc.currentPageId);
      const j = id === "page.next" ? i + 1 : i - 1;
      if (j < 0 || j >= pages.length) {
        setStatus(id === "page.next" ? "This is the last page. Say “add page” for a new one." : "This is the first page.");
        return;
      }
      commit("change page", [{ type: "switch-page", pageId: pages[j].id }]);
      setStatus(`Page ${j + 1} of ${pages.length}: ${pages[j].name}`);
      say(`${pages[j].name}`);
      return;
    }
    case "page.delete": {
      const pages = st.history.doc.pages;
      const cur = page();
      if (pages.length === 1) {
        const p = newPage("Notes 1");
        commit("delete page", [{ type: "add-page", page: p }, { type: "switch-page", pageId: p.id }, { type: "delete-page", pageId: cur.id }]);
      } else {
        const i = pages.findIndex((p) => p.id === cur.id);
        const other = pages[i + 1] ?? pages[i - 1];
        commit("delete page", [{ type: "switch-page", pageId: other.id }, { type: "delete-page", pageId: cur.id }]);
      }
      setStatus(`Deleted ${cur.name}. Undo brings it back.`);
      say(`Deleted ${cur.name}`);
      return;
    }
    case "page.clear":
      commit("clear page", [{ type: "clear-page", pageId: page().id }]);
      setStatus(`Cleared ${page().name}. Undo brings it back.`);
      return;
    case "export.png": {
      const p = page();
      void exportPng(p, runtime.canvasSize)
        .then(() => {
          setStatus(`Saved ${p.name} as a PNG picture`);
          say(`Saved ${p.name} as a picture`);
        })
        .catch((e) => setStatus(`Could not save the picture: ${(e as Error).message}`));
      return;
    }
    case "export.svg": {
      const p = page();
      const svg = pageToSvg(p, { w: Math.round(runtime.canvasSize.w), h: Math.round(runtime.canvasSize.h) });
      downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `steady-${slug(p.name)}.svg`);
      setStatus(`Saved ${p.name} as an SVG drawing`);
      say(`Saved ${p.name} as a drawing`);
      return;
    }
    case "export.pdf":
      setStatus("Opening the print dialog. Choose “Save as PDF” to make a PDF.");
      setTimeout(() => window.print(), 50);
      return;

    // ---------------------------------------------------------------- voice
    case "mic.toggle":
      toggleMic("command");
      return;
    case "dictate":
      return startDictation();
    case "dictation.fix":
      return fixDictation();
    case "dictation.edit":
      return editLastText();
    case "readback": {
      const texts = page().texts.map((t) => t.text).filter(Boolean);
      if (!texts.length) {
        setStatus("There is no text on this page to read yet. Say “note” to dictate, or “turn my writing into text”.");
        say("There is no text on this page yet");
        return;
      }
      setStatus(`Reading back ${texts.length} text ${texts.length === 1 ? "block" : "blocks"}`);
      void speakNow(texts.join(". ")).catch(() => setStatus("Spoken replies aren't available right now."));
      return;
    }
    case "speech.toggle": {
      const on = !st.speech;
      setState({ speech: on });
      applySpeechSetting(on);
      setStatus(on ? "Spoken replies on" : "Spoken replies off");
      persistPrefs();
      return;
    }
    case "sounds.toggle": {
      const on = !st.sounds;
      setState({ sounds: on });
      setEarconsEnabled(on);
      setStatus(on ? "Click sounds on" : "Click sounds off");
      persistPrefs();
      return;
    }

    // ---------------------------------------------------------------- ai
    case "ai.handwriting":
      return void startCleanup("handwriting");
    case "ai.cleanup":
      return void startCleanup("cleanup");
    case "ai.label":
      return void startCleanup("label");

    // ---------------------------------------------------------------- setup
    case "steadier":
    case "looser": {
      const v = Math.max(0, Math.min(100, st.settings.steadiness + (id === "steadier" ? 10 : -10)));
      runtime.setSteadiness(v);
      setStatus(`Steadiness ${v} of 100`);
      return;
    }
    case "recenter":
      if (st.phase === "calibrating") return;
      runtime.beginCalibration(st.calibration ? "recenter" : "full");
      return;
    case "remeasure":
      if (st.phase === "calibrating") return;
      runtime.beginCalibration(st.calibration ? "remeasure" : "full");
      return;
    case "calibrate":
      if (st.phase === "calibrating" && st.calib?.measuring) return;
      runtime.beginCalibration("full");
      return;
    case "calibration.reset": {
      remove(KEYS.setup);
      runtime.updateSettings({ ...DEFAULT_SETTINGS, simulateTremor: st.tremor });
      runtime.setSteadiness(DEFAULT_SETTINGS.steadiness);
      setState({ calibration: null, hasSavedSetup: false });
      setStatus("Setup reset to the defaults. Say “calibrate” or use Calibrate to measure again.");
      return;
    }
    case "pause.toggle":
      runtime.setPaused(!st.paused);
      if (st.desktopOn && !st.paused) desktop.release(); // never leave the real mouse button held
      return;
    case "mode.head":
    case "face.toggle":
      setStatus(`${ACTION_BY_ID[id].label} isn't available yet. Hand mode, keys, voice and the typed box all work.`);
      return;
    case "profile.next": {
      const target = inv.text ? loadProfiles().list.find((p) => p.id === inv.text) : nextProfile();
      if (!target) return;
      const prof = activateProfile(target.id);
      if (!prof) return;
      runtime.updateSettings({ ...prof.settings, simulateTremor: st.tremor });
      setState({ calibration: prof.calibration ?? st.calibration });
      setStatus(`Profile: ${prof.name}. Steadiness ${prof.settings.steadiness}.`);
      say(`Switched to ${prof.name}`);
      persistSetup();
      return;
    }
    case "preset.sore":
    case "preset.reaching":
    case "preset.rest":
    case "preset.still": {
      const pr = PRESETS[id as PresetId];
      runtime.updateSettings(withSteadiness(st.settings, pr.patch));
      setStatus(`${pr.label}: ${pr.describe}`);
      say(pr.label);
      persistSetup();
      saveActiveProfile();
      return;
    }
    case "help":
      setState({ panel: st.panel === "help" ? null : "help" });
      return;
    case "settings":
      setState({ panel: st.panel === "settings" ? null : "settings" });
      return;

    // ---------------------------------------------------------------- demo
    case "demo.toggle":
      setState({ demoOpen: !st.demoOpen });
      return;
    case "tremor.toggle": {
      const on = !st.tremor;
      setState({ tremor: on });
      runtime.updateSettings({ simulateTremor: on });
      setStatus(on ? "Simulated shake on: noise is added to the camera point before smoothing." : "Simulated shake off");
      return;
    }
    case "ghost.toggle":
      setState((s) => ({ ghost: !s.ghost, renderVersion: s.renderVersion + 1 }));
      setStatus(st.ghost ? "Ghost view off" : "Ghost view on: the raw path shows faded under each smoothed stroke.");
      return;
    case "judge.next": {
      closeMic();
      resetDoc();
      setState({
        metrics: { ...INITIAL_METRICS, cameraFps: st.metrics.cameraFps, detectionFps: st.metrics.detectionFps },
        overlay: null,
        clarify: null,
        nearest: null,
        tremor: false,
        ghost: false,
        lastActions: [],
        demoQuoteSeen: false,
      });
      clearClaudeLog();
      refreshClaudeMetrics();
      runtime.updateSettings({ simulateTremor: false });
      runtime.beginCalibration("full");
      setStatus("Ready for the next person. Rest your hand and hold still.");
      return;
    }
    case "desktop.toggle": {
      const on = !st.desktopOn;
      if (on) {
        closeMic();
        setState({ desktopOn: true, overlay: null, clarify: null, nearest: null, panel: null, subpanel: null, ghost: false });
        runtime.setDesktop(true);
        setStatus("Desktop mode on: connecting to the helper. Put Chrome beside your drawing app, not behind it.");
        void desktop.enable().catch((e) => setStatus(`Desktop mode: ${(e as Error)?.message ?? e}`));
      } else {
        desktop.disable();
        runtime.setDesktop(false);
        setState({ desktopOn: false });
        setStatus("Desktop mode off. Drawing on Steady's page again.");
      }
      return;
    }
    case "desktop.area":
      if (!st.desktopOn) {
        setStatus("Turn on Desktop mode first, then set the drawing area.");
        return;
      }
      desktop.startAreaSetup();
      return;
    case "desktop.dwellclick":
      if (!st.desktopOn) {
        setStatus("Dwell click works in Desktop mode. Turn Desktop mode on first.");
        return;
      }
      desktop.setDwellClick(!desktop.dwellClick);
      setStatus(desktop.dwellClick ? "Dwell click on: holding still outside the drawing area clicks." : "Dwell click off.");
      return;
  }
  const never: never = id;
  void never;
}

function cancelAnything(id: ActionId) {
  const st = getState();
  if (st.dialog) {
    setState({ dialog: null });
    pendingArg = undefined;
    setStatus("Cancelled. Nothing changed.");
    return;
  }
  if (st.overlay?.kind === "ghost") return rejectGhost();
  if (st.overlay?.kind === "dictation") return cancelDictation();
  if (st.clarify || st.nearest) {
    setState({ clarify: null, nearest: null });
    setStatus("Cancelled.");
    return;
  }
  if (st.phase === "calibrating") {
    runtime.cancelCalibration();
    return;
  }
  if (st.mic.open) {
    closeMic();
    return;
  }
  if (st.panel || st.subpanel) {
    setState({ panel: null, subpanel: null });
    focusCanvas();
    return;
  }
  if (id === "confirm.no") setStatus("Nothing to cancel.");
  focusCanvas();
}

async function makeShapeAsync(target: ShapeTarget) {
  const s = lastStroke();
  if (!s) {
    setStatus(`There is no stroke to make into a ${target} yet.`);
    say(`Draw something first`);
    return;
  }
  const fit = forceShape(s.points, target);
  if (fit.kind === "none" || fit.points.length < 2) {
    setStatus(`Couldn't make that into a ${target}.`);
    say(`Couldn't make that into a ${target}`);
    return;
  }
  const shaped: Stroke = { ...s, id: newId("s"), kind: fit.kind, points: fit.points, raw: s.raw };
  commit(`make it a ${target}`, [{ type: "replace-strokes", pageId: page().id, removeIds: [s.id], add: [shaped] }]);
  setState({ selectedStrokeId: shaped.id });
  setStatus(`Made it a ${target}. Undo goes back.`);
  say(`Made it a ${target}`);
}

function makeShape(target: ShapeTarget) {
  void makeShapeAsync(target);
}

export function persistPrefs() {
  const s = getState();
  save(KEYS.prefs, { colour: s.colour, width: s.width, tool: s.tool, sounds: s.sounds, speech: s.speech, inputs: s.inputs });
}

export function restorePrefs() {
  const p = load<Partial<{ colour: ColourName; width: number; tool: "free" | "straight" | "eraser"; sounds: boolean; speech: boolean; inputs: { dwell: boolean; voice: boolean; keys: boolean } }>>(KEYS.prefs, {});
  const patch: Record<string, unknown> = {};
  if (p.colour) patch.colour = p.colour;
  if (p.width) patch.width = p.width;
  if (p.tool === "free" || p.tool === "straight") patch.tool = p.tool;
  if (typeof p.sounds === "boolean") patch.sounds = p.sounds;
  if (typeof p.speech === "boolean") patch.speech = p.speech;
  if (p.inputs) patch.inputs = { dwell: p.inputs.dwell !== false, voice: p.inputs.voice !== false, keys: p.inputs.keys !== false };
  setState(patch);
  setEarconsEnabled(getState().sounds);
  applySpeechSetting(getState().speech);
}
