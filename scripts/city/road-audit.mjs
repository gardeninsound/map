/**
 * Road-drawing QA: renders every chunk (the app at ?audit) and counts glitches — slivers (tiny
 * non-road patches walled in by road) and fragments (tiny loose bits of road). Prints totals
 * and screenshots the biggest N to screenshots/audit/. Needs `npm run dev` running.
 *
 * Usage: npm run audit [-- N]
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const { chromium } = await import(`${homedir()}/code/games/arcade/node_modules/playwright-core/index.mjs`);
const BASE = process.env.MAP_URL ?? 'http://localhost:5173/';
const N = Number(process.argv[2] ?? 12);
const OUT = new URL('../../screenshots/audit/', import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
await page.goto(`${BASE}?audit`);
await page.waitForFunction(() => window.__audit, null, { timeout: 300000, polling: 1000 });
const found = await page.evaluate(() => window.__audit);
const tally = found.reduce((c, a) => ((c[a.kind] = (c[a.kind] ?? 0) + 1), c), {});
console.log(`road audit: ${found.length} glitches`, tally);
writeFileSync(`${OUT}audit.json`, JSON.stringify(found));
const pick = found.slice().sort((a, b) => b.area - a.area).slice(0, N);
for (const [i, a] of pick.entries()) {
  await page.goto(`${BASE}?atTile=${a.x},${a.y}`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}${String(i).padStart(2, '0')}-${a.kind}-${a.x}_${a.y}.png` });
}
console.log(`screenshots/audit/: ${pick.length} spots`);
await browser.close();
