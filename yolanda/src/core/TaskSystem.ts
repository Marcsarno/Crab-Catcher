import { Emitter } from './Events';
import type { Inventory } from './Inventory';
import type {
  AttentionEventDef, CaseTemplate, ItemId, LevelDef, PatientDef, PatientModifier, Phase, TaskDef,
} from './types';
import { CASE_TEMPLATES } from '../data/caseTemplates';
import { PATIENT_MODIFIERS } from '../data/patientModifiers';
import { ITEMS } from '../data/items';

export type TaskState = 'locked' | 'available' | 'working' | 'running' | 'ready' | 'done';

export interface TaskRT {
  key: string;
  def: TaskDef;
  caseId: string;
  state: TaskState;
  work: number;
  processLeft: number;
  by: string | null;
  availableAt: number | null;
  startedAt: number | null;
  readyAt: number | null;
  doneAt: number | null;
  event?: { def: AttentionEventDef; createdAt: number; deadline: number; late: boolean };
}

export interface CaseRT {
  id: string;
  patient: PatientDef;
  template: CaseTemplate;
  phase: Phase;
  phaseAt: Partial<Record<Phase, number>>;
  arrived: boolean;
  proceduralistPresent: boolean;
  activeTime: number;
  firedEvents: Set<string>;
  pendingMods: PatientModifier[];
  activeMods: PatientModifier[];
  plan: { label: string; items: ItemId[] }[];
}

export type StationAction =
  | { type: 'collect'; task: TaskRT }
  | { type: 'do'; task: TaskRT }
  | { type: 'busy'; task: TaskRT; left: number }
  | { type: 'blocked'; task: TaskRT; reason: string }
  | { type: 'full'; task: TaskRT }
  | { type: 'nothing' };

type TaskEvents = {
  state: TaskRT;
  phase: CaseRT;
  reveal: { c: CaseRT; mod: PatientModifier };
  ready: TaskRT;
  eventFired: TaskRT;
  eventLate: TaskRT;
  arrived: CaseRT;
};

const asList = (p: Phase | Phase[]) => (Array.isArray(p) ? p : [p]);

/**
 * Data-driven task graph for one level. Holds every case's tasks, their
 * prerequisites, consumable items, background processes and phase changes.
 */
export class TaskSystem {
  readonly bus = new Emitter<TaskEvents>();
  readonly tasks = new Map<string, TaskRT>();
  readonly cases: CaseRT[] = [];
  time = 0;

  constructor(public level: LevelDef) {
    const template = CASE_TEMPLATES[level.caseTemplateId];
    for (const patient of level.patients) {
      const c: CaseRT = {
        id: patient.id, patient: { ...patient }, template, phase: 'prep', phaseAt: { prep: 0 },
        arrived: false, proceduralistPresent: false, activeTime: 0, firedEvents: new Set(),
        pendingMods: [], activeMods: [], plan: template.plan.map((p) => ({ ...p, items: [...p.items] })),
      };
      this.cases.push(c);
      for (const def of template.tasks) this.addTask(c, def);
      for (const modId of patient.modifiers) {
        const mod = PATIENT_MODIFIERS[modId];
        if (!mod.revealedBy) this.applyModifier(c, mod);
        else c.pendingMods.push(mod);
      }
      // Procedure length comes from the template.
      const proc = this.get(c.id, 'procedure');
      if (proc) proc.def.process = template.procedureTime;
    }
    for (const t of level.turnoverTasks ?? []) {
      const c = this.cases[this.cases.length - 1];
      this.addTask(c, t);
    }
    for (const p of level.casePatches ?? []) {
      const t = this.get(p.caseId, p.taskId);
      if (t) t.def.prerequisites.push(...p.addPrerequisites.map((x) => (x.includes('.') ? x : `${p.caseId}.${x}`)));
    }
  }

  // ------------------------------------------------------------------ building

  private resolveDef(c: CaseRT, def: TaskDef): TaskDef {
    return {
      ...def,
      stationId: def.stationId === '$bay' ? (def.preop && c.patient.preopBay ? c.patient.preopBay : c.patient.bay) : def.stationId,
      prerequisites: def.prerequisites.map((p) => (p.includes('.') ? p : `${c.id}.${p}`)),
      requiredItems: [...def.requiredItems],
      producedItems: [...def.producedItems],
    };
  }

  addTask(c: CaseRT, def: TaskDef, extra?: Partial<TaskRT>): TaskRT {
    const key = `${c.id}.${def.id}`;
    const t: TaskRT = {
      key, def: this.resolveDef(c, def), caseId: c.id, state: 'locked', work: 0, processLeft: 0,
      by: null, availableAt: null, startedAt: null, readyAt: null, doneAt: null, ...extra,
    };
    this.tasks.set(key, t);
    return t;
  }

  private applyModifier(c: CaseRT, mod: PatientModifier): void {
    c.activeMods.push(mod);
    for (const def of mod.addTasks) this.addTask(c, def);
    for (const patch of mod.patchTasks) {
      const t = this.get(c.id, patch.id);
      if (!t) continue;
      for (const p of patch.addPrerequisites ?? []) t.def.prerequisites.push(p.includes('.') ? p : `${c.id}.${p}`);
      if (patch.addRequiredItems?.length) {
        if (t.state === 'locked' || t.state === 'available') {
          t.def.requiredItems.push(...patch.addRequiredItems);
        } else {
          // Already started: add a top-up task at the same station.
          this.addTask(c, {
            ...t.def, id: `${patch.id}_addon`, name: `Top up ${t.def.label ?? t.def.name}`,
            label: `Top up ${t.def.label ?? t.def.name}`, stationId: t.def.stationId,
            prerequisites: [patch.id], requiredItems: [...patch.addRequiredItems], producedItems: [],
            process: 6, duration: 1.2,
          });
          const timeOut = this.get(c.id, 'time_out');
          timeOut?.def.prerequisites.push(`${c.id}.${patch.id}_addon`);
        }
      }
    }
    if (mod.planAdd) c.plan.push({ ...mod.planAdd, items: [...mod.planAdd.items] });
  }

  // ------------------------------------------------------------------ queries

  get(caseId: string, id: string): TaskRT | undefined {
    return this.tasks.get(`${caseId}.${id}`);
  }

  caseOf(t: TaskRT): CaseRT {
    return this.cases.find((c) => c.id === t.caseId)!;
  }

  getCase(id: string): CaseRT {
    return this.cases.find((c) => c.id === id)!;
  }

  list(): TaskRT[] {
    return [...this.tasks.values()];
  }

  isDone(key: string): boolean {
    return this.tasks.get(key)?.state === 'done';
  }

  /** A case is "under active care" when sedation has begun and the patient is not yet in recovery. */
  anyActive(): boolean {
    return this.cases.some((c) => c.phase === 'active' || c.phase === 'closing');
  }

  allDone(): boolean {
    return this.cases.every((c) => c.phase === 'done');
  }

  handoffFacts(c: CaseRT): { text: string; correct: boolean }[] {
    const facts = c.template.handoffFacts.map((f) => ({ ...f }));
    for (const m of c.activeMods) {
      for (const f of m.handoffFacts ?? []) {
        const i = facts.findIndex((x) => x.text === f.text);
        if (i >= 0) facts[i] = { ...f };
        else facts.push({ ...f });
      }
    }
    return facts;
  }

  /** What would happen if Yolanda arrived at this station right now. */
  resolveAt(stationId: string, inv: Inventory): StationAction {
    const here = this.list().filter((t) => t.def.stationId === stationId && t.def.requiresYolanda !== false);
    // 1. collect finished outputs
    const ready = here.find((t) => t.state === 'ready');
    if (ready) {
      return inv.free >= ready.def.producedItems.length ? { type: 'collect', task: ready } : { type: 'full', task: ready };
    }
    // 2. do the best available task we have items for
    const avail = here
      .filter((t) => t.state === 'available' && !t.def.auto)
      .sort((a, b) => this.sortKey(b) - this.sortKey(a));
    const machineBusy = here.some((t) => (t.state === 'running' || t.state === 'working') && (t.def.process ?? 0) > 0 && !t.event);
    let blocked: StationAction | null = null;
    for (const t of avail) {
      const c = this.caseOf(t);
      if (machineBusy && (t.def.process ?? 0) > 0) continue;
      if (t.def.needsProceduralist && !c.proceduralistPresent) {
        blocked ??= { type: 'blocked', task: t, reason: `Waiting for ${c.template.proceduralist.name}` };
        continue;
      }
      const missing = inv.missing(t.def.requiredItems);
      if (missing.length) {
        blocked ??= { type: 'blocked', task: t, reason: `Need ${missing.map((m) => ITEMS[m]?.short ?? m).join(' + ')}` };
        continue;
      }
      return { type: 'do', task: t };
    }
    const running = here.find((t) => t.state === 'running' && t.def.producedItems.length > 0);
    if (running) return { type: 'busy', task: running, left: running.processLeft };
    const anyRunning = here.find((t) => t.state === 'running' && !t.def.auto);
    if (!blocked && anyRunning) return { type: 'busy', task: anyRunning, left: anyRunning.processLeft };
    if (blocked) return blocked;
    // 3. explain locked work here (unmet prerequisites)
    const locked = here
      .filter((t) => t.state === 'locked' && !t.def.optional && !t.def.hidden && (this.caseOf(t).arrived || t.def.levelTask) && asList(t.def.phase).includes(this.caseOf(t).phase))
      .sort((a, b) => this.sortKey(b) - this.sortKey(a));
    for (const t of locked) {
      const unmet = t.def.prerequisites.map((p) => this.tasks.get(p)).find((p) => p && p.state !== 'done');
      if (!unmet) continue;
      const label = unmet.def.label ?? unmet.def.name;
      const reason = unmet.state === 'running' ? `${label}: ${Math.ceil(unmet.processLeft)}s` : unmet.state === 'ready' ? `Collect ${label} first` : `First: ${label}`;
      return { type: 'blocked', task: t, reason };
    }
    return { type: 'nothing' };
  }

  /** Is there something Yolanda could do here right now (for the label hint dot)? */
  actionable(stationId: string, inv: Inventory): boolean {
    const a = this.resolveAt(stationId, inv);
    return a.type === 'do' || a.type === 'collect';
  }

  private sortKey(t: TaskRT): number {
    let k = t.def.priority;
    if (t.event) k += 20;
    if (t.def.optional) k -= 10;
    return k;
  }

  // ------------------------------------------------------------------ mutations

  setState(t: TaskRT, state: TaskState): void {
    if (t.state === state) return;
    t.state = state;
    if (state === 'available') t.availableAt ??= this.time;
    if (state === 'ready') t.readyAt = this.time;
    if (state === 'done') t.doneAt = this.time;
    this.bus.emit('state', t);
    if (state === 'ready') this.bus.emit('ready', t);
  }

  /** Begin hands-on work (consumes required items). */
  start(t: TaskRT, by: string, inv?: Inventory): void {
    if (inv) inv.removeAll(t.def.requiredItems);
    t.by = by;
    t.startedAt = this.time;
    t.work = 0;
    if (t.def.duration <= 0) this.finishWork(t);
    else this.setState(t, 'working');
  }

  private finishWork(t: TaskRT): void {
    const p = t.def.process ?? 0;
    if (p > 0) {
      t.processLeft = p;
      this.setState(t, 'running');
    } else {
      this.complete(t);
    }
  }

  collect(t: TaskRT, inv: Inventory): boolean {
    if (t.state !== 'ready') return false;
    if (inv.free < t.def.producedItems.length) return false;
    for (const id of t.def.producedItems) inv.add(id);
    this.complete(t);
    return true;
  }

  complete(t: TaskRT): void {
    if (t.state === 'done') return;
    this.setState(t, 'done');
    const c = this.caseOf(t);
    if (t.def.setsPhase) this.setPhase(c, t.def.setsPhase);
    // reveals
    for (const mod of [...c.pendingMods]) {
      if (`${c.id}.${mod.revealedBy}` === t.key) {
        c.pendingMods = c.pendingMods.filter((m) => m !== mod);
        this.applyModifier(c, mod);
        this.bus.emit('reveal', { c, mod });
      }
    }
    this.refresh();
  }

  /** Debug / delegation: finish a task regardless of state. */
  forceComplete(t: TaskRT, inv?: Inventory): void {
    if (t.state === 'done') return;
    if (t.def.producedItems.length && inv) {
      for (const id of t.def.producedItems) inv.add(id);
    }
    this.complete(t);
  }

  setPhase(c: CaseRT, phase: Phase): void {
    if (c.phase === phase) return;
    c.phase = phase;
    c.phaseAt[phase] = this.time;
    this.bus.emit('phase', c);
  }

  private prereqsMet(t: TaskRT): boolean {
    return t.def.prerequisites.every((p) => this.isDone(p));
  }

  /** Recompute which locked tasks became available. */
  refresh(): void {
    for (const t of this.tasks.values()) {
      const c = this.caseOf(t);
      const phaseOk = asList(t.def.phase).includes(c.phase);
      if (t.state === 'locked' && (c.arrived || t.def.levelTask) && phaseOk && this.prereqsMet(t) && !t.def.hidden) {
        this.setState(t, 'available');
      } else if (t.state === 'available' && (!phaseOk || !this.prereqsMet(t))) {
        // Phase moved on (e.g. optional comfort task after sedation started).
        this.setState(t, 'locked');
      }
      if (t.state === 'available' && t.def.auto) this.start(t, 'auto');
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const c of this.cases) {
      if (!c.arrived && this.time >= c.patient.arrival) {
        c.arrived = true;
        this.bus.emit('arrived', c);
      }
      if (c.phase === 'active') {
        c.activeTime += dt;
        for (const ev of this.level.events) {
          if (c.firedEvents.has(ev.id) || c.activeTime < ev.at) continue;
          c.firedEvents.add(ev.id);
          this.fireEvent(c, ev);
        }
      }
    }
    for (const t of this.tasks.values()) {
      if (t.state === 'working' && t.by === 'auto') {
        t.work += dt;
        if (t.work >= t.def.duration) this.finishWork(t);
      } else if (t.state === 'running') {
        t.processLeft -= dt;
        if (t.processLeft <= 0) {
          t.processLeft = 0;
          if (t.def.producedItems.length) this.setState(t, 'ready');
          else this.complete(t);
        }
      }
      if (t.event && t.state !== 'done' && !t.event.late && this.time > t.event.deadline) {
        t.event.late = true;
        this.bus.emit('eventLate', t);
      }
    }
    this.refresh();
  }

  /** Called by the game each frame while Yolanda performs hands-on work. */
  workYolanda(t: TaskRT, dt: number): boolean {
    if (t.state !== 'working') return true;
    t.work += dt;
    if (t.work >= t.def.duration) {
      this.finishWork(t);
      return true;
    }
    return false;
  }

  /** Patient moved beds: unfinished tasks follow them. */
  retarget(c: CaseRT, from: string, to: string): void {
    for (const t of this.tasks.values()) {
      if (t.caseId === c.id && t.def.stationId === from && t.state !== 'done') t.def.stationId = to;
    }
    c.patient.bay = to;
    c.patient.preopBay = undefined;
  }

  /** Hand a task to a staff member; the game finishes it when their ETA runs out. */
  delegateTask(t: TaskRT, roleId: string): void {
    t.by = roleId;
    t.startedAt = this.time;
    this.setState(t, 'working');
  }

  /** Abandon hands-on work (e.g. redirected). Items are returned. */
  cancelWork(t: TaskRT, inv: Inventory): void {
    if (t.state !== 'working') return;
    for (const id of t.def.requiredItems) inv.add(id);
    t.work = 0;
    t.by = null;
    this.setState(t, 'available');
  }

  private fireEvent(c: CaseRT, ev: AttentionEventDef): void {
    const def: TaskDef = {
      id: `ev_${ev.id}`, name: ev.name, label: ev.name, stationId: ev.stationId, phase: 'active',
      duration: ev.duration, prerequisites: [], requiredItems: [], producedItems: [], requiresYolanda: true,
      priority: 10, scoreCategory: ev.scoreCategory, anim: ev.anim ?? 'interact', safetyCritical: ev.scoreCategory === 'safety',
    };
    const t = this.addTask(c, def, {
      event: { def: ev, createdAt: this.time, deadline: this.time + ev.window, late: false },
    });
    this.setState(t, 'available');
    this.bus.emit('eventFired', t);
  }

  /** Simplified monitor numbers for a case. */
  vitals(c: CaseRT): { hr: number; spo2: number; bp: string; comfort: number } {
    let hr = 72, spo2 = 98, comfort = 100;
    for (const t of this.tasks.values()) {
      if (t.caseId !== c.id || !t.event || t.state === 'done') continue;
      const v = t.event.def.vitals;
      if (!v) continue;
      const age = Math.min(1, (this.time - t.event.createdAt) / 4);
      hr += (v.hr ?? 0) * age;
      spo2 += (v.spo2 ?? 0) * age;
      comfort += (v.comfort ?? 0) * age;
    }
    if (c.phase === 'prep' && c.patient.anxious) hr += 18;
    const wobble = Math.sin(this.time * 0.7 + c.id.charCodeAt(0)) * 1.5;
    return { hr: Math.round(hr + wobble), spo2: Math.round(spo2), bp: `${118 + Math.round(wobble)}/${76}`, comfort };
  }
}
