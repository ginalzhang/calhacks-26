/**
 * Earcons: two distinct WebAudio-synthesised clicks for pen down / pen up (§3).
 * Never speech on pen toggles. The AudioContext is created lazily and resumed on the
 * first user gesture (Chrome autoplay policy); before that, clicks are silently skipped.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setEarconsEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const a = audio();
  if (a && a.state === "suspended") void a.resume().catch(() => undefined);
}

function click(freq: number, at: number, dur = 0.05, gain = 0.22) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Pen down: one bright rising click. Pen up: two soft low clicks. */
export function earcon(kind: "down" | "up") {
  if (!enabled) return;
  const a = audio();
  if (!a || a.state !== "running") return;
  const t = a.currentTime + 0.005;
  if (kind === "down") {
    click(1400, t, 0.06, 0.25);
  } else {
    click(520, t, 0.045, 0.2);
    click(440, t + 0.07, 0.045, 0.16);
  }
}

/** Soft chime for tile activation by dwell (so a dwell user knows it fired). */
export function tick() {
  if (!enabled) return;
  const a = audio();
  if (!a || a.state !== "running") return;
  click(900, a.currentTime + 0.005, 0.03, 0.12);
}
