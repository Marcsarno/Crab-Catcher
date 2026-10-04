import type { LevelDef } from '../core/types';
import type { Save } from '../core/Save';
import { CASE_TEMPLATES } from '../data/caseTemplates';
import { ITEMS } from '../data/items';
import { ICON } from './icons';

const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const UPCOMING = [
  { n: 4, t: 'Operating Room', s: 'General anesthesia · bigger room' },
  { n: 5, t: 'Parallel Processes', s: 'ThermaNest, transport, deliveries' },
  { n: 6, t: 'Ortho + Ultrasound', s: 'Shared equipment' },
  { n: 7, t: 'Pediatric Case', s: 'Comfort & caregiver' },
  { n: 8, t: 'MRI', s: 'Screening threshold puzzle' },
];

export class Screens {
  private cur: HTMLElement | null = null;

  constructor(private root: HTMLElement) {}

  clear(): void {
    this.cur?.remove();
    this.cur = null;
  }

  private show(el: HTMLElement): void {
    this.clear();
    this.cur = el;
    this.root.append(el);
  }

  title(levels: LevelDef[], save: Save, play: (l: LevelDef) => void, settings: () => void): void {
    const s = h('div', 'screen title-screen');
    s.append(h('div', 'logo', '<h1>YOLANDA</h1><h2>ANESTHESIA SHIFT</h2>'));
    const list = h('div', 'levels');
    for (const l of levels) {
      const unlocked = save.data.unlocked.includes(l.id);
      const best = save.data.best[l.id];
      const b = h('button', `lvl ${unlocked ? '' : 'locked'}`,
        `<span class="num">${unlocked ? l.number : ICON.lock}</span><span class="nm">${l.title}<small>${l.location} · ${l.lesson.split('.')[0]}</small></span>${best ? `<span class="st">${ICON.star}${best.total}/15</span>` : ''}`);
      if (unlocked) b.onclick = () => play(l);
      list.append(b);
    }
    list.append(h('div', 'soon-line', `Coming on later shifts: ${UPCOMING.map((u) => u.t).join(' · ')}`));
    const row = h('div', 'menu-row');
    const set = h('button', 'big-btn ghost', 'Settings');
    set.onclick = settings;
    row.append(set);
    s.append(list, row);
    this.show(s);
  }

  caseCard(l: LevelDef, start: () => void, back: () => void): void {
    const tpl = CASE_TEMPLATES[l.caseTemplateId];
    const s = h('div', 'screen');
    const planItems = tpl.plan.map((p) => `${p.label} (${p.items.map((i) => ITEMS[i].name).join(', ')})`);
    const card = h('div', 'card', `<h1><small>Case ${l.number} · ${l.location}</small>${l.title}</h1>
      <div class="lines">${l.cardLines.map((x) => `<div>${ICON.check}${x}</div>`).join('')}</div>
      <p style="margin:6px 0 2px;font-weight:800;font-size:13px;color:#47627c;letter-spacing:.06em">CASE PLAN</p>
      <div class="lines" style="margin-top:4px">${planItems.map((x) => `<div>${ICON.chart}${x}</div>`).join('')}</div>
      <div class="lesson">${l.lesson}</div>`);
    const btns = h('div', 'btns');
    const go = h('button', 'big-btn', 'Start prep');
    go.onclick = start;
    const bk = h('button', 'big-btn ghost', 'Back');
    bk.onclick = back;
    btns.append(go, bk);
    card.append(btns);
    s.append(card);
    this.show(s);
  }

  pause(o: { resume: () => void; restart: () => void; menu: () => void; save: Save; apply: () => void }): void {
    const s = h('div', 'screen');
    const card = h('div', 'card', '<h1><small>Paused</small>Take a breath</h1>');
    card.append(this.toggles(o.save, o.apply));
    const btns = h('div', 'btns');
    const r = h('button', 'big-btn', 'Resume');
    r.onclick = () => { this.clear(); o.resume(); };
    const rs = h('button', 'big-btn yellow', 'Restart case');
    rs.onclick = () => { this.clear(); o.restart(); };
    const m = h('button', 'big-btn ghost', 'Quit to shift menu');
    m.onclick = () => { this.clear(); o.menu(); };
    btns.append(r, rs, m);
    card.append(btns);
    s.append(card);
    this.show(s);
  }

  settings(save: Save, apply: () => void, back: () => void): void {
    const s = h('div', 'screen');
    const card = h('div', 'card', '<h1><small>Settings</small>Preferences</h1>');
    card.append(this.toggles(save, apply));
    const btns = h('div', 'btns');
    const reset = h('button', 'big-btn ghost', 'Reset progress');
    reset.onclick = () => {
      if (reset.dataset.confirm) { save.reset(); apply(); reset.textContent = 'Progress reset'; return; }
      reset.dataset.confirm = '1';
      reset.textContent = 'Tap again to confirm reset';
    };
    const bk = h('button', 'big-btn', 'Back');
    bk.onclick = back;
    btns.append(reset, bk);
    card.append(btns);
    card.append(h('p', '', '<small style="color:#6a8299">A game, not medical training. Medications and machines are fictional. Hidden developer panel: press <b>`</b> or tap the clock 5×.</small>'));
    s.append(card);
    this.show(s);
  }

  private toggles(save: Save, apply: () => void): HTMLElement {
    const wrap = h('div', '');
    const rows: [keyof typeof save.data.settings, string][] = [['sound', 'Sound effects'], ['music', 'Music'], ['hints', 'Tutorial hints']];
    for (const [k, label] of rows) {
      const row = h('div', 'toggle', `<span>${label}</span>`);
      const b = h('button', save.data.settings[k] ? 'on' : '', save.data.settings[k] ? 'ON' : 'OFF');
      b.onclick = () => {
        save.data.settings[k] = !save.data.settings[k];
        b.className = save.data.settings[k] ? 'on' : '';
        b.textContent = save.data.settings[k] ? 'ON' : 'OFF';
        save.write();
        apply();
      };
      row.append(b);
      wrap.append(row);
    }
    return wrap;
  }
}
