/**
 * Pure document + undo/redo history (agent A).
 *
 * Docs are immutable: every command returns a new Doc sharing untouched pages/strokes.
 * Undo uses exact snapshot inverses: each history entry's `inverse` restores the affected
 * page(s) to the object they were before the edit (O(1) thanks to immutability), so order,
 * ids and styles come back exactly. Because DocCommand has no "restore" variant, inverses use
 * two module-internal commands (`restore-page`, `restore-pages`); they are stored in
 * HistoryEntry.inverse typed as DocCommand (see `.context/contract-requests.md`). They are only
 * ever produced and consumed here; callers should treat `inverse` as opaque.
 *
 * Use applyCommands() for undoable edits (each call = one Undo step with a label, e.g.
 * "stroke", "make it a circle"); applyUntracked() for navigation such as switch-page.
 */
import type { Doc, DocCommand, History, HistoryEntry, Page } from "./types";

export type InternalCommand =
  | { type: "restore-page"; page: Page }
  | { type: "restore-pages"; pages: Page[]; currentPageId: string };
export type AnyDocCommand = DocCommand | InternalCommand;

export const HISTORY_LIMIT = 200;

let idCounter = 0;
/** Unique-enough id: prefix + process-local counter + random suffix (survives reloads). */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newPage(name: string): Page {
  return { id: newId("page"), name, strokes: [], texts: [], background: "light", guides: false };
}

export function newDoc(): Doc {
  const p = newPage("Notes 1");
  return { pages: [p], currentPageId: p.id };
}

export function currentPage(doc: Doc): Page {
  return doc.pages.find((p) => p.id === doc.currentPageId) ?? doc.pages[0];
}

/** Next default page name ("Notes N" with N one more than the highest existing). */
export function nextPageName(doc: Doc): string {
  let max = 0;
  for (const p of doc.pages) {
    const m = /^Notes (\d+)$/.exec(p.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Notes ${Math.max(max, doc.pages.length) + 1}`;
}

export function createHistory(initial?: Doc): History {
  return { doc: initial ?? newDoc(), past: [], future: [] };
}

function mapPage(doc: Doc, pageId: string, f: (p: Page) => Page): Doc {
  let changed = false;
  const pages = doc.pages.map((p) => {
    if (p.id !== pageId) return p;
    const q = f(p);
    if (q !== p) changed = true;
    return q;
  });
  return changed ? { ...doc, pages } : doc;
}

/** Apply one command purely. Unknown page/stroke ids are no-ops. */
export function applyCommand(doc: Doc, cmd: AnyDocCommand): Doc {
  switch (cmd.type) {
    case "add-stroke":
      return mapPage(doc, cmd.pageId, (p) => ({ ...p, strokes: [...p.strokes, cmd.stroke] }));
    case "remove-strokes": {
      const ids = new Set(cmd.ids);
      return mapPage(doc, cmd.pageId, (p) =>
        p.strokes.some((s) => ids.has(s.id)) ? { ...p, strokes: p.strokes.filter((s) => !ids.has(s.id)) } : p,
      );
    }
    case "replace-strokes": {
      const ids = new Set(cmd.removeIds);
      return mapPage(doc, cmd.pageId, (p) => {
        // Replacement strokes take the z-position of the first removed stroke (if any).
        const firstIdx = p.strokes.findIndex((s) => ids.has(s.id));
        const kept = p.strokes.filter((s) => !ids.has(s.id));
        const insertAt = firstIdx < 0 ? kept.length : p.strokes.slice(0, firstIdx).filter((s) => !ids.has(s.id)).length;
        const strokes = [...kept.slice(0, insertAt), ...cmd.add, ...kept.slice(insertAt)];
        return { ...p, strokes, texts: cmd.addTexts?.length ? [...p.texts, ...cmd.addTexts] : p.texts };
      });
    }
    case "style-stroke":
      return mapPage(doc, cmd.pageId, (p) => ({
        ...p,
        strokes: p.strokes.map((s) =>
          s.id === cmd.id ? { ...s, ...(cmd.colour ? { colour: cmd.colour } : {}), ...(cmd.width !== undefined ? { width: cmd.width } : {}) } : s,
        ),
      }));
    case "add-text":
      return mapPage(doc, cmd.pageId, (p) => ({ ...p, texts: [...p.texts, cmd.text] }));
    case "edit-text":
      return mapPage(doc, cmd.pageId, (p) => ({ ...p, texts: p.texts.map((x) => (x.id === cmd.id ? { ...x, text: cmd.text } : x)) }));
    case "clear-page":
      return mapPage(doc, cmd.pageId, (p) => (p.strokes.length || p.texts.length ? { ...p, strokes: [], texts: [] } : p));
    case "add-page":
      return { pages: [...doc.pages, cmd.page], currentPageId: cmd.page.id };
    case "delete-page": {
      const idx = doc.pages.findIndex((p) => p.id === cmd.pageId);
      if (idx < 0) return doc;
      let pages = doc.pages.filter((p) => p.id !== cmd.pageId);
      if (!pages.length) pages = [newPage("Notes 1")];
      const currentPageId =
        doc.currentPageId === cmd.pageId ? pages[Math.min(idx, pages.length - 1)].id : doc.currentPageId;
      return { pages, currentPageId };
    }
    case "rename-page":
      return mapPage(doc, cmd.pageId, (p) => ({ ...p, name: cmd.name }));
    case "switch-page":
      return doc.pages.some((p) => p.id === cmd.pageId) ? { ...doc, currentPageId: cmd.pageId } : doc;
    case "set-page-props":
      return mapPage(doc, cmd.pageId, (p) => ({
        ...p,
        ...(cmd.background ? { background: cmd.background } : {}),
        ...(cmd.guides !== undefined ? { guides: cmd.guides } : {}),
      }));
    case "remove-texts": {
      const ids = new Set(cmd.ids);
      return mapPage(doc, cmd.pageId, (p) =>
        p.texts.some((x) => ids.has(x.id)) ? { ...p, texts: p.texts.filter((x) => !ids.has(x.id)) } : p,
      );
    }
    case "restore-page":
      return mapPage(doc, cmd.page.id, () => cmd.page);
    case "restore-pages":
      return { pages: cmd.pages, currentPageId: cmd.currentPageId };
  }
}

const PAGE_LIST_COMMANDS = new Set<AnyDocCommand["type"]>(["add-page", "delete-page", "switch-page", "restore-pages"]);

/** Exact inverse of `cmds` applied to `before`: snapshots of the touched pages. */
function inverseFor(before: Doc, cmds: AnyDocCommand[]): InternalCommand[] {
  if (cmds.some((c) => PAGE_LIST_COMMANDS.has(c.type))) {
    return [{ type: "restore-pages", pages: before.pages, currentPageId: before.currentPageId }];
  }
  const ids: string[] = [];
  for (const c of cmds) {
    const id = c.type === "restore-page" ? c.page.id : "pageId" in c ? c.pageId : null;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids
    .map((id) => before.pages.find((p) => p.id === id))
    .filter((p): p is Page => !!p)
    .map((page) => ({ type: "restore-page", page }));
}

/** One undoable step. No-op edits (doc unchanged) don't create a history entry. */
export function applyCommands(h: History, label: string, cmds: DocCommand[]): History {
  let doc = h.doc;
  for (const c of cmds) doc = applyCommand(doc, c);
  if (doc === h.doc) return h;
  const entry: HistoryEntry = { label, forward: cmds, inverse: inverseFor(h.doc, cmds) as unknown as DocCommand[] };
  const past = [...h.past, entry];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { doc, past, future: [] };
}

/** Apply without creating an undo step (navigation, e.g. switch-page). Keeps redo. */
export function applyUntracked(h: History, cmds: DocCommand[]): History {
  let doc = h.doc;
  for (const c of cmds) doc = applyCommand(doc, c);
  return doc === h.doc ? h : { ...h, doc };
}

export function undo(h: History): History {
  const entry = h.past[h.past.length - 1];
  if (!entry) return h;
  let doc = h.doc;
  // restore-page keeps the current page (untracked navigation is not undone);
  // restore-pages (page-list edits) restores the page list and current page exactly.
  for (const c of entry.inverse as unknown as AnyDocCommand[]) doc = applyCommand(doc, c);
  return { doc, past: h.past.slice(0, -1), future: [entry, ...h.future] };
}

export function redo(h: History): History {
  const entry = h.future[0];
  if (!entry) return h;
  let doc = h.doc;
  for (const c of entry.forward) doc = applyCommand(doc, c);
  return { doc, past: [...h.past, { ...entry, inverse: inverseFor(h.doc, entry.forward) as unknown as DocCommand[] }], future: h.future.slice(1) };
}

export function undoLabel(h: History): string | null {
  return h.past.length ? h.past[h.past.length - 1].label : null;
}

export function redoLabel(h: History): string | null {
  return h.future.length ? h.future[0].label : null;
}

/** Find a stroke by id on any page. */
export function findStroke(doc: Doc, id: string): { page: Page; index: number } | null {
  for (const page of doc.pages) {
    const index = page.strokes.findIndex((s) => s.id === id);
    if (index >= 0) return { page, index };
  }
  return null;
}
