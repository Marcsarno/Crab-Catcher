import * as THREE from 'three';
import type { EnvironmentDef, LevelDef, StationDef, StationPlacement } from '../core/types';
import { STATIONS } from '../data/stations';
import { NavGrid, type Vec2 } from '../nav/NavGrid';
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
  /** Height for the floating label. */
  labelY: number;
  rot: number;
}

const WALL_H = 2.9;

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
  private hitList: THREE.Object3D[] = [];
  private floor!: THREE.Mesh;
  navDebug: THREE.Object3D | null = null;
  pathLine: THREE.Line | null = null;
  readonly dirLight: THREE.DirectionalLight;

  constructor() {
    this.scene.background = new THREE.Color('#cfe3f1');
    const hemi = new THREE.HemisphereLight('#ffffff', '#b6c6d6', 1.25);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight('#fff4e6', 1.9);
    dir.position.set(5, 14, 7);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    const sc = dir.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 40;
    dir.shadow.bias = -0.0008;
    dir.shadow.normalBias = 0.02;
    dir.shadow.radius = 3;
    this.dirLight = dir;
    this.scene.add(dir, dir.target);
    const fill = new THREE.DirectionalLight('#dbe9ff', 0.45);
    fill.position.set(-8, 6, 10);
    this.scene.add(fill);
  }

  build(env: EnvironmentDef, level: LevelDef): void {
    this.env = env;
    const root = new THREE.Group();
    root.name = 'level';
    this.scene.add(root);
    this.buildRoom(env, root);
    this.nav = new NavGrid(env.width, env.depth, 0.25, 0.32);
    this.navWide = new NavGrid(env.width, env.depth, 0.25, 0.75);

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
      if (def.kind !== 'bay' && def.kind !== 'preop') {
        this.nav.blockCentered(place.x, place.z, fw, fd);
        this.navWide.blockCentered(place.x, place.z, fw, fd);
      } else {
        // beds: block the bed itself (narrower than footprint incl. curtain), wide grid ignores beds (they move)
        this.nav.blockCentered(place.x, place.z, odd ? 2.5 : 1.15, odd ? 1.15 : 2.5);
      }
      const front = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const stand = place.stand
        ? { x: place.x + place.stand.x, z: place.z + place.stand.z }
        : { x: place.x + front.x * (def.d / 2 + 0.6), z: place.z + front.z * (def.d / 2 + 0.6) };
      const face = Math.atan2(place.x - stand.x, place.z - stand.z);
      // generous invisible hit box
      const hit = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.5, 2.4, fd + 0.5), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(place.x, 1.2, place.z);
      hit.userData.stationId = place.id;
      root.add(hit);
      this.hitList.push(hit);
      // stand-point marker
      const markerMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.0, depthWrite: false });
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 28), markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(stand.x, 0.02, stand.z);
      root.add(marker);
      this.stations.set(place.id, {
        def, place, model, center: new THREE.Vector3(place.x, 0, place.z), stand, face, hit, marker, markerMat,
        labelY: def.kind === 'bay' || def.kind === 'preop' ? 2.6 : def.kind === 'workstation' ? 2.75 : def.kind === 'scopeair' ? 2.5 : 2.3,
        rot,
      });
    }

    // decor
    for (const d of env.decor) {
      if (d.kind === 'plant') {
        const p = makePlant();
        p.position.set(d.x, 0, d.z);
        root.add(p);
        this.nav.blockCentered(d.x, d.z, 0.6, 0.6);
        this.navWide.blockCentered(d.x, d.z, 0.6, 0.6);
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
      ctx.fillStyle = 'rgba(43,168,160,0.16)';
      roundRect(ctx, 8, 8, W - 16, H - 16, 40); ctx.fill();
      ctx.setLineDash([26, 18]);
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(29,127,121,0.85)';
      roundRect(ctx, 8, 8, W - 16, H - 16, 40); ctx.stroke();
    });
    this.zoneMat = new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, opacity: 0, depthWrite: false });
    this.zone = plane(zw, zd, this.zoneMat);
    this.zone.rotation.x = -Math.PI / 2;
    this.zone.position.set((z.x0 + z.x1) / 2, 0.015, (z.z0 + z.z1) / 2);
    this.zone.receiveShadow = false;
    root.add(this.zone);

    // characters
    this.yolanda = makeHuman(YOLANDA_LOOK);
    this.yolanda.root.position.set(env.start.x, 0, env.start.z);
    this.yolanda.root.rotation.y = Math.PI;
    root.add(this.yolanda.root);

    for (const p of level.patients) {
      const pr = makeLyingPatient(p.look);
      this.patients.set(p.id, pr);
    }
  }

  makeNpc(id: string, look: HumanLook, x: number, z: number): Rig {
    const rig = makeHuman(look);
    rig.root.position.set(x, 0, z);
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
      case 'bay': return makeBed(true);
      case 'preop': return makeBed(false);
      case 'handoff': return makeHandoff();
      case 'airready': return makeAirReady();
      default: return makeChartDesk();
    }
  }

  private buildRoom(env: EnvironmentDef, root: THREE.Group): void {
    const W = env.width, D = env.depth;
    // floor
    const tileTex = canvasTex(`floor-${env.floor}`, 256, 256, (ctx, w, h) => {
      const a = env.floor === 'or' ? C.orFloorA : C.floorA;
      const b = env.floor === 'or' ? C.orFloorB : C.floorB;
      ctx.fillStyle = a; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = b; ctx.fillRect(0, 0, w / 2, h / 2); ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, w / 2, h / 2); ctx.strokeRect(w / 2, h / 2, w / 2, h / 2);
      ctx.strokeRect(w / 2, 0, w / 2, h / 2); ctx.strokeRect(0, h / 2, w / 2, h / 2);
    });
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(W / 3, D / 3);
    const floorMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.55 });
    this.floor = plane(W, D, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.userData.floor = true;
    root.add(this.floor);
    this.hitList.push(this.floor);
    // outer ground (the "diorama" base)
    const base = at(rbox(W + 0.8, 0.4, D + 0.8, C.navyLight, 0.12, false), 0, -0.21, 0);
    root.add(base);

    const wallM = mat(C.wall);
    const trimM = mat(C.blue);
    const capM = mat(C.wallTop);
    const t = 0.25;
    const mkWall = (len: number, h: number, x: number, z: number, alongX: boolean, trim = true) => {
      const w = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : t, h, alongX ? t : len), wallM);
      body.position.y = h / 2;
      body.receiveShadow = true;
      body.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len + 0.02 : t + 0.04, 0.08, alongX ? t + 0.04 : len + 0.02), capM);
      cap.position.y = h + 0.04;
      w.add(body, cap);
      if (trim) {
        const tr = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : t + 0.02, 0.16, alongX ? t + 0.02 : len), trimM);
        tr.position.y = 0.08;
        const band = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : t + 0.02, 0.08, alongX ? t + 0.02 : len), mat(C.tealLight));
        band.position.y = 1.15;
        w.add(tr, band);
      }
      w.position.set(x, 0, z);
      root.add(w);
      return w;
    };
    // back wall (full), side walls (full height, they frame the diorama)
    mkWall(W + t * 2, WALL_H, 0, -D / 2 - t / 2, true);
    mkWall(D, WALL_H, -W / 2 - t / 2, 0, false);
    mkWall(D, WALL_H * 0.42, W / 2 + t / 2, 0, false);
    // front lip
    const lip = at(rbox(W + t * 2, 0.22, t, C.wallTop, 0.03, false), 0, 0.11, D / 2 + t / 2);
    root.add(lip);

    // door on the back wall
    const dx = env.door.x;
    const door = new THREE.Group();
    door.add(at(rbox(1.5, 2.25, 0.12, C.blue, 0.04), 0, 1.13, 0));
    door.add(at(rbox(1.36, 2.12, 0.14, C.blueLight, 0.04), 0, 1.1, 0.02));
    door.add(at(rbox(0.4, 0.5, 0.15, '#cfeaff', 0.03), 0.25, 1.55, 0.03));
    door.add(at(rbox(0.06, 0.3, 0.17, C.midGray, 0.02), -0.45, 1.05, 0.05));
    door.position.set(dx, 0, -D / 2 + 0.02);
    root.add(door);

    // sign
    const sign = textPlane(env.sign, 3.4, 0.62, C.navy, null, 'bold 92px system-ui, sans-serif', 'PEOPLE · SAFER CARE · CALM');
    sign.position.set(env.stations.find((s) => s.id === 'sedaprep')?.x ?? 3.5, 2.35, -D / 2 + 0.03);
    root.add(sign);
    const line = at(rbox(2.8, 0.04, 0.02, C.blue, 0.01, false), sign.position.x, 2.18, -D / 2 + 0.04);
    root.add(line);

    for (const d of env.decor) {
      if (d.kind === 'window') {
        const g = new THREE.Group();
        g.add(at(rbox(0.12, 1.4, 2.4, C.white, 0.04), 0, 1.6, 0));
        const glassTex = canvasTex('window-sky', 128, 128, (ctx, w, h) => {
          const gr = ctx.createLinearGradient(0, 0, 0, h);
          gr.addColorStop(0, '#9fd4f5'); gr.addColorStop(1, '#e6f6ff');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#8cc98a';
          ctx.beginPath(); ctx.arc(30, 120, 34, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(95, 128, 40, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d3dde8'; ctx.fillRect(60, 60, 26, 60);
        });
        const glass = plane(2.2, 1.2, new THREE.MeshBasicMaterial({ map: glassTex }));
        glass.position.set(0.07, 1.6, 0);
        glass.rotation.y = Math.PI / 2;
        g.add(glass);
        g.add(at(rbox(0.14, 0.06, 2.3, C.white, 0.02), 0.02, 1.6, 0));
        g.position.set(d.x + 0.02, 0, d.z);
        root.add(g);
      } else if (d.kind === 'poster') {
        const p = textPlane('Calm · Care', 1.4, 1.0, C.blueDeep, '#f7fbff', 'bold 70px system-ui, sans-serif', 'Progress Together ♥');
        p.position.set(d.x, 1.75, d.z + 0.03);
        root.add(p);
      }
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

