/**
 * Synthesises the ReplaySource landmark fixtures listed in FIXTURES
 * (src/tracking/LandmarkSource.ts) into public/fixtures/<name>.json.
 *
 *   npx tsx scripts/synth-fixtures.ts            # write all fixtures + manifest.json
 *   npx tsx scripts/synth-fixtures.ts word-tremor  # write one
 *
 * Format: LandmarkFixture v1, 30 fps, 640x480, MediaPipe-normalised and UNMIRRORED
 * (screen-right = decreasing x). Every detected frame carries a full, plausible
 * 21-point hand built from a rigid template; the template is translated so the
 * index tip (8) follows the path, which means the index knuckle (5) and the middle
 * knuckle (9) follow exactly the same path shape at a fixed offset (pointer
 * landmark is a user setting, design rule 1).
 *
 * All paths are authored in MIRRORED camera px (what the app computes as
 * camera.x = (1 - lm.x) * 640), i.e. "screen space", and converted at the end.
 * Motion stays inside a small active box near the centre: at the default 3x gain
 * a path spanning ~1/3 of the frame fills the canvas.
 *
 * Deterministic: seeded RNG (mulberry32) per fixture. Re-running produces
 * byte-identical files.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURES, type FixtureName, type LandmarkFixture } from "../src/tracking/LandmarkSource";

type V = { x: number; y: number };

const FPS = 30;
const DT = 1000 / FPS;
const W = 640;
const H = 480;
/** Centre of the motion region for landmark 8 (slightly above frame centre so 5/9 stay central too). */
const CX = 320;
const CY = 225;

// ---------------------------------------------------------------- RNG

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rand: () => number) {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function seedOf(name: string) {
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------- hand template

/**
 * A relaxed right hand, palm towards the camera, other fingers loosely curled
 * ("you don't need to point"), in mirrored camera px relative to the wrist, y down.
 * Scaled for a hand ~130 px tall in a 640x480 frame at desk distance.
 * z is MediaPipe-style relative depth (wrist 0, more negative = closer to camera).
 */
const TEMPLATE_RAW: [number, number, number][] = [
  [0, 0, 0], // 0 wrist
  [-22, -12, -0.012], // 1 thumb CMC
  [-38, -30, -0.02], // 2 thumb MCP
  [-48, -47, -0.028], // 3 thumb IP
  [-55, -61, -0.036], // 4 thumb tip
  [-20, -70, -0.01], // 5 index MCP
  [-22, -94, -0.02], // 6 index PIP
  [-23, -109, -0.028], // 7 index DIP
  [-24, -121, -0.035], // 8 index tip
  [-2, -73, -0.008], // 9 middle MCP
  [-2, -95, -0.022], // 10 middle PIP (curled)
  [-1, -90, -0.038], // 11 middle DIP
  [0, -80, -0.045], // 12 middle tip
  [14, -68, -0.009], // 13 ring MCP
  [16, -87, -0.022], // 14 ring PIP
  [16, -82, -0.036], // 15 ring DIP
  [15, -73, -0.042], // 16 ring tip
  [28, -58, -0.01], // 17 pinky MCP
  [31, -73, -0.02], // 18 pinky PIP
  [31, -70, -0.03], // 19 pinky DIP
  [29, -63, -0.035], // 20 pinky tip
];
const HAND_SCALE = 0.85;
/** Template offsets relative to landmark 8 (so the path point IS landmark 8). */
const TEMPLATE: [number, number, number][] = TEMPLATE_RAW.map(([x, y, z]) => [
  (x - TEMPLATE_RAW[8][0]) * HAND_SCALE,
  (y - TEMPLATE_RAW[8][1]) * HAND_SCALE,
  z,
]);

// ---------------------------------------------------------------- timeline

interface Sample {
  /** Landmark-8 position in mirrored camera px, or null = no hand. */
  p: V | null;
  /** Tremor amplitude envelope for this frame, px (0 = none). */
  tremor: number;
  /** Per-fixture rest jitter std multiplier. */
}

class Timeline {
  samples: Sample[] = [];
  pos: V;
  constructor(start: V) {
    this.pos = { ...start };
  }
  get tMs() {
    return this.samples.length * DT;
  }
  still(durS: number, tremor = 0) {
    const n = Math.round(durS * FPS);
    for (let i = 0; i < n; i++) this.samples.push({ p: { ...this.pos }, tremor });
    return this;
  }
  lost(durS: number) {
    const n = Math.round(durS * FPS);
    for (let i = 0; i < n; i++) this.samples.push({ p: null, tremor: 0 });
    return this;
  }
  /** Teleport (e.g. the hand re-appears elsewhere after a loss). */
  jump(to: V) {
    this.pos = { ...to };
    return this;
  }
  /**
   * Follow a polyline (already densely sampled) from its first point with a trapezoidal
   * speed profile: ramps of `rampS` at each end, constant speed in between.
   */
  follow(poly: V[], durS: number, tremor = 0, rampS = 0.3) {
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + dist(poly[i - 1], poly[i]));
    const L = cum[cum.length - 1];
    const n = Math.round(durS * FPS);
    const T = durS;
    const r = Math.min(rampS, T / 2);
    const v = L / (T - r); // cruise speed so the area under the trapezoid = L
    const sAt = (t: number) => {
      if (t <= r) return (v * t * t) / (2 * r);
      if (t >= T - r) return L - (v * (T - t) * (T - t)) / (2 * r);
      return (v * r) / 2 + v * (t - r);
    };
    let j = 0;
    for (let i = 1; i <= n; i++) {
      const s = Math.min(L, Math.max(0, sAt((i / n) * T)));
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j] || 1;
      const k = (s - cum[j]) / seg;
      const p = { x: poly[j].x + (poly[j + 1].x - poly[j].x) * k, y: poly[j].y + (poly[j + 1].y - poly[j].y) * k };
      this.samples.push({ p, tremor });
    }
    this.pos = { ...poly[poly.length - 1] };
    return { lengthPx: L, cruisePxPerS: v };
  }
}

function dist(a: V, b: V) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Centripetal-ish Catmull-Rom through control points, `per` samples per segment. */
function catmullRom(ctrl: V[], per = 24): V[] {
  const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out: V[] = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

function line(a: V, b: V, n = 60, sag = 0): V[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + sag * Math.sin(Math.PI * u) };
  });
}

/** Wobbly closed-ish loop, clockwise on screen, starting at the top. */
function loop(c: V, rx: number, ry: number, sweep: number, wobble: number, n = 240): V[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const th = -Math.PI / 2 + (sweep * i) / n;
    const k = 1 + wobble * Math.sin(2 * th + 1.1) + wobble * 0.6 * Math.sin(3 * th + 0.4);
    return { x: c.x + rx * k * Math.cos(th), y: c.y + ry * k * Math.sin(th) };
  });
}

/**
 * Cursive "hi" in a unit where baseline y = 0, x-height = -31, ascender = -70, width ~68.
 * Lead-in → h ascender loop → stem down → shoulder → baseline → connector up to i →
 * down → exit flick. No i-dot (that would need a second pen-down).
 */
const HI_CTRL: V[] = [
  { x: -6, y: 2 },
  { x: 2, y: -14 },
  { x: 11, y: -36 },
  { x: 18, y: -56 },
  { x: 18, y: -68 },
  { x: 11, y: -70 },
  { x: 5, y: -57 },
  { x: 5, y: -32 },
  { x: 5, y: -10 },
  { x: 5.5, y: 0 },
  { x: 8, y: -16 },
  { x: 15, y: -28 },
  { x: 23, y: -31 },
  { x: 29, y: -23 },
  { x: 30, y: -9 },
  { x: 32, y: 0 },
  { x: 38, y: -8 },
  { x: 43, y: -20 },
  { x: 46, y: -31 },
  { x: 46.5, y: -16 },
  { x: 47, y: -4 },
  { x: 51, y: 0 },
  { x: 57, y: -4 },
  { x: 62, y: -10 },
];

// ---------------------------------------------------------------- rendering to fixture

interface Built {
  description: string;
  timeline: Timeline;
  luma?: number;
  /** Rest-jitter std (px) of the low-pass jitter applied to the whole hand. */
  restJitter: number;
  /** Metadata for manifest.json / docs (expected app behaviour). */
  notes: Record<string, unknown>;
}

function render(name: FixtureName, b: Built): LandmarkFixture {
  const rand = mulberry32(seedOf(name));
  // AR(1) low-pass jitter: stationary std = restJitter.
  const a = 0.85;
  const sigma = b.restJitter * Math.sqrt(1 - a * a);
  let jx = 0;
  let jy = 0;
  // Tremor: ~6 Hz with slow phase drift and amplitude modulation; dominant along y.
  let phase = rand() * Math.PI * 2;
  let env = 0;
  const frames: LandmarkFixture["frames"] = [];
  b.timeline.samples.forEach((s, i) => {
    const t = Math.round(i * DT * 1000) / 1000;
    jx = a * jx + sigma * gaussian(rand);
    jy = a * jy + sigma * gaussian(rand);
    // Smooth tremor envelope (time constant ~0.12 s) so transitions are not steps.
    env += (s.tremor - env) * (1 - Math.exp(-DT / 120));
    phase += 2 * Math.PI * (6 + 0.25 * gaussian(rand)) * (DT / 1000);
    if (!s.p) {
      frames.push({ t, lm: null });
      return;
    }
    const am = 0.9 + 0.1 * Math.sin((2 * Math.PI * i) / 47);
    const tx = env * am * 0.55 * Math.sin(phase + 0.9);
    const ty = env * am * Math.sin(phase);
    const px = s.p.x + jx + tx;
    const py = s.p.y + jy + ty;
    const lm = TEMPLATE.map(([ox, oy, oz]) => {
      const x = px + ox + 0.12 * gaussian(rand);
      const y = py + oy + 0.12 * gaussian(rand);
      // Mirrored camera px → unmirrored normalised MediaPipe coordinates.
      return [round(1 - x / W, 5), round(y / H, 5), round(oz + 0.002 * gaussian(rand), 4)] as [number, number, number];
    });
    frames.push({ t, lm, handedness: "Right" });
  });
  const fx: LandmarkFixture = {
    version: 1,
    name,
    description: b.description,
    mode: "hand",
    videoWidth: W,
    videoHeight: H,
    fps: FPS,
    frames,
  };
  if (b.luma !== undefined) fx.luma = b.luma;
  return fx;
}

function round(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

// ---------------------------------------------------------------- the fixtures

function build(name: FixtureName): Built {
  switch (name) {
    case "still-10s": {
      const tl = new Timeline({ x: CX, y: CY }).still(10);
      return {
        description: "Hand resting still at the centre for 10 s with ~1 px low-pass rest jitter. Expect at most one pen toggle and zero strokes.",
        timeline: tl,
        restJitter: 0.6,
        notes: { durationS: 10, expect: "<= 1 pen toggle, 0 strokes" },
      };
    }
    case "calibration": {
      const R = 78;
      const c = { x: CX, y: CY + 5 };
      const start = { x: c.x, y: c.y - R * 0.9 };
      const tl = new Timeline(start).still(3);
      const m = tl.follow(loop(c, R, R * 0.9, Math.PI * 2, 0.025), 4, 0, 0.5);
      tl.still(1);
      return {
        description: "Calibration: 3 s resting still (step 1, rest jitter), then a 4 s comfortable clockwise circle (~156x140 camera px, step 2), then 1 s still.",
        timeline: tl,
        restJitter: 0.6,
        notes: { stillS: [0, 3], circleS: [3, 7], circleBoxCameraPx: { w: 2 * R, h: 2 * R * 0.9 }, circlePathPx: Math.round(m.lengthPx) },
      };
    }
    case "dwell-stroke": {
      const a = { x: CX - 65, y: CY };
      const b = { x: CX + 65, y: CY };
      const tl = new Timeline(a).still(1.5);
      const m = tl.follow(line(a, b, 80, 4), 2, 0);
      tl.still(2.3);
      return {
        description: "Still 1.5 s (pen-down dwell fires at ~0.8-1.1 s) -> 2 s left-to-right stroke on screen (130 camera px, ~390 canvas px at 3x) -> still 2.3 s (pen-up dwell at ~1.2 s). Expect exactly 1 stroke.",
        timeline: tl,
        restJitter: 0.6,
        notes: { strokeS: [1.5, 3.5], strokeCameraPx: 130, cruisePxPerS: Math.round(m.cruisePxPerS), expect: "1 pen-down (dwell), 1 pen-up (dwell), 1 stroke" },
      };
    }
    case "word-tremor": {
      const s = 1.25;
      const origin = { x: CX - 33 * s, y: CY + 34 * s };
      const ctrl = HI_CTRL.map((p) => ({ x: origin.x + p.x * s, y: origin.y + p.y * s }));
      const poly = catmullRom(ctrl);
      const tl = new Timeline(poly[0]).still(1.5, 1.5);
      // Pick a duration that gives ~90 px/s cruise speed in camera px.
      let L = 0;
      for (let i = 1; i < poly.length; i++) L += dist(poly[i - 1], poly[i]);
      const dur = Math.round((L / 90 + 0.3) * 10) / 10;
      const m = tl.follow(poly, dur, 5, 0.3);
      tl.still(2.6, 1.5);
      return {
        description: `Still 1.5 s -> cursive "hi" (${Math.round(L)} camera px over ${dur} s, ~${Math.round(m.cruisePxPerS)} px/s) with ~6 Hz +/-5 px tremor during movement (+/-1.5 px at rest) -> still 2.6 s. Expect 1 legible stroke after smoothing.`,
        timeline: tl,
        restJitter: 0.5,
        notes: { word: "hi", wordS: [1.5, 1.5 + dur], pathCameraPx: Math.round(L), cruisePxPerS: Math.round(m.cruisePxPerS), tremorHz: 6, tremorPx: 5, expect: "1 stroke" },
      };
    }
    case "circle-stroke": {
      const R = 52;
      const c = { x: CX, y: CY - 5 };
      const poly = loop(c, R, R, Math.PI * 2 - 0.1, 0.03);
      const tl = new Timeline(poly[0]).still(1.5);
      const m = tl.follow(poly, 3.2, 0);
      tl.still(2.3);
      return {
        description: "Still 1.5 s -> roughly circular clockwise closed stroke (r ~52 camera px, ~3 % radius wobble, small closing gap) in 3.2 s -> still 2.3 s. Expect 1 stroke; 'make it a circle' turns it into kind 'circle'.",
        timeline: tl,
        restJitter: 0.6,
        notes: { strokeS: [1.5, 4.7], radiusCameraPx: R, cruisePxPerS: Math.round(m.cruisePxPerS), expect: "1 stroke, fits circle" },
      };
    }
    case "tracking-lost": {
      const a = { x: CX - 60, y: CY - 5 };
      const b = { x: CX + 10, y: CY + 10 };
      const tl = new Timeline(a).still(1.5);
      tl.follow(line(a, b, 60, -6), 1.5, 0);
      const lostAt = tl.tMs / 1000;
      tl.lost(1);
      const c = { x: CX + 25, y: CY + 12 };
      const d = { x: CX + 70, y: CY + 20 };
      tl.jump(c).follow(line(c, d, 40, 3), 1, 0, 0.2);
      tl.still(0.5);
      return {
        description: `Still 1.5 s (pen down by dwell) -> stroke in progress for 1.5 s -> 1 s of null frames (no hand) mid-stroke at ${lostAt.toFixed(2)} s -> hand back elsewhere, moving for 1 s -> 0.5 s still (too short to re-arm a pen-down dwell). Expect the pen to lift > 300 ms into the loss and stay up after re-acquire.`,
        timeline: tl,
        restJitter: 0.6,
        notes: { lostS: [lostAt, lostAt + 1], expect: "pen HOVER from ~lost+0.3 s; tracking 'lost' during gap; pen stays HOVER after; 1 stroke" },
      };
    }
    case "too-dark": {
      const tl = new Timeline({ x: CX, y: CY });
      const rand = mulberry32(seedOf("too-dark-gaps"));
      while (tl.tMs < 10_000) {
        tl.still(0.8 + rand() * 0.8);
        if (tl.tMs < 9_500) tl.lost(0.2 + rand() * 0.4);
      }
      return {
        description: "Like still-10s but in a dim room: luma 25, noisier rest jitter (~1.5 px) and intermittent null frames (0.2-0.6 s gaps every 0.8-1.6 s). Expect 'too dark' tracking warning.",
        timeline: tl,
        luma: 25,
        restJitter: 1.5,
        notes: { luma: 25, expect: "status mentions dark; lossReason 'too-dark' during gaps; 0 strokes" },
      };
    }
  }
}

// ---------------------------------------------------------------- main

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "fixtures");
mkdirSync(outDir, { recursive: true });

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const names = (only.length ? only : [...FIXTURES]) as FixtureName[];
for (const n of names) if (!FIXTURES.includes(n)) throw new Error(`Unknown fixture "${n}". Known: ${FIXTURES.join(", ")}`);

const manifest: Record<string, unknown> = {};
for (const name of names) {
  const b = build(name);
  const fx = render(name, b);
  const file = join(outDir, `${name}.json`);
  writeFileSync(file, JSON.stringify(fx) + "\n");
  const durationS = Math.round((fx.frames.length / FPS) * 100) / 100;
  manifest[name] = { file: `/fixtures/${name}.json`, frames: fx.frames.length, durationS, description: fx.description, ...b.notes };
  console.log(`${name.padEnd(14)} ${String(fx.frames.length).padStart(4)} frames  ${durationS.toFixed(2)} s  -> public/fixtures/${name}.json`);
}
if (!only.length) writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
