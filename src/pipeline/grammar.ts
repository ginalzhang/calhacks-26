/**
 * Local command grammar (pure; no DOM). Voice transcripts and the typed-command box both go
 * through matchCommand(): exact phrase match first, then fuzzy (Levenshtein <= 1 for phrases
 * of <= 5 chars, <= 2 otherwise). A fuzzy tie between two different actions is no match.
 * Fuzzy matching is off when `exactOnly` (any dialog open).
 */
import { ACTIONS, type ActionId } from "@/actions";
import type { GrammarMatch, GrammarOptions } from "./types";

/** GrammarMatch plus the runtime `arg` carried by an `opts.extra` phrase (e.g. a profile id). */
export type GrammarMatchWithArg = GrammarMatch & { arg?: string };

/** Single filler words removed anywhere in the utterance. None of them occurs in any action phrase (tested). */
const FILLER_WORDS = new Set(["um", "umm", "uh", "uhh", "erm", "er", "hmm", "please", "pls"]);
/** Politeness prefixes removed from the start only (longest first). */
const LEADING_FILLERS = ["can you please", "could you please", "can you", "could you", "okay", "ok", "hey steady", "now"];
/** Removed from the end only. */
const TRAILING_FILLERS = ["thank you", "thanks", "now"];

/**
 * Lower-case, unify apostrophes, drop apostrophes ("don't" -> "dont"), turn every other
 * non-alphanumeric character into a space, strip filler, collapse spaces.
 */
export function normalize(text: string): string {
  let s = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/['‘’ʼ`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!s) return "";
  s = s
    .split(" ")
    .filter((w) => !FILLER_WORDS.has(w))
    .join(" ");
  // Repeatedly peel leading/trailing fillers ("ok now make it blue thanks").
  let changed = true;
  while (changed && s) {
    changed = false;
    for (const f of LEADING_FILLERS) {
      if (s === f) break;
      if (s.startsWith(f + " ")) {
        s = s.slice(f.length + 1);
        changed = true;
        break;
      }
    }
    for (const f of TRAILING_FILLERS) {
      if (s === f) break;
      if (s.endsWith(" " + f)) {
        s = s.slice(0, -(f.length + 1));
        changed = true;
        break;
      }
    }
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Classic Levenshtein edit distance (two-row DP). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Fuzzy threshold for a candidate phrase. */
export function fuzzyThreshold(phrase: string): number {
  return phrase.length <= 5 ? 1 : 2;
}

interface Candidate {
  phrase: string;
  id: ActionId;
  arg?: string;
}

let tableCandidates: Candidate[] | null = null;

/** Every phrase and typed form in the action table, normalised and de-duplicated per id. */
export function grammarCandidates(): readonly Candidate[] {
  if (tableCandidates) return tableCandidates;
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const def of ACTIONS) {
    for (const raw of [...def.phrases, def.typed]) {
      const phrase = normalize(raw);
      const key = `${def.id}\u0000${phrase}`;
      if (!phrase || seen.has(key)) continue;
      seen.add(key);
      out.push({ phrase, id: def.id });
    }
  }
  tableCandidates = out;
  return out;
}

function allCandidates(opts?: GrammarOptions): Candidate[] {
  const base = grammarCandidates();
  if (!opts?.extra?.length) return base.slice();
  const extra = opts.extra
    .map((e) => ({ phrase: normalize(e.phrase), id: e.id, arg: e.arg }))
    .filter((e) => e.phrase.length > 0);
  // Table phrases win exact ties (listed first).
  return [...base, ...extra];
}

function nearestOf(input: string, cands: Candidate[]): { id: ActionId; phrase: string; distance: number }[] {
  const scored = cands
    .map((c) => ({ id: c.id, phrase: c.phrase, distance: levenshtein(input, c.phrase) }))
    .sort((a, b) => a.distance - b.distance || Math.abs(a.phrase.length - input.length) - Math.abs(b.phrase.length - input.length));
  const out: { id: ActionId; phrase: string; distance: number }[] = [];
  for (const s of scored) {
    if (out.some((o) => o.id === s.id)) continue;
    out.push(s);
    if (out.length === 2) break;
  }
  return out;
}

export function matchCommand(text: string, opts?: GrammarOptions): GrammarMatchWithArg {
  const input = normalize(text);
  const cands = allCandidates(opts);
  if (!input) return { kind: "none", nearest: [] };

  // 1. Exact.
  const exact = cands.find((c) => c.phrase === input);
  if (exact) {
    const m: GrammarMatchWithArg = { kind: "exact", id: exact.id, phrase: exact.phrase };
    if (exact.arg !== undefined) m.arg = exact.arg;
    return m;
  }

  // 2. Fuzzy (off while a dialog is open).
  if (!opts?.exactOnly) {
    let best = Infinity;
    let hits: (Candidate & { distance: number })[] = [];
    for (const c of cands) {
      const th = fuzzyThreshold(c.phrase);
      if (Math.abs(c.phrase.length - input.length) > th) continue;
      const d = levenshtein(input, c.phrase);
      if (d > th) continue;
      if (d < best) {
        best = d;
        hits = [{ ...c, distance: d }];
      } else if (d === best) {
        hits.push({ ...c, distance: d });
      }
    }
    if (hits.length) {
      const ids = new Set(hits.map((h) => `${h.id}\u0000${h.arg ?? ""}`));
      if (ids.size === 1) {
        const h = hits[0];
        const m: GrammarMatchWithArg = { kind: "fuzzy", id: h.id, phrase: h.phrase, distance: h.distance };
        if (h.arg !== undefined) m.arg = h.arg;
        return m;
      }
      // Tie between different actions: no match, but offer the tied ones as the nearest tiles.
      return { kind: "none", nearest: nearestOf(input, hits) };
    }
  }

  return { kind: "none", nearest: nearestOf(input, cands) };
}
