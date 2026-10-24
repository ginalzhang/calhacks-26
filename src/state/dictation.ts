/**
 * Dictation (§4): "note"/"type" opens a read-only aria-live transcript while the mic is open,
 * with Accept (Enter) / Fix (1) / Cancel (Esc) tiles. It becomes an editable textarea only
 * after Accept; the Edit tile opens the last text block for keyboard users.
 */
import { newId } from "@/pipeline/document";
import type { Vec2 } from "@/pipeline/types";
import { commit, page } from "./docOps";
import { runtime } from "./runtime";
import { getState, setState, setStatus } from "./store";
import { closeMic, openMic, say } from "./voice";
import { focusCanvas } from "@/lib/focus";

export const TEXT_SIZE = 28;

function placeAt(): Vec2 {
  const p = runtime.lastPointer;
  if (p && runtime.isOverCanvas(p)) {
    return runtime.toDoc({ x: Math.max(8, Math.min(p.x, runtime.canvasSize.w - 200)), y: Math.max(8, Math.min(p.y, runtime.canvasSize.h - 40)) });
  }
  const n = page().texts.length;
  return runtime.toDoc({ x: 32, y: 32 + ((n * TEXT_SIZE * 1.6) % Math.max(100, runtime.canvasSize.h - 80)) });
}

export function startDictation() {
  const st = getState();
  if (st.overlay && st.overlay.kind !== "dictation") {
    setStatus("Finish the open panel first: Accept or Cancel.");
    return;
  }
  setState({ overlay: { kind: "dictation", stage: "listening", text: "", partial: "", at: placeAt() } });
  setStatus("Note: speak now. Enter accepts, 1 fixes the last sentence, Esc cancels.");
  void openMic("dictation");
}

export function acceptDictation() {
  const ov = getState().overlay;
  if (ov?.kind !== "dictation") return;
  if (ov.stage === "editing") return finishEditing(ov.text);
  const text = [ov.text, ov.partial].filter(Boolean).join(" ").trim();
  closeMic();
  if (!text) {
    setStatus("I haven't heard anything yet. Say your note, press 1 to try again, or Esc to cancel.");
    setState({ overlay: { ...ov, stage: "review" } });
    return;
  }
  const id = newId("t");
  commit("note", [{ type: "add-text", pageId: page().id, text: { id, x: ov.at.x, y: ov.at.y, text, colour: inkForText(), size: TEXT_SIZE, createdAt: Date.now() } }]);
  setState({ overlay: { kind: "dictation", stage: "editing", text, partial: "", at: ov.at, editId: id }, lastTextId: id });
  setStatus("Note placed. You can edit it in the box now; Done or Esc to finish. Undo removes it.");
  say("Note placed");
}

export function fixDictation() {
  const ov = getState().overlay;
  if (ov?.kind !== "dictation") {
    setStatus("Fix works while a note is open. Say “note” to start one.");
    return;
  }
  const kept = dropLastSentence(ov.text);
  setState({ overlay: { ...ov, stage: ov.stage === "editing" ? "editing" : "listening", text: kept, partial: "" } });
  setStatus("Say the last sentence again.");
  void openMic("dictation");
}

export function cancelDictation() {
  const ov = getState().overlay;
  closeMic();
  setState({ overlay: null });
  if (ov?.kind === "dictation" && ov.stage === "editing") setStatus("Done.");
  else setStatus("Note cancelled. Nothing was added.");
  focusCanvas();
}

export function editLastText() {
  const cur = getState().overlay;
  // From the live transcript, Edit places the note and opens it for typing.
  if (cur?.kind === "dictation" && cur.stage !== "editing" && (cur.text || cur.partial)) return acceptDictation();
  const p = page();
  const id = getState().lastTextId;
  const t = p.texts.find((x) => x.id === id) ?? p.texts[p.texts.length - 1];
  if (!t) {
    setStatus("There is no text on this page to edit yet. Say “note” to dictate one.");
    return;
  }
  setState({ overlay: { kind: "dictation", stage: "editing", text: t.text, partial: "", at: { x: t.x, y: t.y }, editId: t.id }, lastTextId: t.id });
  setStatus("Editing text. Done saves; Esc closes.");
}

/** Save the textarea contents into the placed text block. */
export function finishEditing(text: string) {
  const ov = getState().overlay;
  if (ov?.kind !== "dictation") return;
  const p = page();
  const t = p.texts.find((x) => x.id === ov.editId);
  if (t && text.trim() && text !== t.text) {
    commit("edit text", [{ type: "edit-text", pageId: p.id, id: t.id, text }]);
    setStatus("Text updated. Undo goes back.");
  } else {
    setStatus("Done.");
  }
  closeMic();
  setState({ overlay: null });
  focusCanvas();
}

function inkForText() {
  const s = getState();
  const bg = page().background;
  if (bg === "light" && (s.colour === "white" || s.colour === "yellow")) return "black" as const;
  if (bg === "dark" && s.colour === "black") return "white" as const;
  return s.colour;
}

export function dropLastSentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const parts = t.match(/[^.!?]+[.!?]*\s*/g) ?? [t];
  parts.pop();
  return parts.join("").trim();
}
