import { describe, expect, it } from "vitest";
import { ACTIONS } from "@/actions";
import { buildSttUrl, commandKeyterms, createTranscriptAssembler, MAX_KEYTERM_CHARS, MAX_KEYTERMS, parseSttMessage } from "./cartesiaStt";

describe("Cartesia STT URL", () => {
  it("uses the manual Ink 2 endpoint with the required params", () => {
    const u = new URL(buildSttUrl("tok_123", "command"));
    expect(`${u.protocol}//${u.host}${u.pathname}`).toBe("wss://api.cartesia.ai/stt/websocket");
    expect(u.searchParams.get("model")).toBe("ink-2");
    expect(u.searchParams.get("encoding")).toBe("pcm_s16le");
    expect(u.searchParams.get("sample_rate")).toBe("16000");
    expect(u.searchParams.get("cartesia_version")).toBe("2026-08-14");
    expect(u.searchParams.get("access_token")).toBe("tok_123");
    expect(u.pathname).not.toContain("turns");
  });
  it("repeats keyterm once per voice phrase in command mode", () => {
    const u = new URL(buildSttUrl("t", "command"));
    const kts = u.searchParams.getAll("keyterm");
    const phrases = [...new Set(ACTIONS.flatMap((a) => a.phrases))];
    expect(kts).toEqual(phrases.slice(0, kts.length));
    expect(kts).toContain("make it a circle");
    expect(kts.length).toBe(Math.min(phrases.length, MAX_KEYTERMS));
  });
  it("omits keyterms in dictation mode", () => {
    expect(new URL(buildSttUrl("t", "dictation")).searchParams.getAll("keyterm")).toEqual([]);
  });
  it("caps keyterms at Cartesia's 100 terms / 1200 chars", () => {
    const extra = Array.from({ length: 200 }, (_, i) => `profile number ${i}`);
    const k = commandKeyterms(extra);
    expect(k.length).toBeLessThanOrEqual(MAX_KEYTERMS);
    expect(k.join("").length).toBeLessThanOrEqual(MAX_KEYTERM_CHARS);
    expect(k[0]).toBe(ACTIONS[0].phrases[0]); // table phrases first
  });
});

describe("transcript assembly", () => {
  it("concatenates only is_final deltas; partial = finals + latest non-final", () => {
    const a = createTranscriptAssembler();
    expect(a.push("make", false)).toBe("make");
    expect(a.push("make it", false)).toBe("make it");
    expect(a.push("Make it", true)).toBe("Make it");
    expect(a.push(" a cir", false)).toBe("Make it a cir");
    expect(a.push(" a circle.", true)).toBe("Make it a circle.");
    expect(a.final()).toBe("Make it a circle.");
  });
  it("falls back to the last partial if nothing was finalised", () => {
    const a = createTranscriptAssembler();
    a.push("undo", false);
    expect(a.final()).toBe("undo");
    expect(a.hasText).toBe(true);
  });
  it("parses server messages", () => {
    expect(parseSttMessage(JSON.stringify({ type: "transcript", text: "hi", is_final: true, request_id: "r" }))).toMatchObject({
      type: "transcript",
      text: "hi",
      is_final: true,
    });
    expect(parseSttMessage(JSON.stringify({ type: "flush_done", request_id: "r" }))).toEqual({ type: "flush_done", request_id: "r" });
    expect(parseSttMessage(JSON.stringify({ type: "turn.end" }))).toBeNull();
    expect(parseSttMessage("not json")).toBeNull();
    expect(parseSttMessage(new ArrayBuffer(2))).toBeNull();
  });
});
