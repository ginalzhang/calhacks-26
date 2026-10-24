/**
 * Spoken replies: Cartesia Sonic via @cartesia/cartesia-js (browser, minted access token),
 * falling back to the browser's speechSynthesis. Togglable (persisted in localStorage).
 *
 * Use for outcomes you can't see at a glance ("Made it a circle", "Saved page 3",
 * "Didn't catch that; I heard paint the room"), "read it back", and reading clarify options.
 * NEVER call speak() on pen toggles (design rule, §3): pen state uses earcons only.
 * A newer speak() cancels the one in progress; opening the mic cancels speech.
 */
import { getCartesiaToken, invalidateCartesiaToken } from "./token";

export const SONIC_MODEL = "sonic-3.6";
/** "Skylar", en-US female, from Cartesia's recommended voices. */
export const SONIC_VOICE_ID = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4";
const STORAGE_KEY = "steady.speech";
const MAX_CHARS = 1000;

let enabled: boolean | null = null;
let generation = 0;
let audioCtx: AudioContext | null = null;
let current: { stop(): void } | null = null;
let sonicFailedAt = 0;

function readEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = typeof localStorage?.getItem !== "function" ? true : localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function setSpeechEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* private mode */
  }
  if (!on) cancelSpeech();
}

export function isSpeechEnabled(): boolean {
  return readEnabled();
}

export function cancelSpeech(): void {
  generation++;
  current?.stop();
  current = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

/** Which engine the last speak() used (for the status bar / Demo panel). */
export let lastTtsEngine: "sonic" | "browser" | "none" = "none";

async function speakSonic(text: string, gen: number): Promise<boolean> {
  if (Date.now() - sonicFailedAt < 60_000) return false;
  const token = await getCartesiaToken();
  if (!token || gen !== generation) return false;
  try {
    const { default: Cartesia } = await import("@cartesia/cartesia-js");
    const client = new Cartesia({ token, maxRetries: 0, timeout: 8000 });
    const res = await client.tts.generate({
      model_id: SONIC_MODEL,
      transcript: text,
      voice: { id: SONIC_VOICE_ID },
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 24000 },
      language: "en",
    });
    const bytes = await res.arrayBuffer();
    if (gen !== generation) return true; // cancelled meanwhile; treat as handled
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => {});
    const buf = await audioCtx.decodeAudioData(bytes);
    if (gen !== generation) return true;
    await new Promise<void>((resolve) => {
      const src = audioCtx!.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx!.destination);
      src.onended = () => resolve();
      current = {
        stop() {
          try {
            src.stop();
          } catch {
            /* already stopped */
          }
          resolve();
        },
      };
      src.start();
    });
    lastTtsEngine = "sonic";
    return true;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) invalidateCartesiaToken();
    sonicFailedAt = Date.now();
    console.warn("[tts] Sonic failed, using speechSynthesis:", (err as Error).message);
    return false;
  }
}

function speakBrowser(text: string, gen: number): Promise<void> {
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
    lastTtsEngine = "none";
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    if (gen !== generation) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1;
    const voice = speechSynthesis.getVoices().find((v) => v.lang?.startsWith("en") && v.localService);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    current = {
      stop() {
        speechSynthesis.cancel();
        resolve();
      },
    };
    speechSynthesis.speak(u);
    lastTtsEngine = "browser";
  });
}

/** Speak `text` (no-op when spoken replies are off). Resolves when playback ends or is cancelled. */
export async function speak(text: string): Promise<void> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!clean || !readEnabled() || typeof window === "undefined") return;
  cancelSpeech();
  const gen = generation;
  if (await speakSonic(clean, gen)) return;
  if (gen !== generation) return;
  await speakBrowser(clean, gen);
}
