/** Document edits: the only place history is changed. Autosaves the doc to localStorage. */
import { applyCommands, createHistory, currentPage, redo, undo, undoLabel } from "@/pipeline/document";
import type { Doc, DocCommand, Page, Stroke } from "@/pipeline/types";
import { KEYS, load, save } from "@/lib/persist";
import { getState, setState } from "./store";

export function page(): Page {
  return currentPage(getState().history.doc);
}

export function commit(label: string, cmds: DocCommand[]): void {
  const h = applyCommands(getState().history, label, cmds);
  setState((s) => ({ history: h, renderVersion: s.renderVersion + 1 }));
  scheduleSave();
}

export function undoDoc(): string | null {
  const s = getState();
  const label = undoLabel(s.history);
  if (!label) return null;
  setState((st) => ({ history: undo(st.history), renderVersion: st.renderVersion + 1 }));
  scheduleSave();
  return label;
}

export function redoDoc(): string | null {
  const s = getState();
  if (!s.history.future.length) return null;
  const h = redo(s.history);
  setState((st) => ({ history: h, renderVersion: st.renderVersion + 1 }));
  scheduleSave();
  return undoLabel(h) ?? "change";
}

export function lastStroke(): Stroke | null {
  const p = page();
  const sel = getState().selectedStrokeId;
  if (sel) {
    const s = p.strokes.find((x) => x.id === sel);
    if (s) return s;
  }
  return p.strokes[p.strokes.length - 1] ?? null;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    // Raw ghost points are demo-only; don't bloat localStorage with them.
    const doc = getState().history.doc;
    const slim: Doc = {
      ...doc,
      pages: doc.pages.map((p) => ({ ...p, strokes: p.strokes.map((s) => ({ ...s, raw: undefined })) })),
    };
    save(KEYS.doc, slim);
  }, 400);
}

export function restoreDoc(): boolean {
  const doc = load<Doc | null>(KEYS.doc, null);
  if (!doc || !Array.isArray(doc.pages) || doc.pages.length === 0) return false;
  if (!doc.pages.some((p) => p.id === doc.currentPageId)) doc.currentPageId = doc.pages[0].id;
  setState((s) => ({ history: createHistory(doc), renderVersion: s.renderVersion + 1 }));
  return true;
}

export function resetDoc(doc?: Doc): void {
  setState((s) => ({ history: createHistory(doc), renderVersion: s.renderVersion + 1 }));
  scheduleSave();
}
