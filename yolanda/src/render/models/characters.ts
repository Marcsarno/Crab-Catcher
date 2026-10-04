import * as THREE from 'three';
import { C, at, capsule, mat, rbox, sph, torus, cyl, tube, uniqueMat } from '../palette';
import type { AnimName } from '../../core/types';
import { character, hasModel, type ModelName, type Outfit } from '../assets';

// Chunky stylized people: oversized heads and hands, simple color blocking.

export interface HumanLook {
  skin: string;
  hair: string;
  hairStyle: 'ponytail' | 'short' | 'bun' | 'curly' | 'bald' | 'cap';
  top: string;
  pants: string;
  shoes: string;
  capColor?: string;
  mask?: boolean;
  badge?: boolean;
  tie?: string;
  scale?: number;
  /** External rigged model (Kenney Mini Characters) used when loaded. */
  model?: ModelName;
  outfit?: Outfit;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  tray: THREE.Group;
  trayTokens: THREE.Mesh[];
  eyes: THREE.Object3D[];
  mouth: THREE.Mesh;
  anim: AnimName;
  t: number;
  /** blend weight for carry pose */
  carry: number;
  /** Present when the rig is an imported, skeletal-animated model. */
  gl?: { mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; cur: string };
}

export const YOLANDA_LOOK: HumanLook = {
  skin: '#f0c39c', hair: '#8a6239', hairStyle: 'ponytail', top: C.teal, pants: '#23968f',
  shoes: '#f4f6f8', badge: true, tie: '#e05656',
};

/** Map game animation names to Kenney clip names. */
const CLIP_FOR: Record<AnimName, string> = {
  idle: 'idle', walk: 'walk', carry: 'holding-both', interact: 'interact-right', drawer: 'pick-up', machine: 'interact-right',
  monitor: 'interact-left', chart: 'interact-left', talk: 'emote-yes', push: 'walk', handoff: 'emote-yes', wait: 'idle', cheer: 'emote-yes',
};

function makeModelRig(look: HumanLook): Rig | null {
  if (!look.model || !hasModel(look.model)) return null;
  const cm = character(look.model, look.outfit ?? null, 1.75 * (look.scale ?? 1));
  if (!cm) return null;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(cm.object);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const [name, clip] of cm.clips) actions.set(name, cm.mixer.clipAction(clip));
  actions.get('idle')?.play();
  // carried Prep Tray in front of the chest
  const tray = new THREE.Group();
  tray.add(rbox(0.7, 0.05, 0.42, C.lightGray, 0.02));
  const trayTokens: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const tok = rbox(0.13, 0.13, 0.13, uniqueMat('#ffffff'), 0.04);
    tok.position.set(-0.25 + i * 0.165, 0.09, 0);
    tok.visible = false;
    tray.add(tok);
    trayTokens.push(tok);
  }
  tray.position.set(0, 0.8, 0.5);
  tray.visible = false;
  body.add(tray);
  const dummy = () => new THREE.Group();
  return {
    root, body, torso: dummy(), head: dummy(), armL: dummy(), armR: dummy(), legL: dummy(), legR: dummy(),
    tray, trayTokens, eyes: [], mouth: new THREE.Mesh(), anim: 'idle', t: Math.random() * 3, carry: 0,
    gl: { mixer: cm.mixer, actions, cur: 'idle' },
  };
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

/** Smooth turned shape from a (radius, y) profile, flattened front-to-back. */
function lathe(key: string, pts: [number, number][], color: string | THREE.Material, depth = 0.74): THREE.Mesh {
  const g = cached(`la${key}`, () => {
    const lg = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28);
    lg.scale(1, 1, depth);
    lg.computeVertexNormals();
    return lg;
  });
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color, { rough: 0.62 }) : color);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Partial sphere shell (hair caps, surgical caps): covers the top `theta` radians. */
function shell(r: number, theta: number, color: string): THREE.Mesh {
  const g = cached(`sh${r.toFixed(3)},${theta.toFixed(3)}`, () => new THREE.SphereGeometry(r, 30, 18, 0, Math.PI * 2, 0, theta));
  const m = new THREE.Mesh(g, mat(color, { rough: 0.55, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

function face(head: THREE.Group, look: HumanLook, r: number) {
  const eyes: THREE.Object3D[] = [];
  const brows: THREE.Object3D[] = [];
  const browColor = look.hairStyle === 'bald' || look.hairStyle === 'cap' ? '#4a3426' : look.hair;
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    const white = sph(r * 0.15, C.white, 14, false);
    white.scale.set(0.95, 1.2, 0.5);
    const iris = sph(r * 0.115, '#3b2a1e', 14, false);
    iris.scale.set(1, 1.18, 0.45);
    iris.position.set(s * -r * 0.012, -r * 0.012, r * 0.035);
    const pupil = sph(r * 0.06, '#120c08', 10, false);
    pupil.scale.set(1, 1.15, 0.4);
    pupil.position.set(s * -r * 0.012, -r * 0.01, r * 0.07);
    const glint = sph(r * 0.035, '#ffffff', 8, false);
    glint.position.set(r * 0.04, r * 0.06, r * 0.085);
    const glint2 = sph(r * 0.018, '#ffffff', 6, false);
    glint2.position.set(-r * 0.035, -r * 0.05, r * 0.08);
    eye.add(white, iris, pupil, glint, glint2);
    eye.position.set(s * r * 0.33, -r * 0.04, r * 0.895);
    eye.rotation.y = s * 0.28;
    head.add(eye);
    eyes.push(eye);
    const brow = capsule(r * 0.032, r * 0.17, browColor, false);
    brow.rotation.z = Math.PI / 2 + s * 0.14;
    brow.position.set(s * r * 0.34, r * 0.25, r * 0.88);
    head.add(brow);
    brows.push(brow);
    const cheek = new THREE.Mesh(cached('cheek', () => new THREE.CircleGeometry(r * 0.13, 16)), mat('#f08f86', { opacity: 0.42 }));
    cheek.scale.set(1.2, 0.7, 1);
    cheek.position.set(s * r * 0.55, -r * 0.24, r * 0.79);
    cheek.rotation.y = s * 0.6;
    head.add(cheek);
  }
  const nose = sph(r * 0.07, look.skin, 10, false);
  nose.scale.set(1.1, 0.8, 0.8);
  nose.position.set(0, -r * 0.13, r * 0.95);
  head.add(nose);
  const mouth = torus(r * 0.1, r * 0.026, '#9a3d3d', Math.PI);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -r * 0.3, r * 0.9);
  mouth.rotation.x = -0.35;
  head.add(mouth);
  return { eyes, mouth, brows };
}

function hair(head: THREE.Group, look: HumanLook, r: number) {
  if (look.hairStyle === 'bald') return;
  if (look.hairStyle === 'cap') {
    const col = look.capColor ?? C.blue;
    const cap = shell(r * 1.1, 1.72, col);
    cap.scale.set(1.04, 0.92, 1.06);
    cap.rotation.x = -0.5;
    cap.position.set(0, r * 0.08, -r * 0.06);
    head.add(cap);
    const puff = sph(r * 0.8, col, 18);
    puff.scale.set(1.2, 0.62, 1.15);
    puff.position.set(0, r * 0.68, -r * 0.2);
    head.add(puff);
    const band = torus(r * 1.0, r * 0.06, mat(col, { rough: 0.6 }));
    band.rotation.x = Math.PI / 2 - 0.5;
    band.position.set(0, r * 0.32, r * 0.05);
    band.scale.set(1.04, 1.06, 1);
    head.add(band);
    return;
  }
  const hc = look.hair;
  // main cap, tilted back so the hairline sits high on the forehead and low at the nape
  const cap = shell(r * 1.07, look.hairStyle === 'short' ? 1.62 : 1.85, hc);
  cap.rotation.x = -0.72;
  cap.position.set(0, r * 0.04, -r * 0.04);
  head.add(cap);
  // side-swept fringe
  const fr1 = sph(r * 0.5, hc, 16);
  fr1.scale.set(1.45, 0.55, 0.75);
  fr1.position.set(-r * 0.28, r * 0.6, r * 0.58);
  fr1.rotation.set(0.4, 0, 0.42);
  head.add(fr1);
  const fr2 = sph(r * 0.4, hc, 14);
  fr2.scale.set(1.3, 0.55, 0.7);
  fr2.position.set(r * 0.36, r * 0.62, r * 0.55);
  fr2.rotation.set(0.4, 0, -0.35);
  head.add(fr2);
  // side locks in front of the ears
  for (const s of [-1, 1]) {
    const lock = sph(r * 0.3, hc, 12);
    lock.scale.set(0.55, look.hairStyle === 'short' ? 0.9 : 1.35, 0.8);
    lock.position.set(s * r * 0.9, look.hairStyle === 'short' ? r * 0.2 : r * 0.05, r * 0.12);
    head.add(lock);
  }
  if (look.hairStyle === 'ponytail') {
    const tail = new THREE.Group();
    tail.position.set(0, r * 0.62, -r * 0.88);
    const tie = torus(r * 0.17, r * 0.075, look.tie ?? C.red);
    tie.rotation.x = 0.9;
    tail.add(tie);
    const segs: [number, number, number][] = [[0.3, -0.18, -0.2], [0.33, -0.55, -0.34], [0.27, -0.92, -0.36], [0.17, -1.2, -0.28]];
    for (const [rr, y, z] of segs) {
      const p = sph(r * rr, hc, 14);
      p.scale.set(1, 1.35, 1);
      p.position.set(0, r * y, r * z);
      tail.add(p);
    }
    tail.name = 'ponytail';
    head.add(tail);
  } else if (look.hairStyle === 'bun') {
    const bun = sph(r * 0.42, hc, 16);
    bun.position.set(0, r * 0.8, -r * 0.62);
    head.add(bun);
    const tie = torus(r * 0.3, r * 0.06, look.tie ?? '#e0b13a');
    tie.position.set(0, r * 0.62, -r * 0.5);
    tie.rotation.x = 1.0;
    head.add(tie);
  } else if (look.hairStyle === 'curly') {
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const b = sph(r * 0.32, hc, 10);
      b.position.set(Math.cos(a) * r * 0.82, r * 0.5 + Math.sin(i * 2.1) * r * 0.12, Math.sin(a) * r * 0.82 - r * 0.12);
      head.add(b);
    }
  }
}

export function makeHuman(look: HumanLook): Rig {
  const modelRig = makeModelRig(look);
  if (modelRig) return modelRig;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const s = look.scale ?? 1.12;
  body.scale.setScalar(s);
  const isYolanda = look === YOLANDA_LOOK;

  const hipY = 0.64;
  // legs (tapered scrub pants + rounded sneakers)
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.115, hipY, 0);
    const leg = lathe('leg', [[0, -0.6], [0.085, -0.6], [0.095, -0.5], [0.105, -0.2], [0.115, 0], [0.11, 0.06], [0, 0.08]], look.pants, 1);
    const shoe = sph(0.11, look.shoes, 14);
    shoe.scale.set(0.95, 0.62, 1.5);
    shoe.position.set(0, -0.62, 0.05);
    const sole = cyl(0.1, 0.1, 0.03, '#c9d3de', 14);
    sole.scale.set(0.95, 1, 1.5);
    sole.position.set(0, -0.655, 0.05);
    g.add(leg, shoe, sole);
    body.add(g);
    return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // torso: smooth scrub top, flared hem, rounded shoulders
  const torso = new THREE.Group();
  const top = lathe('top', [[0, -0.06], [0.24, -0.06], [0.265, 0.02], [0.245, 0.16], [0.25, 0.36], [0.255, 0.46], [0.2, 0.55], [0.1, 0.6], [0, 0.61]], look.top);
  top.position.y = hipY - 0.02;
  const hips = lathe('hips', [[0, -0.1], [0.215, -0.1], [0.235, 0], [0.235, 0.08], [0, 0.1]], look.pants);
  hips.position.y = hipY;
  torso.add(top, hips);
  // V-neck
  const v = new THREE.Mesh(cached('vneck', () => new THREE.CircleGeometry(0.1, 3)), mat(look.skin));
  v.rotation.z = -Math.PI / 2;
  v.scale.set(1.1, 0.7, 1);
  v.position.set(0, hipY + 0.5, 0.168);
  v.rotation.x = -0.25;
  torso.add(v);
  if (look.badge) {
    const badge = rbox(0.09, 0.12, 0.02, C.white, 0.015, false);
    badge.position.set(0.12, hipY + 0.34, 0.185);
    const stripe = rbox(0.09, 0.03, 0.022, C.blueDeep, 0.005, false);
    stripe.position.set(0.12, hipY + 0.38, 0.186);
    const lanyard = tube([new THREE.Vector3(0.08, hipY + 0.54, 0.15), new THREE.Vector3(0.11, hipY + 0.47, 0.18), new THREE.Vector3(0.12, hipY + 0.41, 0.187)], 0.008, look.tie ?? C.blueDeep);
    torso.add(badge, stripe, lanyard);
    const pocket = rbox(0.12, 0.09, 0.02, new THREE.Color(look.top).multiplyScalar(0.85).getStyle(), 0.02, false);
    pocket.position.set(-0.12, hipY + 0.3, 0.182);
    const pen = cyl(0.012, 0.012, 0.07, C.blueDeep, 6, false);
    pen.position.set(-0.09, hipY + 0.35, 0.186);
    torso.add(pocket, pen);
  }
  body.add(torso);

  // arms
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.27, hipY + 0.49, 0);
    const sleeve = lathe('sleeve', [[0, 0.06], [0.1, 0.04], [0.105, -0.08], [0.092, -0.17], [0, -0.17]], look.top, 1);
    const arm = capsule(0.062, 0.3, look.skin);
    arm.position.y = -0.27;
    const hand = sph(0.085, look.skin, 14);
    hand.scale.set(0.9, 1.05, 0.9);
    hand.position.y = -0.47;
    g.add(sleeve, arm, hand);
    g.rotation.z = side * 0.1;
    body.add(g);
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // head
  const head = new THREE.Group();
  const r = 0.39; // big friendly head
  head.position.y = hipY + 0.6 + r * 0.82;
  const neck = cyl(0.065, 0.075, 0.16, look.skin, 12);
  neck.position.y = -r * 0.86;
  const hd = makeHead(look, r);
  head.add(neck, hd.head);
  const { eyes, mouth } = hd;
  if (look.mask) {
    const mask = sph(r * 0.6, '#a9d8ea', 18);
    mask.scale.set(1.28, 0.78, 0.62);
    mask.position.set(0, -r * 0.38, r * 0.6);
    head.add(mask);
    for (const sd of [-1, 1]) {
      const strap = torus(r * 0.5, r * 0.02, '#e8f4fa', Math.PI * 0.6);
      strap.rotation.set(0, sd * Math.PI / 2, 0.2);
      strap.position.set(sd * r * 0.82, -r * 0.1, r * 0.1);
      head.add(strap);
    }
    mouth.visible = false;
  }
  body.add(head);

  // tray (carry prop)
  const tray = new THREE.Group();
  const plate = rbox(0.62, 0.04, 0.36, C.lightGray, 0.02);
  tray.add(plate);
  const trayTokens: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const tok = rbox(0.12, 0.12, 0.12, uniqueMat('#ffffff'), 0.035);
    tok.position.set(-0.22 + i * 0.145, 0.08, 0);
    tok.visible = false;
    tray.add(tok);
    trayTokens.push(tok);
  }
  tray.position.set(0, hipY + 0.26, 0.42);
  tray.visible = false;
  body.add(tray);

  // tablet in the right hand (Yolanda's signature prop)
  if (isYolanda) {
    const tablet = new THREE.Group();
    tablet.add(rbox(0.24, 0.33, 0.035, '#24384f', 0.03));
    const glow = rbox(0.19, 0.26, 0.01, '#7fd8ff', 0.01, false);
    glow.position.z = 0.02;
    tablet.add(glow);
    tablet.position.set(0.02, -0.47, 0.11);
    tablet.rotation.set(-0.3, 0, 0.1);
    tablet.name = 'tablet';
    armR.add(tablet);
  }

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });

  return { root, body, torso, head, armL, armR, legL, legR, tray, trayTokens, eyes, mouth, anim: 'idle', t: 0, carry: 0 };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Procedural animation. Called every frame. */
export function animateRig(rig: Rig, dt: number, carrying: boolean): void {
  rig.t += dt;
  if (rig.gl) {
    const gl = rig.gl;
    let want = CLIP_FOR[rig.anim] ?? 'idle';
    const holding = carrying && (rig.anim === 'idle' || rig.anim === 'wait');
    if (holding) want = 'holding-both';
    if (!gl.actions.has(want)) want = 'idle';
    if (want !== gl.cur) {
      const next = gl.actions.get(want)!;
      const prev = gl.actions.get(gl.cur);
      next.reset().setEffectiveWeight(1).fadeIn(0.18).play();
      prev?.fadeOut(0.18);
      gl.cur = want;
    }
    gl.mixer.update(dt);
    rig.carry = carrying ? 1 : 0;
    rig.tray.visible = carrying && (rig.anim === 'walk' || rig.anim === 'idle' || rig.anim === 'wait');
    return;
  }
  const t = rig.t;
  const a = rig.anim;
  rig.carry = lerp(rig.carry, carrying && a !== 'push' ? 1 : 0, Math.min(1, dt * 8));
  const k = Math.min(1, dt * 12);

  let legL = 0, legR = 0, armLx = 0, armRx = 0, armLz = -0.08, armRz = 0.08, bob = 0, headX = 0, headY = 0, lean = 0;

  switch (a) {
    case 'walk': {
      const w = t * 9.5;
      legL = Math.sin(w) * 0.55; legR = -legL;
      armLx = -Math.sin(w) * 0.5; armRx = -armLx;
      bob = Math.abs(Math.cos(w)) * 0.05;
      lean = 0.06;
      break;
    }
    case 'push': {
      const w = t * 7;
      legL = Math.sin(w) * 0.45; legR = -legL;
      armLx = armRx = -1.25; armLz = -0.25; armRz = 0.25;
      bob = Math.abs(Math.cos(w)) * 0.03;
      lean = 0.18;
      break;
    }
    case 'interact':
    case 'machine': {
      armLx = -1.0 + Math.sin(t * 7) * 0.18;
      armRx = -1.15 + Math.sin(t * 7 + 1.4) * 0.22;
      headX = 0.25; lean = 0.08;
      break;
    }
    case 'drawer': {
      armRx = -0.9 + Math.sin(t * 3) * 0.3; armLx = -0.3;
      headX = 0.3; lean = 0.12;
      break;
    }
    case 'monitor': {
      armRx = -1.6 + Math.sin(t * 6) * 0.1; armLx = -0.2;
      headX = -0.05; headY = Math.sin(t * 1.3) * 0.15;
      break;
    }
    case 'chart': {
      armLx = -1.1; armRx = -0.9 + Math.sin(t * 9) * 0.08; armLz = 0.25; armRz = -0.3;
      headX = 0.35 + Math.sin(t * 1.7) * 0.05;
      break;
    }
    case 'talk': {
      armRx = -0.6 + Math.sin(t * 4) * 0.35; armRz = 0.3 + Math.sin(t * 2.3) * 0.2;
      armLx = -0.25;
      headX = Math.sin(t * 3) * 0.08; headY = Math.sin(t * 1.4) * 0.2;
      break;
    }
    case 'handoff': {
      armRx = -1.1 + Math.sin(t * 3) * 0.2; armRz = 0.2;
      armLx = -0.4;
      headY = Math.sin(t * 2) * 0.15; headX = Math.sin(t * 4) * 0.05;
      break;
    }
    case 'wait': {
      armLx = -0.2; armRx = -0.2; armLz = -0.35; armRz = 0.35;
      headY = Math.sin(t * 0.8) * 0.4;
      bob = Math.sin(t * 2) * 0.008;
      break;
    }
    case 'cheer': {
      const w = t * 7;
      armLx = armRx = -2.7 + Math.sin(w) * 0.25;
      armLz = -0.35 - Math.sin(w) * 0.2; armRz = 0.35 + Math.sin(w) * 0.2;
      bob = Math.max(0, Math.sin(w)) * 0.22;
      legL = legR = -Math.max(0, Math.sin(w)) * 0.25;
      headX = -0.2;
      break;
    }
    default: { // idle
      bob = Math.sin(t * 2.2) * 0.012;
      armLx = Math.sin(t * 1.1) * 0.04; armRx = -armLx;
      headY = Math.sin(t * 0.6) * 0.12;
    }
  }

  // carry overrides arms (both forward holding the tray)
  if (rig.carry > 0.01 && (a === 'walk' || a === 'idle' || a === 'wait')) {
    armLx = lerp(armLx, -1.05, rig.carry); armRx = lerp(armRx, -1.05, rig.carry);
    armLz = lerp(armLz, -0.3, rig.carry); armRz = lerp(armRz, 0.3, rig.carry);
  }
  rig.tray.visible = rig.carry > 0.5 && (a === 'walk' || a === 'idle' || a === 'wait');
  const tab = rig.armR.getObjectByName('tablet');
  if (tab && tab.userData.allowed !== false) tab.visible = !rig.tray.visible && a !== 'push' && a !== 'machine' && a !== 'interact';

  rig.legL.rotation.x = lerp(rig.legL.rotation.x, legL, k);
  rig.legR.rotation.x = lerp(rig.legR.rotation.x, legR, k);
  rig.armL.rotation.x = lerp(rig.armL.rotation.x, armLx, k);
  rig.armR.rotation.x = lerp(rig.armR.rotation.x, armRx, k);
  rig.armL.rotation.z = lerp(rig.armL.rotation.z, armLz, k);
  rig.armR.rotation.z = lerp(rig.armR.rotation.z, armRz, k);
  rig.head.rotation.x = lerp(rig.head.rotation.x, headX, k);
  rig.head.rotation.y = lerp(rig.head.rotation.y, headY, k);
  rig.body.position.y = bob;
  rig.body.rotation.x = lerp(rig.body.rotation.x, lean, k);
  const tail = rig.head.getObjectByName('ponytail');
  if (tail) tail.rotation.x = Math.sin(t * (a === 'walk' ? 9.5 : 2)) * (a === 'walk' ? 0.25 : 0.05) + 0.1;

  // blink
  const blink = (t % 3.7) < 0.12 ? 0.1 : 1;
  for (const e of rig.eyes) e.scale.y = blink;
}

// ------------------------------------------------------------------ patient in bed

export interface PatientRig {
  root: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Object3D[];
  mouth: THREE.Mesh;
  brows: THREE.Object3D[];
  blanket: THREE.Mesh;
  warmBlanket: THREE.Mesh;
  /** Surgical drape (OR cases, during surgery). */
  drape: THREE.Mesh;
  state: 'awake' | 'anxious' | 'asleep' | 'stirring' | 'happy';
  t: number;
  monitored: THREE.Group;
  /** Rising "z" sprites shown while sedated. */
  zzz?: THREE.Sprite[];
}

/** A patient lying on their back, head toward local +x. */
function makeModelPatient(look: { skin: string; gown: string; model?: string }): PatientRig | null {
  const name = look.model as ModelName | undefined;
  if (!name || !hasModel(name)) return null;
  const cm = character(name, { top: look.gown, pants: look.gown, shoes: '#e9eef3' }, 1.6);
  if (!cm) return null;
  // freeze in the first idle frame (arms down) and lay the figure on its back, head toward +x
  const idle = cm.clips.get('idle');
  if (idle) { const act = cm.mixer.clipAction(idle); act.play(); cm.mixer.update(0); act.paused = true; }
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  pivot.position.set(-0.95, 0.22, 0);
  pivot.add(cm.object);
  root.add(pivot);
  const blanket = rbox(1.15, 0.2, 0.95, C.blueLight, 0.08);
  blanket.position.set(-0.5, 0.42, 0);
  const warmBlanket = rbox(1.0, 0.22, 1.0, '#f2b880', 0.08);
  warmBlanket.position.set(-0.4, 0.46, 0);
  warmBlanket.visible = false;
  const drape = rbox(1.5, 0.24, 1.25, '#2fae9d', 0.08);
  drape.position.set(-0.3, 0.5, 0);
  drape.visible = false;
  const monitored = new THREE.Group();
  const clip = rbox(0.12, 0.09, 0.12, C.red, 0.03, false);
  clip.position.set(0.2, 0.6, 0.48);
  const lead = tube([new THREE.Vector3(0.2, 0.6, 0.48), new THREE.Vector3(0.4, 0.75, 0.75), new THREE.Vector3(0.8, 0.9, 0.7)], 0.02, C.teal);
  monitored.add(clip, lead);
  monitored.visible = false;
  root.add(blanket, warmBlanket, drape, monitored);
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { root, head: pivot, eyes: [], mouth: new THREE.Mesh(), brows: [], blanket, warmBlanket, drape, state: 'awake', t: 0, monitored };
}

/** Head with hair and face, shared by standing and lying people. Face toward +z. */
function makeHead(look: HumanLook, r: number) {
  const head = new THREE.Group();
  const skull = sph(r, look.skin, 28);
  skull.scale.set(1.03, 0.97, 0.96);
  const jaw = sph(r * 0.8, look.skin, 20);
  jaw.scale.set(1.08, 0.72, 0.98);
  jaw.position.set(0, -r * 0.2, r * 0.08);
  head.add(skull, jaw);
  for (const sd of [-1, 1]) {
    const ear = sph(r * 0.16, look.skin, 10);
    ear.scale.set(0.45, 1, 0.75);
    ear.position.set(sd * r * 0.98, -r * 0.05, 0);
    head.add(ear);
  }
  hair(head, look, r);
  const f = face(head, look, r);
  return { head, ...f };
}

export function makeLyingPatient(look: { skin: string; hair: string; gown: string; hairStyle: string; model?: string }): PatientRig {
  const mp = makeModelPatient(look);
  if (mp) return mp;
  const root = new THREE.Group();
  root.scale.setScalar(1.12);
  // pillow
  const pillow = rbox(0.5, 0.14, 0.78, '#ffffff', 0.07);
  pillow.position.set(0.86, 0.1, 0);
  root.add(pillow);
  // body in a gown, lying along x (head toward +x)
  const body = lathe('ptorso', [[0, -0.75], [0.2, -0.75], [0.27, -0.55], [0.28, -0.1], [0.3, 0.3], [0.25, 0.5], [0.12, 0.56], [0, 0.57]], look.gown, 0.62);
  body.rotation.z = -Math.PI / 2;
  body.position.set(-0.05, 0.2, 0);
  body.scale.set(0.55, 1, 1); // flatten front-to-back (local x is world up after the roll)
  root.add(body);
  const blanket = rbox(1.45, 0.18, 0.88, C.blueLight, 0.08);
  blanket.position.set(-0.38, 0.29, 0);
  const fold = rbox(0.18, 0.2, 0.92, '#ffffff', 0.07);
  fold.position.set(0.66, 0.02, 0);
  blanket.add(fold);
  root.add(blanket);
  const warmBlanket = rbox(1.0, 0.2, 0.9, '#f2b880', 0.08);
  warmBlanket.position.set(-0.25, 0.34, 0);
  warmBlanket.visible = false;
  root.add(warmBlanket);
  const drape = rbox(1.6, 0.22, 1.25, '#2fae9d', 0.08);
  drape.position.set(-0.25, 0.36, 0);
  drape.visible = false;
  root.add(drape);
  // arms resting on the blanket, hands on the belly
  for (const s of [-1, 1]) {
    const sleeve = sph(0.11, look.gown, 12);
    sleeve.scale.set(1.3, 0.9, 1);
    sleeve.position.set(0.48, 0.34, s * 0.31);
    const arm = capsule(0.06, 0.3, look.skin);
    arm.rotation.set(0, s * 0.12, Math.PI / 2);
    arm.position.set(0.2, 0.42, s * 0.3);
    const hand = sph(0.075, look.skin, 12);
    hand.position.set(-0.01, 0.43, s * 0.27);
    root.add(sleeve, arm, hand);
  }
  const r = 0.32;
  const pivot = new THREE.Group();
  pivot.position.set(0.82, 0.36, 0);
  const { head, eyes, mouth, brows } = makeHead({ skin: look.skin, hair: look.hair, hairStyle: look.hairStyle as HumanLook['hairStyle'], top: look.gown, pants: look.gown, shoes: '#fff' }, r);
  pivot.add(head);
  // face points up (toward +y): rotate head so its +z faces +y, top toward +x
  pivot.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  root.add(pivot);

  // monitoring leads (visible once monitors applied)
  const monitored = new THREE.Group();
  const lead = tube([new THREE.Vector3(0.3, 0.36, 0.12), new THREE.Vector3(0.45, 0.5, 0.45), new THREE.Vector3(0.7, 0.55, 0.62)], 0.015, C.teal);
  const clip = rbox(0.1, 0.07, 0.08, C.red, 0.03, false);
  clip.position.set(-0.08, 0.45, 0.17);
  const sticker = cyl(0.05, 0.05, 0.02, '#ffffff', 10, false);
  sticker.position.set(0.3, 0.36, 0.12);
  monitored.add(lead, clip, sticker);
  monitored.visible = false;
  root.add(monitored);

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  const zzz = [0, 1, 2].map(() => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture(), transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    sp.renderOrder = 5;
    root.add(sp);
    return sp;
  });
  return { root, head: pivot, eyes, mouth, brows, blanket, warmBlanket, drape, state: 'awake', t: 0, monitored, zzz };
}

let zTex: THREE.CanvasTexture | null = null;
function zTexture(): THREE.CanvasTexture {
  if (zTex) return zTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  const ctx = cv.getContext('2d')!;
  ctx.font = '900 76px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2b5fb4';
  ctx.strokeText('Z', 48, 52);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Z', 48, 52);
  zTex = new THREE.CanvasTexture(cv);
  zTex.colorSpace = THREE.SRGBColorSpace;
  return zTex;
}

export function animatePatient(p: PatientRig, dt: number): void {
  p.t += dt;
  const t = p.t;
  const asleep = p.state === 'asleep';
  const blink = !asleep && (t % 4.1) < 0.14;
  for (const e of p.eyes) e.scale.y = asleep || blink ? 0.12 : 1.1;
  const anxious = p.state === 'anxious' || p.state === 'stirring';
  p.brows.forEach((b, i) => { const base = (b.userData.rz ??= b.rotation.z) as number; b.rotation.z = base + (anxious ? (i ? -0.35 : 0.35) : 0); });
  p.mouth.rotation.z = anxious ? 0 : Math.PI;
  p.mouth.position.y = anxious ? -0.11 : -0.096;
  p.mouth.visible = !asleep;
  if (p.zzz) {
    p.zzz.forEach((sp, i) => {
      const k = (t * 0.45 + i / 3) % 1;
      sp.visible = asleep;
      sp.position.set(0.95 + k * 0.3, 0.75 + k * 0.85, 0.05 + Math.sin(k * 6 + i) * 0.06);
      sp.scale.setScalar(0.22 + k * 0.3);
      (sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.95;
    });
  }
  // breathing
  p.blanket.scale.y = 1 + Math.sin(t * (asleep ? 1.6 : 2.4)) * 0.06;
  if (p.eyes.length) {
    if (p.state === 'stirring') p.head.rotation.y = Math.sin(t * 5) * 0.15;
    else p.head.rotation.y = 0;
  } else {
    p.root.position.y = p.state === 'stirring' ? Math.abs(Math.sin(t * 6)) * 0.05 : 0;
  }
}

export function tintTrayToken(m: THREE.Mesh, color: string | null): void {
  if (!color) { m.visible = false; return; }
  m.visible = true;
  (m.material as THREE.MeshStandardMaterial).color.set(color);
}

export { at };
