/**
 * Typed box + voice → C's resolveCommand (grammar first, then /api/command) → dispatch.
 * Exact-only while any dialog is open. Never discards a transcript silently.
 */
import { ACTION_BY_ID, type ActionId } from "@/actions";
import type { CommandContext, CommandResolution } from "@/pipeline/types";
import { resolveCommand } from "@/voice/resolve";
import { runtime } from "./runtime";
import { getState, setState, setStatus } from "./store";
import { lastStroke } from "./docOps";
import { dispatch } from "./dispatch";
import { say, setCommandHandler } from "./voice";
import { profilePhrases } from "./profiles";

export function commandContext(): CommandContext {
  const s = getState();
  const ls = lastStroke();
  return {
    lastActions: s.lastActions.slice(-3),
    selected: ls ? { id: ls.id, kind: ls.kind, colour: ls.colour, width: ls.width } : null,
    canvas: { w: Math.round(runtime.canvasSize.w), h: Math.round(runtime.canvasSize.h) },
  };
}

export async function runCommand(text: string, via: "typed" | "voice"): Promise<CommandResolution | null> {
  const heard = text.trim();
  if (!heard) return null;
  const s = getState();
  const dialogOpen = !!s.dialog;
  if (via === "voice") {
    setState({ heard });
    setStatus(`Heard: ${heard}`);
  }
  let res: CommandResolution;
  try {
    res = await resolveCommand(heard, commandContext(), { dialogOpen, exactOnly: dialogOpen, extra: profilePhrases() });
  } catch (e) {
    console.error("[Steady] resolveCommand failed", e);
    res = { kind: "none", heard, nearest: [], reason: "offline" };
  }
  const m = getState().metrics;
  setState({
    metrics: {
      ...m,
      commandsTotal: m.commandsTotal + 1,
      commandsMatched: m.commandsMatched + (res.kind === "actions" ? 1 : 0),
    },
  });
  if (res.kind === "actions") {
    setState({ nearest: null, clarify: null });
    if (via === "typed") setStatus(`Typed: ${heard}`);
    for (const id of res.actions) dispatch({ id, via: res.source === "claude" ? "claude" : via, text: res.arg });
  } else if (res.kind === "clarify") {
    setState({ clarify: { question: res.question, options: res.options.slice(0, 3), heard }, nearest: null });
    const spoken = `${res.question} ${res.options.map((o, i) => `${i + 1}: ${o.label}.`).join(" ")}`;
    setStatus(`${res.question} Choose 1 to ${res.options.length}.`);
    say(spoken);
  } else {
    const why =
      res.reason === "offline"
        ? " (offline: only the built-in commands work)"
        : res.reason === "timeout"
          ? " (the helper took too long)"
          : "";
    const ids = res.nearest.filter((id): id is ActionId => !!ACTION_BY_ID[id]).slice(0, 2);
    setState({ nearest: { heard, ids } });
    if (dialogOpen) {
      setStatus(`Didn't catch that; I heard “${heard}”. Say or type “yes” to confirm, or “no” to cancel.`);
    } else {
      setStatus(`Didn't catch that; I heard “${heard}”${why}.${ids.length ? " Closest matches are shown as tiles." : ""}`);
    }
    say(`Didn't catch that; I heard ${heard}`);
  }
  return res;
}

setCommandHandler((text) => void runCommand(text, "voice"));
