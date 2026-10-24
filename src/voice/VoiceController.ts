/**
 * Microphone sessions for commands and dictation (PROMPT.md §5).
 *
 * Engines, in order: Cartesia Ink 2 (hand-rolled WebSocket + AudioWorklet 16 kHz PCM) when a token
 * can be minted; the Web Speech API (Chrome) otherwise or when the socket fails; else "none" with a
 * clear error (the typed-command box is the offline path).
 *
 * The mic opens only on open(). It closes on close() (toggle), on 2 s of silence AFTER the first
 * transcript delta (silence before the user starts speaking never closes it), or at the cap
 * (command: 15 s default, setCapMs 15-60 s; dictation: 30 s, or the command cap if longer).
 *
 * Browser-only; nothing here runs at import time.
 */
import { getCartesiaToken, invalidateCartesiaToken } from "./token";
import { buildSttUrl, createTranscriptAssembler, parseSttMessage, STT_SAMPLE_RATE } from "./cartesiaStt";
import { cancelSpeech } from "./tts";

export type VoiceMode = "command" | "dictation";
export type VoiceState = "idle" | "connecting" | "listening" | "finalizing" | "error";
export type VoiceEngine = "cartesia" | "webspeech" | "none";

export interface VoiceCallbacks {
  /** Live transcript so far (final chunks + current partial). */
  onPartial(text: string, mode: VoiceMode): void;
  /** Called once per session with the full transcript, only if something was heard. */
  onFinal(text: string, mode: VoiceMode): void;
  /** Mic level 0..1 (~10 Hz while open; 0 when closed). */
  onLevel(level0to1: number): void;
  /**
   * Session state. `detail` carries a human-readable reason for "error", and for "idle"
   * one of "no-speech" | "silence" | "cap" | "toggle" | "socket-closed".
   */
  onState(s: VoiceState, detail?: string): void;
}

export interface VoiceController {
  open(mode: VoiceMode): Promise<void>;
  close(): void;
  readonly isOpen: boolean;
  readonly engine: VoiceEngine;
  setCapMs(ms: number): void;
}

export interface VoiceControllerOptions {
  /** Extra Cartesia keyterms for command mode (e.g. user profile names). */
  extraKeyterms?: () => string[];
  /** Force an engine (tests / Settings). */
  forceEngine?: VoiceEngine;
}

export const SILENCE_MS = 2000;
export const DEFAULT_COMMAND_CAP_MS = 15_000;
export const DICTATION_CAP_MS = 30_000;
/** Worklet level (rms x 4) above which a chunk counts as the user still speaking. */
const SPEECH_LEVEL = 0.08;
const WORKLET_URL = "/worklets/pcm16-downsampler.js";

type StopReason = "toggle" | "silence" | "cap" | "switch" | "error" | "socket-closed";

interface Session {
  mode: VoiceMode;
  engine: Exclude<VoiceEngine, "none">;
  stop(reason: StopReason): void;
  setCap(ms: number): void;
  done: Promise<void>;
}

class MicError extends Error {}

// ---------------------------------------------------------------- shared timers

function createTimers(capMs: number, onTimeout: (r: "silence" | "cap") => void) {
  const startedAt = Date.now();
  let capTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => onTimeout("cap"), capMs);
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let armed = false;
  const resetSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => onTimeout("silence"), SILENCE_MS);
  };
  return {
    /** First transcript delta arrived: from now on 2 s of silence closes the mic. */
    firstDelta() {
      if (!armed) {
        armed = true;
        resetSilence();
      }
    },
    /** Speech activity (a new delta or a loud audio chunk). */
    activity() {
      if (armed) resetSilence();
    },
    setCap(ms: number) {
      if (capTimer) clearTimeout(capTimer);
      capTimer = setTimeout(() => onTimeout("cap"), Math.max(0, startedAt + ms - Date.now()));
    },
    clear() {
      if (capTimer) clearTimeout(capTimer);
      if (silenceTimer) clearTimeout(silenceTimer);
      capTimer = silenceTimer = null;
    },
  };
}

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone blocked. Allow the mic in Chrome's address bar, or use the typed command box.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone found. Plug one in, or use the typed command box.";
  if (name === "NotReadableError") return "The microphone is busy in another app. Close it there, or use the typed command box.";
  return `Microphone unavailable (${name ?? "unknown error"}). Use the typed command box.`;
}

async function getMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    throw new MicError(micErrorMessage(err));
  }
}

function cartesiaSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof WebSocket !== "undefined" &&
    typeof AudioWorkletNode !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

// ---------------------------------------------------------------- Web Speech types (not in lib.dom for all TS versions)

interface SRAlternative {
  transcript: string;
}
interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: SRAlternative;
}
interface SREvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [i: number]: SRResult };
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SRInstance;

function speechRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------- controller

export function createVoiceController(cb: VoiceCallbacks, opts: VoiceControllerOptions = {}): VoiceController {
  let session: Session | null = null;
  let engine: VoiceEngine = speechRecognitionCtor() ? "webspeech" : "none";
  let capMs = DEFAULT_COMMAND_CAP_MS;
  let opening = false;
  let closeRequested = false;
  /** After a socket failure, skip Cartesia for a minute (fast fallback to Web Speech). */
  let cartesiaFailedAt = 0;

  const capFor = (mode: VoiceMode) => (mode === "dictation" ? Math.max(DICTATION_CAP_MS, capMs) : capMs);

  // Background probe so `engine` reflects reality before the first open.
  if (typeof window !== "undefined" && opts.forceEngine !== "webspeech" && opts.forceEngine !== "none") {
    void getCartesiaToken().then((t) => {
      if (!session && t && cartesiaSupported()) engine = "cartesia";
    });
  }

  // ---------------------------------------------------------------- Cartesia engine

  async function startCartesia(token: string, mode: VoiceMode): Promise<Session> {
    const url = buildSttUrl(token, mode, opts.extraKeyterms?.() ?? []);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const wsOpen = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Cartesia socket timed out")), 5000);
      ws.onopen = () => {
        clearTimeout(t);
        resolve();
      };
      ws.onclose = (e) => {
        clearTimeout(t);
        reject(new Error(`Cartesia socket closed (${e.code}${e.reason ? `: ${e.reason}` : ""})`));
      };
    });
    wsOpen.catch(() => {}); // handled below

    let stream: MediaStream;
    try {
      stream = await getMic();
    } catch (err) {
      ws.close();
      throw err;
    }
    let ctx: AudioContext | null = null;
    let node: AudioWorkletNode | null = null;
    const stopAudio = () => {
      stream.getTracks().forEach((t) => t.stop());
      try {
        node?.disconnect();
      } catch {
        /* already gone */
      }
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      node = null;
      ctx = null;
    };

    let timers: ReturnType<typeof createTimers> | null = null;
    const queue: ArrayBuffer[] = [];
    let sendAudio = true;
    const send = (buf: ArrayBuffer) => {
      if (!sendAudio) return;
      if (ws.readyState === WebSocket.OPEN) ws.send(buf);
      else if (ws.readyState === WebSocket.CONNECTING && queue.length < 50) queue.push(buf);
    };

    let flushed: (() => void) | null = null;
    try {
      ctx = new AudioContext();
      await ctx.audioWorklet.addModule(WORKLET_URL);
      const src = ctx.createMediaStreamSource(stream);
      node = new AudioWorkletNode(ctx, "pcm16-downsampler", {
        processorOptions: { targetRate: STT_SAMPLE_RATE, chunkMs: 100 },
      });
      node.port.onmessage = (e: MessageEvent<{ type: string; pcm?: ArrayBuffer; level?: number }>) => {
        const m = e.data;
        if (m.type === "chunk" && m.pcm) {
          send(m.pcm);
          const level = m.level ?? 0;
          cb.onLevel(level);
          if (level > SPEECH_LEVEL) timers?.activity();
        } else if (m.type === "flushed") {
          flushed?.();
        }
      };
      src.connect(node);
      node.connect(ctx.destination); // outputs silence; keeps the graph pulled in every browser
      await wsOpen;
    } catch (err) {
      stopAudio();
      ws.close();
      throw err;
    }
    for (const b of queue.splice(0)) ws.send(b);

    const asm = createTranscriptAssembler();
    let stopping = false;
    let finished = false;
    let lastReason: StopReason = "toggle";
    let safety: ReturnType<typeof setTimeout> | null = null;
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));

    const finish = (errorDetail?: string) => {
      if (finished) return;
      finished = true;
      timers?.clear();
      if (safety) clearTimeout(safety);
      sendAudio = false;
      stopAudio();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close(1000);
        } catch {
          /* ignore */
        }
      }
      if (session === s) session = null;
      cb.onLevel(0);
      const text = asm.final();
      if (text) cb.onFinal(text, mode);
      if (errorDetail && !text) cb.onState("error", errorDetail);
      else cb.onState("idle", text ? lastReason : "no-speech");
      resolveDone();
    };

    const stop = (reason: StopReason) => {
      if (stopping || finished) return;
      stopping = true;
      lastReason = reason;
      timers?.clear();
      cb.onState("finalizing");
      const sendFinalize = () => {
        sendAudio = false;
        stopAudio();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("finalize");
          safety = setTimeout(() => finish(), 4000);
        } else finish();
      };
      // Post the last partial chunk first, then finalize.
      if (node) {
        const t = setTimeout(sendFinalize, 200);
        flushed = () => {
          clearTimeout(t);
          flushed = null;
          // The worklet posts the chunk before "flushed"; let the port handler send it.
          setTimeout(sendFinalize, 0);
        };
        node.port.postMessage("flush");
      } else sendFinalize();
    };

    ws.onmessage = (e) => {
      const m = parseSttMessage(e.data);
      if (!m) return;
      if (m.type === "transcript") {
        const partial = asm.push(m.text, m.is_final);
        if (m.text.trim()) {
          timers?.firstDelta();
          timers?.activity();
        }
        if (partial) cb.onPartial(partial, mode);
      } else if (m.type === "flush_done") {
        if (stopping) finish();
      } else if (m.type === "done") {
        finish();
      } else if (m.type === "error") {
        const detail = `Speech service error: ${m.message ?? m.title ?? "unknown"}`;
        if (m.status_code === 401 || m.status_code === 403) invalidateCartesiaToken();
        lastReason = "error";
        finish(detail);
      }
    };
    ws.onclose = (e) => {
      if (finished) return;
      lastReason = "socket-closed";
      if (e.code === 1008 || e.code === 4001 || e.code === 4003) invalidateCartesiaToken();
      finish(e.code === 1000 ? undefined : `Speech connection closed (${e.code}). Try again or use the typed box.`);
    };
    ws.onerror = () => {
      /* onclose follows */
    };

    timers = createTimers(capFor(mode), (r) => stop(r));
    const s: Session = { mode, engine: "cartesia", stop, setCap: (ms) => timers?.setCap(ms), done };
    return s;
  }

  // ---------------------------------------------------------------- Web Speech engine

  function startWebSpeech(mode: VoiceMode, SR: SRCtor): Session {
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let prevFinals = ""; // from earlier recognition runs (Chrome ends continuous sessions on its own)
    let finals = "";
    let interim = "";
    let stopping = false;
    let finished = false;
    let fatal: string | null = null;
    let lastReason: StopReason = "toggle";
    let safety: ReturnType<typeof setTimeout> | null = null;
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    const all = () => `${prevFinals} ${finals} ${interim}`.replace(/\s+/g, " ").trim();

    // eslint-disable-next-line prefer-const -- assigned below, after stop() is defined
    let timers: ReturnType<typeof createTimers>;
    // Level meter via a parallel mic stream + analyser (best effort).
    let levelStream: MediaStream | null = null;
    let levelCtx: AudioContext | null = null;
    let levelTimer: ReturnType<typeof setInterval> | null = null;
    void (async () => {
      try {
        levelStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (finished) {
          levelStream.getTracks().forEach((t) => t.stop());
          return;
        }
        levelCtx = new AudioContext();
        const an = levelCtx.createAnalyser();
        an.fftSize = 1024;
        levelCtx.createMediaStreamSource(levelStream).connect(an);
        const buf = new Float32Array(an.fftSize);
        levelTimer = setInterval(() => {
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          cb.onLevel(level);
          if (level > SPEECH_LEVEL) timers.activity();
        }, 100);
      } catch {
        /* meter is optional */
      }
    })();
    const stopLevel = () => {
      if (levelTimer) clearInterval(levelTimer);
      levelStream?.getTracks().forEach((t) => t.stop());
      if (levelCtx && levelCtx.state !== "closed") void levelCtx.close().catch(() => {});
      levelTimer = null;
      levelStream = null;
      levelCtx = null;
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      timers.clear();
      if (safety) clearTimeout(safety);
      stopLevel();
      if (session === s) session = null;
      cb.onLevel(0);
      const text = all();
      if (text) cb.onFinal(text, mode);
      if (fatal && !text) cb.onState("error", fatal);
      else cb.onState("idle", text ? lastReason : "no-speech");
      resolveDone();
    };

    rec.onresult = (e) => {
      let f = "";
      let i2 = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) f += `${r[0].transcript} `;
        else i2 += r[0].transcript;
      }
      finals = f;
      interim = i2;
      const text = all();
      if (text) {
        timers.firstDelta();
        timers.activity();
        cb.onPartial(text, mode);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // keep waiting; silence before speech never closes
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        fatal = "Microphone blocked. Allow the mic in Chrome's address bar, or use the typed command box.";
      else if (e.error === "audio-capture") fatal = "No microphone found. Use the typed command box.";
      else if (e.error === "network") fatal = "Speech recognition needs the internet. Use the typed command box.";
      else fatal = `Speech recognition error (${e.error}). Use the typed command box.`;
      lastReason = "error";
    };
    rec.onend = () => {
      if (!stopping && !fatal && !finished) {
        // Chrome stops continuous recognition on its own after a while: keep listening.
        prevFinals = `${prevFinals} ${finals}`;
        finals = "";
        interim = "";
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      finish();
    };

    const stop = (reason: StopReason) => {
      if (stopping || finished) return;
      stopping = true;
      lastReason = reason;
      timers.clear();
      cb.onState("finalizing");
      try {
        rec.stop();
      } catch {
        /* not started */
      }
      safety = setTimeout(finish, 2500);
    };

    timers = createTimers(capFor(mode), (r) => stop(r));
    try {
      rec.start();
    } catch (err) {
      finished = true;
      timers.clear();
      stopLevel();
      throw err;
    }
    const s: Session = { mode, engine: "webspeech", stop, setCap: (ms) => timers.setCap(ms), done };
    return s;
  }

  // ---------------------------------------------------------------- public API

  async function open(mode: VoiceMode): Promise<void> {
    if (opening) return;
    if (session) {
      if (session.mode === mode) return;
      const old = session;
      old.stop("switch");
      await old.done;
    }
    opening = true;
    closeRequested = false;
    cancelSpeech(); // never let our own TTS feed the recogniser
    cb.onState("connecting");
    let lastError = "Voice input is not available in this browser. Use desktop Chrome, or the typed command box.";
    try {
      const tryCartesia = opts.forceEngine !== "webspeech" && opts.forceEngine !== "none" && Date.now() - cartesiaFailedAt > 60_000;
      if (tryCartesia && cartesiaSupported()) {
        const token = await getCartesiaToken();
        if (token) {
          try {
            session = await startCartesia(token, mode);
            engine = "cartesia";
          } catch (err) {
            if (err instanceof MicError) {
              engine = "none";
              cb.onState("error", err.message);
              return;
            }
            cartesiaFailedAt = Date.now();
            lastError = (err as Error).message;
            console.warn("[voice] Cartesia failed, falling back to Web Speech:", lastError);
          }
        }
      }
      const SR = opts.forceEngine === "none" ? null : speechRecognitionCtor();
      if (!session && SR) {
        try {
          session = startWebSpeech(mode, SR);
          engine = "webspeech";
        } catch (err) {
          lastError = `Speech recognition could not start (${(err as Error).message}). Use the typed command box.`;
        }
      }
      if (!session) {
        engine = "none";
        cb.onState("error", lastError);
        return;
      }
      cb.onState("listening", session.engine);
      if (closeRequested) session.stop("toggle");
    } finally {
      opening = false;
    }
  }

  return {
    open,
    close() {
      if (session) session.stop("toggle");
      else if (opening) closeRequested = true;
    },
    get isOpen() {
      return session !== null || opening;
    },
    get engine() {
      return session?.engine ?? engine;
    },
    setCapMs(ms: number) {
      capMs = Math.min(60_000, Math.max(15_000, Math.round(ms)));
      if (session) session.setCap(capFor(session.mode));
    },
  };
}
