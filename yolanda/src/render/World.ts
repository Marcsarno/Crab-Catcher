import * as THREE from 'three';
import type { EnvironmentDef, LevelDef, StationDef, StationPlacement } from '../core/types';
import { STATIONS } from '../data/stations';
import { NavGrid, type Vec2 } from '../nav/NavGrid';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { C, at, canvasTex, mat, plane, rbox, textPlane } from './palette';
import {
  makeAirReady, makeBed, makeBench, makeChartDesk, makeHandoff, makePlant, makeScopeAir, makeSedaPrep,
  makeSink, makeSupplies, makeWorkstation, type StationModel,
} from './models/equipment';
import { makeHuman, makeLyingPatient, YOLANDA_LOOK, type HumanLook, type PatientRig, type Rig } from './models/characters';

export interface StationView {
  def: StationDef;
  place: StationPlacement;
  model: StationModel;
  center: THREE.Vector3;
  stand: Vec2;
  /** Yaw Yolanda should face when working here. */
  face: number;
  hit: THREE.Mesh;
  marker: THREE.Mesh;
  markerMat: THREE.MeshBasicMaterial;
  /** Where the station's name tag sits (front edge, near the floor). */
  labelPos: THREE.Vector3;
  /** Top of the model (for the "go here next" arrow). */
  topY: number;
  rot: number;
}

const WALL_H = 3.1;

/** Soft round contact-shadow texture (cheap ambient occlusion under objects). */
function blobTex(): THREE.Texture {
  return canvasTex('blob', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(30,50,80,0.55)');
    g.addColorStop(0.55, 'rgba(30,50,80,0.28)');
    g.addColorStop(1, 'rgba(30,50,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export class World {
  readonly scene = new THREE.Scene();
  readonly stations = new Map<string, StationView>();
  nav!: NavGrid;
  navWide!: NavGrid;
  yolanda!: Rig;
  readonly npcs = new Map<string, Rig>();
  readonly patients = new Map<string, PatientRig>();
  zone!: THREE.Mesh;
  zoneMat!: THREE.MeshBasicMaterial;
  env!: EnvironmentDef;
  /** Bouncing "go here next" chevron. */
  arrow!: THREE.Group;
  private hitList: THREE.Object3D[] = [];
  private floor!: THREE.Mesh;
  navDebug: THREE.Object3D | null = null;
  pathLine: THREE.Line | null = null;
  readonly dirLight: THREE.DirectionalLight;
  private blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });

  constructor() {
    this.scene.background = new THREE.Color('#8fb0d6');
    const hemi = new THREE.HemisphereLight('#fff6e8', '#7f9cc4', 0.6);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight('#fff0d8', 1.7);
    dir.position.set(-6, 15, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const sc = dir.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 45;
    dir.shadow.bias = -0.0006;
    dir.shadow.normalBias = 0.03;
    dir.shadow.radius = 4;
    this.dirLight = dir;
    this.scene.add(dir, dir.target);
  }

  /** Image-based lighting gives the soft, glossy plastic look. Call once with the renderer. */
  initEnvironment(renderer: THREE.WebGLRenderer): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();
  }

  private blob(root: THREE.Object3D, x: number, z: number, w: number, d: number, yaw = 0, opacity = 1): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), opacity === 1 ? this.blobMat : this.blobMat.clone());
    if (opacity !== 1) (m.material as THREE.MeshBasicMaterial).opacity = opacity;
    m.rotation.set(-Math.PI / 2, 0, yaw);
    m.position.set(x, 0.012, z);
    m.renderOrder = 1;
    root.add(m);
    return m;
  }

  /** Block a rectangle given in a station's local frame. */
  private blockLocal(place: StationPlacement, lx: number, lz: number, w: number, d: number, grids: NavGrid[]): void {
    const yaw = (place.rot ?? 0) * Math.PI / 2;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const wx = place.x + lx * c + lz * s, wz = place.z - lx * s + lz * c;
    const odd = (place.rot ?? 0) % 2 === 1;
    for (const g of grids) g.blockCentered(wx, wz, odd ? d : w, odd ? w : d);
  }

  build(env: EnvironmentDef, level: LevelDef): void {
    this.env = env;
    const root = new THREE.Group();
    root.name = 'level';
    this.scene.add(root);
    this.nav = new NavGrid(env.width, env.depth, 0.25, 0.34);
    this.navWide = new NavGrid(env.width, env.depth, 0.25, 0.8);
    this.buildRoom(env, root);
    // Only the floor the fixed camera shows is walkable: block cells outside the
    // on-screen band so paths never route Yolanda off the edge of the phone.
    {
      const cy = Math.cos(env.camYaw), sy = Math.sin(env.camYaw);
      const xs = env.stations.map((p) => p.x * cy - p.z * sy);
      const uMin = Math.min(...xs) - 1.6, uMax = Math.max(...xs) + 1.6;
      for (const g of [this.nav, this.navWide]) {
        for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
          const w = g.toWorld(c, r);
          const u = w.x * cy - w.z * sy;
          if (u < uMin || u > uMax) g.blocked[g.idx(c, r)] = 1;
        }
      }
    }

    for (const place of env.stations) {
      const def = STATIONS[place.id];
      const model = this.makeStation(def);
      const rot = place.rot ?? 0;
      const yaw = rot * Math.PI / 2;
      model.position.set(place.x, 0, place.z);
      model.rotation.y = yaw;
      root.add(model);
      const odd = rot % 2 === 1;
      const fw = odd ? def.d : def.w, fd = odd ? def.w : def.d;
      if (def.kind === 'bay' || def.kind === 'preop') {
        // the bed itself (the wide grid ignores beds: they move during transport)
        this.blockLocal(place, 0, 0, 1.25, 2.6, [this.nav]);
        if (def.kind === 'bay') {
          // cubicle partitions + side table
          this.blockLocal(place, -0.2, -1.65, 2.15, 0.2, [this.nav, this.navWide]);
          this.blockLocal(place, -1.27, -0.1, 0.2, 3.1, [this.nav, this.navWide]);
          this.blockLocal(place, -0.72, -1.35, 0.5, 0.45, [this.nav]);
        }
        this.blob(root, place.x, place.z, 1.9, 3.3, yaw, 0.9);
      } else {
        this.nav.blockCentered(place.x, place.z, fw, fd);
        this.navWide.blockCentered(place.x, place.z, fw, fd);
        this.blob(root, place.x, place.z, fw + 0.7, fd + 0.7, 0, 0.85);
      }
      const front = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const stand = place.stand
        ? { x: place.x + place.stand.x, z: place.z + place.stand.z }
        : { x: place.x + front.x * (def.d / 2 + 0.6), z: place.z + front.z * (def.d / 2 + 0.6) };
      const face = Math.atan2(place.x - stand.x, place.z - stand.z);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.6, 2.6, fd + 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(place.x, 1.3, place.z);
      hit.userData.stationId = place.id;
      root.add(hit);
      this.hitList.push(hit);
      const markerMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.0, depthWrite: false });
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 32), markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(stand.x, 0.02, stand.z);
      root.add(marker);
      // name tag: just in front of the station, low down (like the concept art)
      const isBed = def.kind === 'bay' || def.kind === 'preop';
      const lp = isBed
        ? new THREE.Vector3(place.x - 0.2, 0.55, place.z + 1.55)
        : new THREE.Vector3(place.x + front.x * (def.d / 2 + 0.05), 0.5, place.z + front.z * (def.d / 2 + 0.05));
      const topY = def.kind === 'workstation' ? 2.75 : isBed ? 2.2 : def.kind === 'sedaprep' ? 2.5 : def.kind === 'scopeair' ? 2.2 : def.kind === 'handoff' ? 3.2 : 1.9;
      this.stations.set(place.id, { def, place, model, center: new THREE.Vector3(place.x, 0, place.z), stand, face, hit, marker, markerMat, labelPos: lp, topY, rot });
    }

    for (const d of env.decor) {
      if (d.kind === 'plant') {
        const p = makePlant(d.scale ?? 1);
        p.position.set(d.x, 0, d.z);
        p.rotation.y = d.x * 1.7;
        root.add(p);
        const r = 0.7 * (d.scale ?? 1);
        this.nav.blockCentered(d.x, d.z, r, r);
        this.navWide.blockCentered(d.x, d.z, r, r);
        this.blob(root, d.x, d.z, r + 0.5, r + 0.5);
      } else if (d.kind === 'bench') {
        const b = makeBench();
        b.position.set(d.x, 0, d.z);
        b.rotation.y = (d.rot ?? 0) * Math.PI / 2;
        root.add(b);
        const odd = (d.rot ?? 0) % 2 === 1;
        this.nav.blockCentered(d.x, d.z, odd ? 0.6 : 1.8, odd ? 1.8 : 0.6);
        this.navWide.blockCentered(d.x, d.z, odd ? 0.6 : 1.8, odd ? 1.8 : 0.6);
      } else if (d.kind === 'sink') {
        const s = makeSink();
        s.position.set(d.x, 0, d.z);
        root.add(s);
        this.nav.blockCentered(d.x, d.z, 1.1, 0.6);
        this.navWide.blockCentered(d.x, d.z, 1.1, 0.6);
      }
    }

    // patient zone decal (shown during active care)
    const z = env.patientZone;
    const zw = z.x1 - z.x0, zd = z.z1 - z.z0;
    const zoneTex = canvasTex(`zone-${zw}-${zd}`, 512, Math.round(512 * zd / zw), (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(43,168,160,0.14)';
      roundRect(ctx, 8, 8, W - 16, H - 16, 40); ctx.fill();
      ctx.setLineDash([26, 18]);
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(29,127,121,0.85)';
      roundRect(ctx, 8, 8, W - 16, H - 16, 40); ctx.stroke();
    });
    this.zoneMat = new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, opacity: 0, depthWrite: false });
    this.zone = plane(zw, zd, this.zoneMat);
    this.zone.rotation.x = -Math.PI / 2;
    this.zone.position.set((z.x0 + z.x1) / 2, 0.016, (z.z0 + z.z1) / 2);
    this.zone.receiveShadow = false;
    root.add(this.zone);

    // "go here next" chevron
    const arrow = new THREE.Group();
    const am = new THREE.MeshStandardMaterial({ color: C.yellow, emissive: C.yellow, emissiveIntensity: 0.45, roughness: 0.4 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 4), am);
    cone.rotation.x = Math.PI;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.16), am);
    stem.position.y = 0.34;
    arrow.add(cone, stem);
    arrow.scale.setScalar(1.7);
    arrow.visible = false;
    root.add(arrow);
    this.arrow = arrow;

    // characters
    this.yolanda = makeHuman(YOLANDA_LOOK);
    this.yolanda.root.position.set(env.start.x, 0, env.start.z);
    this.yolanda.root.rotation.y = Math.PI;
    root.add(this.yolanda.root);
    this.blob(this.yolanda.root, 0, 0, 1.0, 1.0);

    for (const p of level.patients) {
      const pr = makeLyingPatient(p.look);
      this.patients.set(p.id, pr);
    }
  }

  makeNpc(id: string, look: HumanLook, x: number, z: number): Rig {
    const rig = makeHuman(look);
    rig.root.position.set(x, 0, z);
    this.blob(rig.root, 0, 0, 1.0, 1.0);
    this.scene.getObjectByName('level')!.add(rig.root);
    this.npcs.set(id, rig);
    return rig;
  }

  private makeStation(def: StationDef): StationModel {
    switch (def.kind) {
      case 'chart': return makeChartDesk();
      case 'sedaprep': return makeSedaPrep();
      case 'scopeair': return makeScopeAir();
      case 'supplies': return makeSupplies();
      case 'workstation': return makeWorkstation();
      case 'bay': return makeBed(true, '1');
      case 'preop': return makeBed(false);
      case 'handoff': return makeHandoff();
      case 'airready': return makeAirReady();
      default: return makeChartDesk();
    }
  }

  private buildRoom(env: EnvironmentDef, root: THREE.Group): void {
    const W = env.width, D = env.depth;
    // glossy tiled floor
    const tileTex = canvasTex(`floor-${env.floor}`, 256, 256, (ctx, w, h) => {
      const a = env.floor === 'or' ? C.orFloorA : C.floorA;
      const b = env.floor === 'or' ? C.orFloorB : C.floorB;
      ctx.fillStyle = a; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = b; ctx.fillRect(0, 0, w / 2, h / 2); ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      for (let i = 0; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * w / 2, 0); ctx.lineTo(i * w / 2, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * h / 2); ctx.lineTo(w, i * h / 2); ctx.stroke(); }
    });
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(W / 2.4, D / 2.4);
    const floorMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.42, metalness: 0.0, envMapIntensity: 0.3 });
    this.floor = plane(W, D, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.userData.floor = true;
    root.add(this.floor);
    this.hitList.push(this.floor);
    root.add(at(rbox(W + 0.6, 0.5, D + 0.6, C.navyLight, 0.1, false), 0, -0.26, 0));

    // two visible walls (back + left), cream with a blue wainscot, like a cutaway diorama
    const t = 0.32;
    const mkWall = (len: number, x: number, z: number, alongX: boolean) => {
      const w = new THREE.Group();
      const geo = (h: number, extra = 0) => new THREE.BoxGeometry(alongX ? len : t + extra, h, alongX ? t + extra : len);
      const upper = new THREE.Mesh(geo(WALL_H - 1.1), mat(C.cream, { rough: 0.85 }));
      upper.position.y = 1.1 + (WALL_H - 1.1) / 2;
      const lower = new THREE.Mesh(geo(1.1), mat(C.wainscot, { rough: 0.7 }));
      lower.position.y = 0.55;
      const rail = new THREE.Mesh(geo(0.1, 0.06), mat(C.white));
      rail.position.y = 1.12;
      const skirt = new THREE.Mesh(geo(0.18, 0.05), mat(C.blue));
      skirt.position.y = 0.09;
      const cap = new THREE.Mesh(geo(0.12, 0.06), mat(C.creamDark));
      cap.position.y = WALL_H + 0.06;
      for (const m of [upper, lower]) { m.receiveShadow = true; m.castShadow = true; }
      w.add(upper, lower, rail, skirt, cap);
      w.position.set(x, 0, z);
      root.add(w);
      return w;
    };
    mkWall(W + t, -t / 2, -D / 2 - t / 2, true);
    mkWall(D + t, -W / 2 - t / 2, -t / 2, false);
    // corner post
    root.add(at(rbox(t + 0.06, WALL_H + 0.12, t + 0.06, C.creamDark, 0.03), -W / 2 - t / 2, (WALL_H + 0.12) / 2, -D / 2 - t / 2));

    const onWall = (o: THREE.Object3D, x: number, z: number, rot: number, y: number) => {
      // rot 0 = back wall (faces +z), rot 1 = left wall (faces +x)
      o.position.set(rot === 1 ? -W / 2 + 0.02 : x, y, rot === 1 ? z : -D / 2 + 0.02);
      o.rotation.y = rot === 1 ? Math.PI / 2 : 0;
      root.add(o);
    };
    for (const d of env.decor) {
      const rot = d.rot ?? 0;
      if (d.kind === 'window') {
        const g = new THREE.Group();
        g.add(at(rbox(2.3, 1.6, 0.14, C.white, 0.06), 0, 0, 0));
        const sky = canvasTex('window-view', 256, 180, (ctx, w, h) => {
          const gr = ctx.createLinearGradient(0, 0, 0, h);
          gr.addColorStop(0, '#8fcaf2'); gr.addColorStop(1, '#dff3ff');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#e8d9c9'; ctx.fillRect(150, 40, 70, 140);
          ctx.fillStyle = '#b9cfe6'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ctx.fillRect(160 + j * 30, 52 + i * 30, 18, 18);
          ctx.fillStyle = '#7cc46d';
          for (const [cx, cy, r] of [[40, 160, 52], [100, 175, 48], [230, 178, 40], [10, 120, 36]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = '#5faa55';
          for (const [cx, cy, r] of [[60, 150, 30], [120, 165, 26]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        });
        g.add(at(plane(2.06, 1.36, new THREE.MeshBasicMaterial({ map: sky })), 0, 0, 0.075));
        g.add(at(rbox(0.07, 1.4, 0.18, C.white, 0.02), 0, 0, 0.06));
        g.add(at(rbox(2.4, 0.1, 0.32, C.white, 0.03), 0, -0.82, 0.1));
        onWall(g, d.x, d.z, rot, 1.85);
      } else if (d.kind === 'door') {
        const g = new THREE.Group();
        g.add(at(rbox(1.6, 2.4, 0.12, C.white, 0.05), 0, 1.2, 0));
        g.add(at(rbox(1.36, 2.22, 0.14, C.blue, 0.05), 0, 1.12, 0.02));
        g.add(at(rbox(0.42, 0.6, 0.15, '#d6efff', 0.04), 0.25, 1.55, 0.03));
        g.add(at(rbox(0.08, 0.34, 0.2, C.lightGray, 0.03), -0.48, 1.05, 0.06));
        onWall(g, d.x, d.z, rot, 0);
      } else if (d.kind === 'sign') {
        const g = new THREE.Group();
        g.add(at(rbox(3.2, 1.0, 0.08, C.white, 0.08), 0, 0, 0));
        const tx = textPlane(env.sign, 2.9, 0.7, C.blueDeep, null, 'bold 120px system-ui, sans-serif', 'PEOPLE · SAFER CARE · HEALTHIER TOMORROW');
        g.add(at(tx, 0, 0, 0.045));
        onWall(g, d.x, d.z, rot, 2.25);
      } else if (d.kind === 'poster') {
        const g = new THREE.Group();
        g.add(at(rbox(1.3, 1.5, 0.06, C.white, 0.06), 0, 0, 0));
        const tex = canvasTex('poster-calm', 260, 300, (ctx, w, h) => {
          ctx.fillStyle = '#f9fbff'; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#3b68c2';
          ctx.font = 'bold 44px system-ui, sans-serif';
          ['Calm', 'Care', 'Progress', 'Together'].forEach((t2, i) => ctx.fillText(t2, 22, 64 + i * 52));
          ctx.fillStyle = '#5a8ade';
          ctx.beginPath(); ctx.moveTo(210, 70); ctx.bezierCurveTo(250, 30, 260, 90, 210, 120); ctx.bezierCurveTo(160, 90, 170, 30, 210, 70); ctx.fill();
          ctx.fillRect(22, 270, 120, 8);
        });
        g.add(at(plane(1.18, 1.36, new THREE.MeshBasicMaterial({ map: tex })), 0, 0, 0.035));
        onWall(g, d.x, d.z, rot, 1.95);
      }
    }
  }

  private faded = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  /** Cutaway: fade stations that stand between the camera and `focusId`. */
  setCutaway(focusId: string | null): void {
    // restore everything first
    for (const [m, orig] of this.faded) m.material = orig;
    this.faded.clear();
    if (!focusId) return;
    const f = this.stations.get(focusId);
    if (!f) return;
    const cy = Math.cos(this.env.camYaw), sy = Math.sin(this.env.camYaw);
    const uOf = (x: number, z: number) => x * cy - z * sy;
    const vOf = (x: number, z: number) => x * sy + z * cy;
    const fu = uOf(f.center.x, f.center.z), fv = vOf(f.center.x, f.center.z);
    for (const sv of this.stations.values()) {
      if (sv === f) continue;
      const u = uOf(sv.center.x, sv.center.z), v = vOf(sv.center.x, sv.center.z);
      if (v <= fv || v - fv > 4.5 || Math.abs(u - fu) > 2.4) continue;
      sv.model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        this.faded.set(m, m.material);
        const fade = (mat: THREE.Material) => { const c = mat.clone(); c.transparent = true; c.opacity = 0.18; c.depthWrite = false; return c; };
        m.material = Array.isArray(m.material) ? m.material.map(fade) : fade(m.material);
      });
    }
  }

  /** Raycast a normalized device coordinate against stations then floor. */
  pick(ndc: THREE.Vector2, camera: THREE.Camera): { station?: string; floor?: Vec2 } | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(this.hitList, false);
    for (const h of hits) {
      if (h.object.userData.stationId) return { station: h.object.userData.stationId };
      if (h.object.userData.floor) return { floor: { x: h.point.x, z: h.point.z } };
    }
    return null;
  }

  showNavDebug(on: boolean): void {
    if (this.navDebug) { this.scene.remove(this.navDebug); this.navDebug = null; }
    if (!on) return;
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: '#e05656', transparent: true, opacity: 0.35, depthWrite: false });
    const geo = new THREE.PlaneGeometry(this.nav.cell * 0.9, this.nav.cell * 0.9);
    for (let r = 0; r < this.nav.rows; r++) for (let c = 0; c < this.nav.cols; c++) {
      if (!this.nav.isBlocked(c, r)) continue;
      const w = this.nav.toWorld(c, r);
      const q = new THREE.Mesh(geo, m);
      q.rotation.x = -Math.PI / 2;
      q.position.set(w.x, 0.03, w.z);
      g.add(q);
    }
    this.navDebug = g;
    this.scene.add(g);
  }

  showPath(path: Vec2[] | null): void {
    if (this.pathLine) { this.scene.remove(this.pathLine); this.pathLine.geometry.dispose(); this.pathLine = null; }
    if (!path || !this.navDebug) return;
    const geo = new THREE.BufferGeometry().setFromPoints(path.map((p) => new THREE.Vector3(p.x, 0.08, p.z)));
    this.pathLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#1e3550' }));
    this.scene.add(this.pathLine);
  }

  dispose(): void {
    this.faded.clear();
    const lvl = this.scene.getObjectByName('level');
    if (lvl) this.scene.remove(lvl);
    this.showNavDebug(false);
    this.stations.clear();
    this.npcs.clear();
    this.patients.clear();
    this.hitList = [];
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function setStatus(m: THREE.MeshStandardMaterial | undefined, s: 'idle' | 'running' | 'ready' | 'alert'): void {
  if (!m) return;
  const col = s === 'ready' ? C.green : s === 'running' ? C.yellow : s === 'alert' ? C.red : C.midGray;
  m.color.set(col);
  m.emissive.set(s === 'idle' ? '#000000' : col);
  m.emissiveIntensity = s === 'idle' ? 0 : 0.9;
}

