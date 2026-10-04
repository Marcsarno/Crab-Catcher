import * as THREE from 'three';
import type { Game, GameUI } from '../core/Game';
import type { CaseRT, TaskRT } from '../core/TaskSystem';
import type { ScoreResult } from '../core/Scoring';
import { CAT_LABEL } from '../core/Scoring';
import { DRAWERS, ITEMS } from '../data/items';
import { STAFF_ROLES } from '../data/staffRoles';
import { ICON, itemIcon } from './icons';
import type { ScoreCat } from '../core/types';

export interface HudHooks {
  pause(): void;
  restart(): void;
  menu(): void;
  next(): void;
  hasNext(): boolean;
  longPressStation(id: string): void;
  tapStation(id: string): void;
}

const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const fmtClock = (mins: number) => {
  const hh = Math.floor(mins / 60) % 24, mm = Math.floor(mins % 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/** In-game HUD. The room is the main interface; this stays minimal. */
export class Hud implements GameUI {
  private g!: Game;
  readonly el: HTMLElement;
  private labels: HTMLElement;
  private top: HTMLElement;
  private tasksEl: HTMLElement;
  private timersEl: HTMLElement;
  private careEl: HTMLElement;
  private bottom: HTMLElement;
  private queueEl: HTMLElement;
  private slotsEl: HTMLElement;
  private toastsEl: HTMLElement;
  private hintEl: HTMLElement | null = null;
  private sheet: HTMLElement | null = null;
  private sideEl: HTMLElement;
  private staffMenu: HTMLElement | null = null;
  private labelEls = new Map<string, HTMLElement>();
  private lastSlots = '';
  private lastQueue = '';
  private lastTasks = '';
  private lastTimers = '';
  private lastSide = '';
  private tasksCollapsed = false;
  private v = new THREE.Vector3();

  constructor(root: HTMLElement, private hooks: HudHooks) {
    this.el = h('div', 'layer hud');
    this.labels = h('div', 'labels');
    this.top = h('div', 'panel topbar');
    this.tasksEl = h('div', 'panel tasks');
    this.timersEl = h('div', 'timers');
    this.careEl = h('div', 'panel care hidden');
    this.sideEl = h('div', 'side-btns');
    this.bottom = h('div', 'bottom');
    this.queueEl = h('div', 'queue');
    const tray = h('div', 'panel tray');
    tray.append(h('div', 'ttl', 'Prep<br>Tray<small class="cnt">0/4</small>'));
    this.slotsEl = h('div', 'slots');
    tray.append(this.slotsEl);
    this.bottom.append(this.queueEl, tray);
    this.toastsEl = h('div', 'toasts');
    this.el.append(this.labels, this.top, this.tasksEl, this.timersEl, this.careEl, this.sideEl, this.bottom, this.toastsEl);
    root.append(this.el);
    this.labels.style.pointerEvents = 'none';
    this.tasksEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('h4')) { this.tasksCollapsed = !this.tasksCollapsed; this.lastTasks = ''; }
    });
  }

  attach(g: Game): void {
    this.g = g;
    this.labels.innerHTML = '';
    this.labelEls.clear();
    this.lastSlots = this.lastQueue = this.lastTasks = this.lastTimers = this.lastSide = '';
    this.closeSheet();
    this.hint(null);
    this.toastsEl.innerHTML = '';
    this.staffMenu?.remove();
    this.staffMenu = null;
    this.tasksCollapsed = true;
    // top bar
    this.top.innerHTML = '';
    const menuBtn = h('button', 'icon-btn', ICON.pause);
    menuBtn.setAttribute('aria-label', 'Pause');
    menuBtn.onclick = () => this.hooks.pause();
    const title = h('div', 'tb-title', `<b>${g.level.title}</b><span class="ph">Prep</span><div class="phase-dots"><i></i><i></i><i></i><i></i></div>`);
    const clock = h('div', 'tb-clock', `${ICON.clock}<span>--:--</span>`);
    clock.dataset.role = 'clock';
    this.top.append(menuBtn, title, clock);
    // station labels
    for (const [id, sv] of g.world.stations) {
      const el = h('div', 'lbl');
      el.innerHTML = `<div class="pill">${ICON[sv.def.icon] ?? ''}<span>${sv.def.kind === 'bay' || sv.def.kind === 'preop' ? sv.def.name : sv.def.name.replace('Anesthesia ', '')}</span></div><div class="badge hidden"></div>`;
      el.style.position = 'absolute';
      let pressT: number | null = null;
      let long = false;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        long = false;
        pressT = window.setTimeout(() => { long = true; this.hooks.longPressStation(id); }, 450);
      });
      el.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        if (pressT) clearTimeout(pressT);
        if (!long) this.hooks.tapStation(id);
      });
      el.addEventListener('pointerleave', () => { if (pressT) clearTimeout(pressT); });
      this.labels.append(el);
      this.labelEls.set(id, el);
    }
  }

  // ------------------------------------------------------------------ GameUI

  toast(text: string, kind: 'info' | 'good' | 'warn' | 'bad' = 'info'): void {
    const t = h('div', `toast ${kind}`, text);
    this.toastsEl.prepend(t);
    while (this.toastsEl.children.length > 3) this.toastsEl.lastElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 2300);
    setTimeout(() => t.remove(), 2700);
  }

  hint(text: string | null): void {
    this.hintEl?.remove();
    this.hintEl = null;
    if (!text) return;
    const el = h('div', 'hint', `<div class="av">Y</div>${text}<button class="x" aria-label="Dismiss">${ICON.x}</button>`);
    el.querySelector('.x')!.addEventListener('click', () => { el.remove(); this.hintEl = null; });
    this.el.append(el);
    this.hintEl = el;
    // hints fade away on their own after a while so they never block the room for long
    setTimeout(() => { if (this.hintEl === el) { el.remove(); this.hintEl = null; } }, 16000);
  }

  bump(id: string): void {
    const el = this.labelEls.get(id);
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  reveal(title: string, text: string): void {
    this.g.pause();
    const el = h('div', 'reveal', `<h3>${ICON.alert}${title}</h3><p>${text}</p>`);
    const ok = h('button', 'big-btn yellow', 'Adapt the plan');
    ok.onclick = () => { el.remove(); this.g.resume(); };
    el.append(ok);
    this.el.append(el);
  }

  openPrep(): void {
    this.closeSheet();
    this.bottom.classList.add('hidden');
    this.hintEl?.classList.add('hidden');
    const s = h('div', 'sheet prep');
    this.sheet = s;
    this.el.append(s);
    this.renderPrep();
  }

  private renderPrep(): void {
    const s = this.sheet;
    if (!s || !this.g) return;
    const g = this.g;
    const c = g.focusCase();
    const need = g.neededItems();
    const glow = g.level.glowRequired ? g.glowItems() : new Set<string>();
    const planHtml = g.ts.cases.filter((x) => x.phase !== 'done' && x.arrived).flatMap((cc) => cc.plan.map((p, i) => {
      const ok = p.items.every((id) => g.inv.count(id) > 0 || !need.has(id));
      const isNew = i >= cc.template.plan.length;
      return `<span class="p ${ok ? 'ok' : ''} ${isNew ? 'new' : ''}">${ok ? ICON.check : ''}${p.label}</span>`;
    })).join('');
    let html = `<h2>${ICON.cart}Supply Cart</h2><div class="sub">Case plan for ${c.patient.name} — fill the tray, then go.</div><div class="plan">${planHtml}</div>`;
    for (const d of DRAWERS) {
      const items = Object.values(ITEMS).filter((it) => it.drawer === d.id);
      html += `<div class="drawer"><h5><i style="background:${d.color}"></i>${d.name}</h5><div class="items">`;
      for (const it of items) {
        const cnt = g.inv.count(it.id);
        const left = g.stockOf(it.id);
        const stockTag = left === Infinity ? '' : `<span class="stock ${left <= 0 ? 'out' : ''}">${left <= 0 ? 'OUT' : `${left} left`}</span>`;
        html += `<div class="item ${glow.has(it.id) ? 'glow' : ''} ${left <= 0 ? 'empty' : ''}" data-id="${it.id}">${itemIcon(it)}<span>${it.name}</span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}${stockTag}</div>`;
      }
      html += '</div></div>';
    }
    html += '<div class="tray-mini"><div class="lab">Prep Tray<small>tap to put back</small></div><div class="slots">';
    g.inv.slots.forEach((id, i) => {
      html += id ? `<div class="slot full" data-slot="${i}">${itemIcon(ITEMS[id])}${ITEMS[id].short}</div>` : '<div class="slot">empty</div>';
    });
    html += '</div></div><button class="big-btn">Done — back to the room</button>';
    s.innerHTML = html;
    s.querySelectorAll<HTMLElement>('.item').forEach((el) => {
      el.onclick = () => { if (g.pickItem(el.dataset.id!)) this.renderPrep(); };
    });
    s.querySelectorAll<HTMLElement>('.slot.full').forEach((el) => {
      el.onclick = () => { g.returnItem(Number(el.dataset.slot)); this.renderPrep(); };
    });
    (s.querySelector('.big-btn') as HTMLButtonElement).onclick = () => g.closePrep();
  }

  closePrep(): void {
    this.closeSheet();
  }

  private closeSheet(): void {
    this.sheet?.remove();
    this.sheet = null;
    this.bottom.classList.remove('hidden');
    this.hintEl?.classList.remove('hidden');
  }

  openHandoff(c: CaseRT, facts: { text: string; correct: boolean }[], done: (picked: number[]) => void): void {
    this.closeSheet();
    this.bottom.classList.add('hidden');
    this.hintEl?.classList.add('hidden');
    const s = h('div', 'sheet handoff');
    this.sheet = s;
    const order = facts.map((_, i) => i).sort(() => Math.random() - 0.5);
    const picked = new Set<number>();
    const need = facts.filter((f) => f.correct).length;
    const render = () => {
      s.innerHTML = `<h2>${ICON.handoff}Handoff to ${STAFF_ROLES.pacu.name} (PACU)</h2><div class="sub">Report on ${c.patient.name}: pick the <b>${need}</b> facts that are true and matter.</div>
        <div class="facts">${order.map((i) => `<div class="fact ${picked.has(i) ? 'on' : ''}" data-i="${i}">${facts[i].text}</div>`).join('')}</div>`;
      const btn = h('button', 'big-btn', `Give report (${picked.size}/${need})`) as HTMLButtonElement;
      btn.disabled = picked.size !== need;
      btn.onclick = () => { this.closeSheet(); done([...picked]); };
      s.append(btn);
      s.querySelectorAll<HTMLElement>('.fact').forEach((el) => {
        el.onclick = () => {
          const i = Number(el.dataset.i);
          if (picked.has(i)) picked.delete(i);
          else if (picked.size < need) picked.add(i);
          this.g.audio.play('click');
          render();
        };
      });
    };
    render();
    this.el.append(s);
  }

  showResults(r: ScoreResult): void {
    this.closeSheet();
    const scr = h('div', 'screen results-screen');
    const cats: ScoreCat[] = ['safety', 'anticipation', 'efficiency', 'care', 'team'];
    const rows = cats.map((cat, ci) => `<div class="score-row"><span>${CAT_LABEL[cat]}</span><span class="stars">${[0, 1, 2].map((i) => `<span style="display:contents">${ICON.star.replace('<svg', `<svg class="${i < r.stars[cat] ? 'on' : ''}" style="animation-delay:${0.15 + ci * 0.25 + i * 0.08}s"`)}</span>`).join('')}</span></div>`).join('');
    const card = h('div', 'card results', `<h1><small>${this.g.level.title}</small>CASE COMPLETE</h1>
      <div class="score-rows">${rows}</div>
      <div class="fb">${r.good.length ? `<div class="g"><h6>GOOD</h6><ul>${r.good.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      ${r.improve.length ? `<div class="i"><h6>IMPROVE</h6><ul>${r.improve.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}</div>`);
    const btns = h('div', 'btns');
    if (this.hooks.hasNext()) {
      const nx = h('button', 'big-btn', 'Next case');
      nx.onclick = () => { scr.remove(); this.hooks.next(); };
      btns.append(nx);
    }
    const rt = h('button', 'big-btn yellow', 'Replay case');
    rt.onclick = () => { scr.remove(); this.hooks.restart(); };
    const mn = h('button', 'big-btn ghost', 'Shift menu');
    mn.onclick = () => { scr.remove(); this.hooks.menu(); };
    btns.append(rt, mn);
    card.append(btns);
    scr.append(card);
    this.el.append(scr);
    let n = 0;
    for (const cat of cats) for (let i = 0; i < r.stars[cat]; i++) setTimeout(() => this.g.audio.play('star'), 200 + n++ * 110);
  }

  // ------------------------------------------------------------------ per-frame refresh

  update(camera: THREE.Camera, w: number, hgt: number): void {
    const g = this.g;
    if (!g) return;
    const fc = g.focusCase();
    // top bar
    const phaseName = { prep: 'Prep', active: 'Active Case', recovery: 'Recovery', done: 'Handoff done' }[fc.phase];
    const ph = this.top.querySelector('.ph')!;
    const phTxt = g.ts.cases.length > 1 ? `${phaseName} · ${fc.patient.name}` : phaseName;
    if (ph.textContent !== phTxt) ph.textContent = phTxt;
    const order = ['prep', 'active', 'recovery', 'done'];
    this.top.querySelectorAll('.phase-dots i').forEach((d, i) => {
      const pi = order.indexOf(fc.phase);
      d.className = i < pi ? 'on' : i === pi ? 'now' : '';
    });
    const clock = this.top.querySelector('[data-role=clock] span')!;
    const ct = fmtClock(g.level.startClock + g.ts.time / 4);
    if (clock.textContent !== ct) clock.textContent = ct;

    this.renderTasks(fc);
    this.renderTimers();
    this.renderTray();
    this.renderQueue();
    this.renderCare(fc);
    this.renderSide(fc);
    this.renderLabels(camera, w, hgt);
    if (this.sheet?.classList.contains('prep') && g.mode === 'prep') {
      const key = g.inv.slots.join(',');
      if (key !== this.sheet.dataset.key) { this.sheet.dataset.key = key; this.renderPrep(); }
    }
    const inRoom = g.mode === 'room' || g.mode === 'paused';
    this.tasksEl.classList.toggle('hidden', !inRoom);
    this.timersEl.classList.toggle('hidden', !inRoom && g.mode !== 'prep');
    if (this.hintEl) {
      this.hintEl.style.top = `calc(${this.careEl.classList.contains('hidden') ? 68 : 132}px + var(--safe-top))`;
      this.hintEl.style.visibility = this.tasksCollapsed ? '' : 'hidden';
    }
    // toasts sit just below whatever occupies the top (hint, care panel)
    let topY = 68;
    if (!this.careEl.classList.contains('hidden')) topY = this.careEl.offsetTop + this.careEl.offsetHeight + 6;
    if (this.hintEl && this.hintEl.style.visibility !== 'hidden' && !this.hintEl.classList.contains('hidden')) topY = this.hintEl.offsetTop + this.hintEl.offsetHeight + 6;
    this.toastsEl.style.top = `${topY}px`;
  }

  private taskLabel(t: TaskRT): string {
    return t.def.label ?? t.def.name;
  }

  private renderTasks(_focus: CaseRT): void {
    const g = this.g;
    const cases = g.ts.cases.filter((c) => c.phase !== 'done' && (c.arrived || g.ts.list().some((t) => t.caseId === c.id && t.def.levelTask)));
    const sections: { title: string; rows: TaskRT[] }[] = [];
    let doneN = 0, totalN = 0;
    for (const c of cases) {
      const inPhase = (t: TaskRT) => (Array.isArray(t.def.phase) ? t.def.phase : [t.def.phase]).includes(c.phase);
      let rows = g.ts.list().filter((t) => t.caseId === c.id && !t.def.hidden && !t.def.auto && (c.arrived || t.def.levelTask))
        .filter((t) => inPhase(t) || (t.state !== 'done' && t.state !== 'locked'));
      if (c.phase !== 'prep') rows = rows.filter((t) => !(t.def.optional && t.state === 'locked'));
      rows.sort((x, y) => (y.event ? 1 : 0) - (x.event ? 1 : 0));
      doneN += rows.filter((t) => t.state === 'done').length;
      totalN += rows.length;
      sections.push({ title: cases.length > 1 ? `${c.patient.name}${c.arrived ? '' : ' (arriving)'}` : '', rows });
    }
    const key = sections.map((sec) => sec.title + sec.rows.map((t) => `${t.key}:${t.state}:${t.state === 'running' ? Math.ceil(t.processLeft) : ''}`).join('|')).join('#') + g.inv.items.join() + this.tasksCollapsed;
    if (key === this.lastTasks) return;
    this.lastTasks = key;
    let html = `<h4><span>${this.tasksCollapsed ? '☑' : 'TASKS'} ${doneN}/${totalN}</span><span>${this.tasksCollapsed ? '▸' : '▾'}</span></h4><ul>`;
    for (const sec of sections) {
      if (sec.title) html += `<li class="sec"><b>${sec.title}</b></li>`;
      for (const t of sec.rows.slice(0, 12)) {
        const st = t.state === 'working' ? (t.by && t.by !== 'yolanda' ? 'running' : 'available') : t.state;
        let right = '';
        if (t.state === 'running') right = `<span class="t">${Math.ceil(t.processLeft)}s</span>`;
        if (t.state === 'ready') right = '<span class="t">READY</span>';
        if (t.state === 'working' && t.by && t.by !== 'yolanda') right = `<span class="t">${STAFF_ROLES[t.by]?.name ?? ''}</span>`;
        const missing = t.state === 'available' ? g.inv.missing(t.def.requiredItems) : [];
        const need = missing.length ? `<span class="need">needs ${missing.map((m) => ITEMS[m]?.short ?? m).join(' + ')}</span>` : '';
        const label = t.event ? `<b style="color:#ff8f8f">${this.taskLabel(t)}</b>` : this.taskLabel(t);
        html += `<li class="${st} ${t.def.optional ? 'optional' : ''}"><span class="ck">${t.state === 'done' ? ICON.check : ''}</span><span>${label}${need}</span>${right}</li>`;
      }
    }
    html += '</ul>';
    this.tasksEl.innerHTML = html;
    this.tasksEl.classList.toggle('collapsed', this.tasksCollapsed);
  }

  private renderTimers(): void {
    const g = this.g;
    const items: { name: string; left: number; total: number; ready: boolean; eta?: boolean }[] = [];
    for (const t of g.totalRunning()) {
      if (t.def.auto) continue;
      items.push({ name: this.taskLabel(t), left: t.processLeft, total: t.def.process ?? 1, ready: t.state === 'ready' });
    }
    for (const d of g.delegations) items.push({ name: `${STAFF_ROLES[d.def.roleId].name}: ${d.def.name}`, left: d.left, total: d.total, ready: false, eta: true });
    for (const c of g.ts.cases) {
      if (c.phase === 'prep' && c.arrived && !g.procSpawned.has(c.id)) {
        const left = c.patient.proceduralistArrival - g.ts.time;
        if (left < 40 && left > 0) items.push({ name: `${c.template.proceduralist.name} ETA`, left, total: 40, ready: false, eta: true });
      }
    }
    const key = items.map((i) => `${i.name}:${Math.ceil(i.left)}:${i.ready}:${Math.round((i.left / i.total) * 40)}`).join('|');
    if (key === this.lastTimers) return;
    this.lastTimers = key;
    this.timersEl.innerHTML = items.map((i) => `<div class="panel timer ${i.ready ? 'ready' : ''} ${i.eta ? 'eta' : ''}"><div class="row"><span>${i.name}</span><b>${i.ready ? 'READY' : `${Math.ceil(i.left)}s`}</b></div><div class="bar" style="width:${(1 - i.left / i.total) * 100}%"></div></div>`).join('');
  }

  private renderTray(): void {
    const g = this.g;
    const key = g.inv.slots.join(',');
    if (key === this.lastSlots) return;
    const prev = this.lastSlots.split(',');
    this.lastSlots = key;
    this.slotsEl.innerHTML = g.inv.slots.map((id, i) =>
      id ? `<div class="slot full ${prev[i] !== id ? 'pop' : ''}">${itemIcon(ITEMS[id])}${ITEMS[id].short}</div>` : '<div class="slot">empty</div>').join('');
    const cnt = this.bottom.querySelector('.cnt');
    if (cnt) cnt.textContent = `${g.inv.items.length}/4`;
  }

  private renderQueue(): void {
    const g = this.g;
    const cur = g.y.k === 'move' ? g.y.station : g.y.k === 'work' || g.y.k === 'wait' ? g.y.station : null;
    const key = `${cur}|${g.queue.items.map((q) => q.uid).join(',')}`;
    if (key === this.lastQueue) return;
    this.lastQueue = key;
    this.queueEl.innerHTML = '';
    if (!g.queue.length && !cur) return;
    this.queueEl.append(h('span', 'lbl-q', 'ROUTE'));
    const name = (id: string) => {
      const sv = g.world.stations.get(id)!;
      return sv.def.kind === 'workstation' ? 'Workstation' : sv.def.name.split(' ·')[0];
    };
    if (cur && !g.queue.items.some((q) => q.stationId === cur && g.y.k === 'move')) {
      this.queueEl.append(h('span', 'chip cur', `<span class="n">▶</span>${name(cur)}`));
    }
    g.queue.items.forEach((q, i) => {
      const chip = h('span', `chip ${i === 0 && g.y.k === 'move' ? 'cur' : ''}`, `<span class="n">${i + 1}</span>${name(q.stationId)}${ICON.x}`);
      chip.onclick = () => { g.cancelQueued(q.uid); };
      this.queueEl.append(chip);
    });
    if (g.queue.length > 1) {
      const clr = h('button', 'clear', 'Clear');
      clr.onclick = () => g.clearQueue();
      this.queueEl.append(clr);
    }
  }

  private renderCare(c: CaseRT): void {
    const g = this.g;
    const show = c.phase === 'active' && (g.mode === 'room' || g.mode === 'paused');
    this.careEl.classList.toggle('hidden', !show);
    if (!show) return;
    const v = g.ts.vitals(c);
    const proc = g.ts.get(c.id, 'procedure');
    const pct = proc && proc.def.process ? (1 - proc.processLeft / proc.def.process) * 100 : 0;
    this.careEl.innerHTML = `<div class="vit"><div class="hr">${v.hr}<small>HR</small></div><div class="sp ${v.spo2 < 94 ? 'low' : ''}">${v.spo2}<small>SpO₂</small></div><div class="bp">${v.bp}<small>BP</small></div></div>
      <div class="prog"><span>${c.template.procedure.toUpperCase()} · ${Math.round(pct)}%</span><div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
  }

  private renderSide(c: CaseRT): void {
    const g = this.g;
    const page = g.mode === 'room' && g.canPage(c);
    const staff = g.level.staff.length > 0 && g.mode === 'room';
    const key = `${page}|${staff}|${c.id}`;
    if (key === this.lastSide) return;
    this.lastSide = key;
    this.sideEl.innerHTML = '';
    if (page) {
      const b = h('button', 'pill-btn yellow pulse', `${ICON.phone}Page ${c.template.proceduralist.name}`);
      b.onclick = () => g.page(c);
      this.sideEl.append(b);
    }
    if (staff) {
      const b = h('button', 'pill-btn navy', `${ICON.team}Team`);
      b.onclick = () => this.toggleStaff();
      this.sideEl.append(b);
    }
  }

  private toggleStaff(): void {
    if (this.staffMenu) { this.staffMenu.remove(); this.staffMenu = null; return; }
    const g = this.g;
    const m = h('div', 'panel staff-menu');
    const list = g.availableDelegations();
    m.innerHTML = '<h4>DELEGATE</h4>';
    if (!list.length) m.append(h('div', 'none', 'Nothing to delegate right now.'));
    for (const d of list) {
      const role = STAFF_ROLES[d.roleId];
      const b = h('button', '', `<span>${d.name}<br><small>${role.name} · ${role.title}</small></span><small>ETA ${d.eta}s</small>`);
      b.onclick = () => { g.delegate(d); m.remove(); this.staffMenu = null; };
      m.append(b);
    }
    this.el.append(m);
    this.staffMenu = m;
  }

  private renderLabels(camera: THREE.Camera, w: number, hgt: number): void {
    const g = this.g;
    const show = g.mode === 'room' || g.mode === 'paused';
    this.labels.style.display = show ? '' : 'none';
    if (!show) return;
    const active = g.ts.anyActive();
    for (const [id, el] of this.labelEls) {
      const sv = g.world.stations.get(id)!;
      this.v.copy(sv.labelPos).project(camera);
      const half = (el.offsetWidth || 120) / 2;
      const x = Math.max(half + 4, Math.min(w - half - 4, (this.v.x * 0.5 + 0.5) * w)), y = (-this.v.y * 0.5 + 0.5) * hgt;
      el.style.transform = `translate(${x - half}px, ${y}px) translate(0, -50%)`;
      // state badge
      const here = g.ts.list().filter((t) => t.def.stationId === id);
      const ev = here.find((t) => t.event && t.state !== 'done');
      const ready = here.find((t) => t.state === 'ready');
      const running = here.find((t) => t.state === 'running' && !t.def.auto);
      const badge = el.querySelector('.badge') as HTMLElement;
      let bTxt = '', bCls = '';
      if (ev) { bTxt = `! ${ev.event!.def.bubble}`; bCls = 'alert'; }
      else if (ready) { bTxt = 'READY'; bCls = 'ready'; }
      else if (running) { bTxt = `${Math.ceil(running.processLeft)}s`; bCls = ''; }
      else if (id === 'supplies' && g.mode === 'room' && g.glowItems().size && g.focusCase().phase === 'prep') { bTxt = 'Items needed'; bCls = 'info'; }
      if (badge.textContent !== bTxt) badge.textContent = bTxt;
      badge.className = `badge ${bCls} ${bTxt ? '' : 'hidden'}`;
      const locked = active && !g.inZone(sv.stand);
      el.classList.toggle('locked', locked);
      el.classList.toggle('focus', g.focusStation === id);
      const act = !locked && !ev && !ready && g.ts.actionable(id, g.inv);
      let dot = el.querySelector('.dot');
      if (act && !dot) { dot = h('span', 'dot'); el.querySelector('.pill')!.append(dot); (el.querySelector('.pill') as HTMLElement).style.position = 'relative'; }
      if (!act && dot) dot.remove();
    }
  }
}
