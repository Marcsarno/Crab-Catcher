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
  private careEl: HTMLElement;
  private bottom: HTMLElement;
  private slotsEl: HTMLElement;
  private toastsEl: HTMLElement;
  private hintEl: HTMLElement | null = null;
  private sheet: HTMLElement | null = null;
  private sideEl: HTMLElement;
  private staffMenu: HTMLElement | null = null;
  private labelEls = new Map<string, HTMLElement>();
  private lastSlots = '';
  private lastTasks = '';
  private lastSide = '';
  private v = new THREE.Vector3();

  constructor(root: HTMLElement, private hooks: HudHooks) {
    this.el = h('div', 'layer hud');
    this.labels = h('div', 'labels');
    this.top = h('div', 'panel topbar');
    this.tasksEl = h('div', 'taskcard');
    this.careEl = h('div', 'panel care hidden');
    this.sideEl = h('div', 'side-btns');
    this.bottom = h('div', 'bottom2');
    const tray = h('div', 'traycard');
    tray.append(h('div', 'tc-head', 'Prep Tray <span class="cnt">0 / 4</span>'));
    this.slotsEl = h('div', 'tc-slots');
    tray.append(this.slotsEl);
    this.bottom.append(this.tasksEl, tray);
    this.toastsEl = h('div', 'toasts');
    this.el.append(this.labels, this.top, this.careEl, this.sideEl, this.bottom, this.toastsEl);
    root.append(this.el);
    this.labels.style.pointerEvents = 'none';
  }

  attach(g: Game): void {
    this.g = g;
    this.labels.innerHTML = '';
    this.labelEls.clear();
    this.lastSlots = this.lastTasks = this.lastSide = '';
    this.closeSheet();
    this.hint(null);
    this.toastsEl.innerHTML = '';
    this.staffMenu?.remove();
    this.staffMenu = null;
    // top bar
    this.top.innerHTML = '';
    const badge = h('div', 'tb-icon', ICON.chart);
    const title = h('div', 'tb-title', `<b>${g.level.title}</b><span class="ph">Prep Phase</span>`);
    const clock = h('div', 'tb-clock', `${ICON.clock}<span>--:--</span>`);
    clock.dataset.role = 'clock';
    const menuBtn = h('button', 'icon-btn', ICON.gear);
    menuBtn.setAttribute('aria-label', 'Pause and settings');
    menuBtn.onclick = () => this.hooks.pause();
    this.top.append(badge, title, clock, menuBtn);
    // station labels
    for (const [id, sv] of g.world.stations) {
      const el = h('div', 'lbl');
      el.innerHTML = `<div class="pill"><span class="qn hidden"></span><i class="ic">${ICON[sv.def.icon] ?? ''}</i><span>${sv.def.kind === 'bay' || sv.def.kind === 'preop' ? sv.def.name : sv.def.name.replace('Anesthesia ', '')}</span></div><div class="badge hidden"></div>`;
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
    const s = h('div', 'sheet prep prep2');
    this.sheet = s;
    this.el.append(s);
    // open the drawer that holds something still needed
    const wanted = this.g.glowItems();
    const first = DRAWERS.findIndex((d) => Object.values(ITEMS).some((it) => it.drawer === d.id && wanted.has(it.id)));
    this.drawerTab = first >= 0 ? first : 0;
    this.renderPrep();
  }

  private drawerTab = 0;

  private renderPrep(): void {
    const s = this.sheet;
    if (!s || !this.g) return;
    const g = this.g;
    const c = g.focusCase();
    const need = g.neededItems();
    const wanted = g.glowItems();
    const glow = g.level.glowRequired ? wanted : new Set<string>();
    const planHtml = g.ts.cases.filter((x) => x.phase !== 'done' && x.arrived).flatMap((cc) => cc.plan.map((p, i) => {
      const ok = p.items.every((id) => g.inv.count(id) > 0 || !need.has(id));
      const isNew = i >= cc.template.plan.length;
      return `<span class="p ${ok ? 'ok' : ''} ${isNew ? 'new' : ''}">${ok ? ICON.check : ''}${p.label}</span>`;
    })).join('');
    g.prepDrawer = this.drawerTab;
    let html = `<div class="pp-head"><div><b>SUPPLY CART</b><span>Case plan · ${c.patient.name}</span></div><div class="plan">${planHtml}</div></div>`;
    html += '<div class="pp-tabs">' + DRAWERS.map((d, i) => {
      const hasNeed = Object.values(ITEMS).some((it) => it.drawer === d.id && wanted.has(it.id));
      return `<button class="pp-tab ${i === this.drawerTab ? 'on' : ''}" data-tab="${i}"><i style="background:${d.color}"></i>${d.name}${hasNeed && g.tutorialOn ? '<em></em>' : ''}</button>`;
    }).join('') + '</div>';
    const d = DRAWERS[this.drawerTab];
    html += '<div class="pp-items">';
    for (const it of Object.values(ITEMS).filter((x) => x.drawer === d.id)) {
      const cnt = g.inv.count(it.id);
      const left = g.stockOf(it.id);
      const stockTag = left === Infinity ? '' : `<span class="stock ${left <= 0 ? 'out' : ''}">${left <= 0 ? 'OUT' : `${left} left`}</span>`;
      html += `<button class="pp-item ${glow.has(it.id) ? 'glow' : ''} ${left <= 0 ? 'empty' : ''} ${cnt ? 'taken' : ''}" data-id="${it.id}">${cnt ? `<span class="cnt">${ICON.check}</span>` : ''}${itemIcon(it)}<span class="nm">${it.name}</span>${stockTag}</button>`;
    }
    html += '</div><div class="pp-foot"><div class="pp-tray">';
    g.inv.slots.forEach((id, i) => {
      html += id ? `<button class="ts full" data-slot="${i}" title="Put back">${itemIcon(ITEMS[id])}<span>${ITEMS[id].short}</span></button>` : `<div class="ts"><span class="n">${i + 1}</span></div>`;
    });
    html += `</div><button class="big-btn pp-done">Done</button></div><div class="pp-note">Tap an item to add it to the tray · tap a tray item to put it back</div>`;
    s.innerHTML = html;
    s.querySelectorAll<HTMLElement>('.pp-tab').forEach((el) => {
      el.onclick = () => { this.drawerTab = Number(el.dataset.tab); this.g.audio.play('drawer'); this.renderPrep(); };
    });
    s.querySelectorAll<HTMLElement>('.pp-item').forEach((el) => {
      el.onclick = () => { if (g.pickItem(el.dataset.id!)) this.renderPrep(); };
    });
    s.querySelectorAll<HTMLElement>('.ts.full').forEach((el) => {
      el.onclick = () => { g.returnItem(Number(el.dataset.slot)); this.renderPrep(); };
    });
    (s.querySelector('.pp-done') as HTMLButtonElement).onclick = () => g.closePrep();
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
    const phaseName = { prep: 'Prep Phase', active: 'Active Case', closing: 'Closing', recovery: 'Recovery', done: 'Handoff done' }[fc.phase];
    const ph = this.top.querySelector('.ph')!;
    const phTxt = g.ts.cases.length > 1 ? `${phaseName} · ${fc.patient.name}` : phaseName;
    if (ph.textContent !== phTxt) ph.textContent = phTxt;
    const clock = this.top.querySelector('[data-role=clock] span')!;
    const ct = fmtClock(g.level.startClock + g.ts.time / 4);
    if (clock.textContent !== ct) clock.textContent = ct;

    this.renderTasks(fc);
    this.renderTray();
    this.renderCare(fc);
    this.renderSide(fc);
    this.renderLabels(camera, w, hgt);
    if (this.sheet?.classList.contains('prep') && g.mode === 'prep') {
      const key = g.inv.slots.join(',');
      if (key !== this.sheet.dataset.key) { this.sheet.dataset.key = key; this.renderPrep(); }
    }
    const inRoom = g.mode === 'room' || g.mode === 'paused';
    this.bottom.classList.toggle('hidden', !inRoom);
    this.sideEl.classList.toggle('hidden', !inRoom);
    if (this.hintEl) this.hintEl.style.top = `calc(${this.careEl.classList.contains('hidden') ? 76 : 140}px + var(--safe-top))`;
    // toasts sit just below whatever occupies the top (hint, care panel)
    let topY = 68;
    if (!this.careEl.classList.contains('hidden')) topY = this.careEl.offsetTop + this.careEl.offsetHeight + 6;
    if (this.hintEl && this.hintEl.style.visibility !== 'hidden' && !this.hintEl.classList.contains('hidden')) topY = this.hintEl.offsetTop + this.hintEl.offsetHeight + 6;
    this.toastsEl.style.top = `${topY}px`;
  }

  private taskLabel(t: TaskRT): string {
    return t.def.label ?? t.def.name;
  }

  private renderTasks(fc: CaseRT): void {
    const g = this.g;
    const sug = g.suggestion;
    const inPhase = (t: TaskRT) => {
      const c = g.ts.caseOf(t);
      return (Array.isArray(t.def.phase) ? t.def.phase : [t.def.phase]).includes(c.phase);
    };
    const rows = g.ts.list().filter((t) => !t.def.hidden && !t.def.auto && (t.caseId === fc.id || (t.def.levelTask && t.state !== 'locked'))
      && (inPhase(t) || t.state === 'running' || t.state === 'ready' || (t.event && t.state !== 'done')));
    const open = rows.filter((t) => t.state !== 'done').sort((x, y) => (y.event ? 1 : 0) - (x.event ? 1 : 0) || (x.def.optional ? 1 : 0) - (y.def.optional ? 1 : 0));
    const doneN = rows.filter((t) => t.state === 'done').length;
    const title = { prep: 'Prep Tasks', active: 'Case Tasks', closing: 'Closing Tasks', recovery: 'Recovery Tasks', done: 'Done' }[fc.phase] + (g.ts.cases.length > 1 ? ` · ${fc.patient.name}` : '');
    const timeLeft = (t: TaskRT) => {
      if (t.state === 'running') return `${Math.ceil(t.processLeft)}s`;
      if (t.state === 'ready') return 'READY';
      if (t.state === 'working' && t.by && t.by !== 'yolanda') return STAFF_ROLES[t.by]?.name ?? '';
      if (t.def.needsProceduralist && !g.ts.caseOf(t).proceduralistPresent) {
        const left = g.ts.caseOf(t).patient.proceduralistArrival - g.ts.time;
        return g.procSpawned.has(t.caseId) ? 'Dr. coming' : left > 0 ? `Dr. ${Math.ceil(left)}s` : '';
      }
      return '';
    };
    const key = `${title}|${sug.text}|${sug.task?.key}|${doneN}|` + open.map((t) => `${t.key}:${t.state}:${timeLeft(t)}`).join('|') + g.inv.items.join();
    if (key === this.lastTasks) return;
    this.lastTasks = key;
    const MAX = 4;
    let html = `<div class="tk-head"><b>${title}</b><span>${doneN}/${rows.length}</span></div>`;
    if (sug.text && g.tutorialOn) html += `<div class="tk-next ${sug.urgent ? 'urgent' : ''}"><i>${sug.urgent ? '!' : '➜'}</i><span>${sug.text}</span></div>`;
    html += '<ul>';
    for (const t of open.slice(0, MAX)) {
      const right = timeLeft(t);
      const missing = t.state === 'available' ? g.inv.missing(t.def.requiredItems) : [];
      const cls = [t.state, t === sug.task && g.tutorialOn ? 'next' : '', t.def.optional ? 'optional' : '', t.event ? 'event' : '', t.state === 'locked' ? 'later' : ''].join(' ');
      const need = missing.length ? `<small>needs ${missing.map((m) => ITEMS[m]?.short ?? m).join(' + ')}</small>` : '';
      html += `<li class="${cls}"><span class="ck">${t.state === 'ready' ? ICON.check : ''}</span><span class="tx">${this.taskLabel(t)}${need}</span>${right ? `<span class="t ${t.state === 'ready' ? 'ok' : ''}">${right}</span>` : ''}</li>`;
    }
    if (open.length > MAX) html += `<li class="more">+${open.length - MAX} more</li>`;
    if (!open.length) html += '<li class="more">All done ✓</li>';
    html += '</ul>';
    this.tasksEl.innerHTML = html;
  }

  private renderTray(): void {
    const g = this.g;
    const key = g.inv.slots.join(',');
    if (key === this.lastSlots) return;
    const prev = this.lastSlots.split(',');
    this.lastSlots = key;
    this.slotsEl.innerHTML = g.inv.slots.map((id, i) =>
      id ? `<div class="ts full ${prev[i] !== id ? 'pop' : ''}">${itemIcon(ITEMS[id])}<span>${ITEMS[id].short}</span></div>` : `<div class="ts"><span class="n">${i + 1}</span></div>`).join('');
    const cnt = this.bottom.querySelector('.cnt');
    if (cnt) cnt.textContent = `${g.inv.items.length} / 4`;
  }

  private renderCare(c: CaseRT): void {
    const g = this.g;
    const show = (c.phase === 'active' || c.phase === 'closing') && (g.mode === 'room' || g.mode === 'paused');
    this.careEl.classList.toggle('hidden', !show);
    if (!show) return;
    const v = g.ts.vitals(c);
    const closing = c.phase === 'closing';
    const proc = g.ts.get(c.id, closing ? 'closing_proc' : 'procedure');
    const pct = proc && proc.def.process ? (1 - proc.processLeft / proc.def.process) * 100 : 0;
    this.careEl.innerHTML = `<div class="vit"><div class="hr">${v.hr}<small>HR</small></div><div class="sp ${v.spo2 < 94 ? 'low' : ''}">${v.spo2}<small>SpO₂</small></div><div class="bp">${v.bp}<small>BP</small></div></div>
      <div class="prog"><span>${closing ? 'CLOSING' : c.template.procedure.toUpperCase()} · ${Math.round(pct)}%</span><div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
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
      const qi = g.queue.items.findIndex((q) => q.stationId === id);
      const cur = (g.y.k === 'move' || g.y.k === 'work' || g.y.k === 'wait') && g.y.station === id;
      const qn = el.querySelector('.qn') as HTMLElement;
      const qTxt = cur ? '▶' : qi >= 0 ? String(qi + 1) : '';
      if (qn.textContent !== qTxt) qn.textContent = qTxt;
      qn.classList.toggle('hidden', !qTxt);
      const act = !locked && !ev && !ready && g.ts.actionable(id, g.inv);
      let dot = el.querySelector('.dot');
      if (act && !dot) { dot = h('span', 'dot'); el.querySelector('.pill')!.append(dot); (el.querySelector('.pill') as HTMLElement).style.position = 'relative'; }
      if (!act && dot) dot.remove();
    }
  }
}
