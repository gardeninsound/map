/**
 * Puts exactly the processed art the scenes show into git — nothing more.
 *
 * public/art/ is gitignored (≈all of it is unused online). `neededArt()` works out the files
 * the deployed site actually requests, using the same code the app runs; this syncs git to it.
 * Missing ones are `git add -f`-ed; tracked art no longer needed is untracked (the files
 * stay on disk). Run after `npm run images` or after changing picks / maxPhotos.
 *
 * Usage: npm run art:publish [-- --dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { neededArt } from './neededArt.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry-run');
const need = neededArt();

const missing = [...need].filter((f) => !existsSync(ROOT + f));
if (missing.length) {
  console.error(`missing on disk (run npm run images first):\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const tracked = new Set(git('ls-files', 'public/art').split('\n').filter(Boolean));
const add = [...need].filter((f) => !tracked.has(f));
const drop = [...tracked].filter((f) => !need.has(f));
const mb = (fs) => (fs.reduce((n, f) => n + (existsSync(ROOT + f) ? statSync(ROOT + f).size : 0), 0) / 1e6).toFixed(1);

console.log(`${need.size} files needed (${mb([...need])} MB): +${add.length} to add, −${drop.length} to untrack`);
if (DRY) {
  add.forEach((f) => console.log(`  + ${f}`));
  drop.forEach((f) => console.log(`  − ${f}`));
  process.exit(0);
}
if (add.length) git('add', '-f', '--', ...add);
if (drop.length) git('rm', '-q', '--cached', '--', ...drop);
// Re-encoded files that stay published also need re-staging.
git('add', '-f', '--', ...need);
console.log('staged — review with git status, then commit');
