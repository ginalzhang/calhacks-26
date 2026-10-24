/**
 * AudioWorklet: mono mic input at the context rate (usually 48 kHz) -> 16 kHz signed 16-bit
 * little-endian PCM, posted to the main thread in fixed chunks (default 100 ms = 1600 samples
 * = 3200 bytes) as transferable ArrayBuffers, with the chunk's RMS level (0..1, boosted for display).
 *
 * Messages posted: { type: "chunk", pcm: ArrayBuffer, level: number }
 * Messages accepted: "flush" (post the partial chunk now, then { type: "flushed" }).
 *
 * Downsampling is a box filter (average of the input samples that fall into each output
 * sample), which is an adequate anti-alias low-pass for speech.
 */
class Pcm16Downsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.targetRate = o.targetRate || 16000;
    this.chunkSamples = Math.round((this.targetRate * (o.chunkMs || 100)) / 1000);
    // `sampleRate` is a global in AudioWorkletGlobalScope.
    this.ratio = sampleRate / this.targetRate;
    this.out = new Int16Array(this.chunkSamples);
    this.outLen = 0;
    this.acc = 0;
    this.accN = 0;
    this.pos = 0; // input samples consumed since the last output sample boundary
    this.sumSq = 0;
    this.sumN = 0;
    this.port.onmessage = (e) => {
      if (e.data === "flush") {
        this.emit(true);
        this.port.postMessage({ type: "flushed" });
      }
    };
  }

  emit(partial) {
    if (this.outLen === 0) return;
    const n = partial ? this.outLen : this.chunkSamples;
    const pcm = this.out.slice(0, n).buffer;
    const rms = this.sumN ? Math.sqrt(this.sumSq / this.sumN) : 0;
    this.port.postMessage({ type: "chunk", pcm, level: Math.min(1, rms * 4) }, [pcm]);
    this.outLen = 0;
    this.sumSq = 0;
    this.sumN = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;
    const ch0 = input[0];
    const ch1 = input.length > 1 ? input[1] : null;
    for (let i = 0; i < ch0.length; i++) {
      const x = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
      this.acc += x;
      this.accN++;
      this.sumSq += x * x;
      this.sumN++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        let s = this.acc / this.accN;
        this.acc = 0;
        this.accN = 0;
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        this.out[this.outLen++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.outLen === this.chunkSamples) this.emit(false);
      }
    }
    return true;
  }
}

registerProcessor("pcm16-downsampler", Pcm16Downsampler);
