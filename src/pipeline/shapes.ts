/**
 * Local shape cleanup (§4, P2, no network). Pure.
 *  - closed if end-to-start distance < 15 % of the bbox diagonal;
 *  - open → line: PCA fit, accept if RMS perpendicular residual < 3 % of length;
 *  - closed → rectangle / triangle: RDP at 5 % of the diagonal, near-straight vertices removed;
 *    4 corners at 90° ± 20° (orientation snapped to the axes within 10°) / 3 corners;
 *  - closed → circle: Kåsa least squares, accept if RMS radial residual / r < 0.08.
 *  Polygons are tried before the circle (a clean square's Kåsa residual is ≈ 0.096, close to
 *  the circle threshold, while a circle never RDPs to 3–4 corners at ε = 5 % of the diagonal).
 * forceShape() always produces the requested shape ("make it a circle/line/square/triangle").
 */
import simplify from "simplify-js";
import { distToSegment, strokeBBox } from "./strokes";
import type { ShapeFit, ShapeTarget, Vec2 } from "./types";

export const CLOSED_FRACTION = 0.15;
export const LINE_MAX_RMS_FRACTION = 0.03;
export const CIRCLE_MAX_RESIDUAL = 0.08;
export const POLY_EPSILON_FRACTION = 0.05;
export const RECT_ANGLE_TOLERANCE = 20;
export const AXIS_SNAP_DEG = 10;
const CIRCLE_SEGMENTS = 72;

const NONE: ShapeFit = { kind: "none", points: [], residual: Infinity, closed: false };
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r: number) => (r * 180) / Math.PI;

function diagonal(points: Vec2[]): number {
  const bb = strokeBBox(points);
  return Math.hypot(bb.w, bb.h);
}

export function isClosed(points: Vec2[]): boolean {
  if (points.length < 3) return false;
  const d = diagonal(points);
  return d > 0 && dist(points[0], points[points.length - 1]) < CLOSED_FRACTION * d;
}

// ---------------------------------------------------------------- line (PCA)

export function fitLinePCA(points: Vec2[]): { centre: Vec2; dir: Vec2; rms: number; length: number; ends: [Vec2, Vec2] } {
  const n = points.length;
  const c = { x: 0, y: 0 };
  for (const p of points) {
    c.x += p.x / n;
    c.y += p.y / n;
  }
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir = { x: Math.cos(theta), y: Math.sin(theta) };
  let tMin = Infinity;
  let tMax = -Infinity;
  let perp2 = 0;
  for (const p of points) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const t = dx * dir.x + dy * dir.y;
    const q = -dx * dir.y + dy * dir.x;
    perp2 += q * q;
    tMin = Math.min(tMin, t);
    tMax = Math.max(tMax, t);
  }
  if (!Number.isFinite(tMin)) tMin = tMax = 0;
  // Orient the segment the way it was drawn (first point → last point).
  let a = { x: c.x + dir.x * tMin, y: c.y + dir.y * tMin };
  let b = { x: c.x + dir.x * tMax, y: c.y + dir.y * tMax };
  if (n > 1 && dist(points[0], a) > dist(points[0], b)) [a, b] = [b, a];
  return { centre: c, dir, rms: n ? Math.sqrt(perp2 / n) : 0, length: tMax - tMin, ends: [a, b] };
}

// ---------------------------------------------------------------- circle (Kåsa)

/** Kåsa algebraic least-squares circle fit. Null when degenerate (collinear / < 3 points). */
export function fitCircleKasa(points: Vec2[]): { centre: Vec2; r: number; residual: number } | null {
  const n = points.length;
  if (n < 3) return null;
  // centre the data for conditioning
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x / n;
    my += p.y / n;
  }
  // Solve [x y 1]·[D E F]ᵀ = −(x² + y²) by normal equations.
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  for (const p of points) {
    const x = p.x - mx;
    const y = p.y - my;
    const z = -(x * x + y * y);
    sxx += x * x;
    sxy += x * y;
    sx += x;
    syy += y * y;
    sy += y;
    sxz += x * z;
    syz += y * z;
    sz += z;
  }
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const bvec = [sxz, syz, sz];
  const sol = solve3(A, bvec);
  if (!sol) return null;
  const [D, E, F] = sol;
  const cx = -D / 2;
  const cy = -E / 2;
  const r2 = cx * cx + cy * cy - F;
  if (!(r2 > 0)) return null;
  const r = Math.sqrt(r2);
  const centre = { x: cx + mx, y: cy + my };
  let e2 = 0;
  for (const p of points) e2 += (dist(p, centre) - r) ** 2;
  return { centre, r, residual: Math.sqrt(e2 / n) / r };
}

function solve3(A: number[][], b: number[]): [number, number, number] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A);
  const scale = Math.abs(A[0][0] * A[1][1] * A[2][2]) || 1;
  if (Math.abs(d) < 1e-12 * scale) return null;
  const col = (i: number) => A.map((row, r) => row.map((v, c) => (c === i ? b[r] : v)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

export function circleOutline(centre: Vec2, r: number, segments = CIRCLE_SEGMENTS): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    out.push({ x: centre.x + r * Math.cos(a), y: centre.y + r * Math.sin(a) });
  }
  return out;
}

// ---------------------------------------------------------------- polygons

/** Interior angle at v (degrees, 0..180). */
function interiorAngle(prev: Vec2, v: Vec2, next: Vec2): number {
  const a = { x: prev.x - v.x, y: prev.y - v.y };
  const b = { x: next.x - v.x, y: next.y - v.y };
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la === 0 || lb === 0) return 180;
  return deg(Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)))));
}

/** Corner vertices of a closed stroke (RDP at 5 % of the diagonal, cleaned). */
export function polygonCorners(points: Vec2[]): Vec2[] {
  const d = diagonal(points);
  if (points.length < 4 || d === 0) return [];
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  pts.push({ ...pts[0] }); // close the loop explicitly
  let verts: Vec2[] = simplify(pts, POLY_EPSILON_FRACTION * d, true).map((p) => ({ x: p.x, y: p.y }));
  if (verts.length > 1 && dist(verts[0], verts[verts.length - 1]) < 1e-6) verts.pop();
  // merge vertices that sit on the same rounded corner
  let merged = true;
  while (merged && verts.length > 2) {
    merged = false;
    for (let i = 0; i < verts.length; i++) {
      const j = (i + 1) % verts.length;
      if (dist(verts[i], verts[j]) < 0.08 * d) {
        const m = { x: (verts[i].x + verts[j].x) / 2, y: (verts[i].y + verts[j].y) / 2 };
        verts = verts.filter((_, k) => k !== i && k !== j);
        verts.splice(Math.min(i, verts.length), 0, m);
        merged = true;
        break;
      }
    }
  }
  // drop near-straight vertices (e.g. where the stroke started mid-edge)
  for (;;) {
    if (verts.length <= 3) break;
    let worst = -1;
    let worstAngle = 0;
    for (let i = 0; i < verts.length; i++) {
      const a = interiorAngle(verts[(i - 1 + verts.length) % verts.length], verts[i], verts[(i + 1) % verts.length]);
      if (a > worstAngle) {
        worstAngle = a;
        worst = i;
      }
    }
    if (worstAngle <= 150) break;
    verts.splice(worst, 1);
  }
  return verts;
}

function polygonAngles(verts: Vec2[]): number[] {
  return verts.map((v, i) => interiorAngle(verts[(i - 1 + verts.length) % verts.length], v, verts[(i + 1) % verts.length]));
}

/** RMS distance of points to a closed polygon outline. */
function rmsToPolygon(points: Vec2[], closedOutline: Vec2[]): number {
  let s = 0;
  for (const p of points) {
    let best = Infinity;
    for (let i = 0; i < closedOutline.length - 1; i++) best = Math.min(best, distToSegment(p, closedOutline[i], closedOutline[i + 1]));
    s += best * best;
  }
  return Math.sqrt(s / Math.max(1, points.length));
}

/** Dominant edge orientation mod 90° (radians in (−π/4, π/4]) using 4θ averaging, length-weighted. */
function orientationMod90(path: Vec2[]): number {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dy = path[i + 1].y - path[i].y;
    const L = Math.hypot(dx, dy);
    if (L === 0) continue;
    const a = 4 * Math.atan2(dy, dx);
    cx += L * Math.cos(a);
    cy += L * Math.sin(a);
  }
  return cx === 0 && cy === 0 ? 0 : Math.atan2(cy, cx) / 4;
}

const rotate = (p: Vec2, c: Vec2, a: number): Vec2 => {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
};

/** Oriented rectangle through `ref` points at orientation θ (snapped to axes within 10°). */
function rectAt(ref: Vec2[], theta: number, square: boolean): Vec2[] {
  const th = Math.abs(deg(theta)) < AXIS_SNAP_DEG ? 0 : theta;
  const c = { x: 0, y: 0 };
  for (const p of ref) {
    c.x += p.x / ref.length;
    c.y += p.y / ref.length;
  }
  const local = ref.map((p) => rotate(p, c, -th));
  const bb = strokeBBox(local);
  let { x, y, w, h } = bb;
  if (square) {
    const s = (w + h) / 2;
    x += (w - s) / 2;
    y += (h - s) / 2;
    w = h = s;
  }
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].map((p) => rotate(p, c, th));
  return [...corners, { ...corners[0] }];
}

function triangleFallback(points: Vec2[]): Vec2[] {
  const c = { x: 0, y: 0 };
  for (const p of points) {
    c.x += p.x / points.length;
    c.y += p.y / points.length;
  }
  let A = points[0];
  for (const p of points) if (dist(p, c) > dist(A, c)) A = p;
  let B = points[0];
  for (const p of points) if (dist(p, A) > dist(B, A)) B = p;
  let C = points[0];
  let best = -1;
  for (const p of points) {
    const area = Math.abs((B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x));
    if (area > best) {
      best = area;
      C = p;
    }
  }
  return [A, B, C];
}

const closeLoop = (v: Vec2[]): Vec2[] => [...v.map((p) => ({ x: p.x, y: p.y })), { x: v[0].x, y: v[0].y }];

// ---------------------------------------------------------------- public API

export function fitShape(points: Vec2[]): ShapeFit {
  if (points.length < 3) return NONE;
  const d = diagonal(points);
  if (d < 1e-6) return NONE;
  if (!isClosed(points)) {
    const l = fitLinePCA(points);
    if (l.length > 0 && l.rms < LINE_MAX_RMS_FRACTION * l.length) {
      return { kind: "line", points: l.ends, residual: l.rms / l.length, closed: false };
    }
    return NONE;
  }
  const corners = polygonCorners(points);
  const angles = polygonAngles(corners);
  if (corners.length === 4 && angles.every((a) => Math.abs(a - 90) <= RECT_ANGLE_TOLERANCE)) {
    const outline = rectAt(corners, orientationMod90(closeLoop(corners)), false);
    return { kind: "rect", points: outline, residual: rmsToPolygon(points, outline) / d, closed: true };
  }
  if (corners.length === 3 && angles.every((a) => a >= 15)) {
    const outline = closeLoop(corners);
    return { kind: "triangle", points: outline, residual: rmsToPolygon(points, outline) / d, closed: true };
  }
  const c = fitCircleKasa(points);
  if (c && c.residual < CIRCLE_MAX_RESIDUAL) {
    return { kind: "circle", points: circleOutline(c.centre, c.r), residual: c.residual, closed: true };
  }
  return NONE;
}

export function forceShape(points: Vec2[], target: ShapeTarget): ShapeFit {
  const pts = points.length ? points : [{ x: 0, y: 0 }];
  const d = Math.max(diagonal(pts), 1e-6);
  switch (target) {
    case "line": {
      const l = fitLinePCA(pts);
      return { kind: "line", points: l.ends, residual: l.length > 0 ? l.rms / l.length : 0, closed: false };
    }
    case "circle": {
      const c = fitCircleKasa(pts);
      let centre: Vec2;
      let r: number;
      if (c && c.r < 2 * d) {
        centre = c.centre;
        r = c.r;
      } else {
        centre = { x: 0, y: 0 };
        for (const p of pts) {
          centre.x += p.x / pts.length;
          centre.y += p.y / pts.length;
        }
        r = pts.reduce((a, p) => a + dist(p, centre), 0) / pts.length;
      }
      r = Math.max(r, 1);
      let e2 = 0;
      for (const p of pts) e2 += (dist(p, centre) - r) ** 2;
      return { kind: "circle", points: circleOutline(centre, r), residual: Math.sqrt(e2 / pts.length) / r, closed: true };
    }
    case "square": {
      const corners = polygonCorners(pts);
      const theta = corners.length === 4 ? orientationMod90(closeLoop(corners)) : orientationMod90(pts);
      let outline = rectAt(pts, theta, true);
      if (strokeBBox(outline).w < 1) outline = rectAt([{ x: pts[0].x - 0.5, y: pts[0].y - 0.5 }, { x: pts[0].x + 0.5, y: pts[0].y + 0.5 }], 0, true);
      return { kind: "rect", points: outline, residual: rmsToPolygon(pts, outline) / d, closed: true };
    }
    case "triangle": {
      const corners = polygonCorners(pts);
      const tri = corners.length === 3 ? corners : triangleFallback(pts);
      const outline = closeLoop(tri);
      return { kind: "triangle", points: outline, residual: rmsToPolygon(pts, outline) / d, closed: true };
    }
  }
}
