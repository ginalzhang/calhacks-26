/**
 * Thin wrapper over C's createVoiceController: mic state into the store, finals into
 * the command runner (command mode) or the dictation overlay (dictation mode).
 */
import { createVoiceController, type VoiceController, type VoiceMode } from "@/voice/VoiceController";
import { cancelSpeech, setSpeechEnabled, speak } from "@/voice/tts";
import { getState, setState, setStatus } from "./store";

let controller: VoiceController | null = null;
let onCommandFinal: ((text: string) => void) | null = null;
/** Mic close time, so face tap can be suppressed for 500 ms after (P3). */
export let micClosedAt = 0;

export function setCommandHandler(fn: (text: string) => void) {
  onCommandFinal = fn;
}

function ctl(): VoiceController {
  if (controller) return controller;
  controller = createVoiceController({
    onPartial(text, mode) {
      const s = getState();
      setState({ mic: { ...s.mic, partial: text } });
      if (mode === "dictation" && s.overlay?.kind === "dictation") {
        setState({ overlay: { ...s.overlay, partial: text } });
      }
    },
    onFinal(text, mode) {
      const s = getState();
      setState({ mic: { ...s.mic, partial: "" } });
      if (mode === "dictation") {
        const ov = s.overlay;
        if (ov?.kind === "dictation") {
          const joined = [ov.text, text.trim()].filter(Boolean).join(ov.text && !/\s$/.test(ov.text) ? " " : "");
          setState({ overlay: { ...ov, text: joined, partial: "", stage: ov.stage === "editing" ? "editing" : "review" } });
        }
        return;
      }
      if (text.trim()) onCommandFinal?.(text);
    },
    onLevel(level) {
      const s = getState();
      if (Math.abs(s.mic.level - level) > 0.03 || level === 0) setState({ mic: { ...s.mic, level } });
    },
    onState(state, detail) {
      const s = getState();
      const open = state === "connecting" || state === "listening" || state === "finalizing";
      if (!open && s.mic.open) micClosedAt = performance.now();
      setState({ mic: { ...s.mic, state, open, engine: controller?.engine ?? s.mic.engine, detail, level: open ? s.mic.level : 0 } });
      if (state === "listening") setStatus(s.mic.mode === "dictation" ? "Listening for your note…" : "Listening…");
      if (state === "error") setStatus(detail ? `Microphone problem: ${detail}. The typed box always works.` : "The microphone isn't available. The typed box always works.");
    },
  });
  return controller;
}

export async function openMic(mode: VoiceMode): Promise<void> {
  const s = getState();
  if (!s.inputs.voice) {
    setStatus("Voice input is switched off in Settings.");
    return;
  }
  if (!s.online) {
    setStatus("Voice needs the internet, which is down. The typed box still works.");
    return;
  }
  cancelSpeech();
  const c = ctl();
  if (c.isOpen) c.close();
  c.setCapMs(mode === "dictation" ? 30_000 : 15_000);
  setState({ mic: { ...getState().mic, mode, open: true, state: "connecting", partial: "" } });
  try {
    await c.open(mode);
    setState({ mic: { ...getState().mic, engine: c.engine } });
    if (c.engine === "none") {
      setState({ mic: { ...getState().mic, open: false, state: "error" } });
      setStatus("No speech recognition is available in this browser. Use the typed box.");
    }
  } catch (e) {
    setState({ mic: { ...getState().mic, open: false, state: "error" } });
    setStatus(`The microphone could not open (${(e as Error)?.message ?? e}). The typed box always works.`);
  }
}

export function closeMic(): void {
  controller?.close();
}

export function micIsOpen(): boolean {
  return !!controller?.isOpen || getState().mic.open;
}

export function toggleMic(mode: VoiceMode = "command"): void {
  if (micIsOpen()) closeMic();
  else void openMic(mode);
}

/** Spoken confirmation for outcomes you can't see at a glance. Never for pen toggles. */
export function say(text: string): void {
  if (!getState().speech) return;
  void speak(text).catch(() => undefined);
}

export function applySpeechSetting(on: boolean) {
  setSpeechEnabled(on);
  if (!on) cancelSpeech();
}

export function speakNow(text: string): Promise<void> {
  return speak(text);
}
