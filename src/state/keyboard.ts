/**
 * The single document keydown listener (§3). Returns early when the target is a button,
 * input, textarea or select, so Space/Enter activate focused controls natively and keys
 * type normally in the typed box, dictation box and profile-name field. Esc always cancels
 * and returns focus to the canvas. Every key not in the key map does nothing.
 */
import { ACTIONS } from "@/actions";
import { unlockAudio } from "@/lib/earcons";
import { focusCanvas } from "@/lib/focus";
import { dispatch } from "./dispatch";
import { getState } from "./store";

export function installKeyboard(): () => void {
  const onKey = (e: KeyboardEvent) => {
    unlockAudio();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const st = getState();
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    const isField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!target?.isContentEditable;
    const isButton = tag === "BUTTON" || tag === "A" || target?.getAttribute?.("role") === "button";

    if (e.key === "Escape") {
      e.preventDefault();
      if (isField && !st.dialog && !st.overlay && !st.clarify && st.phase !== "calibrating") {
        focusCanvas();
        return;
      }
      dispatch({ id: "cancel", via: "key" });
      if (!getState().dialog) focusCanvas();
      return;
    }
    if (isField || isButton) return;
    if (!st.inputs.keys) return;
    if (st.phase === "intro") return;
    if (e.repeat) {
      if (e.key === " ") e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      if (st.overlay && st.overlay.kind !== "busy") {
        e.preventDefault();
        dispatch({ id: "accept", via: "key" });
      }
      return;
    }
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      const n = e.key;
      const dictationFix = st.overlay?.kind === "dictation" && n === "1";
      if (st.clarify || st.nearest || dictationFix) {
        e.preventDefault();
        dispatch({ id: `choose.${n}` as "choose.1", via: "key" });
      }
      return;
    }
    if (st.phase === "calibrating" && (e.key === " " || e.key === "r" || e.key === "R")) {
      e.preventDefault();
      return;
    }
    const def = ACTIONS.find((a) => a.key !== null && (a.key === e.key || a.altKeys?.includes(e.key)));
    if (!def) return;
    e.preventDefault();
    dispatch({ id: def.id, via: "key" });
  };
  document.addEventListener("keydown", onKey);
  const unlock = () => unlockAudio();
  document.addEventListener("pointerdown", unlock);
  return () => {
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", unlock);
  };
}
