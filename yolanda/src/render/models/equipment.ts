import * as THREE from 'three';
import { C, at, capsule, cyl, group, mat, rbox, screenMesh, sph, textPlane, torus, tube, uniqueMat } from '../palette';

// Stylized, silhouette-first medical equipment. Every model faces +z (toward the
// camera) and sits centered on its footprint. Animated bits go in userData.

export interface StationModel extends THREE.Group {
  userData: {
    status?: THREE.MeshStandardMaterial;   // status light (idle / running / ready)
    drawers?: THREE.Group[];
    screen?: THREE.Mesh;
    spinner?: THREE.Object3D;
    bed?: THREE.Group;
    patientMount?: THREE.Group;
    monitorScreen?: THREE.Mesh;
  };
}

function wheels(g: THREE.Group, w: number, d: number, y = 0.07) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = cyl(0.07, 0.07, 0.06, C.darkGray, 12);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx * (w / 2 - 0.1), y, sz * (d / 2 - 0.1));
    g.add(wh);
  }
}

function statusLight(g: THREE.Group, x: number, y: number, z: number): THREE.MeshStandardMaterial {
  const m = uniqueMat(C.midGray, { emissive: '#000000' });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), m);
  bulb.position.set(x, y, z);
  const base = cyl(0.09, 0.1, 0.05, C.navy, 12);
  base.position.set(x, y - 0.06, z);
  g.add(base, bulb);
  return m;
}

function drawerFronts(g: THREE.Group, w: number, h: number, z: number, n: number, color: string, y0: number) {
  const dh = h / n;
  for (let i = 0; i < n; i++) {
    const f = rbox(w - 0.08, dh - 0.05, 0.05, color, 0.03, false);
    f.position.set(0, y0 + dh * (i + 0.5), z);
    const hnd = rbox(w * 0.32, 0.035, 0.04, C.white, 0.015, false);
    hnd.position.set(0, y0 + dh * (i + 0.5) + dh * 0.2, z + 0.04);
    g.add(f, hnd);
  }
}

// ------------------------------------------------------------------ stations

export function makeChartDesk(): StationModel {
  const g = new THREE.Group() as StationModel;
  const top = at(rbox(2.3, 0.08, 1.1, C.wood, 0.03), 0, 0.8, 0);
  const ped = at(rbox(0.6, 0.76, 0.95, C.blue, 0.05), -0.75, 0.38, 0);
  drawerFronts(g, 0.6, 0.7, 0.49, 3, C.blueLight, 0.04);
  g.children.slice(-6).forEach((c) => (c.position.x = -0.75));
  const leg = at(rbox(0.08, 0.76, 0.9, C.lightGray, 0.03), 1.05, 0.38, 0);
  const mon = group(
    at(rbox(0.95, 0.62, 0.07, C.navy, 0.05), 0, 0, 0),
    at(screenMesh(0.84, 0.52, 'chart'), 0, 0, 0.04),
  );
  mon.position.set(0.2, 1.33, -0.2);
  mon.rotation.x = -0.08;
  const stand = at(cyl(0.04, 0.05, 0.2, C.midGray, 8), 0.2, 0.95, -0.25);
  const foot = at(rbox(0.32, 0.03, 0.2, C.midGray, 0.01), 0.2, 0.85, -0.25);
  const kb = at(rbox(0.6, 0.03, 0.2, C.lightGray, 0.01), 0.2, 0.86, 0.22);
  const clip = at(rbox(0.32, 0.03, 0.42, C.yellow, 0.01), -0.7, 0.86, 0.15);
  clip.rotation.y = 0.3;
  const paper = at(rbox(0.26, 0.032, 0.32, C.white, 0.005, false), -0.7, 0.87, 0.17);
  paper.rotation.y = 0.3;
  const cup = at(cyl(0.07, 0.06, 0.16, C.teal, 12), 0.9, 0.92, -0.25);
  const pens = group(at(cyl(0.012, 0.012, 0.18, C.red, 6), 0.88, 1.02, -0.25), at(cyl(0.012, 0.012, 0.2, C.blueDeep, 6), 0.92, 1.03, -0.24));
  // chair tucked to the side
  const chair = group(
    at(rbox(0.5, 0.1, 0.5, C.navy, 0.04), 0, 0.5, 0),
    at(rbox(0.5, 0.55, 0.08, C.navy, 0.04), 0, 0.82, -0.24),
    at(cyl(0.04, 0.04, 0.42, C.midGray, 8), 0, 0.25, 0),
    at(cyl(0.25, 0.25, 0.04, C.darkGray, 10), 0, 0.04, 0),
  );
  chair.position.set(1.55, 0, -0.1);
  chair.rotation.y = -0.6;
  g.add(top, ped, leg, mon, stand, foot, kb, clip, paper, cup, pens, chair);
  g.userData.screen = mon.children[1] as THREE.Mesh;
  return g;
}

export function makeSedaPrep(): StationModel {
  const g = new THREE.Group() as StationModel;
  const base = at(rbox(1.7, 0.82, 1.0, C.white, 0.08), 0, 0.41, 0);
  drawerFronts(g, 1.6, 0.74, 0.51, 2, C.blueLight, 0.04);
  const counter = at(rbox(1.78, 0.06, 1.06, C.lightGray, 0.03), 0, 0.85, 0);
  const machine = at(rbox(1.0, 0.86, 0.78, C.warmWhite, 0.14), -0.18, 1.31, -0.05);
  const bezel = at(rbox(0.66, 0.5, 0.06, C.navy, 0.06), -0.18, 1.4, 0.36);
  const scr = at(screenMesh(0.56, 0.4, 'drop', '#7fd8ff'), -0.18, 1.4, 0.395);
  // cartridge bay
  const bay = at(rbox(0.7, 0.14, 0.12, C.navyLight, 0.04), -0.18, 1.0, 0.36);
  const carts = [C.blue, C.yellow, '#9a7fd8'].map((c, i) => at(rbox(0.12, 0.1, 0.1, c, 0.03, false), -0.38 + i * 0.2, 1.02, 0.4));
  const bottle = at(cyl(0.12, 0.13, 0.42, C.tealLight, 14), 0.6, 1.1, 0.0);
  const cap = at(cyl(0.06, 0.06, 0.08, C.teal, 10), 0.6, 1.35, 0.0);
  const tray = at(rbox(0.36, 0.05, 0.36, C.blueLight, 0.02), 0.6, 0.9, 0.3);
  g.userData.status = statusLight(g, 0.22, 1.8, 0.1);
  g.add(base, counter, machine, bezel, scr, bay, ...carts, bottle, cap, tray);
  g.userData.screen = scr;
  return g;
}

export function makeScopeAir(): StationModel {
  const g = new THREE.Group() as StationModel;
  const base = at(rbox(1.15, 0.18, 0.9, C.lightGray, 0.06), 0, 0.17, 0);
  wheels(g, 1.15, 0.9);
  const body = at(rbox(1.0, 1.25, 0.78, C.warmWhite, 0.16), 0, 0.88, -0.02);
  const panel = at(rbox(0.72, 0.62, 0.05, C.white, 0.08), 0, 1.0, 0.38);
  const icon = group();
  const lm = mat(C.teal);
  for (const s of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), lm);
    lobe.scale.set(0.8, 1.35, 0.3);
    lobe.position.set(s * 0.12, -0.02, 0);
    icon.add(lobe);
  }
  icon.add(at(rbox(0.04, 0.18, 0.04, C.teal, 0.01), 0, 0.17, 0));
  icon.position.set(0, 1.05, 0.42);
  const tag = at(textPlane('ScopeAir', 0.62, 0.14, C.blueDeep), 0, 0.73, 0.41);
  // monitor on arm
  const arm = at(cyl(0.03, 0.03, 0.5, C.midGray, 8), 0.38, 1.7, -0.1);
  const mon = group(at(rbox(0.5, 0.36, 0.06, C.navy, 0.04), 0, 0, 0), at(screenMesh(0.42, 0.28, 'wave', C.screenGlow), 0, 0, 0.035));
  mon.position.set(0.38, 2.02, -0.05);
  // corrugated hoses
  const hose1 = tube([new THREE.Vector3(-0.42, 0.9, 0.3), new THREE.Vector3(-0.68, 0.75, 0.45), new THREE.Vector3(-0.6, 0.45, 0.55), new THREE.Vector3(-0.35, 0.5, 0.48)], 0.05, '#b9d9ee');
  const hose2 = tube([new THREE.Vector3(-0.45, 1.25, 0.2), new THREE.Vector3(-0.75, 1.15, 0.2), new THREE.Vector3(-0.8, 0.8, 0.1)], 0.045, C.tealLight);
  g.userData.status = statusLight(g, -0.3, 1.6, 0.1);
  g.add(base, body, panel, icon, tag, arm, mon, hose1, hose2);
  return g;
}

export function makeSupplies(): StationModel {
  const g = new THREE.Group() as StationModel;
  const W = 1.8, D = 0.9, H = 1.0;
  const frame = at(rbox(W, H, D, C.blue, 0.08), 0, H / 2 + 0.12, 0);
  wheels(g, W, D);
  const top = at(rbox(W + 0.08, 0.06, D + 0.06, C.lightGray, 0.03), 0, H + 0.15, 0);
  const drawers: THREE.Group[] = [];
  const colors = [C.yellow, C.teal, C.blueDeep]; // airway (bottom), monitoring, cartridges (top)
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Group();
    const front = rbox(W - 0.14, 0.27, 0.06, C.blueLight, 0.03);
    const handle = at(rbox(0.6, 0.05, 0.05, C.white, 0.02), 0, 0.06, 0.05);
    const label = at(rbox(0.22, 0.09, 0.02, colors[i], 0.01, false), -0.6, 0.02, 0.035);
    const box = at(rbox(W - 0.2, 0.22, D - 0.12, C.white, 0.02), 0, 0, -D / 2 + 0.02);
    d.add(front, handle, label, box);
    d.position.set(0, 0.28 + i * 0.31, D / 2 + 0.01);
    d.userData.closedZ = D / 2 + 0.01;
    drawers.push(d);
    g.add(d);
  }
  drawers.reverse(); // index 0 = top drawer (cartridges)
  const boxes = [
    at(rbox(0.42, 0.26, 0.32, C.white, 0.03), -0.55, H + 0.31, -0.1),
    at(rbox(0.32, 0.2, 0.28, C.tealLight, 0.03), -0.1, H + 0.28, 0.05),
    at(rbox(0.38, 0.32, 0.3, C.blueLight, 0.03), 0.35, H + 0.34, -0.12),
  ];
  const pump = group(at(cyl(0.07, 0.08, 0.26, C.white, 12), 0, 0, 0), at(cyl(0.025, 0.025, 0.1, C.teal, 8), 0, 0.17, 0));
  pump.position.set(0.72, H + 0.31, 0.15);
  g.add(frame, top, ...boxes, pump);
  g.userData.drawers = drawers;
  return g;
}

export function makeWorkstation(): StationModel {
  const g = new THREE.Group() as StationModel;
  const base = at(rbox(1.3, 0.85, 0.85, C.warmWhite, 0.08), 0, 0.55, 0);
  wheels(g, 1.3, 0.85);
  drawerFronts(g, 1.2, 0.72, 0.43, 3, C.blueLight, 0.18);
  const desk = at(rbox(1.45, 0.07, 0.95, C.lightGray, 0.03), 0, 1.0, 0.02);
  const tower = at(rbox(0.95, 0.85, 0.55, C.warmWhite, 0.1), -0.1, 1.45, -0.15);
  const gauges = [0, 1, 2].map((i) => at(cyl(0.07, 0.07, 0.03, C.white, 14), -0.4 + i * 0.2, 1.3, 0.14));
  gauges.forEach((x) => (x.rotation.x = Math.PI / 2));
  const gaugeRims = [0, 1, 2].map((i) => { const t = torus(0.07, 0.015, C.navy); t.position.set(-0.4 + i * 0.2, 1.3, 0.15); return t; });
  const mon = group(at(rbox(0.86, 0.58, 0.08, C.navy, 0.05), 0, 0, 0), at(screenMesh(0.76, 0.48, 'wave', C.screenGlow), 0, 0, 0.045));
  mon.position.set(-0.1, 2.15, -0.12);
  mon.rotation.x = -0.12;
  const monArm = at(cyl(0.04, 0.04, 0.35, C.midGray, 8), -0.1, 1.9, -0.2);
  // vaporizer-style canisters (fictional colors)
  const canisters = [C.yellow, C.blue, '#9a7fd8'].map((c, i) => at(cyl(0.08, 0.08, 0.28, c, 12), 0.5, 1.22 + i * 0.0, -0.25 + i * 0.18));
  // reservoir bag on a short arm
  const bagArm = at(cyl(0.025, 0.025, 0.4, C.midGray, 8), 0.72, 1.25, 0.1);
  bagArm.rotation.z = Math.PI / 2;
  const bag = sph(0.16, C.green, 14);
  bag.scale.set(0.9, 1.4, 0.9);
  bag.position.set(0.92, 1.0, 0.12);
  // breathing circuit (two corrugated limbs)
  const limb1 = tube([new THREE.Vector3(0.45, 1.1, 0.35), new THREE.Vector3(0.6, 0.9, 0.7), new THREE.Vector3(0.2, 0.75, 0.95), new THREE.Vector3(-0.3, 0.85, 0.9)], 0.045, '#9fcbe6');
  const limb2 = tube([new THREE.Vector3(0.35, 1.1, 0.35), new THREE.Vector3(0.45, 0.95, 0.65), new THREE.Vector3(0.05, 0.82, 0.85), new THREE.Vector3(-0.32, 0.88, 0.86)], 0.04, C.tealLight);
  // suction canister on side
  const suction = group(at(cyl(0.1, 0.1, 0.3, '#d8ecf5', 12), 0, 0, 0), at(cyl(0.105, 0.105, 0.05, C.blueDeep, 12), 0, 0.17, 0));
  suction.position.set(-0.75, 1.0, 0.0);
  g.userData.status = statusLight(g, -0.62, 1.95, -0.1);
  g.userData.monitorScreen = mon.children[1] as THREE.Mesh;
  g.add(base, desk, tower, ...gauges, ...gaugeRims, mon, monArm, ...canisters, bagArm, bag, limb1, limb2, suction);
  return g;
}

/** Hospital bed with patient mount. Long axis along local z, head at +z. */
export function makeBed(withCurtain = true): StationModel {
  const g = new THREE.Group() as StationModel;
  const bed = new THREE.Group();
  const L = 2.5, W = 1.15;
  const frame = at(rbox(W, 0.14, L, C.lightGray, 0.05), 0, 0.42, 0);
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => at(cyl(0.035, 0.035, 0.32, C.midGray, 8), sx * (W / 2 - 0.12), 0.24, sz * (L / 2 - 0.15))));
  const mattress = at(rbox(W - 0.06, 0.16, L - 0.08, C.white, 0.07), 0, 0.57, 0);
  const sheet = at(rbox(W - 0.04, 0.05, L * 0.62, C.blueLight, 0.03), 0, 0.64, -L * 0.18);
  const head = at(rbox(W + 0.04, 0.6, 0.09, C.blue, 0.05), 0, 0.72, L / 2);
  const foot = at(rbox(W + 0.04, 0.42, 0.09, C.blue, 0.05), 0, 0.62, -L / 2);
  const rails = [-1, 1].map((s) => at(rbox(0.05, 0.16, L * 0.45, C.midGray, 0.02), s * (W / 2 + 0.03), 0.78, L * 0.12));
  const pillow = at(rbox(W * 0.7, 0.14, 0.42, C.white, 0.07), 0, 0.72, L / 2 - 0.32);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = cyl(0.08, 0.08, 0.06, C.darkGray, 12);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx * (W / 2 - 0.12), 0.08, sz * (L / 2 - 0.15));
    bed.add(wh);
  }
  bed.add(frame, ...legs, mattress, sheet, head, foot, ...rails, pillow);
  const mount = new THREE.Group();
  mount.position.set(0, 0.62, -0.05);
  mount.rotation.y = -Math.PI / 2; // patient's head (+x) → bed head (+z)
  bed.add(mount);
  g.add(bed);
  g.userData.bed = bed;
  g.userData.patientMount = mount;

  // IV pole + vitals monitor at the head
  const pole = group(
    at(cyl(0.025, 0.025, 1.9, C.midGray, 8), 0, 0.95, 0),
    at(cyl(0.22, 0.22, 0.04, C.darkGray, 10), 0, 0.03, 0),
    at(rbox(0.12, 0.2, 0.05, '#d9f0ff', 0.03), 0.1, 1.7, 0),
    at(rbox(0.5, 0.36, 0.08, C.navy, 0.04), 0, 1.35, 0.06),
  );
  const vit = screenMesh(0.42, 0.28, 'wave', C.screenGlow);
  vit.position.set(0, 1.35, 0.105);
  pole.add(vit);
  pole.position.set(-W / 2 - 0.35, 0, L / 2 - 0.1);
  pole.rotation.y = Math.PI / 2;
  g.add(pole);
  g.userData.monitorScreen = vit;

  if (withCurtain) {
    // curtain along the bed's far side (local +x → world -z when rotated)
    const rail = at(rbox(0.05, 0.05, L + 0.6, C.midGray, 0.02, false), W / 2 + 0.75, 2.35, 0);
    const folds = new THREE.Group();
    const cm = mat('#7fc7c4');
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.1, 10, 1, true, 0, Math.PI), cm);
      f.position.set(W / 2 + 0.75, 1.27, -L / 2 - 0.2 + i * ((L + 0.4) / 8));
      f.rotation.y = Math.PI / 2;
      f.castShadow = true;
      folds.add(f);
    }
    g.add(rail, folds);
  }
  return g;
}

export function makeHandoff(): StationModel {
  const g = new THREE.Group() as StationModel;
  // counter runs along local x; front faces +z
  const counter = at(rbox(2.3, 1.05, 0.7, C.white, 0.08), 0, 0.53, -0.05);
  const front = at(rbox(2.2, 0.75, 0.04, C.teal, 0.03, false), 0, 0.5, 0.31);
  const topc = at(rbox(2.4, 0.06, 0.8, C.wood, 0.03), 0, 1.08, -0.05);
  const sign = at(textPlane('PACU', 1.0, 0.36, C.white, C.green, 'bold 150px system-ui, sans-serif'), 0, 2.15, -0.42);
  const signBack = at(rbox(1.08, 0.44, 0.06, C.green, 0.05), 0, 2.15, -0.46);
  const mon = group(at(rbox(0.5, 0.36, 0.06, C.navy, 0.04), 0, 0, 0), at(screenMesh(0.42, 0.28, 'chart'), 0, 0, 0.035));
  mon.position.set(-0.6, 1.35, -0.2);
  const phone = at(rbox(0.22, 0.08, 0.16, C.navy, 0.03), 0.65, 1.15, -0.1);
  const files = at(rbox(0.3, 0.12, 0.24, C.yellow, 0.02), 0.2, 1.17, -0.15);
  g.add(counter, front, topc, signBack, sign, mon, phone, files);
  g.userData.status = statusLight(g, 1.0, 1.25, -0.25);
  return g;
}

export function makeAirReady(): StationModel {
  const g = new THREE.Group() as StationModel;
  const base = at(rbox(1.4, 0.8, 0.9, C.warmWhite, 0.08), 0, 0.4, 0);
  drawerFronts(g, 1.3, 0.72, 0.46, 2, '#f7d9a6', 0.04);
  const top = at(rbox(1.0, 0.75, 0.7, C.white, 0.14), 0, 1.2, -0.05);
  const bez = at(rbox(0.66, 0.44, 0.06, C.navy, 0.06), 0, 1.25, 0.31);
  const scr = at(screenMesh(0.56, 0.34, 'airway', C.yellow), 0, 1.25, 0.345);
  const stripe = at(rbox(1.02, 0.08, 0.72, C.orange, 0.03), 0, 0.88, -0.05);
  g.userData.status = statusLight(g, 0.42, 1.7, 0.05);
  g.add(base, top, bez, scr, stripe);
  return g;
}

// ------------------------------------------------------------------ decor

export function makePlant(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(cyl(0.3, 0.24, 0.5, C.white, 14), 0, 0.25, 0));
  g.add(at(cyl(0.27, 0.27, 0.04, '#7a5a3c', 14), 0, 0.5, 0));
  const leaves = [C.greenLeaf, C.greenLeafDark];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = sph(0.16, leaves[i % 2], 10);
    leaf.scale.set(0.55, 2.3, 0.3);
    leaf.position.set(Math.cos(a) * 0.17, 0.95 + (i % 3) * 0.08, Math.sin(a) * 0.17);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * -0.5);
    g.add(leaf);
  }
  return g;
}

export function makeBench(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    g.add(at(rbox(0.5, 0.1, 0.5, C.teal, 0.04), -0.55 + i * 0.55, 0.45, 0));
    g.add(at(rbox(0.5, 0.45, 0.08, C.teal, 0.04), -0.55 + i * 0.55, 0.72, -0.22));
  }
  g.add(at(rbox(1.7, 0.06, 0.4, C.midGray, 0.02), 0, 0.37, 0));
  g.add(at(cyl(0.04, 0.04, 0.36, C.midGray, 8), -0.7, 0.18, 0));
  g.add(at(cyl(0.04, 0.04, 0.36, C.midGray, 8), 0.7, 0.18, 0));
  return g;
}

export function makeSink(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(1.1, 0.85, 0.55, C.white, 0.05), 0, 0.43, 0));
  g.add(at(rbox(1.15, 0.06, 0.6, C.lightGray, 0.03), 0, 0.88, 0));
  g.add(at(rbox(0.5, 0.05, 0.32, '#b8d4e6', 0.03), 0, 0.9, 0.02));
  const tap = group(at(cyl(0.025, 0.025, 0.25, C.midGray, 8), 0, 0.12, 0), at(capsule(0.02, 0.12, C.midGray), 0, 0.24, 0.06));
  (tap.children[1] as THREE.Mesh).rotation.x = Math.PI / 2;
  tap.position.set(0, 0.9, -0.2);
  g.add(tap);
  g.add(at(rbox(0.16, 0.24, 0.1, C.teal, 0.03), 0.42, 1.03, -0.18));
  return g;
}

export function makeIVPole(): THREE.Group {
  return group(
    at(cyl(0.025, 0.025, 1.9, C.midGray, 8), 0, 0.95, 0),
    at(cyl(0.22, 0.22, 0.04, C.darkGray, 10), 0, 0.03, 0),
    at(rbox(0.14, 0.24, 0.06, '#d9f0ff', 0.03), 0.1, 1.7, 0),
  );
}
