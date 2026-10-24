/**
 * Pick the pointer landmark and convert to MIRRORED camera px (design rule 1, §1):
 *   camera.x = (1 - lm.x) * videoWidth;  camera.y = lm.y * videoHeight
 * Hand mode: landmark 8 (index tip, default), 5 (index knuckle) or 9 (middle knuckle).
 * Head mode: face landmark 1 (nose tip).
 */
import type { PointerLandmark, Vec2 } from "@/pipeline/types";
import type { LandmarkFrame } from "./LandmarkSource";

export const NOSE_TIP = 1;

export function pointerIndex(mode: "hand" | "head", landmark: PointerLandmark): number {
  return mode === "head" ? NOSE_TIP : landmark;
}

export function pickPointer(frame: LandmarkFrame, index: number): Vec2 | null {
  const lm = frame.landmarks?.[index];
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return null;
  return { x: (1 - lm.x) * frame.videoWidth, y: lm.y * frame.videoHeight };
}

export const POINTER_LANDMARK_LABELS: Record<PointerLandmark, string> = {
  8: "Index fingertip",
  5: "Index knuckle (relaxed open hand)",
  9: "Middle knuckle (loose fist)",
};
