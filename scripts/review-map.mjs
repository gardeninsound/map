/**
 * Screenshots the same map spots every time, so map tweaks can be compared before/after.
 * Needs the dev server running (npm run dev) and Chrome installed.
 *
 *   node scripts/review-map.mjs [label]   → screenshots/review/<label>/<spot>.png
 *
 * Uses playwright-core from the sibling arcade repo (no browser download here).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const { chromium } = await import(`${homedir()}/code/games/arcade/node_modules/playwright-core/index.mjs`);
const URL_BASE = process.env.MAP_URL ?? 'http://localhost:5173/bearisland-map/';
const label = process.argv[2] ?? 'latest';
const OUT = new URL(`../screenshots/review/${label}/`, import.meta.url).pathname;

export const SPOTS = {
  'junction': [47.5612, -122.3868], // California & Alaska
  'california-north': [47.5700, -122.3868],
  'fauntleroy-diagonal': [47.5560, -122.3790],
  'residential': [47.5705, -122.3925],
  'admiral-way-bridge': [47.5773, -122.4033],
  'alki': [47.5790, -122.4100],
};

// …plus every hand-drawn landmark, wherever the sheet puts it.
const landmarks = JSON.parse(readFileSync(new URL('../src/content/landmarksData.json', import.meta.url)));
for (const lm of landmarks) SPOTS[lm.id] = [lm.lat, lm.lon];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (const [name, [lat, lon]] of Object.entries(SPOTS)) {
  await page.goto(`${URL_BASE}?at=${lat},${lon}`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(`${label}/${name}.png`);
}
await browser.close();
