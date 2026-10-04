// Quick visual check: boots the game in a portrait phone viewport and screenshots key states.
import { chromium } from 'playwright-core';
const url = process.env.URL ?? 'http://localhost:5173/';
const out = process.env.OUT ?? 'shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/01-title.png` });
const steps = (process.argv[2] ?? '').split(process.argv[2]?.includes(' | ') ? ' | ' : ',').filter(Boolean);
let n = 2;
for (const s of steps) {
  if (s.startsWith('sleep')) { await page.waitForTimeout(Number(s.slice(5))); continue; }
  if (s.startsWith('wait')) await page.waitForTimeout(Number(s.slice(4)));
  if (s.startsWith('eval:')) { await page.evaluate(s.slice(5)); await page.waitForTimeout(600); }
  else if (s.startsWith('click:')) { await page.click(s.slice(6)); await page.waitForTimeout(900); }
  await page.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${s.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.png` });
}
console.log(errors.join('\n') || 'no console errors');
await browser.close();
