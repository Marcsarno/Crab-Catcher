// Dev-only character preview: /dev/charview.html (not part of the build).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as EQ from '../src/render/models/equipment';
import { makeHuman, makeLyingPatient, animateRig, animatePatient, YOLANDA_LOOK, type HumanLook } from '../src/render/models/characters';

const q = new URLSearchParams(location.search);
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(innerWidth, innerHeight);
r.setPixelRatio(2);
r.toneMapping = THREE.ACESFilmicToneMapping;
r.shadowMap.enabled = true;
document.body.append(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe0f2');
const pm = new THREE.PMREMGenerator(r);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;
scene.add(new THREE.HemisphereLight('#ffffff', '#b8c8dc', 1.2));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
sun.position.set(3, 6, 4);
sun.castShadow = true;
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#b9cfe8' }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const looks: HumanLook[] = [
  YOLANDA_LOOK,
  { skin: '#8d5a3b', hair: '#1f1a17', hairStyle: 'cap', capColor: '#4a7fc6', top: '#4a7fc6', pants: '#3f6fb0', shoes: '#e8eef3', mask: true },
  { skin: '#e6b48f', hair: '#3a2a20', hairStyle: 'bun', top: '#3cb878', pants: '#3fa877', shoes: '#f4f6f8', badge: true },
  { skin: '#c9906a', hair: '#2a211c', hairStyle: 'short', top: '#6a93c9', pants: '#5a82b8', shoes: '#f4f6f8', badge: true },
];
const anim = (q.get('anim') ?? 'idle') as never;
const rigs = looks.map((l, i) => { const g = makeHuman(l); g.root.position.x = (i - 1.5) * 1.3; g.anim = anim; g.t = 1; scene.add(g.root); return g; });
const pat = makeLyingPatient({ skin: '#d9a77f', hair: '#2b211b', gown: '#9cc3ea', hairStyle: 'short' });
pat.root.position.set(0, 0.7, -2); if (q.get("anx")) pat.state = "anxious";
scene.add(pat.root);
if (q.get('st')) {
  for (const o of [...rigs.map((r) => r.root), pat.root]) o.visible = false;
  const makers = q.get('st')!.split(',').map((n) => (EQ as Record<string, () => THREE.Object3D>)[n]());
  makers.forEach((m, i) => { m.position.x = (i - (makers.length - 1) / 2) * 3; scene.add(m); });
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
}
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 30), innerWidth / innerHeight, 0.1, 100);
const yaw = Number(q.get('yaw') ?? 0), pitch = Number(q.get('pitch') ?? 0.35), dist = Number(q.get('d') ?? 9);
cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, 1 + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
cam.lookAt(Number(q.get("lx") ?? 0), Number(q.get("ly") ?? 1), Number(q.get("lz") ?? -0.5));
let last = performance.now();
function loop(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  for (const g of rigs) animateRig(g, dt, false);
  animatePatient(pat, dt);
  r.render(scene, cam);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
