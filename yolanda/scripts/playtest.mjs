// Automated playtest: boots the game in a portrait phone viewport and plays a
// level start-to-finish through the same entry points a player's taps use.
// Usage: node scripts/playtest.mjs [levelId] [--speed=4] [--shots]
import { chromium } from 'playwright-core';

const levelId = process.argv.find((a) => /^L\d$/.test(a)) ?? 'L1';
const speed = Number((process.argv.find((a) => a.startsWith('--speed=')) ?? '--speed=4').split('=')[1]);
const shots = process.argv.includes('--shots');
const lazy = process.argv.includes('--lazy');
const follow = process.argv.includes('--follow'); // only does what the on-screen next-step suggestion says // naive player: quick tasks first, never pages or delegates
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
const botPromise = page.evaluate(async ([lazy, follow]) => {
  const app = window.__yolanda;
  const log = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = () => app.game;
  const t0 = performance.now();
  let lastLog = '';
  const say = (s) => { if (s !== lastLog) { log.push(`[t=${g().ts.time.toFixed(1)}] ${s}`); lastLog = s; } };
  // stations in a sensible preference order (slow machines first)
  const pref = lazy ? ['chart', 'bay2', 'bay1', 'supplies', 'scopeair', 'sedaprep', 'airready', 'workstation', 'handoff'] : ['workstation', 'airready', 'sedaprep', 'scopeair', 'chart', 'supplies', 'bay2', 'bay1', 'handoff'];
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
        if (game.inv.count(id) === 0 && game.stockOf(id) > 0) { game.pickItem(id); say(`pick ${id}`); }
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
    if (follow && game.mode === 'room' && game.y.k === 'idle' && game.queue.length === 0) {
      const sg = game.suggestNext();
      if (sg.page) { game.page(game.focusCase()); say('follow: page'); }
      else if (sg.station) { say(`follow → ${sg.station}: ${sg.text}`); game.tapStation(sg.station); }
      else for (const d of game.availableDelegations()) { game.delegate(d); say(`follow: delegate ${d.id}`); }
      await sleep(40);
      continue;
    }
    if (game.mode === 'room' && (game.y.k === 'idle') && game.queue.length === 0) {
      const fc = game.focusCase();
      if (!lazy && game.canPage(fc)) { game.page(fc); say('page proceduralist'); }
      if (!lazy) for (const d of game.availableDelegations()) { game.delegate(d); say(`delegate ${d.id}`); }
      let chosen = null;
      for (const id of pref) {
        if (!game.world.stations.has(id)) continue;
        const a = game.ts.resolveAt(id, game.inv);
        const sv = game.world.stations.get(id);
        if (game.ts.anyActive() && !game.inZone(sv.stand)) continue;
        if (a.type === 'do' || a.type === 'collect') { chosen = id; say(`→ ${id} (${a.type} ${a.task.def.id})`); break; }
      }
      // need supplies?
      if (!chosen && [...game.glowItems()].some((id) => game.stockOf(id) > 0) && game.inv.free > 0 && !game.ts.anyActive() && game.y.k === 'idle') { chosen = 'supplies'; say('→ supplies'); }
      if (chosen) game.tapStation(chosen);
    }
    await sleep(40);
  }
  return { log, mode: g().mode, result: g().result, metrics: g().metrics, time: g().ts.time };
}, [lazy, follow]);

// Snapshot each phase change (and a few moments inside it) while the bot plays.
if (shots) {
  let lastKey = '';
  let n = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    const st = await page.evaluate(() => { const g = window.__yolanda.game; const c = g.focusCase(); return { key: `${g.mode}-${c.id}-${c.phase}`, mode: g.mode, t: g.ts.time }; });
    if (st.key !== lastKey) {
      lastKey = st.key;
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${process.env.OUT ?? 'shots'}/pt-${levelId}-${String(n++).padStart(2, '0')}-${st.key}.png` });
    }
    if (st.mode === 'results') break;
    await page.waitForTimeout(300);
  }
}
const result = await botPromise;
if (shots) await page.screenshot({ path: `${process.env.OUT ?? 'shots'}/playtest-${levelId}-end.png` });
console.log(result.log.join('\n'));
console.log('\nMODE:', result.mode, ' sim time:', result.time.toFixed(1), 's');
console.log('METRICS:', JSON.stringify(result.metrics));
console.log('RESULT:', JSON.stringify(result.result, null, 1));
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(result.mode === 'results' && !errors.length ? 0 : 1);
