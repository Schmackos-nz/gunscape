// Synthesized sound effects via the Web Audio API — no audio files. The context
// starts suspended and is resumed on the first user gesture (browser policy).
export interface Engine {
  set(pitchMul: number, volume: number): void;
  stop(): void;
}

export class Sfx {
  private ctx: AudioContext;
  private master: GainNode;
  private noise: AudioBuffer;
  private sirenGain: GainNode | null = null;

  constructor() {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const resume = () => { if (this.ctx.state === "suspended") this.ctx.resume(); };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
  }

  private now() { return this.ctx.currentTime; }

  private playNoise(dur: number, freq: number, gain: number, type: BiquadFilterType = "lowpass") {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    const t = this.now();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  private playTone(freq: number, dur: number, type: OscillatorType, gain: number, freqEnd?: number) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const t = this.now();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** Gunshot: a broadband noise crack whose lowpass sweeps down, over a short
   *  low boom — not a tonal beep. */
  gun() {
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(7500, t);
    filt.frequency.exponentialRampToValueAtTime(450, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.22);

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }
  holster() { this.playNoise(0.05, 3500, 0.25, "highpass"); }
  scream() { this.playTone(680, 0.35, "sawtooth", 0.25, 320); }
  punch() { this.playNoise(0.08, 900, 0.5); this.playTone(160, 0.09, "sine", 0.35, 80); }
  bodyfall() { this.playNoise(0.22, 280, 0.6); }
  honk() { this.playTone(420, 0.25, "square", 0.18); this.playTone(360, 0.25, "square", 0.14); }
  coin() { this.playTone(880, 0.07, "square", 0.25); this.playTone(1320, 0.1, "square", 0.22); }
  whistle() { this.playTone(1900, 0.18, "sine", 0.2, 2300); }

  /** A looping, wailing police siren. Cheap: cents-toggling two-tone. */
  startSiren() {
    if (this.sirenGain) { this.sirenGain.gain.setTargetAtTime(0.16, this.now(), 0.2); return; }
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 740;
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1.4; // wail rate
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180; // wail depth
    lfo.connect(lfoGain).connect(osc.frequency);
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 900;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    osc.connect(filt).connect(this.sirenGain).connect(this.master);
    osc.start();
    lfo.start();
    this.sirenGain.gain.setTargetAtTime(0.16, this.now(), 0.2);
  }
  stopSiren() {
    if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.now(), 0.3);
  }

  /** A continuous engine voice for one vehicle (pitch + volume driven live). */
  createEngine(baseFreq: number, type: OscillatorType): Engine {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = baseFreq;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 700;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filt).connect(gain).connect(this.master);
    osc.start();
    return {
      set: (pitchMul: number, volume: number) => {
        const t = this.now();
        osc.frequency.setTargetAtTime(baseFreq * pitchMul, t, 0.06);
        gain.gain.setTargetAtTime(volume, t, 0.1);
      },
      stop: () => { try { osc.stop(); } catch {} },
    };
  }
}
