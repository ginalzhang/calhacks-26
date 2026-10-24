/**
 * Checks the synthesised fixtures against the §2/§3 pipeline rules, independently of the
 * app code, so fixture problems and app problems can be told apart.
 *
 *   npx tsx scripts/verify-fixtures.ts [--canvas=960x600] [--svg=.context/fixtures-preview]
 *
 * Simulation (defaults from PROMPT.md §2/§3 and src/pipeline/types.ts DEFAULT_SETTINGS):
 *   lm (unmirrored, normalised) → mirror → camera px → One Euro per axis (0.6 Hz, β 0.005, dcutoff 1)
 *   → centred active box at gain 3 → canvas px → ink dwell:
 *     pen-down: last 250 ms within r_in of centroid, then held within r_out = 2 r_in for 800 ms;
 *     pen-up: armed after moving > r_in from the pen-down anchor; stays within r_in/2 for 1200 ms;
 *     pen-down re-armed 600 ms after a pen-up dwell; tracking loss > 300 ms lifts the pen.
 * Prints pen events and strokes per fixture and exits non-zero if a fixture's expectation fails.
 * With --svg=<dir>, writes one SVG per fixture (raw canvas path faded, filtered strokes solid).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OneEuroFilter } from "1eurofilter";
import { FIXTURES, type FixtureName, type LandmarkFixture } from "../src/tracking/LandmarkSource";

type V = { x: number; y: number };
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "1"];
  }),
);
const [CW, CH] = (args.canvas ?? "960x600").split("x").map(Number);
const GAIN = 3;
const LANDMARK = Number(args.landmark ?? 8);
const R_IN = 15; // max(15, lazyRadius/2 = 6, 3 × restJitter(0 uncalibrated))
const R_OUT = 2 * R_IN;
const DOWN_MS = 800;
const UP_MS = 1200;
const STILL_WINDOW_MS = 250;
const REARM_MS = 600;
const LOSS_MS = 300;

interface Result {
  events: { t: number; type: string; cause: string }[];
  strokes: V[][];
  raw: V[];
  filtered: V[];
  maxSpeedCanvas: number;
  lostSeen: boolean;
  outOfCanvas: number;
}

function simulate(fx: LandmarkFixture): Result {
  const fx1 = new OneEuroFilter(30, 0.6, 0.005, 1.0);
  const fy1 = new OneEuroFilter(30, 0.6, 0.005, 1.0);
  const bw = CW / GAIN;
  const bh = CH / GAIN;
  const box = { x: (fx.videoWidth - bw) / 2, y: (fx.videoHeight - bh) / 2, w: bw, h: bh };
  const map = (p: V) => ({ x: ((p.x - box.x) / box.w) * CW, y: ((p.y - box.y) / box.h) * CH });

  const res: Result = { events: [], strokes: [], raw: [], filtered: [], maxSpeedCanvas: 0, lostSeen: false, outOfCanvas: 0 };
  let pen: "HOVER" | "DRAWING" = "HOVER";
  let hist: { t: number; p: V }[] = [];
  let downAnchor: V | null = null; // pen-down dwell candidate anchor
  let downStart = 0;
  let downArmedAt = 0;
  let upArmed = false;
  let penDownAt: V | null = null;
  let upAnchor: V | null = null;
  let upStart = 0;
  let lastSeen = -Infinity;
  let lost = false;
  let cur: { t: number; p: V }[] = [];
  let prev: { t: number; p: V } | null = null;

  const penUp = (t: number, cause: string, trimFrom?: number) => {
    pen = "HOVER";
    res.events.push({ t, type: "pen-up", cause });
    const pts = cur.filter((q) => trimFrom === undefined || q.t < trimFrom).map((q) => q.p);
    if (pts.length) res.strokes.push(pts);
    cur = [];
    upArmed = false;
    upAnchor = null;
    downAnchor = null;
    downArmedAt = t + (cause === "dwell" ? REARM_MS : 0);
  };

  for (const f of fx.frames) {
    const t = f.t;
    if (!f.lm) {
      if (t - lastSeen > LOSS_MS && !lost) {
        lost = true;
        res.lostSeen = true;
        if (pen === "DRAWING") penUp(t, "tracking-lost");
      }
      hist = [];
      downAnchor = null;
      continue;
    }
    lost = false;
    lastSeen = t;
    const lm = f.lm[LANDMARK];
    const cam = { x: (1 - lm[0]) * fx.videoWidth, y: lm[1] * fx.videoHeight };
    const filt = { x: fx1.filter(cam.x, t / 1000), y: fy1.filter(cam.y, t / 1000) };
    const p = map(filt);
    res.raw.push(map(cam));
    res.filtered.push(p);
    if (p.x < 0 || p.y < 0 || p.x > CW || p.y > CH) res.outOfCanvas++;
    if (prev) res.maxSpeedCanvas = Math.max(res.maxSpeedCanvas, (Math.hypot(p.x - prev.p.x, p.y - prev.p.y) / (t - prev.t)) * 1000);
    prev = { t, p };
    hist.push({ t, p });
    hist = hist.filter((h) => t - h.t <= STILL_WINDOW_MS);

    if (pen === "HOVER") {
      if (t < downArmedAt) continue;
      if (downAnchor) {
        if (Math.hypot(p.x - downAnchor.x, p.y - downAnchor.y) > R_OUT) downAnchor = null;
        else if (t - downStart >= DOWN_MS) {
          pen = "DRAWING";
          penDownAt = downAnchor;
          res.events.push({ t, type: "pen-down", cause: "dwell" });
          cur = [{ t, p: downAnchor }];
          downAnchor = null;
          upArmed = false;
          upAnchor = null;
          continue;
        }
      }
      if (!downAnchor && hist.length >= 5 && t - hist[0].t >= STILL_WINDOW_MS - 40) {
        const c = { x: hist.reduce((s, h) => s + h.p.x, 0) / hist.length, y: hist.reduce((s, h) => s + h.p.y, 0) / hist.length };
        if (hist.every((h) => Math.hypot(h.p.x - c.x, h.p.y - c.y) <= R_IN)) {
          downAnchor = c;
          downStart = hist[0].t;
        }
      }
    } else {
      cur.push({ t, p });
      if (!upArmed && penDownAt && Math.hypot(p.x - penDownAt.x, p.y - penDownAt.y) > R_IN) upArmed = true;
      if (!upArmed) continue;
      if (!upAnchor || Math.hypot(p.x - upAnchor.x, p.y - upAnchor.y) > R_IN / 2) {
        upAnchor = p;
        upStart = t;
      } else if (t - upStart >= UP_MS) {
        penUp(t, "dwell", upStart);
      }
    }
  }
  if (pen === "DRAWING") res.events.push({ t: fx.frames[fx.frames.length - 1].t, type: "(still drawing at end)", cause: "" });
  return res;
}

const expectations: Record<FixtureName, (r: Result) => string | null> = {
  "still-10s": (r) => (r.strokes.some((s) => bboxSize(s) > R_IN) ? "a non-dot stroke was produced" : r.events.length > 2 ? "too many toggles" : null),
  calibration: () => null,
  "dwell-stroke": (r) => one(r),
  "word-tremor": (r) => one(r),
  "circle-stroke": (r) => one(r),
  "tracking-lost": (r) =>
    !r.lostSeen ? "never lost" : !r.events.some((e) => e.cause === "tracking-lost") ? "pen did not lift on loss" : r.events.at(-1)?.type !== "pen-up" ? "pen ended down" : null,
  "too-dark": (r) => (r.strokes.some((s) => bboxSize(s) > R_IN) ? "a non-dot stroke was produced" : null),
};
function one(r: Result) {
  const downs = r.events.filter((e) => e.type === "pen-down").length;
  const ups = r.events.filter((e) => e.type === "pen-up" && e.cause === "dwell").length;
  return downs === 1 && ups === 1 && r.strokes.length === 1 ? null : `expected 1 down/1 dwell up/1 stroke, got ${downs}/${ups}/${r.strokes.length}`;
}
function bboxSize(s: V[]) {
  const xs = s.map((p) => p.x);
  const ys = s.map((p) => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const svgDir = args.svg;
if (svgDir) mkdirSync(svgDir, { recursive: true });
console.log(`canvas ${CW}x${CH}, gain ${GAIN}, pointer landmark ${LANDMARK}, r_in ${R_IN}`);
for (const name of FIXTURES) {
  const fx = JSON.parse(readFileSync(join(here, "..", "public", "fixtures", `${name}.json`), "utf8")) as LandmarkFixture;
  const shapeOk =
    fx.version === 1 && fx.fps === 30 && fx.videoWidth === 640 && fx.videoHeight === 480 && fx.frames.every((f) => f.lm === null || (f.lm.length === 21 && f.lm.every((p) => p.length === 3 && p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1)));
  const r = simulate(fx);
  const err = !shapeOk ? "bad fixture format" : expectations[name](r);
  if (err) failed++;
  const ev = r.events.map((e) => `${e.type}${e.cause ? `(${e.cause})` : ""}@${(e.t / 1000).toFixed(2)}s`).join(", ");
  const sizes = r.strokes.map((s) => `${Math.round(bboxSize(s))}px/${s.length}pts`).join(", ");
  console.log(`${err ? "FAIL" : "ok  "} ${name.padEnd(14)} events: ${ev || "none"} | strokes: ${sizes || "none"} | offCanvas ${r.outOfCanvas}${err ? ` | ${err}` : ""}`);
  if (svgDir) {
    const path = (pts: V[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${CW}" height="${CH}"><rect width="100%" height="100%" fill="#fff"/><path d="${path(r.raw)}" fill="none" stroke="#d7263d" stroke-opacity="0.35" stroke-width="1.5"/>${r.strokes.map((s) => `<path d="${path(s)}" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}<text x="12" y="28" font-size="20" font-family="sans-serif">${name}</text></svg>`;
    writeFileSync(join(svgDir, `${name}.svg`), svg);
  }
}
process.exit(failed ? 1 : 0);
