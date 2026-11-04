/**
 * Smoke test of the built site in a real browser: does it boot, can you walk into the Duck
 * Arcade, does every playable cabinet open and close? Fails on any page error, console error
 * or failed request (a missing file is a 404). Runs in CI on every PR after `npm run build`.
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

try {
  check('title screen');
  // ?solo: walk alone, never join the live island from a test
  await page.goto(`${base}?solo`);
  await page.locator('.title-start').click();
  await page.locator('.hud-recent').waitFor();
  await settle();
  await dismiss('.dialog'); // Mike's welcome
  assertClean();

  check('RECENT → the Duck Arcade door');
  let atArcade = false;
  for (let i = 0; i < 40 && !atArcade; i++) {
    await page.locator('.hud-recent').click();
    await page.waitForTimeout(150);
    atArcade = /· Duck Arcade/.test((await page.locator('.recent-note').textContent().catch(() => '')) ?? '');
  }
  if (!atArcade) throw new Error('no RECENT entry lands at the Duck Arcade');

  check('walk in');
  // Space on a focused RECENT button would just press it again
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
  }
  console.log(`smoke ok: boots, arcade, ${titles.length} cabinets`);
} catch (e) {
  mkdirSync('screenshots/smoke', { recursive: true });
  await page.screenshot({ path: 'screenshots/smoke/failure.png' }).catch(() => {});
  console.error(`\nsmoke FAILED at "${step}": ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
