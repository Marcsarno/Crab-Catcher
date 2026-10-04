import * as THREE from 'three';
import { ActionQueue } from './ActionQueue';
import { Inventory } from './Inventory';
import { newMetrics, scoreLevel, type Metrics, type ScoreResult } from './Scoring';
import { TaskSystem, type CaseRT, type TaskRT } from './TaskSystem';
import type { DelegationDef, LevelDef, Phase } from './types';
import { ENVIRONMENTS } from '../data/environments';
import { ITEMS } from '../data/items';
import { STAFF_ROLES } from '../data/staffRoles';
import { pathLength, type Vec2 } from '../nav/NavGrid';
import type { World, StationView } from '../render/World';
import { setStatus } from '../render/World';
import type { CameraRig } from '../render/CameraRig';
import { animatePatient, animateRig, tintTrayToken, type HumanLook, type Rig } from '../render/models/characters';
import type { AudioSys } from '../audio/Audio';
import { C } from '../render/palette';

export type Mode = 'card' | 'prep' | 'room' | 'handoff' | 'results' | 'paused';

type YState =
  | { k: 'idle' }
  | { k: 'move'; path: Vec2[]; i: number; station: string | null }
  | { k: 'work'; task: TaskRT; station: string }
  | { k: 'collect'; task: TaskRT; t: number; station: string }
  | { k: 'wait'; task: TaskRT | null; station: string; why: 'machine' | 'proceduralist' }
  | { k: 'transport'; c: CaseRT; task: TaskRT; path: Vec2[]; i: number; bed: THREE.Object3D }
  | { k: 'overlay' };

interface Walker {
  rig: Rig;
  path: Vec2[];
  i: number;
  speed: number;
  onArrive?: () => void;
  face?: number;
}

interface Delegation {
  def: DelegationDef;
  left: number;
  total: number;
  caseId: string;
}

export interface GameUI {
  toast(text: string, kind?: 'info' | 'good' | 'warn' | 'bad'): void;
  hint(text: string | null, focus?: string | null): void;
  openPrep(): void;
  closePrep(): void;
  openHandoff(c: CaseRT, facts: { text: string; correct: boolean }[], done: (picked: number[]) => void): void;
  showResults(r: ScoreResult): void;
  bump(stationId: string): void;
  reveal(title: string, text: string): void;
}

const YOLANDA_SPEED = 3.1;
const PROC_LOOK: HumanLook = { skin: '#8d5a3b', hair: '#1f1a17', hairStyle: 'cap', capColor: '#4a7fc6', top: '#4a7fc6', pants: '#3f6fb0', shoes: '#e8eef3', mask: true };
const PACU_LOOK: HumanLook = { skin: '#e6b48f', hair: '#3a2a20', hairStyle: 'bun', top: C.green, pants: '#3fa877', shoes: '#f4f6f8', badge: true };
const TECH_LOOK: HumanLook = { skin: '#c9906a', hair: '#2a211c', hairStyle: 'short', top: '#6a93c9', pants: '#5a82b8', shoes: '#f4f6f8', badge: true };

export class Game {
  readonly ts: TaskSystem;
  readonly inv = new Inventory(4);
  readonly queue = new ActionQueue();
  readonly metrics: Metrics = newMetrics();
  mode: Mode = 'card';
  private prevMode: Mode = 'room';
  y: YState = { k: 'idle' };
  speed = 1;
  elapsed = 0;
  private walkers: Walker[] = [];
  delegations: Delegation[] = [];
  private stepTimer = 0;
  private tutorialIdx = 0;
  tutorialOn: boolean;
  private finished = false;
  private beds = new Map<string, THREE.Object3D>();
  procSpawned = new Set<string>();
  result: ScoreResult | null = null;
  private pickedThisVisit: string[] = [];
  private lastHint: string | null = null;
  private exitAnims: { obj: THREE.Object3D; t: number; from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  focusStation: string | null = null;
  private eventBeepT = 0;

  constructor(
    readonly level: LevelDef,
    readonly world: World,
    readonly cam: CameraRig,
    readonly audio: AudioSys,
    readonly ui: GameUI,
    hints: boolean,
  ) {
    this.tutorialOn = hints && !!level.tutorial;
    const env = ENVIRONMENTS[level.environmentId];
    world.build(env, level);
    this.ts = new TaskSystem(level);
    this.setupCamera();

    // Yolanda starts at the supply cart: every case begins with the prep close-up.
    const sup = world.stations.get('supplies')!;
    world.yolanda.root.position.set(sup.stand.x, 0, sup.stand.z);
    world.yolanda.root.rotation.y = sup.face;

    // patients onto their beds
    for (const c of this.ts.cases) {
      const bay = world.stations.get(c.patient.bay)!;
      const pr = world.patients.get(c.id)!;
      bay.model.userData.patientMount!.add(pr.root);
      pr.state = c.patient.anxious ? 'anxious' : 'awake';
      pr.root.visible = c.patient.arrival <= 0;
      this.beds.set(c.id, bay.model.userData.bed!);
    }
    // PACU nurse behind the handoff counter
    const ho = world.stations.get('handoff');
    if (ho) {
      const back = { x: ho.center.x - (ho.stand.x - ho.center.x) * 0.72, z: ho.center.z - (ho.stand.z - ho.center.z) * 0.72 };
      const nurse = world.makeNpc('pacu', PACU_LOOK, back.x, back.z);
      nurse.root.rotation.y = ho.face + Math.PI;
    }
    if (level.staff.includes('tech')) {
      const t = world.makeNpc('tech', TECH_LOOK, env.door.x + 1.4, env.door.z + 1.6);
      t.root.rotation.y = Math.PI;
    }

    this.ts.bus.on('phase', (c) => this.onPhase(c));
    this.ts.bus.on('ready', (t) => {
      this.audio.play('ready');
      this.ui.toast(`${t.def.label ?? t.def.name} READY`, 'good');
    });
    this.ts.bus.on('eventFired', (t) => {
      this.audio.play('alert');
      this.ui.toast(`${t.event!.def.bubble}!`, 'warn');
      this.cam.kick(0.06);
    });
    this.ts.bus.on('reveal', ({ c, mod }) => {
      this.audio.play('reveal');
      this.ui.reveal(`${mod.name} · ${c.patient.name}`, mod.description);
    });
    this.ts.bus.on('arrived', (c) => {
      if (c.patient.arrival > 0) {
        const pr = world.patients.get(c.id)!;
        pr.root.visible = true;
        this.ui.toast(`${c.patient.name} arrived in ${world.stations.get(c.patient.bay)?.def.name}`, 'info');
      }
    });
    this.ts.refresh();
  }

  // ------------------------------------------------------------------ camera

  private setupCamera(): void {
    const env = this.world.env;
    const W = env.width / 2, D = env.depth / 2;
    const room = [
      new THREE.Vector3(-W, 0, -D), new THREE.Vector3(W, 0, -D), new THREE.Vector3(-W, 0, D), new THREE.Vector3(W, 0, D),
      new THREE.Vector3(-W, 2.6, -D), new THREE.Vector3(W, 2.6, -D),
    ];
    // margins: [left, right, bottom, top] in NDC — leave room for the top bar and Prep Tray
    const q = new URLSearchParams(location.search);
    const ryaw = Number(q.get('yaw') ?? 0), rpitch = Number(q.get('pitch') ?? 0.98);
    this.cam.define('room', room, ryaw, rpitch, [0.0, 0.0, 0.34, 0.2]);
    const z = env.patientZone;
    const zone = [
      new THREE.Vector3(z.x0, 0, z.z0), new THREE.Vector3(z.x1, 0, z.z0), new THREE.Vector3(z.x0, 0, z.z1), new THREE.Vector3(z.x1, 0, z.z1),
      new THREE.Vector3(z.x0, 2.4, z.z0), new THREE.Vector3(z.x1, 2.6, z.z0),
    ];
    this.cam.define('active', zone, 0, 0.92, [0.04, 0.04, 0.5, 0.3]);
    const sup = this.world.stations.get('supplies')!;
    const c = sup.center;
    const frontYaw = (sup.rot * Math.PI) / 2;
    const yaw = frontYaw + 0.62; // look at the cart's front, from the side Yolanda is not standing on
    const prepPts = [
      new THREE.Vector3(c.x, 0.2, c.z - 1.0), new THREE.Vector3(c.x, 0.2, c.z + 1.0), new THREE.Vector3(c.x, 1.5, c.z - 1.0), new THREE.Vector3(c.x, 1.5, c.z + 1.0),
      new THREE.Vector3(sup.stand.x, 1.8, sup.stand.z),
    ];
    this.cam.define('prep', prepPts, yaw, 0.6, [0.1, 0.1, 1.1, 0.22]);
    this.cam.setMode('prep', true);
  }

  // ------------------------------------------------------------------ input

  tapStation(id: string, insertNext = false): void {
    if (this.mode !== 'room' || this.finished) return;
    this.audio.unlock();
    const sv = this.world.stations.get(id);
    if (!sv) return;
    if (this.ts.anyActive() && !this.inZone(sv.stand)) {
      this.metrics.zoneBlocks++;
      this.audio.play('error');
      this.ui.toast(this.level.delegations.length ? 'Stay with your patient — delegate instead.' : 'Stay with your patient during the procedure.', 'warn');
      this.ui.bump(id);
      return;
    }
    if (this.y.k === 'transport') {
      this.ui.toast('Finish wheeling the patient first.', 'warn');
      return;
    }
    const a = insertNext ? this.queue.insertNext(id) : this.queue.add(id);
    if (!a) {
      this.ui.toast('Queue is full', 'warn');
      return;
    }
    this.audio.play('click');
    this.ui.bump(id);
    if (insertNext && this.y.k === 'move' && this.y.station) {
      // redirect now; the interrupted destination stays queued after this one
      this.queue.items.splice(1, 0, { uid: -Date.now(), stationId: this.y.station });
      this.y = { k: 'idle' };
    }
    if (this.y.k === 'wait') this.y = { k: 'idle' };
  }

  tapFloor(p: Vec2): void {
    if (this.mode !== 'room' || this.finished) return;
    if (this.y.k === 'transport' || this.y.k === 'collect') return;
    if (this.y.k === 'work') {
      if (this.y.task.event || this.y.task.def.duration > 0) {
        this.ts.cancelWork(this.y.task, this.inv);
      }
    }
    this.queue.clear();
    let goal = p;
    if (this.ts.anyActive()) {
      const z = this.world.env.patientZone;
      goal = { x: Math.max(z.x0 + 0.3, Math.min(z.x1 - 0.3, p.x)), z: Math.max(z.z0 + 0.3, Math.min(z.z1 - 0.3, p.z)) };
    }
    this.moveTo(goal, null);
  }

  cancelQueued(uid: number): void {
    this.queue.cancel(uid);
    this.audio.play('click');
  }

  clearQueue(): void {
    this.queue.clear();
    this.audio.play('click');
  }

  // ------------------------------------------------------------------ helpers

  inZone(p: Vec2): boolean {
    const z = this.world.env.patientZone;
    return p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1;
  }

  get yPos(): Vec2 {
    const p = this.world.yolanda.root.position;
    return { x: p.x, z: p.z };
  }

  focusCase(): CaseRT {
    return this.ts.cases.find((c) => c.phase !== 'done' && c.arrived) ?? this.ts.cases[this.ts.cases.length - 1];
  }

  private moveTo(goal: Vec2, station: string | null): boolean {
    const path = this.world.nav.findPath(this.yPos, goal);
    if (!path) {
      this.ui.toast("Can't reach that spot", 'warn');
      return false;
    }
    this.world.showPath(path);
    this.y = { k: 'move', path, i: 1, station };
    return true;
  }

  private startNext(): void {
    const a = this.queue.peek();
    if (!a) return;
    const sv = this.world.stations.get(a.stationId)!;
    if (this.ts.anyActive() && !this.inZone(sv.stand)) {
      this.queue.shift();
      this.ui.toast('Stay with your patient during the procedure.', 'warn');
      return;
    }
    const d = Math.hypot(sv.stand.x - this.yPos.x, sv.stand.z - this.yPos.z);
    if (d < 0.25) {
      this.y = { k: 'move', path: [this.yPos], i: 1, station: a.stationId };
      return;
    }
    if (!this.moveTo(sv.stand, a.stationId)) this.queue.shift();
  }

  // ------------------------------------------------------------------ arrival logic

  private arrive(stationId: string): void {
    this.queue.shift();
    const sv = this.world.stations.get(stationId)!;
    const action = this.ts.resolveAt(stationId, this.inv);
    if (sv.def.kind === 'supplies' && action.type !== 'do' && action.type !== 'collect') {
      this.openPrep();
      return;
    }
    switch (action.type) {
      case 'collect': {
        this.y = { k: 'collect', task: action.task, t: 0.55, station: stationId };
        this.world.yolanda.anim = 'interact';
        return;
      }
      case 'full':
        this.metrics.wastedVisits++;
        this.audio.play('error');
        this.ui.toast('Prep Tray is full — drop something off first.', 'bad');
        break;
      case 'do': {
        const t = action.task;
        if (t.def.special === 'transport') { this.beginTransport(t); return; }
        if (t.def.special === 'handoff') { this.beginHandoff(t); return; }
        this.ts.start(t, 'yolanda', this.inv);
        if (t.def.requiredItems.length) this.audio.play('drop');
        if (t.def.process) this.audio.play('machine');
        if (t.state === 'working') {
          this.y = { k: 'work', task: t, station: stationId };
          this.world.yolanda.anim = t.def.anim ?? 'interact';
          return;
        }
        this.audio.play('complete');
        break;
      }
      case 'busy':
        if (!this.queue.length && action.task.def.producedItems.length) {
          this.y = { k: 'wait', task: action.task, station: stationId, why: 'machine' };
          this.world.yolanda.anim = 'wait';
          this.ui.toast(`Waiting for ${action.task.def.label ?? action.task.def.name} (${Math.ceil(action.left)}s)…`, 'info');
          return;
        }
        this.metrics.wastedVisits++;
        this.ui.toast(`${action.task.def.label ?? action.task.def.name}: ${Math.ceil(action.left)}s left`, 'info');
        break;
      case 'blocked':
        if (action.task.def.needsProceduralist && !this.queue.length) {
          this.y = { k: 'wait', task: action.task, station: stationId, why: 'proceduralist' };
          this.world.yolanda.anim = 'wait';
          this.ui.toast(action.reason, 'info');
          return;
        }
        this.metrics.wastedVisits++;
        this.audio.play('error');
        this.ui.toast(action.reason, 'warn');
        break;
      case 'nothing':
        this.metrics.wastedVisits++;
        this.ui.toast(`Nothing to do at ${sv.def.name} right now`, 'info');
        break;
    }
    this.y = { k: 'idle' };
  }

  // ------------------------------------------------------------------ prep close-up

  openPrep(): void {
    this.prevMode = 'room';
    this.mode = 'prep';
    this.y = { k: 'overlay' };
    this.world.yolanda.anim = 'drawer';
    const sv = this.world.stations.get('supplies')!;
    this.world.yolanda.root.rotation.y = sv.face;
    this.cam.setMode('prep');
    this.metrics.drawerTrips++;
    this.pickedThisVisit = [];
    this.audio.play('drawer');
    this.ui.openPrep();
  }

  /** Called by the prep panel. */
  pickItem(id: string): boolean {
    if (!this.inv.add(id)) {
      this.audio.play('error');
      this.ui.toast('Prep Tray is full (4 slots)', 'bad');
      return false;
    }
    this.pickedThisVisit.push(id);
    this.audio.play('pickup');
    return true;
  }

  returnItem(slot: number): void {
    if (this.mode !== 'prep') return;
    const id = this.inv.removeAt(slot);
    if (id) {
      this.audio.play('drop');
      if (!this.neededItems().has(id)) this.metrics.wrongPicks += 0.5; // correcting a mistake costs a little
    }
  }

  closePrep(): void {
    if (this.mode !== 'prep') return;
    // count unnecessary picks
    const need = this.neededItems();
    for (const id of this.pickedThisVisit) if (!need.has(id)) this.metrics.wrongPicks++;
    this.mode = 'room';
    if (this.metrics.roomStart === 0) this.metrics.roomStart = this.ts.time;
    this.y = { k: 'idle' };
    this.world.yolanda.anim = 'idle';
    this.cam.setMode(this.ts.anyActive() ? 'active' : 'room');
    this.audio.play('drawer');
    this.ui.closePrep();
  }

  /** Items still required by unfinished tasks (plus revealed plans). */
  neededItems(): Set<string> {
    const s = new Set<string>();
    for (const t of this.ts.list()) {
      if (t.state === 'done' || t.state === 'running' || t.state === 'ready' || t.state === 'working') continue;
      if (t.def.optional) continue;
      for (const id of t.def.requiredItems) s.add(id);
    }
    return s;
  }

  /** Items the case plan glows in the drawers (tutorial). */
  glowItems(): Set<string> {
    const need = this.neededItems();
    const out = new Set<string>();
    for (const id of need) if (ITEMS[id]?.drawer && this.inv.count(id) === 0) out.add(id);
    return out;
  }

  // ------------------------------------------------------------------ transport & handoff

  private beginTransport(task: TaskRT): void {
    const c = this.ts.caseOf(task);
    const bed = this.beds.get(c.id)!;
    const levelRoot = this.world.scene.getObjectByName('level')!;
    levelRoot.attach(bed);
    const bay = this.world.stations.get(c.patient.bay)!;
    // free the bay's nav cells
    const odd = bay.rot % 2 === 1;
    this.world.nav.blockCentered(bay.center.x, bay.center.z, odd ? 2.5 : 1.15, odd ? 1.15 : 2.5, 0);
    const ho = this.world.stations.get('handoff')!;
    const dir = { x: ho.stand.x - ho.center.x, z: ho.stand.z - ho.center.z };
    const len = Math.hypot(dir.x, dir.z);
    const park = { x: ho.stand.x + (dir.x / len) * 1.9, z: ho.stand.z + (dir.z / len) * 1.9 + 0.1 };
    const from = { x: bed.position.x, z: bed.position.z };
    const path = this.world.navWide.findPath(from, park) ?? [from, park];
    this.ts.start(task, 'yolanda', this.inv);
    this.y = { k: 'transport', c, task, path, i: 1, bed };
    this.world.yolanda.anim = 'push';
    this.audio.play('cart');
  }

  private beginHandoff(task: TaskRT): void {
    const c = this.ts.caseOf(task);
    this.mode = 'handoff';
    this.y = { k: 'overlay' };
    this.world.yolanda.anim = 'handoff';
    const facts = this.ts.handoffFacts(c);
    this.ui.openHandoff(c, facts, (picked) => {
      let right = 0, wrong = 0;
      for (const i of picked) (facts[i].correct ? right++ : wrong++);
      this.metrics.handoffCorrect[c.id] = right;
      this.metrics.handoffWrong[c.id] = wrong;
      this.ts.start(task, 'yolanda', this.inv);
      if (task.state === 'working') task.work = task.def.duration;
      this.ts.complete(task);
      this.mode = 'room';
      this.y = { k: 'idle' };
      this.world.yolanda.anim = 'idle';
      this.audio.play('complete');
      this.ui.toast(wrong ? 'Handoff given (a few details were off)' : `Clean handoff — ${c.patient.name} is in good hands.`, wrong ? 'warn' : 'good');
    });
  }

  // ------------------------------------------------------------------ proceduralist

  canPage(c: CaseRT): boolean {
    if (c.phase !== 'prep' || this.procSpawned.has(c.id) || !c.arrived) return false;
    const to = this.ts.get(c.id, 'time_out');
    return !!to && to.state === 'available';
  }

  page(c: CaseRT): void {
    if (!this.canPage(c)) return;
    this.audio.play('click');
    this.ui.toast(`Paged ${c.template.proceduralist.name} — on the way.`, 'info');
    this.spawnProceduralist(c);
  }

  private spawnProceduralist(c: CaseRT): void {
    if (this.procSpawned.has(c.id)) return;
    this.procSpawned.add(c.id);
    const env = this.world.env;
    const rig = this.world.makeNpc(`proc-${c.id}`, PROC_LOOK, env.door.x, env.door.z);
    const bay = this.world.stations.get(c.patient.bay)!;
    const spot = this.procSpot(bay);
    this.walk(rig, spot, 2.4, () => {
      c.proceduralistPresent = true;
      this.metrics.proceduralistArrived[c.id] = this.ts.time;
      this.ui.toast(`${c.template.proceduralist.name} is here.`, 'info');
      rig.root.rotation.y = Math.atan2(bay.center.x - spot.x, bay.center.z - spot.z);
    });
  }

  private procSpot(bay: StationView): Vec2 {
    // foot of the bed, away from the anesthesia side
    const along = bay.rot % 2 === 1 ? { x: 1, z: 0 } : { x: 0, z: 1 };
    return this.world.nav.nearestWalkable({ x: bay.center.x - along.x * 1.9, z: bay.center.z - along.z * 1.9 - 0.1 });
  }

  private walk(rig: Rig, to: Vec2, speed: number, onArrive?: () => void): void {
    const from = { x: rig.root.position.x, z: rig.root.position.z };
    const path = this.world.nav.findPath(from, to) ?? [from, to];
    this.walkers = this.walkers.filter((w) => w.rig !== rig);
    this.walkers.push({ rig, path, i: 1, speed, onArrive });
    rig.anim = 'walk';
  }

  // ------------------------------------------------------------------ delegation

  availableDelegations(): DelegationDef[] {
    const fc = this.focusCase();
    return this.level.delegations.filter((d) => {
      if (this.delegations.some((x) => x.def.id === d.id)) return false;
      const t = d.completesTask ? this.ts.get(fc.id, d.completesTask) ?? this.ts.list().find((x) => x.def.id === d.completesTask && x.state !== 'done') : null;
      if (d.completesTask && (!t || t.state === 'done' || t.state === 'locked')) return false;
      return true;
    });
  }

  delegate(d: DelegationDef): void {
    const fc = this.focusCase();
    this.delegations.push({ def: d, left: d.eta, total: d.eta, caseId: fc.id });
    this.metrics.delegations++;
    this.audio.play('click');
    const role = STAFF_ROLES[d.roleId];
    this.ui.toast(`${role.name} (${role.title}): "${d.name} — on it."`, 'info');
    const rig = this.world.npcs.get(d.roleId);
    const t = d.completesTask ? this.ts.list().find((x) => x.def.id === d.completesTask && x.state !== 'done') : null;
    if (rig && t) {
      const sv = this.world.stations.get(t.def.stationId);
      if (sv) this.walk(rig, this.world.nav.nearestWalkable({ x: sv.stand.x + 0.6, z: sv.stand.z + 0.3 }), 2.6, () => { rig.anim = 'interact'; });
      t.by = d.roleId;
    }
  }

  // ------------------------------------------------------------------ phases

  private onPhase(c: CaseRT): void {
    const pr = this.world.patients.get(c.id)!;
    this.audio.play('phase');
    if (c.phase === 'active') {
      pr.state = 'asleep';
      this.cam.setMode('active');
      // drop queued trips that leave the patient zone
      this.queue.items = this.queue.items.filter((a) => this.inZone(this.world.stations.get(a.stationId)!.stand));
      const proc = this.world.npcs.get(`proc-${c.id}`);
      if (proc) proc.anim = 'interact';
      this.ui.toast('Sedation started — procedure underway', 'good');
    } else if (c.phase === 'recovery') {
      // resolve leftover alerts as missed
      for (const t of this.ts.list()) {
        if (t.caseId === c.id && t.event && t.state !== 'done') { t.by = 'missed'; this.ts.complete(t); }
      }
      if (!this.ts.anyActive()) this.cam.setMode('room');
      const proc = this.world.npcs.get(`proc-${c.id}`);
      if (proc) {
        this.walk(proc, this.world.env.door, 2.4, () => { proc.root.visible = false; });
      }
      this.ui.toast('Procedure complete — time to wake up', 'good');
    } else if (c.phase === 'done') {
      // bed leaves with the PACU nurse
      const bed = this.beds.get(c.id)!;
      const from = bed.position.clone();
      this.exitAnims.push({ obj: bed, t: 0, from, to: new THREE.Vector3(from.x, 0, this.world.env.depth / 2 + 3) });
      const nurse = this.world.npcs.get('pacu');
      if (nurse) nurse.anim = 'talk';
      if (this.ts.allDone()) {
        this.finished = true;
        setTimeout(() => this.finish(), 1600 / this.speed);
      }
    }
  }

  private finish(): void {
    this.result = scoreLevel(this.ts, this.metrics, this.level.parWalk);
    this.mode = 'results';
    this.audio.energy = 0;
    this.audio.monitorHr = 0;
    this.ui.showResults(this.result);
  }

  // ------------------------------------------------------------------ main update

  update(dtReal: number): void {
    const paused = this.mode === 'paused' || this.mode === 'card' || this.mode === 'results';
    const dt = paused ? 0 : Math.min(0.1, dtReal) * this.speed;
    if (dt > 0) {
      this.elapsed += dt;
      this.ts.update(dt);
      for (const c of this.ts.cases) {
        if (!this.procSpawned.has(c.id) && c.arrived && this.ts.time >= c.patient.proceduralistArrival && c.phase === 'prep') this.spawnProceduralist(c);
      }
      this.updateYolanda(dt);
      this.updateWalkers(dt);
      this.updateDelegations(dt);
      this.updateTutorial();
    }
    this.updateVisuals(dt, dtReal);
    const yp = this.world.yolanda.root.position;
    this.cam.update(dtReal, yp);
  }

  private updateYolanda(dt: number): void {
    const rig = this.world.yolanda;
    const y = this.y;
    switch (y.k) {
      case 'idle':
        rig.anim = 'idle';
        if (this.queue.length && this.mode === 'room') this.startNext();
        break;
      case 'move': {
        rig.anim = 'walk';
        const moved = this.followPath(rig.root, y.path, y, YOLANDA_SPEED * dt);
        this.metrics.walk += moved;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0 && moved > 0) { this.stepTimer = 0.32; this.audio.play('step'); }
        if (y.i >= y.path.length) {
          this.world.showPath(null);
          if (y.station) {
            const sv = this.world.stations.get(y.station)!;
            rig.root.rotation.y = sv.face;
            this.arrive(y.station);
          } else {
            this.y = { k: 'idle' };
          }
        }
        break;
      }
      case 'work': {
        const sv = this.world.stations.get(y.station)!;
        this.turnToward(rig.root, sv.face, dt);
        if (this.ts.workYolanda(y.task, dt)) {
          if (y.task.state === 'done') this.audio.play('complete');
          this.afterTask(y.task);
          this.y = { k: 'idle' };
        }
        break;
      }
      case 'collect': {
        y.t -= dt;
        if (y.t <= 0) {
          if (this.ts.collect(y.task, this.inv)) {
            this.audio.play('pickup');
            this.ui.toast(`+ ${y.task.def.producedItems.map((i) => ITEMS[i].name).join(', ')}`, 'good');
          }
          this.y = { k: 'idle' };
        }
        break;
      }
      case 'wait': {
        if (y.why === 'machine') this.metrics.waitTime += dt;
        if (this.queue.length) { this.y = { k: 'idle' }; break; }
        const a = this.ts.resolveAt(y.station, this.inv);
        if (a.type === 'collect' || a.type === 'do') {
          this.queue.insertNext(y.station);
          this.y = { k: 'move', path: [this.yPos], i: 1, station: y.station };
        }
        break;
      }
      case 'transport': {
        rig.anim = 'push';
        const bed = y.bed;
        const pos = { x: bed.position.x, z: bed.position.z };
        const target = y.path[y.i];
        if (target) {
          const dx = target.x - pos.x, dz = target.z - pos.z;
          const d = Math.hypot(dx, dz);
          const step = Math.min(d, 1.9 * dt);
          if (d > 1e-3) {
            bed.position.x += (dx / d) * step;
            bed.position.z += (dz / d) * step;
            const want = Math.atan2(-dx, -dz) + Math.PI; // head trails, feet lead
            bed.rotation.y = lerpAngle(bed.rotation.y, want, Math.min(1, dt * 4));
            this.metrics.walk += step;
          }
          if (d < 0.05) y.i++;
        }
        // Yolanda pushes from the head end
        const yaw = bed.rotation.y;
        const hx = Math.sin(yaw), hz = Math.cos(yaw);
        rig.root.position.set(bed.position.x + hx * 1.6, 0, bed.position.z + hz * 1.6);
        rig.root.rotation.y = yaw + Math.PI;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { this.stepTimer = 0.6; this.audio.play('cart'); }
        if (y.i >= y.path.length) {
          this.ts.complete(y.task);
          this.y = { k: 'idle' };
          this.queue.insertNext('handoff');
        }
        break;
      }
      case 'overlay':
        break;
    }
    // tray tokens show what Yolanda carries
    const items = this.inv.slots;
    rig.trayTokens.forEach((m, i) => tintTrayToken(m, items[i] ? ITEMS[items[i]!].color : null));
  }

  private afterTask(t: TaskRT): void {
    const c = this.ts.caseOf(t);
    const pr = this.world.patients.get(c.id)!;
    if (t.def.id === 'apply_monitors') pr.monitored.visible = true;
    if (t.def.id === 'comfort_chat') { pr.warmBlanket.visible = true; pr.state = 'happy'; this.ui.toast(`${c.patient.name} relaxes. ♥`, 'good'); }
    if (t.def.id === 'wake_check') pr.state = 'awake';
    if (t.def.id === 'assess_patient' && pr.state === 'anxious') pr.state = 'awake';
    if (t.state === 'running') this.ui.toast(`${t.def.label ?? t.def.name} started · ${Math.round(t.def.process ?? 0)}s`, 'info');
  }

  private followPath(obj: THREE.Object3D, path: Vec2[], st: { i: number }, dist: number): number {
    let moved = 0;
    while (dist > 1e-5 && st.i < path.length) {
      const p = obj.position;
      const tgt = path[st.i];
      const dx = tgt.x - p.x, dz = tgt.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d <= dist) {
        p.x = tgt.x; p.z = tgt.z;
        dist -= d; moved += d; st.i++;
      } else {
        p.x += (dx / d) * dist; p.z += (dz / d) * dist;
        moved += dist; dist = 0;
      }
      if (d > 1e-3) obj.rotation.y = lerpAngle(obj.rotation.y, Math.atan2(dx, dz), 0.25);
    }
    return moved;
  }

  private turnToward(obj: THREE.Object3D, yaw: number, dt: number) {
    obj.rotation.y = lerpAngle(obj.rotation.y, yaw, Math.min(1, dt * 10));
  }

  private updateWalkers(dt: number): void {
    for (const w of [...this.walkers]) {
      this.followPath(w.rig.root, w.path, w, w.speed * dt);
      if (w.i >= w.path.length) {
        this.walkers = this.walkers.filter((x) => x !== w);
        w.rig.anim = 'idle';
        w.onArrive?.();
      }
    }
  }

  private updateDelegations(dt: number): void {
    for (const d of [...this.delegations]) {
      d.left -= dt;
      if (d.left > 0) continue;
      this.delegations = this.delegations.filter((x) => x !== d);
      const role = STAFF_ROLES[d.def.roleId];
      if (d.def.completesTask) {
        const t = this.ts.list().find((x) => x.def.id === d.def.completesTask && x.state !== 'done');
        if (t) this.ts.forceComplete(t);
      }
      if (d.def.deliversItem) {
        if (!this.inv.add(d.def.deliversItem)) this.ui.toast(`${role.name} left ${ITEMS[d.def.deliversItem].name} on the cart (tray full)`, 'warn');
      }
      this.audio.play('complete');
      this.ui.toast(`${role.name}: "${d.def.name} — done!"`, 'good');
      const rig = this.world.npcs.get(d.def.roleId);
      if (rig) this.walk(rig, { x: this.world.env.door.x + 1.4, z: this.world.env.door.z + 1.6 }, 2.6);
    }
  }

  // ------------------------------------------------------------------ tutorial

  private cond(when: string): boolean {
    const c = this.focusCase();
    const [kind, a, b] = when.split(':');
    const order: Phase[] = ['prep', 'active', 'recovery', 'done'];
    switch (kind) {
      case 'room': return this.mode === 'room';
      case 'task': {
        const t = this.ts.get(c.id, a);
        if (!t) return false;
        if (b === 'running') return t.state === 'running' || t.state === 'ready' || t.state === 'done';
        if (b === 'done') return t.state === 'done';
        return t.state === b;
      }
      case 'available': return this.ts.get(c.id, a)?.state === 'available';
      case 'phase': return order.indexOf(c.phase) >= order.indexOf(a as Phase);
      case 'active': return c.phase === 'active' && c.activeTime >= Number(a);
      default: return false;
    }
  }

  private updateTutorial(): void {
    if (!this.tutorialOn || !this.level.tutorial) return;
    const steps = this.level.tutorial;
    // advance to the furthest step whose condition holds
    let idx = this.tutorialIdx;
    for (let i = steps.length - 1; i >= this.tutorialIdx; i--) {
      if (this.cond(steps[i].when)) { idx = i + 1; break; }
    }
    if (idx !== this.tutorialIdx) {
      this.tutorialIdx = idx;
      const s = steps[idx - 1];
      const focus = s.focus === '$bay' ? this.focusCase().patient.bay : s.focus ?? null;
      this.focusStation = focus;
      if (s.text !== this.lastHint) {
        this.lastHint = s.text;
        this.ui.hint(s.text, focus);
      }
    }
    // clear focus once that station has been visited/used
    if (this.focusStation && this.y.k === 'work' && this.y.station === this.focusStation) this.focusStation = null;
  }

  // ------------------------------------------------------------------ visuals

  private updateVisuals(dt: number, dtReal: number): void {
    const w = this.world;
    const carrying = this.inv.items.length > 0;
    animateRig(w.yolanda, dt || dtReal * 0.5, carrying);
    for (const rig of w.npcs.values()) animateRig(rig, dt || dtReal * 0.5, false);
    for (const [id, pr] of w.patients) {
      const c = this.ts.getCase(id);
      const stirring = this.ts.list().some((t) => t.caseId === id && t.event && t.state !== 'done' && t.event.def.vitals?.comfort);
      if (c.phase === 'active') pr.state = stirring ? 'stirring' : 'asleep';
      animatePatient(pr, dt || dtReal * 0.5);
    }
    // station lights
    for (const sv of w.stations.values()) {
      const here = this.ts.list().filter((t) => t.def.stationId === sv.place.id);
      const st = here.some((t) => t.event && t.state !== 'done') ? 'alert'
        : here.some((t) => t.state === 'ready') ? 'ready'
          : here.some((t) => t.state === 'running' && !t.def.auto) ? 'running' : 'idle';
      setStatus(sv.model.userData.status, st);
      const focus = this.focusStation === sv.place.id;
      const show = this.mode === 'room' && (focus || this.queue.items.some((q) => q.stationId === sv.place.id));
      sv.markerMat.opacity += ((show ? (focus ? 0.55 + Math.sin(this.elapsed * 6) * 0.25 : 0.45) : 0) - sv.markerMat.opacity) * Math.min(1, dtReal * 8);
      sv.markerMat.color.set(focus ? C.yellow : C.teal);
    }
    // supply drawers open while in prep
    const sup = w.stations.get('supplies');
    sup?.model.userData.drawers?.forEach((d, i) => {
      const open = this.mode === 'prep' ? 0.42 - i * 0.06 : 0;
      d.position.z += (d.userData.closedZ + open - d.position.z) * Math.min(1, dtReal * 7);
    });
    // patient zone
    const zoneTarget = this.ts.anyActive() ? 0.9 : 0;
    w.zoneMat.opacity += (zoneTarget - w.zoneMat.opacity) * Math.min(1, dtReal * 3);
    // exiting beds
    for (const e of [...this.exitAnims]) {
      e.t += dt / 3;
      e.obj.position.lerpVectors(e.from, e.to, Math.min(1, e.t));
      if (e.t >= 1) { e.obj.visible = false; this.exitAnims = this.exitAnims.filter((x) => x !== e); }
    }
    // audio energy = number of things running at once
    const running = this.ts.list().filter((t) => t.state === 'running' && t.def.backgroundProcess).length;
    const alerts = this.ts.list().filter((t) => t.event && t.state !== 'done').length;
    this.audio.energy = Math.min(3, running + alerts * 2 > 3 ? 3 : running);
    const fc = this.focusCase();
    this.audio.monitorHr = fc.phase === 'active' ? this.ts.vitals(fc).hr : 0;
    this.eventBeepT += dtReal;
  }

  // ------------------------------------------------------------------ pause / debug

  pause(): void {
    if (this.mode === 'paused' || this.mode === 'results' || this.mode === 'card') return;
    this.prevMode = this.mode;
    this.mode = 'paused';
  }

  resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = this.prevMode;
  }

  begin(): void {
    // case card dismissed → prep close-up
    this.audio.unlock();
    this.openPrep();
  }

  debugComplete(t: TaskRT): void {
    if (t.state === 'ready') { this.ts.collect(t, this.inv) || this.ts.forceComplete(t); return; }
    if (t.def.special === 'transport' && t.state !== 'done') {
      this.beginTransport(t);
      return;
    }
    if (t.def.special === 'handoff') {
      const c = this.ts.caseOf(t);
      this.metrics.handoffCorrect[c.id] = 3;
      this.metrics.handoffWrong[c.id] = 0;
    }
    if (t.state === 'running') { t.processLeft = 0.01; return; }
    this.ts.forceComplete(t, this.inv);
    this.afterTask(t);
  }

  debugSpawn(id: string): void {
    if (!this.inv.add(id)) this.ui.toast('Tray full', 'warn');
  }

  totalRunning(): TaskRT[] {
    return this.ts.list().filter((t) => (t.state === 'running' || t.state === 'ready') && (t.def.backgroundProcess || t.def.producedItems.length));
  }

  pathPreviewLength(stationId: string): number {
    const sv = this.world.stations.get(stationId);
    if (!sv) return 0;
    const p = this.world.nav.findPath(this.yPos, sv.stand);
    return p ? pathLength(p) : 0;
  }
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
