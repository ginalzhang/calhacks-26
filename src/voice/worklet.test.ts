import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

type Posted = { msg: { type: string; pcm?: ArrayBuffer; level?: number } };

/** Load the worklet source in a fake AudioWorkletGlobalScope. */
function loadWorklet(sampleRate: number) {
  const src = readFileSync(path.resolve(__dirname, "../../public/worklets/pcm16-downsampler.js"), "utf8");
  let Ctor: new (o: unknown) => { process(i: Float32Array[][]): boolean; port: { onmessage: ((e: { data: unknown }) => void) | null } } = null!;
  class AudioWorkletProcessor {
    posted: Posted[] = [];
    port = {
      onmessage: null as ((e: { data: unknown }) => void) | null,
      postMessage: (msg: Posted["msg"]) => this.posted.push({ msg }),
    };
  }
  const registerProcessor = (_name: string, c: typeof Ctor) => {
    Ctor = c;
  };
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", src)(AudioWorkletProcessor, registerProcessor, sampleRate);
  return (opts: unknown) => new Ctor({ processorOptions: opts }) as unknown as InstanceType<typeof Ctor> & { posted: Posted[] };
}

describe("pcm16-downsampler worklet", () => {
  it("turns 48 kHz float blocks into 100 ms chunks of 16 kHz Int16 (3200 bytes)", () => {
    const make = loadWorklet(48000);
    const p = make({ targetRate: 16000, chunkMs: 100 });
    const total = 48000 * 0.25; // 250 ms
    for (let off = 0; off < total; off += 128) {
      const block = new Float32Array(128);
      for (let i = 0; i < 128; i++) block[i] = 0.5 * Math.sin((2 * Math.PI * 440 * (off + i)) / 48000);
      p.process([[block]]);
    }
    const chunks = p.posted.filter((x) => x.msg.type === "chunk");
    expect(chunks).toHaveLength(2);
    for (const c of chunks) {
      expect(c.msg.pcm!.byteLength).toBe(3200);
      const pcm = new Int16Array(c.msg.pcm!);
      const peak = Math.max(...Array.from(pcm, Math.abs));
      expect(peak).toBeGreaterThan(0.4 * 0x7fff);
      expect(peak).toBeLessThan(0.55 * 0x7fff);
      expect(c.msg.level).toBeGreaterThan(0);
    }
    // flush posts the remaining ~50 ms then "flushed" (94 blocks x 128 = 12032 in -> 4010 out).
    p.port.onmessage!({ data: "flush" });
    const tail = p.posted.slice(-2);
    expect(tail[0].msg.type).toBe("chunk");
    expect(tail[0].msg.pcm!.byteLength).toBe((Math.floor((Math.ceil(total / 128) * 128) / 3) - 3200) * 2);
    expect(tail[1].msg.type).toBe("flushed");
  });

  it("handles 44.1 kHz input (fractional ratio)", () => {
    const p = loadWorklet(44100)({ targetRate: 16000, chunkMs: 100 });
    for (let off = 0; off < 44100; off += 128) p.process([[new Float32Array(128)]]);
    const chunks = p.posted.filter((x) => x.msg.type === "chunk");
    // 1 s of audio -> 10 chunks (+/- 1 for the boundary).
    expect(chunks.length).toBeGreaterThanOrEqual(9);
    expect(chunks.length).toBeLessThanOrEqual(10);
    expect(chunks.every((c) => c.msg.pcm!.byteLength === 3200)).toBe(true);
  });
});
