/**
 * Presets (named by what the hand does, never a condition) and user-named profiles.
 * Two profiles are pre-created and renamable: "Steady day" and "Shaky day".
 */
import type { ActionId } from "@/actions";
import { DEFAULT_SETTINGS, type PipelineSettings, type Profile } from "@/pipeline/types";
import { steadinessToParams } from "@/pipeline/steadiness";
import { KEYS, load, save } from "@/lib/persist";
import { getState, setState } from "./store";

export type PresetId = Extract<ActionId, "preset.sore" | "preset.reaching" | "preset.rest" | "preset.still">;

export const PRESETS: Record<PresetId, { label: string; describe: string; patch: Partial<PipelineSettings> }> = {
  "preset.sore": {
    label: "Steady but sore",
    describe: "Light smoothing, low effort: Steadiness 25, gain 3×.",
    patch: { steadiness: 25, gain: 3, latch: false, tileDwellRadius: null, tileSnapPx: 0 },
  },
  "preset.reaching": {
    label: "Shakes when reaching",
    describe: "Strong smoothing while moving: Steadiness 70.",
    patch: { steadiness: 70, latch: false, tileDwellRadius: null, tileSnapPx: 0 },
  },
  "preset.rest": {
    label: "Shakes at rest",
    describe: "Steadiness 45, gain 4×, 1.2 s dwell, Latch on so the pen never lifts on its own.",
    patch: { steadiness: 45, gain: 4, penDownDwellMs: 1200, penUpDwellMs: 1800, tileDwellMs: 1200, latch: true, tileDwellRadius: null, tileSnapPx: 0 },
  },
  "preset.still": {
    label: "Hard to hold still",
    describe: "Steadiness 60, Latch on, big forgiving tile targets (60 px hold area, tiles count from 40 px away).",
    patch: { steadiness: 60, latch: true, tileDwellRadius: 60, tileSnapPx: 40 },
  },
};

/** Fill minCutoff + lazyRadius from the patch's steadiness. */
export function withSteadiness(base: PipelineSettings, patch: Partial<PipelineSettings>): Partial<PipelineSettings> {
  if (patch.steadiness === undefined) return patch;
  const p = steadinessToParams(patch.steadiness);
  return { ...patch, lazyRadius: p.lazyRadius, filter: { ...base.filter, minCutoff: p.minCutoff } };
}

interface StoredProfiles {
  activeId: string;
  list: Profile[];
}

function defaults(): StoredProfiles {
  const steady: Profile = { id: "p_steady", name: "Steady day", settings: { ...DEFAULT_SETTINGS }, calibration: null };
  const shaky: Profile = {
    id: "p_shaky",
    name: "Shaky day",
    settings: { ...DEFAULT_SETTINGS, ...(withSteadiness(DEFAULT_SETTINGS, { steadiness: 70 }) as PipelineSettings) },
    calibration: null,
  };
  return { activeId: steady.id, list: [steady, shaky] };
}

export function loadProfiles(): StoredProfiles {
  const p = load<StoredProfiles | null>(KEYS.profiles, null);
  if (!p || !Array.isArray(p.list) || p.list.length === 0) return defaults();
  return p;
}

export function saveProfiles(p: StoredProfiles) {
  save(KEYS.profiles, p);
  setState({ profiles: p.list.map((x) => ({ id: x.id, name: x.name })), activeProfileId: p.activeId });
}

export function syncProfilesToStore() {
  saveProfiles(loadProfiles());
}

/** Store the live settings into the active profile. */
export function saveActiveProfile() {
  const p = loadProfiles();
  const s = getState();
  p.list = p.list.map((x) => (x.id === p.activeId ? { ...x, settings: { ...s.settings, simulateTremor: false }, calibration: s.calibration } : x));
  saveProfiles(p);
}

/** True when the live settings differ from the active profile's saved values. */
export function hasUnsavedChanges(): boolean {
  const p = loadProfiles();
  const active = p.list.find((x) => x.id === p.activeId);
  if (!active) return false;
  const a = active.settings;
  const b = getState().settings;
  return a.steadiness !== b.steadiness || a.gain !== b.gain || a.latch !== b.latch || a.penDownDwellMs !== b.penDownDwellMs;
}

export function nextProfile(): Profile {
  const p = loadProfiles();
  const i = p.list.findIndex((x) => x.id === p.activeId);
  return p.list[(i + 1) % p.list.length];
}

export function activateProfile(id: string): Profile | null {
  const p = loadProfiles();
  const target = p.list.find((x) => x.id === id);
  if (!target) return null;
  p.activeId = id;
  saveProfiles(p);
  return target;
}

export function renameProfile(id: string, name: string) {
  const p = loadProfiles();
  p.list = p.list.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x));
  saveProfiles(p);
}

export function addProfile(name: string): Profile {
  const p = loadProfiles();
  const s = getState();
  const prof: Profile = { id: `p_${Date.now().toString(36)}`, name: name.trim() || `Profile ${p.list.length + 1}`, settings: { ...s.settings, simulateTremor: false }, calibration: s.calibration };
  p.list.push(prof);
  p.activeId = prof.id;
  saveProfiles(p);
  return prof;
}

/** Runtime phrases: saying a profile's name switches to it. */
export function profilePhrases(): { phrase: string; id: ActionId; arg?: string }[] {
  return getState().profiles.map((x) => ({ phrase: x.name.toLowerCase(), id: "profile.next" as ActionId, arg: x.id }));
}
