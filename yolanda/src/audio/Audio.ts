// All audio is synthesized at runtime (original, no samples): SFX, ambience and
// a light generative music loop whose energy rises with overlapping timers.

export type Sfx =
  | 'step' | 'drawer' | 'pickup' | 'drop' | 'machine' | 'ready' | 'complete' | 'alert' | 'error'
  | 'phase' | 'beep' | 'click' | 'cart' | 'star' | 'reveal';

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // major pentatonic-ish

export class AudioSys {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private ambGain!: GainNode;
  private noise!: AudioBuffer;
  private nextNote = 0;
  private step = 0;
  energy = 0;
  soundOn = true;
  musicOn = true;
  private beepAt = 0;
  monitorHr = 0; // 0 = monitor silent

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.soundOn ? 0.9 : 0;
    this.sfxGain.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
    this.musicGain.connect(this.master);
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = this.soundOn ? 0.05 : 0;
    this.ambGain.connect(this.master);
    // noise buffer
    const len = ctx.sampleRate * 1.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // ambience: very soft filtered noise (HVAC hum)
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    src.connect(lp).connect(this.ambGain);
    src.start();
    this.nextNote = ctx.currentTime + 0.2;
    window.setInterval(() => this.schedule(), 90);
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    if (this.ctx) {
      this.sfxGain.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
      this.ambGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.05);
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.1);
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, glideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.008, vol, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(t: number, dur: number, vol: number, freq: number, q: number, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.005, vol, dur);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  play(name: Sfx): void {
    if (!this.ctx || !this.soundOn) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this.sfxGain;
    switch (name) {
      case 'step': this.burst(t, 0.06, 0.08, 900 + Math.random() * 300, 1.2, 'bandpass'); break;
      case 'drawer': this.burst(t, 0.28, 0.25, 600, 2, 'bandpass', 1800); this.tone(140, t + 0.22, 0.08, 'sine', 0.2, out); break;
      case 'pickup': this.tone(660, t, 0.08, 'triangle', 0.25, out); this.tone(990, t + 0.06, 0.12, 'triangle', 0.22, out); break;
      case 'drop': this.tone(300, t, 0.12, 'sine', 0.3, out, 160); break;
      case 'machine': this.tone(220, t, 0.35, 'sawtooth', 0.06, out, 440); this.tone(440, t + 0.3, 0.15, 'sine', 0.15, out); break;
      case 'ready': this.tone(880, t, 0.25, 'sine', 0.22, out); this.tone(1320, t + 0.12, 0.4, 'sine', 0.2, out); break;
      case 'complete': [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.07, 0.25, 'triangle', 0.2, out)); break;
      case 'alert': this.tone(740, t, 0.16, 'square', 0.07, out); this.tone(587, t + 0.18, 0.2, 'square', 0.07, out); break;
      case 'error': this.tone(180, t, 0.18, 'square', 0.08, out, 140); break;
      case 'phase': [392, 494, 587, 784].forEach((f) => this.tone(f, t, 0.9, 'sine', 0.09, out)); break;
      case 'beep': this.tone(1046, t, 0.07, 'sine', 0.06, out); break;
      case 'click': this.tone(1200, t, 0.03, 'sine', 0.08, out); break;
      case 'cart': this.burst(t, 0.5, 0.06, 300, 0.8, 'lowpass'); break;
      case 'star': this.tone(1046, t, 0.3, 'triangle', 0.2, out); this.tone(1568, t + 0.08, 0.35, 'sine', 0.14, out); break;
      case 'reveal': [440, 554, 659].forEach((f, i) => this.tone(f, t + i * 0.1, 0.4, 'sine', 0.14, out)); break;
    }
  }

  /** Generative music: soft plucks over a gentle bass. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const bpm = 96 + this.energy * 8;
    const sixteenth = 60 / bpm / 4;
    // monitor beep (active care)
    if (this.monitorHr > 0 && this.soundOn && ctx.currentTime >= this.beepAt) {
      this.beepAt = ctx.currentTime + 60 / this.monitorHr;
      this.play('beep');
    }
    while (this.nextNote < ctx.currentTime + 0.3) {
      const t = this.nextNote;
      const s = this.step % 32;
      const bar = Math.floor(this.step / 16) % 4;
      const root = [0, -3, 5, 2][bar] + 60; // C, A-, F, D-ish progression
      if (this.musicOn) {
        if (s % 8 === 0) this.tone(midi(root - 24), t, 0.5, 'sine', 0.2, this.musicGain);
        const pattern = [0, 3, 6, 10, 12, 14];
        if (pattern.includes(s % 16)) {
          const n = SCALE[(this.step * 7 + bar * 3) % SCALE.length];
          this.tone(midi(root + n), t, 0.22, 'triangle', 0.09, this.musicGain);
        }
        if (this.energy >= 1 && s % 4 === 2) this.hat(t, 0.025);
        if (this.energy >= 2 && s % 2 === 1) this.tone(midi(root + 12 + SCALE[(this.step * 3) % 5]), t, 0.1, 'sine', 0.035, this.musicGain);
        if (this.energy >= 3 && s % 8 === 4) this.tone(midi(root - 12), t, 0.2, 'triangle', 0.12, this.musicGain);
      }
      this.nextNote += sixteenth;
      this.step++;
    }
  }

  private hat(t: number, vol: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    this.env(g, t, 0.002, vol, 0.04);
    s.connect(f).connect(g).connect(this.musicGain);
    s.start(t, Math.random());
    s.stop(t + 0.06);
  }
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
