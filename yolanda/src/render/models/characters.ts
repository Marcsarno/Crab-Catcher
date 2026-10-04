import * as THREE from 'three';
import { C, at, capsule, mat, rbox, sph, torus, cyl, uniqueMat } from '../palette';
import type { AnimName } from '../../core/types';

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
}

export const YOLANDA_LOOK: HumanLook = {
  skin: '#f0c39c', hair: '#8a6239', hairStyle: 'ponytail', top: C.teal, pants: '#23968f',
  shoes: '#f4f6f8', badge: true, tie: '#e05656',
};

function face(head: THREE.Group, look: HumanLook, r: number) {
  const eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    const white = sph(r * 0.17, C.white, 12, false);
    white.scale.set(1, 1.15, 0.6);
    const pupil = sph(r * 0.12, C.black, 12, false);
    pupil.position.z = r * 0.06;
    pupil.scale.set(1, 1.15, 0.6);
    const glint = sph(r * 0.035, '#ffffff', 6, false);
    glint.position.set(r * 0.04, r * 0.05, r * 0.12);
    eye.add(white, pupil, glint);
    eye.position.set(s * r * 0.36, r * 0.08, r * 0.9);
    head.add(eye);
    eyes.push(eye);
    const brow = rbox(r * 0.3, r * 0.06, r * 0.06, look.hairStyle === 'bald' ? '#6b4a33' : look.hair, 0.01, false);
    brow.position.set(s * r * 0.36, r * 0.36, r * 0.9);
    brow.rotation.z = s * -0.12;
    head.add(brow);
    const cheek = sph(r * 0.12, '#f2a39a', 8, false);
    cheek.scale.set(1, 0.6, 0.3);
    cheek.position.set(s * r * 0.56, -r * 0.16, r * 0.8);
    (cheek.material as THREE.MeshStandardMaterial) = mat('#f2a39a', { opacity: 0.55 });
    head.add(cheek);
  }
  const nose = sph(r * 0.09, look.skin, 8, false);
  nose.position.set(0, -r * 0.08, r * 0.98);
  head.add(nose);
  const mouth = torus(r * 0.16, r * 0.035, '#8c3b3b', Math.PI);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -r * 0.32, r * 0.92);
  head.add(mouth);
  return { eyes, mouth };
}

function hair(head: THREE.Group, look: HumanLook, r: number) {
  const hm = mat(look.hair);
  if (look.hairStyle === 'bald') return;
  if (look.hairStyle === 'cap') {
    const cap = sph(r * 1.06, look.capColor ?? C.blue, 18);
    cap.scale.set(1, 0.72, 1);
    cap.position.y = r * 0.3;
    head.add(cap);
    const band = cyl(r * 1.04, r * 1.04, r * 0.18, look.capColor ?? C.blue, 18);
    band.position.y = r * 0.25;
    head.add(band);
    return;
  }
  const cap = sph(r * 1.07, hm, 18);
  cap.scale.set(1, 0.85, 1);
  cap.position.set(0, r * 0.22, -r * 0.08);
  head.add(cap);
  // fringe
  const fringe = sph(r * 0.62, hm, 12);
  fringe.scale.set(1.5, 0.5, 0.6);
  fringe.position.set(-r * 0.15, r * 0.62, r * 0.55);
  fringe.rotation.z = 0.2;
  head.add(fringe);
  if (look.hairStyle === 'ponytail') {
    const tie = torus(r * 0.16, r * 0.07, look.tie ?? C.red);
    tie.position.set(0, r * 0.45, -r * 1.0);
    tie.rotation.x = 0.4;
    head.add(tie);
    const tail = new THREE.Group();
    tail.position.set(0, r * 0.45, -r * 1.05);
    const p1 = sph(r * 0.3, hm, 12);
    p1.scale.set(1.05, 1.5, 1.05);
    p1.position.set(0, -r * 0.2, -r * 0.12);
    const p2 = sph(r * 0.24, hm, 12);
    p2.scale.set(1.0, 1.6, 1.0);
    p2.position.set(0, -r * 0.62, -r * 0.18);
    tail.add(p1, p2);
    tail.name = 'ponytail';
    head.add(tail);
  } else if (look.hairStyle === 'bun') {
    const bun = sph(r * 0.38, hm, 12);
    bun.position.set(0, r * 0.75, -r * 0.6);
    head.add(bun);
  } else if (look.hairStyle === 'curly') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const b = sph(r * 0.3, hm, 8);
      b.position.set(Math.cos(a) * r * 0.75, r * 0.55 + Math.sin(i * 2.1) * r * 0.1, Math.sin(a) * r * 0.75 - r * 0.1);
      head.add(b);
    }
  }
  // sides
  for (const s of [-1, 1]) {
    const side = sph(r * 0.4, hm, 10);
    side.scale.set(0.5, 1.1, 0.9);
    side.position.set(s * r * 0.88, r * 0.05, -r * 0.15);
    head.add(side);
  }
}

export function makeHuman(look: HumanLook): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const s = look.scale ?? 1.15;
  body.scale.setScalar(s);

  const hipY = 0.72;
  // legs
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.13, hipY, 0);
    const leg = capsule(0.105, 0.42, look.pants);
    leg.position.y = -0.3;
    const shoe = rbox(0.2, 0.12, 0.3, look.shoes, 0.05);
    shoe.position.set(0, -0.66, 0.05);
    g.add(leg, shoe);
    body.add(g);
    return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // torso (scrub top, slightly flared)
  const torso = new THREE.Group();
  const top = rbox(0.5, 0.58, 0.32, look.top, 0.13);
  top.position.y = hipY + 0.27;
  const hips = rbox(0.46, 0.2, 0.3, look.pants, 0.09);
  hips.position.y = hipY + 0.02;
  torso.add(top, hips);
  // V-neck
  const v = rbox(0.16, 0.12, 0.02, look.skin, 0.02, false);
  v.position.set(0, hipY + 0.5, 0.16);
  v.rotation.z = Math.PI / 4;
  torso.add(v);
  if (look.badge) {
    const badge = rbox(0.1, 0.13, 0.02, C.white, 0.015, false);
    badge.position.set(0.13, hipY + 0.36, 0.165);
    const stripe = rbox(0.1, 0.03, 0.022, C.blueDeep, 0.005, false);
    stripe.position.set(0.13, hipY + 0.4, 0.166);
    const clip = rbox(0.03, 0.04, 0.025, C.midGray, 0.005, false);
    clip.position.set(0.13, hipY + 0.44, 0.166);
    torso.add(badge, stripe, clip);
    // pocket
    const pocket = rbox(0.13, 0.1, 0.02, '#239a92', 0.02, false);
    pocket.position.set(-0.13, hipY + 0.34, 0.163);
    torso.add(pocket);
  }
  body.add(torso);

  // arms
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.31, hipY + 0.5, 0);
    const sleeve = sph(0.12, look.top, 12);
    sleeve.scale.set(1, 0.9, 1);
    const arm = capsule(0.068, 0.36, look.skin);
    arm.position.y = -0.26;
    const hand = sph(0.095, look.skin, 12);
    hand.position.y = -0.5;
    g.add(sleeve, arm, hand);
    g.rotation.z = side * 0.08;
    body.add(g);
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // head
  const head = new THREE.Group();
  const r = 0.34; // big friendly head
  head.position.y = hipY + 0.62 + r * 0.9;
  const neck = cyl(0.07, 0.08, 0.14, look.skin, 10);
  neck.position.y = -r * 0.95;
  const skull = sph(r, look.skin, 22);
  skull.scale.set(1, 0.98, 0.95);
  head.add(neck, skull);
  for (const sd of [-1, 1]) {
    const ear = sph(r * 0.17, look.skin, 8);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(sd * r * 0.95, 0, 0);
    head.add(ear);
  }
  hair(head, look, r);
  const { eyes, mouth } = face(head, look, r);
  if (look.mask) {
    const mask = sph(r * 0.62, '#9fd3e8', 14);
    mask.scale.set(1.25, 0.75, 0.55);
    mask.position.set(0, -r * 0.25, r * 0.7);
    head.add(mask);
    mouth.visible = false;
  }
  if (look.hairStyle === 'cap' || look.capColor) {
    // already handled by hair()
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
  tray.position.set(0, hipY + 0.28, 0.42);
  tray.visible = false;
  body.add(tray);

  // tablet in the right hand (Yolanda's signature prop)
  const tablet = new THREE.Group();
  tablet.add(rbox(0.26, 0.36, 0.04, '#24384f', 0.03));
  const glow = rbox(0.21, 0.29, 0.01, '#7fd8ff', 0.01, false);
  glow.position.z = 0.022;
  tablet.add(glow);
  tablet.position.set(0.02, -0.5, 0.12);
  tablet.rotation.set(-0.3, 0, 0.1);
  tablet.name = 'tablet';
  tablet.visible = !!look.badge && look.hairStyle === 'ponytail';
  armR.add(tablet);

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });

  return { root, body, torso, head, armL, armR, legL, legR, tray, trayTokens, eyes, mouth, anim: 'idle', t: 0, carry: 0 };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Procedural animation. Called every frame. */
export function animateRig(rig: Rig, dt: number, carrying: boolean): void {
  rig.t += dt;
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
}

/** A patient lying on their back, head toward local +x. */
export function makeLyingPatient(look: { skin: string; hair: string; gown: string; hairStyle: string }): PatientRig {
  const root = new THREE.Group();
  root.scale.setScalar(1.12);
  const body = rbox(1.5, 0.3, 0.62, look.gown, 0.14);
  body.position.set(-0.1, 0.15, 0);
  root.add(body);
  const blanket = rbox(1.25, 0.18, 0.78, C.blueLight, 0.08);
  blanket.position.set(-0.42, 0.26, 0);
  root.add(blanket);
  const warmBlanket = rbox(1.0, 0.2, 0.82, '#f2b880', 0.08);
  warmBlanket.position.set(-0.25, 0.3, 0);
  warmBlanket.visible = false;
  root.add(warmBlanket);
  const drape = rbox(1.6, 0.22, 1.25, '#2fae9d', 0.08);
  drape.position.set(-0.25, 0.32, 0);
  drape.visible = false;
  root.add(drape);
  for (const s of [-1, 1]) {
    const arm = capsule(0.07, 0.5, look.skin);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.25, 0.36, s * 0.36);
    root.add(arm);
  }
  const pivot = new THREE.Group();
  pivot.position.set(0.85, 0.3, 0);
  const head = new THREE.Group();
  pivot.add(head);
  const r = 0.31;
  const skull = sph(r, look.skin, 20);
  head.add(skull);
  const hm = mat(look.hair);
  if (look.hairStyle !== 'bald') {
    const capH = sph(r * 1.06, hm, 16);
    capH.scale.set(1, 0.85, 1);
    capH.position.set(0, r * 0.25, -r * 0.1);
    head.add(capH);
    if (look.hairStyle === 'bun') { const b = sph(r * 0.35, hm, 10); b.position.set(0, r * 0.4, -r * 0.95); head.add(b); }
    if (look.hairStyle === 'curly') {
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const b = sph(r * 0.28, hm, 8); b.position.set(Math.cos(a) * r * 0.75, r * 0.5, Math.sin(a) * r * 0.7 - r * 0.15); head.add(b); }
    }
  }
  const eyes: THREE.Object3D[] = [];
  const brows: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = sph(r * 0.13, C.black, 10, false);
    e.scale.set(1, 1.1, 0.5);
    e.position.set(s * r * 0.36, r * 0.05, r * 0.92);
    head.add(e);
    eyes.push(e);
    const brow = rbox(r * 0.3, r * 0.06, r * 0.05, look.hairStyle === 'bald' ? '#5a4030' : look.hair, 0.01, false);
    brow.position.set(s * r * 0.36, r * 0.32, r * 0.9);
    head.add(brow);
    brows.push(brow);
  }
  const mouth = torus(r * 0.15, r * 0.035, '#8c3b3b', Math.PI);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -r * 0.35, r * 0.9);
  head.add(mouth);
  // face points up (toward +y): rotate head so its +z faces +y, top toward +x
  pivot.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  root.add(pivot);

  // monitoring leads (visible once monitors applied)
  const monitored = new THREE.Group();
  const lead = rbox(0.2, 0.03, 0.2, C.teal, 0.02, false);
  lead.position.set(0.35, 0.33, 0);
  const clip = rbox(0.1, 0.08, 0.1, C.red, 0.03, false);
  clip.position.set(0.25, 0.42, 0.42);
  monitored.add(lead, clip);
  monitored.visible = false;
  root.add(monitored);

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { root, head, eyes, mouth, brows, blanket, warmBlanket, drape, state: 'awake', t: 0, monitored };
}

export function animatePatient(p: PatientRig, dt: number): void {
  p.t += dt;
  const t = p.t;
  const asleep = p.state === 'asleep';
  const blink = !asleep && (t % 4.1) < 0.14;
  for (const e of p.eyes) e.scale.y = asleep || blink ? 0.12 : 1.1;
  const anxious = p.state === 'anxious' || p.state === 'stirring';
  p.brows.forEach((b, i) => { b.rotation.z = anxious ? (i ? 0.35 : -0.35) : 0; });
  p.mouth.rotation.z = anxious ? 0 : Math.PI;
  p.mouth.position.y = anxious ? -0.12 : -0.095;
  p.mouth.visible = !asleep;
  // breathing
  p.blanket.scale.y = 1 + Math.sin(t * (asleep ? 1.6 : 2.4)) * 0.06;
  if (p.state === 'stirring') p.head.rotation.y = Math.sin(t * 5) * 0.15;
  else p.head.rotation.y = 0;
}

export function tintTrayToken(m: THREE.Mesh, color: string | null): void {
  if (!color) { m.visible = false; return; }
  m.visible = true;
  (m.material as THREE.MeshStandardMaterial).color.set(color);
}

export { at };
