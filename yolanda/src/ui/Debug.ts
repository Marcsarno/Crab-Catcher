import type { Game } from '../core/Game';
import type { LevelDef } from '../core/types';
import { ITEMS } from '../data/items';

/** Hidden developer panel: level select, time scale, task/timer inspection, nav overlay. */
export class DebugPanel {
  el: HTMLElement | null = null;
  private timer: number | null = null;
  navOn = false;

  constructor(private root: HTMLElement, private api: {
    game: () => Game | null;
    levels: LevelDef[];
    load: (l: LevelDef) => void;
    restart: () => void;
  }) {}

  toggle(): void {
    if (this.el) { this.close(); return; }
    this.el = document.createElement('div');
    this.el.className = 'debug';
    this.root.append(this.el);
    this.render();
    this.timer = window.setInterval(() => this.render(), 400);
  }

  close(): void {
    this.el?.remove();
    this.el = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private render(): void {
    const el = this.el;
    if (!el) return;
    const g = this.api.game();
    const scroll = el.scrollTop;
    let html = '<h3><span>YOLANDA · DEV</span><button data-a="close">close</button></h3>';
    html += '<h4>LEVELS</h4>' + this.api.levels.map((l) => `<button data-a="load" data-id="${l.id}">${l.id} ${l.title}</button>`).join('');
    html += '<button data-a="restart">restart</button>';
    if (g) {
      html += `<h4>TIME ×${g.speed} · t=${g.ts.time.toFixed(1)}s · mode=${g.mode} · Yolanda=${g.y.k}</h4>`;
      html += [0.5, 1, 2, 4, 8].map((s) => `<button data-a="speed" data-v="${s}" class="${g.speed === s ? 'on' : ''}">×${s}</button>`).join('');
      html += `<button data-a="nav" class="${this.navOn ? 'on' : ''}">nav grid + paths</button>`;
      html += `<h4>CASES</h4>` + g.ts.cases.map((c) => `${c.id} ${c.patient.name}: phase=${c.phase} arrived=${c.arrived} proc=${c.proceduralistPresent} activeT=${c.activeTime.toFixed(1)} mods=${c.activeMods.map((m) => m.id).join(',') || '-'} pending=${c.pendingMods.map((m) => m.id).join(',') || '-'}`).join('<br>');
      html += `<h4>TRAY</h4>${g.inv.slots.map((s) => s ?? '·').join(' | ')} <select data-a="spawnSel">${Object.keys(ITEMS).map((k) => `<option>${k}</option>`).join('')}</select><button data-a="spawn">spawn item</button>`;
      html += `<h4>METRICS</h4>walk=${g.metrics.walk.toFixed(1)} wasted=${g.metrics.wastedVisits} wait=${g.metrics.waitTime.toFixed(1)} wrong=${g.metrics.wrongPicks} zoneBlocks=${g.metrics.zoneBlocks}`;
      html += '<h4>TASKS (state · timers · prerequisites)</h4><table>';
      for (const t of g.ts.list()) {
        const timer = t.state === 'running' ? `${t.processLeft.toFixed(1)}s` : t.state === 'working' ? `${t.work.toFixed(1)}/${t.def.duration}` : '';
        const pre = t.def.prerequisites.map((p) => `<span class="s-${g.ts.tasks.get(p)?.state}">${p.split('.')[1]}</span>`).join(', ');
        const items = t.def.requiredItems.length ? ` ⟵ ${t.def.requiredItems.join('+')}` : '';
        const out = t.def.producedItems.length ? ` ⟶ ${t.def.producedItems.join('+')}` : '';
        html += `<tr><td>${t.key}</td><td class="s-${t.state}">${t.state} ${timer}</td><td>@${t.def.stationId}${items}${out}<br><small>needs: ${pre || '-'}</small></td><td>${t.state !== 'done' ? `<button data-a="complete" data-k="${t.key}">✓</button>` : ''}</td></tr>`;
      }
      html += '</table>';
    }
    el.innerHTML = html;
    el.scrollTop = scroll;
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
      if (b.tagName === 'SELECT') return;
      b.onclick = () => this.act(b);
    });
  }

  private act(b: HTMLElement): void {
    const g = this.api.game();
    switch (b.dataset.a) {
      case 'close': this.close(); return;
      case 'load': { const l = this.api.levels.find((x) => x.id === b.dataset.id); if (l) this.api.load(l); break; }
      case 'restart': this.api.restart(); break;
      case 'speed': if (g) g.speed = Number(b.dataset.v); break;
      case 'nav': this.navOn = !this.navOn; g?.world.showNavDebug(this.navOn); break;
      case 'complete': { const t = g?.ts.tasks.get(b.dataset.k!); if (g && t) g.debugComplete(t); break; }
      case 'spawn': { const sel = this.el!.querySelector('select') as HTMLSelectElement; g?.debugSpawn(sel.value); break; }
    }
    this.render();
  }
}
