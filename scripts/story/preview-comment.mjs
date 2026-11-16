/**
 * The preview comment's facts, from GitHub, → the comment's Markdown on stdout
 * (.github/workflows/preview-comment.yml; the words are renderPreviewComment in lib.mjs).
 *
 *   node scripts/story/preview-comment.mjs --pr 81 [--url https://pr-81-garden-preview.gardeninsound.workers.dev]
 *
 * Needs `gh` signed in (GH_TOKEN in Actions). No npm install: plain Node.
 */
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ideaRefs, parseWish, renderPreviewComment } from './lib.mjs';

const { values: opt } = parseArgs({ options: { pr: { type: 'string' }, url: { type: 'string' }, repo: { type: 'string' } } });
const gh = (path) => JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', path], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const one = (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8' }));
const repo = opt.repo || process.env.GITHUB_REPOSITORY || execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim();

const pr = one(`repos/${repo}/pulls/${opt.pr}`);
const files = gh(`repos/${repo}/pulls/${opt.pr}/files?per_page=100`)
  .flat()
  .map((f) => ({ path: f.filename, additions: f.additions, deletions: f.deletions }));
const wishes = [];
for (const n of ideaRefs(pr.title, pr.body ?? '')) {
  try {
    const is = one(`repos/${repo}/issues/${n}`);
    if (is.pull_request) continue;
    const w = parseWish(is.body ?? '');
    wishes.push({ issue: n, url: is.html_url, title: is.title, text: w.text, name: w.name, street: w.street, asked_at: is.created_at });
  } catch {
    // not an issue we can read: leave it out
  }
}
process.stdout.write(
  renderPreviewComment({
    url: opt.url ?? `https://pr-${opt.pr}-garden-preview.gardeninsound.workers.dev`,
    pr: Number(opt.pr),
    sha: pr.head.sha,
    author: pr.user?.login,
    title: pr.title,
    body: pr.body ?? '',
    files,
    wishes,
  }) + '\n',
);
