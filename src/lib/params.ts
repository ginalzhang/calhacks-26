/** URL params the app honours (contract: src/tracking/LandmarkSource.ts). Read once on the client. */
export interface AppParams {
  source: "mediapipe" | "replay";
  fixture: string | null;
  autoplay: boolean;
  skipIntro: boolean;
  demo: boolean;
}

let cached: AppParams | null = null;

export function getParams(): AppParams {
  if (cached) return cached;
  if (typeof window === "undefined") {
    return { source: "mediapipe", fixture: null, autoplay: true, skipIntro: false, demo: false };
  }
  const q = new URLSearchParams(window.location.search);
  const fixture = q.get("fixture");
  cached = {
    source: q.get("source") === "replay" || (fixture && q.get("source") !== "camera") ? "replay" : "mediapipe",
    fixture,
    autoplay: q.get("autoplay") !== "0",
    skipIntro: q.get("skipIntro") === "1",
    demo: q.get("demo") === "1",
  };
  return cached;
}

/** `word-tremor` → `/fixtures/word-tremor.json`; full paths/URLs pass through. */
export function fixtureUrl(name: string): string {
  if (name.includes("/") || name.endsWith(".json")) return name;
  return `/fixtures/${encodeURIComponent(name)}.json`;
}
