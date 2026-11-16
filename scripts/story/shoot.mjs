/**
 * The story log's camera: serves a built site (any commit's `dist/`) and photographs places on
 * it, using the site's own review hooks (`?solo&at=lat,lon`, `?at=arcade`, `?atTile=x,y`).
 * Each place gets a still (lossless WebP, so the pixels stay exact) and, if asked, a short
 * animated WebP loop: the map is alive (ponies trot, crows hop) and a still misses that.
 *
 * Used by record.mjs; on its own:
 *   npm run build && node scripts/story/shoot.mjs --dist dist --at "47.531,-122.396" --out screenshots/story
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ARCADE_DOOR, parseWhere, squeeze } from './lib.mjs';

/** zoomFor(1280, 768) is 3: every native pixel is a 3×3 block */
export const VIEWPORT = { width: 1280, height: 768 };
const FRAMES = 16;
const FRAME_MS = 150;

/**
 * Starts a static server for `dist` (as GitHub Pages serves it: a missing file is a 404), at the
 * `base` that build was made for (early commits were built for a sub-path).
 */
export async function serve(dist, base = '/') {
  const { preview } = await import('vite');
  const root = resolve(dist, '..');
  const server = await preview({
    root,
    configFile: false,
    base,
    appType: 'mpa',
    build: { outDir: resolve(dist) },
    preview: { port: 4190, strictPort: false },
    logLevel: 'warn',
  });
  return { url: server.resolvedUrls.local[0], close: () => new Promise((r) => server.httpServer.close(r)) };
}

export async function launch() {
  const { chromium } = await import('playwright');
  return chromium.launch({
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
}

/** runs in the page before its own scripts: Math.random from a seed (mulberry32), for builds with no ?seed= */
function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Photographs each place on the site at `url`. Returns one result per place:
 * `{ still, moving, problems, via }` (file names inside `outDir`, page errors seen while there, and
 * `via: 'way'` when it walked in by hand).
 *
 * `features` says what this build understands (record.mjs reads it from the commit): without
 * ?open= links (`open: false`) a place with a `way` stands there and presses {A} until its `goal`
 * is on screen; without the game clock (`clock: false`) a place's `time=` is faked in the browser;
 * without `?at=arcade` (`arcadeAt: false`) the camera stands at the arcade door's coordinates instead.
 * Walking in gets four tries, each with its own seed on a build without one (a neighbor may be in the way).
 */
export async function shoot(browser, url, places, outDir, { prefix, moving = false, settleMs = 3500, time = null, features = { open: true, clock: true } } = {}) {
  const sharp = (await import('sharp')).default;
  mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const [i, place] of places.entries()) {
    const opens = /(^|&)open=/.test(place.query);
    const byHand = opens && !features.open;
    let query = byHand && place.way ? place.way : place.query;
    if (features.arcadeAt === false) query = query.replace(/(^|&)at=arcade(?=&|$)/, `$1${ARCADE_DOOR}`);
    // a build from before the clock: its Date says the time the place asks for, and its chance is
    // seeded here (it had no ?seed=), a different seed each try in case a neighbor stood in the way
    const asked = /(?:^|&)time=([^&]+)/.exec(query)?.[1];
    // seed=1 and the moment of the change (src/city/clock.ts): the same chance every time, and the
    // garden in the month it was; builds from before the clock simply ignore them
    const pin = `&seed=1${time && !/(^|&)time=/.test(query) ? `&time=${encodeURIComponent(time)}` : ''}`;
    const tries = byHand && place.way && place.goal ? 4 : 1;

    let page = null;
    let problems = [];
    const res = { still: null, moving: null, problems };
    try {
      for (let attempt = 1; attempt <= tries; attempt++) {
        if (page) await page.close();
        page = await browser.newPage({ viewport: VIEWPORT });
        const seen = (problems = []);
        page.on('pageerror', (e) => seen.push(`page error: ${e.message}`));
        page.on('console', (m) => m.type() === 'error' && seen.push(`console: ${m.text()}`));
        if (byHand && !place.way) problems.push('this build has no ?open= links and the place gives no way in (`@ lat, lon`)');
        if (byHand && place.way) res.via = 'way';
        if (!features.clock) await page.addInitScript(seedRandom, attempt);
        if (asked && !features.clock) await page.clock.setFixedTime(new Date(decodeURIComponent(asked)));
        await page.goto(`${url}?solo${pin}${query === 'title' ? '' : `&${query}`}`, { waitUntil: 'load' });
        await page.locator('canvas').first().waitFor({ timeout: 15_000 });
        await page.waitForTimeout(settleMs);
        if (!place.goal || !opens) break;
        const goal = page.locator(place.goal).first();
        // walking in: {A} (Space) through the greeting and the first choice ("Let's see it", "Ride it", "Yes!")
        for (let k = 0; byHand && place.way && k < 14 && !(await goal.isVisible()); k++) {
          await page.keyboard.press('Space');
          await page.waitForTimeout(700);
        }
        if (await goal.waitFor({ timeout: 6000 }).then(() => true, () => false)) {
          if (attempt > 1) problems.push(`got in on try ${attempt}`);
          await page.waitForTimeout(1500);
          break;
        }
        if (attempt === tries)
          problems.push(`nothing opened: no ${place.goal} on screen${tries > 1 ? ` in ${tries} tries` : ''} (on a "before" photo, usually because it wasn't there yet)`);
      }
      if (place.query !== 'title' && (await page.locator('.title-start').count()))
        problems.push('this build has no ?at= hook: the shot is its title screen');
      await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
      const still = `${prefix}-${i + 1}.webp`;
      await sharp(await page.screenshot()).webp({ lossless: true, effort: 6 }).toFile(join(outDir, still));
      res.still = still;
      if (moving) {
        const frames = [];
        for (let f = 0; f < FRAMES; f++) {
          frames.push(await page.screenshot());
          await page.waitForTimeout(FRAME_MS);
        }
        // half size (each native pixel 1.5 → still readable), lossy: a loop to watch, not to measure
        const small = await Promise.all(
          frames.map((b) => sharp(b).resize(VIEWPORT.width / 2, VIEWPORT.height / 2, { kernel: 'nearest' }).png().toBuffer()),
        );
        const name = `moving-${i + 1}.webp`;
        await sharp(small, { join: { animated: true } })
          .webp({ quality: 80, effort: 5, loop: 0, delay: Array(FRAMES).fill(FRAME_MS) })
          .toFile(join(outDir, name));
        res.moving = name;
      }
    } catch (e) {
      problems.push(`shot failed: ${e.message.split('\n')[0]}`);
    } finally {
      await page?.close();
    }
    res.problems = squeeze(problems);
    results.push(res);
  }
  return results;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: { old: { type: 'boolean', default: false }, dist: { type: 'string', default: 'dist' }, at: { type: 'string', multiple: true }, out: { type: 'string', default: 'screenshots/story' }, moving: { type: 'boolean', default: true } },
  });
  const places = (values.at ?? ['title']).map(parseWhere).filter(Boolean);
  const server = await serve(values.dist);
  const browser = await launch();
  try {
    const r = await shoot(browser, server.url, places, values.out, { prefix: 'shot', moving: values.moving, features: values.old ? { open: false, clock: false } : undefined });
    writeFileSync(join(values.out, 'shots.json'), JSON.stringify(r, null, 2));
    console.log(JSON.stringify(r, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
}
