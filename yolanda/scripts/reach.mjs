// Checks that every station stand point can be reached from every other (per level).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(process.env.URL ?? 'http://localhost:5173/');
await p.waitForFunction(() => window.__yolanda && document.querySelector('.lvl'), null, { timeout: 90000 });
for (const id of ['L1', 'L2', 'L3', 'L4']) {
  const bad = await p.evaluate((id) => {
    const app = window.__yolanda;
    app.start(app.debug['api'].levels.find((l) => l.id === id), true);
    const w = app.game.world;
    const out = [];
    const sts = [...w.stations.values()];
    for (const a of sts) for (const c of sts) {
      if (a === c) continue;
      const path = w.nav.findPath(a.stand, c.stand);
      if (!path) out.push(`${a.place.id}->${c.place.id}`);
    }
    const s = app.game.world.env.start;
    for (const c of sts) if (!w.nav.findPath(s, c.stand)) out.push(`start->${c.place.id}`);
    return out;
  }, id);
  console.log(id, bad.length ? 'UNREACHABLE: ' + bad.join(', ') : 'all reachable');
}
await b.close();
