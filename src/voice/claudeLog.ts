/**
 * Claude call log in localStorage["steady.claudeLog"] (docs/API.md). Every /api/command and
 * /api/cleanup call is logged; cleanup entries start "pending" and are resolved by the ghost
 * overlay's Accept / Reject. Fires a `steady:claudelog` window event on every change.
 */
export type ClaudeLogResult = "accepted" | "rejected" | "timeout" | "error" | "pending";

export interface ClaudeLogEntry {
  id: string;
  at: number;
  route: "command" | "cleanup";
  mode: string;
  summary: string;
  latencyMs: number;
  result: ClaudeLogResult;
  mock?: boolean;
}

export interface ClaudeStats {
  calls: number;
  accepted: number;
  rejected: number;
  timeouts: number;
}

export const CLAUDE_LOG_KEY = "steady.claudeLog";
export const CLAUDE_LOG_EVENT = "steady:claudelog";
const MAX_ENTRIES = 300;

let memory: ClaudeLogEntry[] = []; // used when localStorage is unavailable (tests, private mode)

function storage(): Storage | null {
  try {
    // Node 25 exposes a non-functional global localStorage stub: require a working API.
    if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function" || typeof localStorage.setItem !== "function") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function getClaudeLog(): ClaudeLogEntry[] {
  const s = storage();
  if (!s) return memory.slice();
  try {
    const v = JSON.parse(s.getItem(CLAUDE_LOG_KEY) ?? "[]");
    return Array.isArray(v) ? (v as ClaudeLogEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: ClaudeLogEntry[]) {
  const trimmed = entries.slice(-MAX_ENTRIES);
  const s = storage();
  if (s) {
    try {
      s.setItem(CLAUDE_LOG_KEY, JSON.stringify(trimmed));
    } catch {
      memory = trimmed;
    }
  } else memory = trimmed;
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLAUDE_LOG_EVENT));
  }
}

let seq = 0;

/** Append an entry; returns its id (pass to resolveClaudeCall). */
export function logClaudeCall(
  entry: Omit<ClaudeLogEntry, "id" | "at" | "result" | "latencyMs"> & { result?: ClaudeLogResult; latencyMs?: number },
): string {
  const id = `cl_${Date.now().toString(36)}_${(seq++).toString(36)}`;
  const full: ClaudeLogEntry = { latencyMs: 0, result: "pending", ...entry, id, at: Date.now() };
  save([...getClaudeLog(), full]);
  return id;
}

/** Update an entry's result (and optionally latency / summary). */
export function resolveClaudeCall(
  id: string,
  result: ClaudeLogResult,
  patch?: Partial<Pick<ClaudeLogEntry, "latencyMs" | "summary">>,
): void {
  const log = getClaudeLog();
  const i = log.findIndex((e) => e.id === id);
  if (i < 0) return;
  log[i] = { ...log[i], ...patch, result };
  save(log);
}

export function getClaudeStats(): ClaudeStats {
  const log = getClaudeLog();
  return {
    calls: log.length,
    accepted: log.filter((e) => e.result === "accepted").length,
    rejected: log.filter((e) => e.result === "rejected").length,
    timeouts: log.filter((e) => e.result === "timeout").length,
  };
}

/** "Next judge" / metrics reset. */
export function clearClaudeLog(): void {
  save([]);
}
