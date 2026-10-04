// Automated playtest: boots the game in a portrait phone viewport and plays a
// level start-to-finish through the same entry points a player's taps use.
// Usage: node scripts/playtest.mjs [levelId] [--speed=4] [--shots]
import { chromium } from 'playwright-core';

const levelId = process.argv.find((a) => /^L\d$/.test(a)) ?? 'L1';
const speed = Number((process.argv.find((a) => a.startsWith('--speed=')) ?? '--speed=4').split('=')[1]);
const shots = process.argv.includes('--shots');
const url = process.env.URL ?? 'http://localhost:5173/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT') && !m.text().includes('404')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__yolanda);

await page.evaluate(([id, sp]) => {
  const app = window.__yolanda;
  const lvl = app.debug['api'].levels.find((l) => l.id === id);
  app.start(lvl, true);
  app.game.speed = sp;
}, [levelId, speed]);

// The bot runs inside the page so it reacts every frame-ish.
const result = await page.evaluate(async () => {
  const app = window.__yolanda;
  const log = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = () => app.game;
  const t0 = performance.now();
  let lastLog = '';
  const say = (s) => { if (s !== lastLog) { log.push(`[t=${g().ts.time.toFixed(1)}] ${s}`); lastLog = s; } };
  // stations in a sensible preference order (slow machines first)
  const pref = ['workstation', 'airready', 'sedaprep', 'scopeair', 'chart', 'bay2', 'bay1', 'handoff'];
  while (performance.now() - t0 < 240000) {
    const game = g();
    if (game.mode === 'results') break;
    if (game.mode === 'paused') {
      // modifier reveal popups pause the game: press their button
      const btn = document.querySelector('.reveal .big-btn');
      if (btn) { say('reveal → adapt'); btn.click(); }
      await sleep(50);
      continue;
    }
    if (game.mode === 'prep') {
      const need = [...game.glowItems()];
      const fc = game.focusCase();
      // pick what unfinished tasks need, but leave room for outputs
      for (const id of need) {
        if (game.inv.free <= 0) break;
        if (game.inv.count(id) === 0) { game.pickItem(id); say(`pick ${id}`); }
      }
      game.closePrep();
      say(`close prep, tray=${game.inv.items.join(',')}`);
      await sleep(50);
      continue;
    }
    if (game.mode === 'handoff') {
      const c = game.focusCase();
      const facts = game.ts.handoffFacts(c);
      const correct = new Set(facts.filter((f) => f.correct).map((f) => f.text));
      document.querySelectorAll('.fact').forEach((el) => { if (correct.has(el.textContent)) el.click(); });
      await sleep(50);
      document.querySelector('.sheet .big-btn')?.click();
      say('handoff given');
      await sleep(50);
      continue;
    }
    if (game.mode === 'room' && (game.y.k === 'idle') && game.queue.length === 0) {
      const fc = game.focusCase();
      if (game.canPage(fc)) { game.page(fc); say('page proceduralist'); }
      let chosen = null;
      for (const id of pref) {
        if (!game.world.stations.has(id)) continue;
        const a = game.ts.resolveAt(id, game.inv);
        const sv = game.world.stations.get(id);
        if (game.ts.anyActive() && !game.inZone(sv.stand)) continue;
        if (a.type === 'do' || a.type === 'collect') { chosen = id; say(`→ ${id} (${a.type} ${a.task.def.id})`); break; }
      }
      // need supplies?
      if (!chosen && game.glowItems().size && game.inv.free > 0 && !game.ts.anyActive()) { chosen = 'supplies'; say('→ supplies'); }
      if (chosen) game.tapStation(chosen);
    }
    await sleep(40);
  }
  return { log, mode: g().mode, result: g().result, metrics: g().metrics, time: g().ts.time };
});

if (shots) await page.screenshot({ path: `shots/playtest-${levelId}-end.png` });
console.log(result.log.join('\n'));
console.log('\nMODE:', result.mode, ' sim time:', result.time.toFixed(1), 's');
console.log('METRICS:', JSON.stringify(result.metrics));
console.log('RESULT:', JSON.stringify(result.result, null, 1));
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(result.mode === 'results' && !errors.length ? 0 : 1);
