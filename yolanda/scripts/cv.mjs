import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 700, height: 500 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto('http://localhost:5173/dev/charview.html' + (process.argv[3] ?? ''));
await p.waitForTimeout(Number(process.env.WAIT ?? 2500));
await p.screenshot({ path: process.argv[2] });
console.log(errs.join('\n') || 'ok');
await b.close();
