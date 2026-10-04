import * as THREE from 'three';
import { C, at, capsule, cyl, group, mat, rbox, screenMesh, sph, textPlane, torus, tube, uniqueMat } from '../palette';

// Chunky, rounded, silhouette-first equipment in a management-sim style.
// Every model faces +z, sits centered on its footprint, and is built only from the
// shared palette so the room reads as one asset family. Animated bits go in userData.

export interface StationModel extends THREE.Group {
  userData: {
    status?: THREE.MeshStandardMaterial;
    drawers?: THREE.Group[];
    screen?: THREE.Mesh;
    bed?: THREE.Group;
    patientMount?: THREE.Group;
    monitorScreen?: THREE.Mesh;
  };
}

const R = 0.12; // default corner radius: big and soft

function casters(g: THREE.Object3D, w: number, d: number, y = 0.09) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = cyl(0.09, 0.09, 0.08, C.navy, 14);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx * (w / 2 - 0.14), y, sz * (d / 2 - 0.14));
    const fork = rbox(0.06, 0.1, 0.1, C.midGray, 0.02, false);
    fork.position.set(sx * (w / 2 - 0.14), y + 0.1, sz * (d / 2 - 0.14));
    g.add(wh, fork);
  }
}

function statusLight(g: THREE.Object3D, x: number, y: number, z: number): THREE.MeshStandardMaterial {
  const m = uniqueMat(C.midGray, { emissive: '#000000' });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), m);
  bulb.position.set(x, y, z);
  const base = cyl(0.1, 0.12, 0.06, C.navy, 14);
  base.position.set(x, y - 0.07, z);
  g.add(base, bulb);
  return m;
}

/** A drawer stack with chunky handles. */
function drawers(g: THREE.Object3D, w: number, h: number, zFront: number, n: number, y0: number, color = C.blue, x = 0) {
  const dh = h / n;
  for (let i = 0; i < n; i++) {
    const f = rbox(w - 0.08, dh - 0.06, 0.07, color, 0.04, false);
    f.position.set(x, y0 + dh * (i + 0.5), zFront);
    const hnd = rbox(Math.min(0.42, w * 0.4), 0.05, 0.06, C.white, 0.02, false);
    hnd.position.set(x, y0 + dh * (i + 0.5) + dh * 0.18, zFront + 0.05);
    g.add(f, hnd);
  }
}

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, r = 0.03) {
  return at(rbox(w, h, d, color, r), x, y + h / 2, z);
}

// ------------------------------------------------------------------ stations

export function makeChartDesk(): StationModel {
  const g = new THREE.Group() as StationModel;
  // L of white desk with a blue pedestal, chunky monitor, boxes, a plant
  g.add(at(rbox(2.6, 0.12, 1.25, C.white, 0.05), 0, 0.92, 0));
  g.add(at(rbox(0.75, 0.86, 1.15, C.lightGray, 0.06), 0.88, 0.45, 0));
  drawers(g, 0.75, 0.8, 0.59, 3, 0.06, C.blue, 0.88);
  g.add(at(rbox(0.1, 0.86, 1.1, C.lightGray, 0.03), -1.2, 0.45, 0));
  const mon = group(
    at(rbox(1.1, 0.78, 0.1, C.navy, 0.07), 0, 0, 0),
    at(screenMesh(0.96, 0.64, 'chart'), 0, 0, 0.056),
    at(rbox(0.12, 0.32, 0.1, C.midGray, 0.03), 0, -0.5, -0.05),
    at(rbox(0.5, 0.05, 0.32, C.midGray, 0.02), 0, -0.66, -0.05),
  );
  mon.position.set(-0.1, 1.64, -0.25);
  g.add(mon);
  g.add(at(rbox(0.7, 0.05, 0.25, C.lightGray, 0.02), -0.1, 1.0, 0.22));
  // stacked boxes + clipboard + plant
  g.add(box(0.42, 0.28, 0.34, C.blueLight, 0.85, 0.98, -0.3));
  g.add(box(0.36, 0.22, 0.3, C.blue, 0.85, 1.26, -0.32));
  g.add(at(rbox(0.36, 0.04, 0.46, C.yellow, 0.02), -0.85, 1.0, 0.18));
  g.add(at(rbox(0.3, 0.045, 0.36, C.white, 0.01, false), -0.85, 1.02, 0.2));
  const pot = group(at(cyl(0.13, 0.11, 0.2, C.white, 12), 0, 0.1, 0));
  for (let i = 0; i < 5; i++) { const l = sph(0.08, C.greenLeaf, 8); l.scale.set(0.6, 1.6, 0.4); l.position.set(Math.cos(i * 1.3) * 0.07, 0.3, Math.sin(i * 1.3) * 0.07); l.rotation.z = Math.cos(i * 1.3) * 0.5; pot.add(l); }
  pot.position.set(-0.95, 0.98, -0.35);
  g.add(pot);
  // office chair (to the side so the stand point is clear)
  const chair = group(
    at(rbox(0.6, 0.12, 0.58, C.navy, 0.05), 0, 0.56, 0),
    at(rbox(0.6, 0.62, 0.1, C.navy, 0.05), 0, 0.93, -0.27),
    at(cyl(0.04, 0.04, 0.44, C.midGray, 8), 0, 0.3, 0),
  );
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = rbox(0.34, 0.05, 0.06, C.darkGray, 0.02);
    leg.position.set(Math.cos(a) * 0.17, 0.08, Math.sin(a) * 0.17);
    leg.rotation.y = -a;
    const w = sph(0.05, C.black, 8);
    w.position.set(Math.cos(a) * 0.32, 0.05, Math.sin(a) * 0.32);
    chair.add(leg, w);
  }
  chair.position.set(0.15, 0, 1.0);
  chair.rotation.y = Math.PI + 0.35;
  chair.scale.setScalar(0.95);
  g.add(chair);
  g.userData.screen = mon.children[1] as THREE.Mesh;
  return g;
}

export function makeSedaPrep(): StationModel {
  const g = new THREE.Group() as StationModel;
  // blue-drawer cabinet
  g.add(at(rbox(2.0, 0.9, 1.2, C.white, R), 0, 0.5, 0));
  drawers(g, 0.9, 0.72, 0.61, 2, 0.12, C.blue, -0.5);
  drawers(g, 0.9, 0.72, 0.61, 2, 0.12, C.blue, 0.5);
  casters(g, 2.0, 1.2, 0.05);
  g.add(at(rbox(2.08, 0.08, 1.26, C.lightGray, 0.04), 0, 0.98, 0));
  // the machine: a big rounded white unit with a glowing screen
  const m = new THREE.Group();
  m.add(at(rbox(1.15, 1.05, 0.95, C.white, 0.2), 0, 0.52, 0));
  m.add(at(rbox(0.9, 0.62, 0.08, C.navy, 0.1), 0, 0.62, 0.47));
  const scr = at(screenMesh(0.76, 0.5, 'drop', '#6fe0ff'), 0, 0.62, 0.515);
  m.add(scr);
  m.add(at(rbox(0.94, 0.16, 0.1, C.blueLight, 0.05), 0, 0.15, 0.46));
  const label = textPlane('SedaPrep', 0.9, 0.2, C.blueDeep, null, 'bold 110px system-ui, sans-serif');
  label.position.set(0, 0.16, 0.52);
  m.add(label);
  m.position.set(-0.3, 1.02, -0.05);
  g.add(m);
  // cartridge rack + bottles + boxes
  g.add(box(0.5, 0.36, 0.5, C.blue, 0.68, 1.02, -0.22, 0.05));
  g.add(at(cyl(0.13, 0.14, 0.5, C.tealLight, 14), 0.7, 1.27, 0.25));
  g.add(at(cyl(0.06, 0.06, 0.1, C.teal, 10), 0.7, 1.57, 0.25));
  g.add(box(0.26, 0.42, 0.22, C.white, 0.92, 1.02, 0.15, 0.04));
  g.userData.status = statusLight(g, -0.3, 2.22, 0.0);
  g.userData.screen = scr;
  return g;
}

export function makeScopeAir(): StationModel {
  const g = new THREE.Group() as StationModel;
  // tall rounded unit with the lung emblem
  const body = new THREE.Group();
  body.add(at(rbox(1.2, 1.7, 1.15, C.white, 0.22), 0, 0.95, 0));
  body.add(at(rbox(1.24, 0.2, 1.18, C.lightGray, 0.08), 0, 0.1, 0));
  const lm = mat(C.blue);
  const icon = new THREE.Group();
  for (const s of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), lm);
    lobe.scale.set(0.75, 1.3, 0.28);
    lobe.position.set(s * 0.15, -0.03, 0);
    icon.add(lobe);
  }
  icon.add(at(rbox(0.06, 0.24, 0.06, C.blue, 0.02), 0, 0.22, 0));
  icon.position.set(0, 1.35, 0.58);
  body.add(icon);
  const label = textPlane('ScopeAir', 1.0, 0.24, C.blueDeep, null, 'bold 110px system-ui, sans-serif');
  label.position.set(0, 0.95, 0.585);
  body.add(label);
  drawers(body, 0.9, 0.36, 0.585, 1, 0.3, C.lightGray);
  body.position.x = -0.35;
  g.add(body);
  // side monitor cart with hoses
  const cart = new THREE.Group();
  cart.add(at(rbox(0.62, 0.95, 0.7, C.lightGray, 0.1), 0, 0.6, 0));
  drawers(cart, 0.55, 0.5, 0.36, 2, 0.25, C.white);
  casters(cart, 0.62, 0.7, 0.05);
  const mon = group(at(rbox(0.6, 0.46, 0.1, C.navy, 0.06), 0, 0, 0), at(screenMesh(0.5, 0.36, 'wave', C.screenGlow), 0, 0, 0.056));
  mon.position.set(0, 1.42, 0);
  cart.add(mon, at(rbox(0.1, 0.3, 0.1, C.midGray, 0.03), 0, 1.15, -0.05));
  cart.position.set(0.62, 0, 0.05);
  g.add(cart);
  g.add(tube([new THREE.Vector3(0.0, 1.2, 0.45), new THREE.Vector3(0.25, 1.0, 0.75), new THREE.Vector3(0.35, 0.6, 0.7), new THREE.Vector3(0.12, 0.35, 0.55)], 0.06, '#dfe9f2'));
  g.add(tube([new THREE.Vector3(0.05, 1.0, 0.4), new THREE.Vector3(0.18, 0.75, 0.62), new THREE.Vector3(0.25, 0.5, 0.6)], 0.05, C.tealLight));
  g.userData.status = statusLight(g, -0.35, 1.95, 0.1);
  return g;
}

export function makeSupplies(): StationModel {
  const g = new THREE.Group() as StationModel;
  const W = 1.9, D = 1.0, H = 1.0;
  g.add(at(rbox(W, H, D, C.white, R), 0, H / 2 + 0.14, 0));
  casters(g, W, D, 0.07);
  g.add(at(rbox(W + 0.1, 0.08, D + 0.08, C.lightGray, 0.04), 0, H + 0.18, 0));
  const ds: THREE.Group[] = [];
  const tags = [C.yellow, C.teal, C.blueDeep];
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Group();
    d.add(rbox(W - 0.14, 0.28, 0.08, C.blue, 0.05));
    d.add(at(rbox(0.62, 0.06, 0.06, C.white, 0.02), 0, 0.06, 0.06));
    d.add(at(rbox(0.2, 0.08, 0.02, tags[i], 0.01, false), -0.62, 0.03, 0.045));
    d.add(at(rbox(W - 0.24, 0.22, D - 0.16, C.lightGray, 0.03), 0, 0, -D / 2 + 0.02));
    d.position.set(0, 0.34 + i * 0.32, D / 2 + 0.01);
    d.userData.closedZ = D / 2 + 0.01;
    ds.push(d);
    g.add(d);
  }
  ds.reverse(); // 0 = top drawer
  // supplies on top
  g.add(box(0.5, 0.3, 0.42, C.blue, -0.55, H + 0.22, -0.1, 0.05));
  g.add(box(0.42, 0.24, 0.36, '#4cc38a', -0.05, H + 0.22, -0.05, 0.05));
  g.add(box(0.38, 0.2, 0.32, C.blueLight, -0.6, H + 0.52, -0.12, 0.05));
  const pump = group(at(cyl(0.11, 0.12, 0.34, C.white, 14), 0, 0, 0), at(cyl(0.035, 0.035, 0.14, C.teal, 8), 0, 0.23, 0), at(rbox(0.16, 0.04, 0.05, C.teal, 0.02), 0.05, 0.3, 0));
  pump.position.set(0.55, H + 0.39, 0.05);
  g.add(pump);
  g.userData.drawers = ds;
  return g;
}

export function makeWorkstation(): StationModel {
  const g = new THREE.Group() as StationModel;
  // cabinet with blue drawers
  g.add(at(rbox(1.5, 1.0, 1.1, C.white, R), -0.15, 0.6, 0));
  drawers(g, 1.3, 0.8, 0.56, 3, 0.2, C.blue, -0.15);
  casters(g, 1.5, 1.1, 0.06);
  g.add(at(rbox(1.62, 0.09, 1.2, C.lightGray, 0.04), -0.15, 1.14, 0.02));
  // tower + big monitor with green waveform
  g.add(at(rbox(1.2, 0.62, 0.6, C.warmWhite, 0.12), -0.2, 1.5, -0.25));
  const mon = group(at(rbox(1.08, 0.74, 0.12, C.navy, 0.08), 0, 0, 0), at(screenMesh(0.94, 0.6, 'wave', '#66e3a0'), 0, 0, 0.065));
  mon.position.set(-0.2, 2.18, -0.2);
  mon.rotation.x = -0.1;
  g.add(mon);
  // gauges
  for (let i = 0; i < 3; i++) {
    const gz = cyl(0.08, 0.08, 0.04, C.white, 16);
    gz.rotation.x = Math.PI / 2;
    gz.position.set(-0.55 + i * 0.22, 1.5, 0.07);
    const rim = torus(0.08, 0.018, C.navy);
    rim.position.set(-0.55 + i * 0.22, 1.5, 0.08);
    g.add(gz, rim);
  }
  // canisters + reservoir bag + breathing circuit
  [C.yellow, C.blue, '#9a7fd8'].forEach((c, i) => g.add(at(cyl(0.09, 0.09, 0.3, c, 14), 0.25 + i * 0.0, 1.33, -0.35 + i * 0.2)));
  const bag = sph(0.19, C.blueDeep, 16);
  bag.scale.set(0.9, 1.35, 0.9);
  bag.position.set(-1.05, 1.0, 0.25);
  g.add(bag, at(cyl(0.03, 0.03, 0.3, C.midGray, 8), -1.05, 1.3, 0.25));
  g.add(tube([new THREE.Vector3(-0.85, 1.3, 0.35), new THREE.Vector3(-1.1, 1.55, 0.7), new THREE.Vector3(-0.8, 1.2, 0.95), new THREE.Vector3(-0.4, 1.0, 0.9)], 0.055, '#a5d0ef'));
  // green gas cylinder
  const cylG = group(at(cyl(0.17, 0.17, 1.0, '#3aa27f', 16), 0, 0.6, 0), at(sph(0.17, '#3aa27f', 14), 0, 1.1, 0), at(cyl(0.05, 0.05, 0.16, C.midGray, 8), 0, 1.3, 0));
  cylG.position.set(0.9, 0, -0.1);
  g.add(cylG);
  // stool tucked at the side
  const stool = group(at(cyl(0.26, 0.26, 0.12, C.blue, 18), 0, 0.6, 0), at(cyl(0.04, 0.04, 0.5, C.midGray, 8), 0, 0.32, 0), at(cyl(0.22, 0.24, 0.04, C.darkGray, 10), 0, 0.04, 0));
  stool.position.set(-1.0, 0, 0.95);
  g.add(stool);
  g.userData.status = statusLight(g, 0.4, 2.0, -0.35);
  g.userData.monitorScreen = mon.children[1] as THREE.Mesh;
  return g;
}

/** Hospital bed in a cubicle. Long axis along z, head at -z (back). */
export function makeBed(withCubicle = true, number = '1'): StationModel {
  const g = new THREE.Group() as StationModel;
  const bed = new THREE.Group();
  const L = 2.6, W = 1.25;
  bed.add(at(rbox(W, 0.2, L, C.blue, 0.08), 0, 0.42, 0));
  bed.add(at(rbox(W - 0.1, 0.06, L - 0.15, C.lightGray, 0.03), 0, 0.55, 0));
  bed.add(at(rbox(W - 0.04, 0.2, L - 0.12, C.white, 0.09), 0, 0.68, 0));
  bed.add(at(rbox(W + 0.06, 0.72, 0.14, C.lightGray, 0.07), 0, 0.82, -L / 2));
  bed.add(at(rbox(W + 0.06, 0.48, 0.14, C.lightGray, 0.07), 0, 0.68, L / 2));
  bed.add(at(rbox(W * 0.72, 0.18, 0.5, C.white, 0.09), 0, 0.86, -L / 2 + 0.38));
  for (const s of [-1, 1]) bed.add(at(rbox(0.07, 0.2, L * 0.4, C.lightGray, 0.03), s * (W / 2 + 0.04), 0.92, -L * 0.14));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bed.add(at(cyl(0.04, 0.04, 0.32, C.midGray, 8), sx * (W / 2 - 0.15), 0.24, sz * (L / 2 - 0.2)));
    const wh = cyl(0.1, 0.1, 0.08, C.navy, 14);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx * (W / 2 - 0.15), 0.1, sz * (L / 2 - 0.2));
    bed.add(wh);
  }
  const mount = new THREE.Group();
  mount.position.set(0, 0.76, 0.05);
  mount.rotation.y = Math.PI / 2; // patient's head (+x) → bed head (-z)
  bed.add(mount);
  g.add(bed);
  g.userData.bed = bed;
  g.userData.patientMount = mount;

  // IV pole + vitals monitor at the head, on the right
  const pole = group(
    at(cyl(0.03, 0.03, 2.0, C.midGray, 8), 0, 1.0, 0),
    at(cyl(0.26, 0.26, 0.05, C.darkGray, 12), 0, 0.03, 0),
    at(rbox(0.16, 0.26, 0.07, '#d9f0ff', 0.04), 0.12, 1.85, 0),
    at(rbox(0.58, 0.42, 0.1, C.navy, 0.05), 0, 1.45, 0.06),
  );
  const vit = screenMesh(0.5, 0.33, 'wave', '#66e3a0');
  vit.position.set(0, 1.45, 0.115);
  pole.add(vit);
  pole.position.set(W / 2 + 0.35, 0, -L / 2 + 0.15);
  pole.rotation.y = -0.6;
  g.add(pole);
  g.userData.monitorScreen = vit;

  if (withCubicle) {
    // cream partition walls (back + left), curtain on the left, bay number
    const pw = W + 0.9, px = -0.2;
    g.add(at(rbox(pw, 1.7, 0.16, C.cream, 0.05), px, 0.85, -L / 2 - 0.35));
    g.add(at(rbox(pw + 0.04, 0.1, 0.22, C.creamDark, 0.03), px, 1.72, -L / 2 - 0.35));
    g.add(at(rbox(pw, 0.16, 0.18, C.wainscot, 0.03), px, 0.1, -L / 2 - 0.34));
    g.add(at(rbox(0.16, 1.7, L + 0.5, C.cream, 0.05), -W / 2 - 0.65, 0.85, -0.1));
    g.add(at(rbox(0.22, 0.1, L + 0.54, C.creamDark, 0.03), -W / 2 - 0.65, 1.72, -0.1));
    // curtain folds hanging in front of the left partition
    const cm = mat('#4fb3c4');
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.85, 10, 1, true, 0, Math.PI), cm);
      f.position.set(-W / 2 - 0.45, 1.0, -L / 2 + 0.25 + i * 0.36);
      f.rotation.y = -Math.PI / 2;
      f.castShadow = true;
      g.add(f);
    }
    g.add(at(rbox(0.08, 0.06, L + 0.3, C.midGray, 0.02, false), -W / 2 - 0.45, 1.95, -0.1));
    const sign = group(at(rbox(0.5, 0.56, 0.06, C.blue, 0.08), 0, 0, 0), at(textPlane(number, 0.42, 0.48, C.white, null, 'bold 300px system-ui, sans-serif'), 0, 0, 0.035));
    sign.position.set(-0.35, 1.3, -L / 2 - 0.26);
    g.add(sign);
    // little side table with a plant
    g.add(box(0.5, 0.6, 0.45, C.lightGray, -W / 2 - 0.1, 0, -L / 2 - 0.05, 0.05));
    const pot = group(at(cyl(0.12, 0.1, 0.18, C.white, 12), 0, 0.09, 0));
    for (let i = 0; i < 5; i++) { const l = sph(0.08, C.greenLeaf, 8); l.scale.set(0.6, 1.7, 0.4); l.position.set(Math.cos(i * 1.3) * 0.06, 0.3, Math.sin(i * 1.3) * 0.06); l.rotation.z = Math.cos(i * 1.3) * 0.5; pot.add(l); }
    pot.position.set(-W / 2 - 0.1, 0.6, -L / 2 - 0.05);
    g.add(pot);
  }
  return g;
}

export function makeHandoff(): StationModel {
  const g = new THREE.Group() as StationModel;
  // reception-style counter; front faces +z
  g.add(at(rbox(2.4, 1.1, 0.8, C.white, R), 0, 0.56, 0));
  g.add(at(rbox(2.2, 0.8, 0.06, C.teal, 0.04, false), 0, 0.55, 0.41));
  g.add(at(rbox(2.5, 0.08, 0.92, C.wood, 0.04), 0, 1.14, 0));
  const signPost = group(
    at(rbox(0.08, 1.4, 0.08, C.midGray, 0.03), 0, 0.7, 0),
    at(rbox(1.15, 0.5, 0.1, C.green, 0.1), 0, 1.6, 0),
    at(textPlane('PACU', 1.0, 0.36, C.white, null, 'bold 150px system-ui, sans-serif'), 0, 1.6, 0.056),
  );
  signPost.position.set(0.85, 1.1, -0.25);
  g.add(signPost);
  const mon = group(at(rbox(0.56, 0.4, 0.08, C.navy, 0.05), 0, 0, 0), at(screenMesh(0.48, 0.32, 'chart'), 0, 0, 0.045));
  mon.position.set(-0.5, 1.48, -0.15);
  g.add(mon, at(rbox(0.1, 0.2, 0.08, C.midGray, 0.03), -0.5, 1.24, -0.18));
  g.add(box(0.3, 0.12, 0.24, C.yellow, 0.2, 1.18, -0.1, 0.03));
  g.userData.status = statusLight(g, -1.0, 1.32, -0.2);
  return g;
}

export function makeAirReady(): StationModel {
  const g = new THREE.Group() as StationModel;
  g.add(at(rbox(1.7, 0.9, 1.1, C.white, R), 0, 0.5, 0));
  drawers(g, 1.5, 0.72, 0.56, 2, 0.12, C.orange);
  casters(g, 1.7, 1.1, 0.05);
  const m = new THREE.Group();
  m.add(at(rbox(1.1, 0.85, 0.85, C.white, 0.2), 0, 0.42, 0));
  m.add(at(rbox(0.86, 0.52, 0.08, C.navy, 0.1), 0, 0.5, 0.42));
  m.add(at(screenMesh(0.72, 0.4, 'airway', C.yellow), 0, 0.5, 0.465));
  m.add(at(textPlane('AirReady', 0.86, 0.18, '#b4521c', null, 'bold 110px system-ui, sans-serif'), 0, 0.13, 0.43));
  m.position.set(0, 1.0, -0.05);
  g.add(m);
  g.userData.status = statusLight(g, 0.62, 2.0, 0.0);
  return g;
}

/** OR table with pedestal; surgical light boom stands at the head (not part of the movable table). */
export function makeORTable(): StationModel {
  const g = new THREE.Group() as StationModel;
  const bed = new THREE.Group();
  const L = 2.7, W = 1.15;
  bed.add(at(rbox(0.9, 0.12, 1.4, C.midGray, 0.05), 0, 0.06, 0));
  bed.add(at(rbox(0.5, 0.62, 0.7, C.lightGray, 0.1), 0, 0.4, 0));
  bed.add(at(rbox(W, 0.14, L, C.darkGray, 0.06), 0, 0.78, 0));
  bed.add(at(rbox(W - 0.06, 0.12, L - 0.1, C.navyLight, 0.06), 0, 0.9, 0));
  bed.add(at(rbox(0.6, 0.12, 0.36, C.navyLight, 0.06), 0, 0.92, -L / 2 - 0.1));
  for (const sx of [-1, 1]) {
    const arm = at(rbox(0.75, 0.08, 0.24, C.navyLight, 0.04), sx * (W / 2 + 0.3), 0.88, -0.35);
    bed.add(arm);
  }
  const mount = new THREE.Group();
  mount.position.set(0, 0.96, 0.05);
  mount.rotation.y = Math.PI / 2;
  bed.add(mount);
  g.add(bed);
  g.userData.bed = bed;
  g.userData.patientMount = mount;
  // surgical light boom (two round heads on arms)
  const boom = new THREE.Group();
  boom.add(at(cyl(0.32, 0.36, 0.08, C.darkGray, 16), 0, 0.04, 0));
  boom.add(at(cyl(0.07, 0.07, 3.2, C.lightGray, 10), 0, 1.6, 0));
  const lightMat = mat('#fff6d8', { emissive: '#fff1c4', emissiveIntensity: 0.9 });
  for (const [dx, dz, y] of [[-1.15, 0.4, 2.85], [-1.0, -0.6, 2.55]] as const) {
    const arm = rbox(Math.hypot(dx, dz), 0.1, 0.12, C.lightGray, 0.04);
    arm.position.set(dx / 2, y + 0.2, dz / 2);
    arm.rotation.y = -Math.atan2(dz, dx);
    boom.add(arm);
    const head = new THREE.Group();
    head.add(cyl(0.48, 0.42, 0.18, C.white, 22));
    const rim = torus(0.46, 0.05, C.blue);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.06;
    head.add(rim);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lightMat);
      bulb.position.set(Math.cos(a) * 0.24, -0.1, Math.sin(a) * 0.24);
      head.add(bulb);
    }
    head.position.set(dx, y, dz);
    head.rotation.z = 0.25;
    boom.add(head);
  }
  boom.position.set(W / 2 + 1.3, 0, -L / 2 + 0.3);
  g.add(boom);
  // instrument table at the foot (like the concept art)
  const inst = new THREE.Group();
  inst.add(at(rbox(1.0, 0.06, 0.6, C.lightGray, 0.03), 0, 0.85, 0));
  inst.add(at(rbox(1.08, 0.36, 0.66, '#2fae9d', 0.05), 0, 0.72, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) inst.add(at(cyl(0.025, 0.025, 0.8, C.midGray, 8), sx * 0.42, 0.4, sz * 0.24));
  inst.add(at(cyl(0.12, 0.09, 0.08, C.lightGray, 14), -0.25, 0.94, 0));
  inst.add(at(rbox(0.3, 0.05, 0.08, C.midGray, 0.02), 0.2, 0.92, -0.1));
  inst.add(at(rbox(0.3, 0.05, 0.08, C.midGray, 0.02), 0.2, 0.92, 0.08));
  inst.position.set(W / 2 + 0.75, 0, L / 2 + 0.2);
  g.add(inst);
  return g;
}

export function makeThermaNest(): StationModel {
  const g = new THREE.Group() as StationModel;
  g.add(at(rbox(1.5, 1.7, 1.0, C.white, R), 0, 0.88, 0));
  casters(g, 1.5, 1.0, 0.05);
  // glass door with warm glowing blankets inside
  g.add(at(rbox(1.2, 1.2, 0.06, '#d9ecf7', 0.06), 0, 0.98, 0.5));
  const warm = mat('#ffb36b', { emissive: '#ff9a3d', emissiveIntensity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.5), warm);
    b.position.set(0, 0.55 + i * 0.27, 0.22);
    g.add(b);
  }
  g.add(at(rbox(1.24, 0.06, 0.08, C.blue, 0.02), 0, 1.6, 0.52));
  g.add(at(textPlane('ThermaNest', 1.2, 0.22, '#b4521c', null, 'bold 100px system-ui, sans-serif'), 0, 1.77, 0.505));
  g.userData.status = statusLight(g, 0.55, 1.9, 0.1);
  return g;
}

export function makeVitaDock(): StationModel {
  const g = new THREE.Group() as StationModel;
  g.add(at(rbox(1.6, 0.85, 1.0, C.white, R), 0, 0.47, 0));
  drawers(g, 1.4, 0.6, 0.51, 2, 0.1, C.teal);
  g.add(at(rbox(1.66, 0.07, 1.06, C.lightGray, 0.03), 0, 0.92, 0));
  // three charging docks with leads
  for (let i = 0; i < 3; i++) {
    g.add(at(rbox(0.36, 0.22, 0.4, C.navy, 0.06), -0.5 + i * 0.5, 1.07, -0.12));
    g.add(at(rbox(0.26, 0.08, 0.3, [C.red, C.yellow, C.tealLight][i], 0.03), -0.5 + i * 0.5, 1.22, -0.12));
    const coil = torus(0.12, 0.03, C.lightGray);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(-0.5 + i * 0.5, 0.98, 0.3);
    g.add(coil);
  }
  const mon = group(at(rbox(0.7, 0.48, 0.08, C.navy, 0.06), 0, 0, 0), at(screenMesh(0.6, 0.38, 'wave', '#66e3a0'), 0, 0, 0.045));
  mon.position.set(0, 1.7, -0.35);
  g.add(mon, at(rbox(0.1, 0.4, 0.08, C.midGray, 0.03), 0, 1.35, -0.4));
  g.userData.status = statusLight(g, 0.65, 1.55, -0.3);
  return g;
}

export function makeORChart(): StationModel {
  const g = new THREE.Group() as StationModel;
  g.add(at(rbox(1.3, 0.85, 0.9, C.white, R), 0, 0.5, 0));
  drawers(g, 1.1, 0.62, 0.46, 2, 0.14, C.blue);
  casters(g, 1.3, 0.9, 0.05);
  g.add(at(rbox(1.36, 0.06, 0.96, C.lightGray, 0.03), 0, 0.96, 0));
  const mon = group(at(rbox(0.9, 0.62, 0.08, C.navy, 0.06), 0, 0, 0), at(screenMesh(0.78, 0.5, 'chart'), 0, 0, 0.045), at(rbox(0.12, 0.3, 0.08, C.midGray, 0.03), 0, -0.42, -0.04));
  mon.position.set(-0.1, 1.42, -0.15);
  g.add(mon);
  g.add(at(cyl(0.09, 0.08, 0.2, C.midGray, 12), 0.5, 1.09, 0.15));
  g.add(at(cyl(0.012, 0.012, 0.22, C.red, 6), 0.48, 1.22, 0.15), at(cyl(0.012, 0.012, 0.24, C.yellow, 6), 0.52, 1.23, 0.13), at(cyl(0.012, 0.012, 0.2, C.blueDeep, 6), 0.5, 1.21, 0.18));
  return g;
}

// ------------------------------------------------------------------ decor

export function makePlant(scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(0.62, 0.62, 0.62, C.white, 0.14), 0, 0.31, 0));
  g.add(at(rbox(0.54, 0.05, 0.54, '#7a5a3c', 0.04), 0, 0.6, 0));
  const leaves = [C.greenLeaf, C.greenLeafDark, '#72c060'];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.2;
    const tilt = 0.35 + (i % 3) * 0.18;
    const leaf = sph(0.16, leaves[i % 3], 10);
    leaf.scale.set(0.7, 2.6, 0.32);
    const piv = new THREE.Group();
    piv.position.set(0, 0.62, 0);
    piv.rotation.set(0, -a, tilt);
    leaf.position.set(0, 0.42, 0);
    piv.add(leaf);
    g.add(piv);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeBench(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    g.add(at(rbox(0.5, 0.12, 0.52, C.blue, 0.05), -0.55 + i * 0.55, 0.46, 0));
    g.add(at(rbox(0.5, 0.48, 0.1, C.blue, 0.05), -0.55 + i * 0.55, 0.74, -0.22));
  }
  g.add(at(rbox(1.7, 0.06, 0.4, C.midGray, 0.02), 0, 0.38, 0));
  return g;
}

export function makeSink(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(1.1, 0.88, 0.58, C.white, 0.08), 0, 0.44, 0));
  g.add(at(rbox(1.16, 0.07, 0.62, C.lightGray, 0.03), 0, 0.9, 0));
  g.add(at(rbox(0.5, 0.05, 0.32, '#b8d4e6', 0.03), 0, 0.93, 0.02));
  g.add(at(capsule(0.025, 0.14, C.midGray), 0, 1.05, -0.2));
  return g;
}

export { cyl };
