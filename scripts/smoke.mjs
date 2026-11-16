/**
 * Smoke test of the built site in a real browser: does it boot, can you walk into the Duck
 * Arcade, does every playable cabinet open and close, does the bear hand you a licorice? Fails on any page error, console error
 * or failed request (a missing file is a 404). Also tries the ?open= links and opens /story/ on a made-up log. Runs in CI on every PR after `npm run build`.
 *
 * Usage: npm run build && npm run smoke   (locally uses your installed Chrome; CI uses
 * Playwright's Chromium). Shots of a failure land in screenshots/smoke/.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

// appType 'mpa': a missing file is a real 404, as on GitHub Pages (not index.html with a 200)
const server = await preview({ appType: 'mpa', preview: { port: 4173, strictPort: false }, logLevel: 'warn' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  ...(process.env.CI ? {} : { channel: 'chrome' }),
  args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()}: ${r.url()}`));

let step = '';
const check = (what) => {
  step = what;
  console.log(`· ${what}`);
};
const settle = (ms = 1500) => page.waitForTimeout(ms);
/** Space through a dialog box until it's gone (Space finishes a line, then moves on) */
const dismiss = async (sel) => {
  for (let i = 0; i < 16 && (await page.locator(sel).count()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
  }
};
const assertClean = () => {
  if (problems.length) throw new Error(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
};

/** after the first game the bear is right beside you, holding out its licorice: take one */
const meetTheBear = async () => {
  check('the bear and its licorice');
  // the bear's lines follow each other in the same box: Space only until this one is gone
  const says = async (text) => {
    const box = page.locator('.scene-dialog', { hasText: text });
    await box.waitFor({ timeout: 20_000 });
    for (let i = 0; i < 16 && (await box.count()); i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(250);
    }
  };
  await says(/licorice/i);
  await page.locator('.arcade-take').waitFor();
  const bag = await page.evaluate(() => window.__arcade?.bagOnScreen());
  if (!bag) throw new Error('the bear is not holding out its licorice');
  await page.mouse.click(bag.x, bag.y);
  await says(/Thanks!/);
  await says(/Avocado Drop/);
};

try {
  check('title screen');
  // ?solo: walk alone, never join the live island from a test
  await page.goto(`${base}?solo`);
  await page.locator('.title-start').click();
  await page.locator('.hud-spots').waitFor();
  await settle();
  await dismiss('.dialog'); // Mike's welcome
  assertClean();

  check('?at=arcade → the Duck Arcade door');
  await page.goto(`${base}?solo&at=arcade`);
  await page.locator('.hud-spots').waitFor();
  await settle();
  assertClean();

  check('walk in');
  // Space on a focused button would just press it again
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.locator('.arcade-scene').waitFor({ timeout: 10_000 });
  await dismiss('.scene-dialog'); // Mike's arcade intro
  await settle();
  assertClean();

  const titles = await page.evaluate(async () => {
    const open = () => [...document.querySelectorAll('.arcade-buttons button')].find((b) => b.textContent?.startsWith('GAMES'));
    open()?.click();
    await new Promise((r) => setTimeout(r, 200));
    return [...document.querySelectorAll('.arcade-menu li button')]
      .filter((b) => b.querySelector('.arcade-menu-tag')?.textContent === 'PLAY')
      .map((b) => b.querySelector('.arcade-menu-title')?.textContent ?? '');
  });
  if (!titles.length) throw new Error('no playable cabinets in the GAMES list');

  for (const title of titles) {
    check(`cabinet: ${title}`);
    if (!(await page.locator('.arcade-menu').count())) await page.getByRole('button', { name: /^GAMES/ }).click();
    await page.locator('.arcade-menu li button', { hasText: title }).click();
    await page.locator('.arcade-game').waitFor();
    await settle(2500);
    // SceneBoundary drops a crashed game back to the floor
    if (!(await page.locator('.arcade-game').count())) throw new Error(`${title} crashed on open`);
    assertClean();
    await page.keyboard.press('Escape');
    await page.locator('.arcade-game').waitFor({ state: 'detached', timeout: 5000 }).catch(async () => {
      await page.locator('.minigame-back').first().click();
      await page.locator('.arcade-game').waitFor({ state: 'detached', timeout: 5000 });
    });
    assertClean();
    if (title === titles[0]) {
      await meetTheBear();
      assertClean();
    } else {
      // only once a visit: after that it's busy with Avocado Drop
      await settle(500);
      if (await page.locator('.scene-dialog').count()) throw new Error('the bear came over again');
    }
  }

  // ?open= links (src/ui/openLink.ts): each kind opens what it should, with no errors
  for (const [link, sel] of [
    ['open=garden&time=2026-04-15', '.dialog'],
    ['open=sundrop', '.dialog'],
    ['open=scene:gas-station-wall', '.scene'],
    ['open=arcade:duck-on-the-moon', '.arcade-game'],
    ['open=minigame:cone-catch&seed=3', '.minigame-canvas'],
    ['open=ride:whirl', '.scene'],
  ]) {
    check(`?${link}`);
    await page.goto(`${base}?solo&${link}`);
    await page.locator(sel).first().waitFor({ timeout: 15_000 });
    await settle(1000);
    assertClean();
  }

  // a plugin's {A} as data (src/game/actions.ts): the Figure Eight's sign → "Ride it" → the ride
  check('Luna Park sign → ride');
  await page.goto(`${base}?solo&open=luna:figure8`);
  await page.locator('.dialog').waitFor({ timeout: 15_000 });
  for (let i = 0; i < 10 && !(await page.locator('.dialog button').count()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
  }
  await page.locator('.dialog button').first().click();
  await page.locator('.luna-ride').waitFor({ timeout: 15_000 });
  await settle(1000);
  assertClean();

  // a plugin's id (src/game/plugins/index.ts): ?open=crow is the snack crow (it offers a carrot), not a street crow
  check('?open=crow → the snack crow');
  await page.goto(`${base}?solo&open=crow`);
  await page.locator('.dialog').waitFor({ timeout: 15_000 });
  for (let i = 0; i < 10 && !(await page.locator('.dialog button', { hasText: 'Share a carrot' }).count()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
  }
  await page.locator('.dialog button', { hasText: 'Share a carrot' }).waitFor({ timeout: 5_000 });
  assertClean();

  // /story/ (the story log page): fed a one-change log, so it doesn't depend on the story branch
  check('/story/ page');
  await page.route((u) => u.pathname.startsWith('/__story/'), (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schema: 1,
        changes: [
          {
            pr: 64, sha: 'abc1234', title: 'Pastel ponies', url: 'https://github.com/gardeninsound/map/pull/64',
            merged_at: '2026-11-15T00:24:24Z', dir: 'changes/x',
            ideas: [{ issue: 36, url: 'u', text: 'add my little ponys', name: null, street: '47th Ave SW', asked_at: '2026-11-05T04:44:46Z' }],
            summary: 'Five pastel ponies.', story: { askedVsMade: null, mike: null, note: null },
            authors: ['exit320-stack'], tools: [], files: 7, additions: 274, deletions: 2, areas: [], tags: ['wish', 'character'], shots: [],
            census: { spots: 15, plugins: 20, scenes: 11 },
          },
          {
            pr: 65, sha: 'def5678', title: 'A new road', url: 'https://github.com/gardeninsound/map/pull/65',
            merged_at: '2026-11-16T00:24:24Z', dir: 'changes/y', ideas: [], summary: 'A road.', story: { askedVsMade: null, mike: null, note: null },
            authors: ['vlandham'], tools: [], files: 2, additions: 20, deletions: 2, areas: [], tags: ['map'], shots: [], census: null,
          },
        ],
        wishes: [{ issue: 36, url: 'u', asked_at: '2026-11-05T04:44:46Z', text: 'add my little ponys', name: null, street: null, state: 'closed', answered_by: [{ pr: 64, sha: 'abc1234', merged_at: '2026-11-15T00:24:24Z' }] }],
      }),
    }),
  );
  await page.goto(`${base}story/?src=/__story/`);
  await page.locator('#pr-64 .story-wish', { hasText: 'add my little ponys' }).waitFor({ timeout: 10_000 });
  // a tag shows only its changes; again shows everything
  await page.locator('.story-tags button', { hasText: 'map' }).click();
  await page.locator('#pr-64').waitFor({ state: 'detached', timeout: 5_000 });
  await page.locator('#pr-65').waitFor({ timeout: 5_000 });
  await page.locator('#pr-65 .story-change-tags button', { hasText: 'map' }).click();
  await page.locator('#pr-64').waitFor({ timeout: 5_000 });
  assertClean();

  console.log(`smoke ok: boots, arcade, ${titles.length} cabinets, the bear, ?open= links, a sign's ride, the snack crow, /story/`);
} catch (e) {
  mkdirSync('screenshots/smoke', { recursive: true });
  await page.screenshot({ path: 'screenshots/smoke/failure.png' }).catch(() => {});
  console.error(`\nsmoke FAILED at "${step}": ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
