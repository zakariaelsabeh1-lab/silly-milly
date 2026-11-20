// Runs in the audio thread. Turns the microphone into 16 kHz, 16-bit-scale chunks of 1280 samples
// (80 ms) and sends them to the wake-word worker through the port it is given.
class MillyCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // AudioContext is usually created at 16 kHz, so this is 1
    this.pos = 0;
    this.buf = new Float32Array(1280);
    this.n = 0;
    this.out = this.port;
    this.port.onmessage = (e) => { if (e.data && e.data.port) this.out = e.data.port; };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (this.ratio === 1) {
      for (let i = 0; i < ch.length; i++) this.push(ch[i]);
    } else {
      // simple resampler for devices that refuse a 16 kHz AudioContext
      while (this.pos < ch.length) {
        const i = Math.floor(this.pos), f = this.pos - i;
        const a = ch[i], b = i + 1 < ch.length ? ch[i + 1] : a;
        this.push(a + (b - a) * f);
        this.pos += this.ratio;
      }
      this.pos -= ch.length;
    }
    return true;
  }
  push(v) {
    this.buf[this.n++] = Math.max(-1, Math.min(1, v)) * 32767;
    if (this.n === 1280) {
      this.out.postMessage({ type: "audio", pcm: this.buf }, [this.buf.buffer]);
      this.buf = new Float32Array(1280);
      this.n = 0;
    }
  }
}
registerProcessor("milly-capture", MillyCapture);
