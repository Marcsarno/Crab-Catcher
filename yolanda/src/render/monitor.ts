import * as THREE from 'three';

// A live patient-monitor screen: scrolling ECG trace plus HR / SpO₂ numbers drawn on a
// canvas texture. Every "wave" screen in the room becomes one, so the equipment reacts to
// the patient (standby until monitors are on, red when SpO₂ dips).

const W = 256, H = 168, SAMPLES = 110;

const gauss = (p: number, m: number, s: number) => Math.exp(-(((p - m) / s) ** 2) / 2);
/** One heartbeat (P, Q, R, S, T) as a function of beat phase 0..1. */
const ecg = (p: number) =>
  0.12 * gauss(p, 0.16, 0.025) - 0.14 * gauss(p, 0.245, 0.008) + 1.0 * gauss(p, 0.27, 0.011) - 0.26 * gauss(p, 0.297, 0.011) + 0.3 * gauss(p, 0.47, 0.045);

export interface MonitorState {
  hr: number;
  spo2: number;
  live: boolean;
}

export class LiveMonitor {
  readonly material: THREE.MeshBasicMaterial;
  private cv = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private buf: number[] = new Array(SAMPLES).fill(0);
  private phase = Math.random();
  private acc = 0;
  private clock = 0;
  private state: MonitorState = { hr: 72, spo2: 98, live: false };

  constructor(readonly tint: string) {
    this.cv.width = W;
    this.cv.height = H;
    this.ctx = this.cv.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
    this.draw();
  }

  set(s: MonitorState): void {
    this.state = s;
  }

  update(dt: number): void {
    this.clock += dt;
    this.acc += dt;
    const step = 1 / 24;
    let moved = false;
    while (this.acc >= step) {
      this.acc -= step;
      this.phase = (this.phase + (step * this.state.hr) / 60) % 1;
      this.buf.shift();
      this.buf.push(this.state.live ? ecg(this.phase) + (Math.random() - 0.5) * 0.03 : (Math.random() - 0.5) * 0.015);
      moved = true;
    }
    if (moved) this.draw();
  }

  private draw(): void {
    const { ctx } = this;
    const { hr, spo2, live } = this.state;
    const alarm = live && spo2 < 94;
    const col = alarm ? '#ff6b6b' : this.tint;
    ctx.fillStyle = '#06121c';
    ctx.fillRect(0, 0, W, H);
    // faint grid
    ctx.strokeStyle = 'rgba(120,200,220,0.10)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 100); ctx.stroke(); }
    for (let y = 0; y <= 100; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // trace
    ctx.strokeStyle = live ? col : 'rgba(150,170,190,0.55)';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = col;
    ctx.shadowBlur = live ? 8 : 0;
    ctx.beginPath();
    for (let i = 0; i < SAMPLES; i++) {
      const x = (i / (SAMPLES - 1)) * W;
      const y = 78 - this.buf[i] * 52;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // numbers
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(190,225,235,0.75)';
    ctx.fillText('HR', 12, 126);
    ctx.fillText('SpO₂', 136, 126);
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillStyle = live ? '#66e3a0' : 'rgba(150,170,190,0.5)';
    ctx.fillText(live ? String(hr) : '--', 10, 160);
    const blink = alarm && Math.floor(this.clock * 3) % 2 === 0;
    ctx.fillStyle = !live ? 'rgba(150,170,190,0.5)' : alarm ? (blink ? '#ffffff' : '#ff6b6b') : '#7fd8ff';
    ctx.fillText(live ? String(spo2) : '--', 134, 160);
    if (!live) {
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(190,225,235,0.6)';
      ctx.fillText('STANDBY', W - 10, 20);
    } else {
      // heart blip next to HR
      const beat = 1 - Math.min(1, ((this.phase + 0.73) % 1) * 5);
      ctx.fillStyle = `rgba(255,107,107,${0.35 + 0.65 * Math.max(0, beat)})`;
      ctx.beginPath();
      ctx.arc(W - 22, 18, 5 + 3 * Math.max(0, beat), 0, Math.PI * 2);
      ctx.fill();
    }
    this.tex.needsUpdate = true;
  }
}
