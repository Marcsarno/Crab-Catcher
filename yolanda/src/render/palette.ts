import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// THE shared material + geometry library. Every model in the game is built from
// these so the whole world reads as one cohesive asset set.

export const C = {
  warmWhite: '#f5f2ec',
  white: '#fbfbfa',
  lightGray: '#dde2e7',
  midGray: '#a9b4bf',
  darkGray: '#5d6874',
  blue: '#6a93c9',
  blueLight: '#a9c6ea',
  blueDeep: '#3f6fb0',
  teal: '#2ba8a0',
  tealLight: '#7fd3c9',
  tealDark: '#1d7f79',
  navy: '#1e3550',
  navyLight: '#2c4a6b',
  yellow: '#f2b33d',
  orange: '#ee8a3c',
  red: '#e05656',
  green: '#4cc38a',
  greenLeaf: '#5fae5a',
  greenLeafDark: '#3f8a46',
  floorA: '#e3ebf1',
  floorB: '#d6e1ea',
  orFloorA: '#cfdde6',
  orFloorB: '#bfd0dc',
  wall: '#e9eff3',
  wallTop: '#2c4a6b',
  wood: '#e2c9a0',
  screen: '#16324a',
  screenGlow: '#58e0c8',
  black: '#1b2430',
  skinA: '#f1c6a1',
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export interface MatOpts {
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  rough?: number;
  metal?: number;
  side?: THREE.Side;
}

export function mat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.emissive ?? ''}|${o.emissiveIntensity ?? ''}|${o.opacity ?? 1}|${o.rough ?? ''}|${o.metal ?? ''}|${o.side ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: o.rough ?? 0.72,
      metalness: o.metal ?? 0.0,
      emissive: new THREE.Color(o.emissive ?? '#000000'),
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}

/** A unique (non-cached) material, for things that animate color. */
export function uniqueMat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: o.rough ?? 0.6, metalness: 0,
    emissive: new THREE.Color(o.emissive ?? '#000000'), emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1,
  });
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

export function rbox(w: number, h: number, d: number, color: string | THREE.Material, radius = 0.06, shadow = true): THREE.Mesh {
  const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = geo(`rb${r2(w)},${r2(h)},${r2(d)},${r2(r)}`, () =>
    r > 0.005 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function cyl(rt: number, rb: number, h: number, color: string | THREE.Material, seg = 18, shadow = true): THREE.Mesh {
  const g = geo(`cy${r2(rt)},${r2(rb)},${r2(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function sph(r: number, color: string | THREE.Material, seg = 18, shadow = true): THREE.Mesh {
  const g = geo(`sp${r2(r)},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.75))));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.castShadow = shadow;
  return m;
}

export function capsule(r: number, len: number, color: string | THREE.Material, shadow = true): THREE.Mesh {
  const g = geo(`ca${r2(r)},${r2(len)}`, () => new THREE.CapsuleGeometry(r, len, 5, 12));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.castShadow = shadow;
  return m;
}

export function torus(r: number, tube: number, color: string | THREE.Material, arc = Math.PI * 2, shadow = false): THREE.Mesh {
  const g = geo(`to${r2(r)},${r2(tube)},${r2(arc)}`, () => new THREE.TorusGeometry(r, tube, 8, 24, arc));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.castShadow = shadow;
  return m;
}

export function plane(w: number, h: number, material: THREE.Material): THREE.Mesh {
  const g = geo(`pl${r2(w)},${r2(h)}`, () => new THREE.PlaneGeometry(w, h));
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

export function tube(points: THREE.Vector3[], radius: number, color: string): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), mat(color));
  m.castShadow = true;
  return m;
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

// ---------------------------------------------------------------- canvas textures

const texCache = new Map<string, THREE.CanvasTexture>();

export function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  draw(ctx, w, h);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

export type ScreenIcon = 'drop' | 'lungs' | 'wave' | 'chart' | 'airway' | 'check' | 'text';

/** A glowing screen panel with a simple icon. */
export function screenMesh(w: number, h: number, icon: ScreenIcon, tint = C.screenGlow, text = ''): THREE.Mesh {
  const tex = canvasTex(`scr-${icon}-${tint}-${text}`, 128, 96, (ctx, W, H) => {
    ctx.fillStyle = C.screen;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = tint;
    ctx.fillStyle = tint;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cx = W / 2, cy = H / 2;
    if (icon === 'drop') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 30);
      ctx.bezierCurveTo(cx + 26, cy, cx + 22, cy + 28, cx, cy + 28);
      ctx.bezierCurveTo(cx - 22, cy + 28, cx - 26, cy, cx, cy - 30);
      ctx.fill();
    } else if (icon === 'lungs') {
      ctx.beginPath(); ctx.ellipse(cx - 16, cy + 6, 14, 24, 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 16, cy + 6, 14, 24, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 3, cy - 32, 6, 22);
    } else if (icon === 'wave') {
      ctx.beginPath();
      const pts = [0, 0, 0, -26, 20, 0, 0, 0, -8, 0, 0];
      pts.forEach((p, i) => { const x = 10 + i * (W - 20) / (pts.length - 1); i ? ctx.lineTo(x, cy + p) : ctx.moveTo(x, cy + p); });
      ctx.stroke();
    } else if (icon === 'chart') {
      ctx.fillStyle = '#e8f1f8';
      ctx.fillRect(14, 12, W - 28, H - 24);
      ctx.fillStyle = C.blue;
      ctx.beginPath(); ctx.arc(34, 34, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(54, 26, 50, 6); ctx.fillRect(54, 40, 36, 6);
      ctx.fillStyle = '#9fb3c6';
      for (let i = 0; i < 2; i++) ctx.fillRect(22, 58 + i * 12, W - 44, 5);
    } else if (icon === 'airway') {
      ctx.beginPath(); ctx.arc(cx, cy - 4, 22, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 20, cy + 2); ctx.lineTo(cx + 20, cy + 28); ctx.stroke();
    } else if (icon === 'check') {
      ctx.beginPath(); ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 6, cy + 18); ctx.lineTo(cx + 26, cy - 18); ctx.stroke();
    } else if (icon === 'text') {
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy);
    }
  });
  const m = plane(w, h, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.castShadow = false;
  return m;
}

export function textPlane(text: string, w: number, h: number, color = C.navy, bg: string | null = null, font = 'bold 64px system-ui, sans-serif', sub = ''): THREE.Mesh {
  const pxW = 512, pxH = Math.round(512 * h / w);
  const tex = canvasTex(`txt-${text}-${color}-${bg}-${w}-${h}-${sub}`, pxW, pxH, (ctx, W, H) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.font = font;
    // shrink to fit
    const m = font.match(/(\d+)px/);
    let px = m ? Number(m[1]) : 64;
    while (px > 10 && ctx.measureText(text).width > W * 0.92) { px -= 4; ctx.font = font.replace(/\d+px/, `${px}px`); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, sub ? H * 0.38 : H / 2);
    if (sub) {
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.globalAlpha = 0.75;
      ctx.fillText(sub, W / 2, H * 0.78);
    }
  });
  const m = plane(w, h, new THREE.MeshBasicMaterial({ map: tex, transparent: !bg }));
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

export function shadowAll(o: THREE.Object3D, cast = true): void {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = cast; });
}
