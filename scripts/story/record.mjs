/**
 * The story log's recorder. Writes into a checkout of the `story` branch (`--out`), one folder
 * per change that reached main, one file per visitor's wish, and the chronicle on top.
 * Shapes and the why: scripts/story/README.md. The rules are pure, in lib.mjs.
 *
 *   node scripts/story/record.mjs --out .story --missing --limit 5   # catch up, oldest first
 *   node scripts/story/record.mjs --out .story --commit <sha> --redo # (re)record one change
 *   node scripts/story/record.mjs --out .story --pr 64 --redo        # the same, by PR number
 *   node scripts/story/record.mjs --out .story --wishes --chronicle  # just the wishes + README
 *   node scripts/story/record.mjs --out .story --portraits           # this week's photo of every spot
 *   add --no-shots to skip building and photographing (facts only, fast). A --redo keeps the
 *   earlier photos when the places are the same; --reshoot takes them again.
 *
 * Needs `gh` signed in (GH_TOKEN in Actions) and full git history (fetch-depth: 0).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  SCHEMA,
  areasOf,
  baseOf,
  changeDir,
  coordsFromPatches,
  ideaRefs,
  isRealWish,
  makers,
  parseStory,
  parseWhere,
  parseWish,
  previewUrl,
  prOfSubject,
  renderChronicle,
  renderIndex,
  summaryOf,
  updateWish,
} from './lib.mjs';

const { values: opt } = parseArgs({
  options: {
    out: { type: 'string', default: '.story' },
    missing: { type: 'boolean', default: false },
    commit: { type: 'string', multiple: true },
    pr: { type: 'string', multiple: true },
    limit: { type: 'string', default: '5' },
    redo: { type: 'boolean', default: false },
    reshoot: { type: 'boolean', default: false },
    shots: { type: 'boolean', default: true },
    'no-shots': { type: 'boolean', default: false },
    wishes: { type: 'boolean', default: false },
    chronicle: { type: 'boolean', default: false },
    portraits: { type: 'boolean', default: false },
    branch: { type: 'string', default: 'origin/main' },
  },
});
const OUT = resolve(opt.out);
const SHOTS = opt.shots && !opt['no-shots'];
const NOW = new Date().toISOString();
const RUN = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : 'local';

/** what a fresh shell would have: vite's preview server sets NODE_ENV=production in this process,
 *  and npm ci would then leave out the devDependencies (vite itself) */
const CLEAN_ENV = (() => {
  const { NODE_ENV, ...rest } = process.env;
  return rest;
})();
const sh = (cmd, args, o = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 << 20, ...o });
const git = (...args) => sh('git', args).trimEnd();
const tryGit = (...args) => {
  try {
    return sh('git', args, { stdio: 'pipe' }).trimEnd();
  } catch {
    return null;
  }
};
const gh = (path, paginate = false) => {
  const out = sh('gh', ['api', ...(paginate ? ['--paginate', '--slurp'] : []), path]);
  const data = JSON.parse(out);
  return paginate ? data.flat() : data;
};
const REPO = process.env.GITHUB_REPOSITORY || sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const log = (...a) => console.log('·', ...a);

mkdirSync(join(OUT, 'changes'), { recursive: true });
mkdirSync(join(OUT, 'wishes'), { recursive: true });

// ---------------------------------------------------------------------------------------------
// What's already recorded

function loadEntries() {
  return readdirSync(join(OUT, 'changes'))
    .filter((d) => existsSync(join(OUT, 'changes', d, 'entry.json')))
    .map((d) => ({ dir: `changes/${d}`, entry: readJson(join(OUT, 'changes', d, 'entry.json')) }));
}
function loadWishes() {
  return readdirSync(join(OUT, 'wishes'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(OUT, 'wishes', f)));
}

// ---------------------------------------------------------------------------------------------
// Building any commit, once

const BUILDS = join(tmpdir(), 'story-builds');
const built = new Map();
function buildAt(sha) {
  if (built.has(sha)) return built.get(sha);
  const dir = join(BUILDS, sha);
  let dist = null;
  try {
    if (!existsSync(join(dir, 'dist', 'index.html'))) {
      rmSync(dir, { recursive: true, force: true });
      tryGit('worktree', 'prune');
      git('worktree', 'add', '--detach', '--force', dir, sha);
      log(`build ${sha.slice(0, 7)}: npm ci`);
      sh('npm', ['ci', '--include=dev', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: dir, stdio: 'pipe', env: CLEAN_ENV });
      log(`build ${sha.slice(0, 7)}: vite build`);
      // no tsc: this commit already passed its checks; we only need the pictures
      sh('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: dir, stdio: 'pipe', env: CLEAN_ENV });
    }
    dist = join(dir, 'dist');
  } catch (e) {
    log(`build ${sha.slice(0, 7)} failed: ${e.message.split('\n')[0]}\n${String(e.stderr ?? '').slice(-1500)}`);
  }
  built.set(sha, dist);
  return dist;
}
/** removes every build but `keep` (a backfill would otherwise fill the runner's disk) */
function cleanBuilds(keep = null) {
  for (const sha of [...built.keys()]) {
    if (sha === keep) continue;
    tryGit('worktree', 'remove', '--force', join(BUILDS, sha));
    rmSync(join(BUILDS, sha), { recursive: true, force: true });
    built.delete(sha);
  }
  tryGit('worktree', 'prune');
}

let camera = null;
async function getCamera() {
  if (!camera) {
    const { launch, serve, shoot } = await import('./shoot.mjs');
    camera = { browser: await launch(), serve, shoot };
  }
  return camera;
}
async function photograph(sha, places, outDir, prefix, moving) {
  const dist = buildAt(sha);
  if (!dist) return places.map(() => ({ still: null, moving: null, problems: ['build failed'] }));
  const cam = await getCamera();
  const base = baseOf(tryGit('show', `${sha}:vite.config.ts`) ?? '');
  const server = await cam.serve(dist, base);
  try {
    return await cam.shoot(cam.browser, server.url, places, outDir, { prefix, moving });
  } finally {
    await server.close();
  }
}

// ---------------------------------------------------------------------------------------------
// One change

const START = (() => {
  const m = /export const START = \{ lat: ([\d.-]+), lon: ([\d.-]+) \}/.exec(readFileSync('src/content/locations.ts', 'utf8'));
  return m ? parseWhere(`${m[1]},${m[2]} — the Junction, where everyone starts`) : parseWhere('title');
})();
const VISIBLE = new Set(['city', 'map pipeline', 'characters & map life', 'scenes & games', 'ui', 'words & content', 'art & sound']);

/** Where to point the camera: what the PR said, else coordinates the diff adds, else the start. */
function placesFor(story, files, patch, areas) {
  if (!story.shots) return [];
  if (story.where.length) return story.where;
  if (!areas.some((a) => VISIBLE.has(a))) return [];
  const found = coordsFromPatches([patch]);
  if (files.some((f) => /arcade/i.test(f.path))) found.unshift(parseWhere('arcade'));
  return (found.length ? found : [START]).slice(0, 3);
}

function census(sha) {
  const c = {};
  const count = (dir, re, deep = false) =>
    (tryGit('ls-tree', ...(deep ? ['-r'] : []), '--name-only', `${sha}:${dir}`) ?? '').split('\n').filter((f) => re.test(f)).length;
  try {
    c.spots = JSON.parse(git('show', `${sha}:src/content/placesData.json`)).length;
  } catch {}
  c.plugins = count('src/game/plugins', /^(?!.*\.test\.).*\.tsx?$/);
  c.scenes = count('src/experiences', /^(?!.*\.test\.).*\.tsx$/, true); // scene + game components, in their folders
  c.content_files = count('src/content', /^(?!.*\.test\.).*\.(ts|json)$/);
  const arcade = tryGit('show', `${sha}:src/content/duckArcade.ts`);
  if (arcade) c.arcade_cabinets_ready = (arcade.match(/ready:\s*true/g) ?? []).length;
  const lines = tryGit('grep', '-c', '', sha, '--', 'src/*.ts', 'src/*.tsx');
  if (lines) c.source_lines = lines.split('\n').reduce((n, l) => n + Number(l.split(':').at(-1) || 0), 0);
  c.commits = Number(git('rev-list', '--count', sha));
  return c;
}

async function recordChange(sha, recorded) {
  const subject = git('log', '-1', '--format=%s', sha);
  const prNum = prOfSubject(subject);
  const committedAt = git('log', '-1', '--format=%cI', sha);
  const parent = tryGit('rev-parse', `${sha}^1`);

  // the diff, from git (the same for a squash merge as the PR's)
  const numstat = git('show', '--format=', '--numstat', '-M', sha).split('\n').filter(Boolean);
  const status = Object.fromEntries(
    git('show', '--format=', '--name-status', '-M', sha)
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t'))
      .map((p) => [p.at(-1), p[0][0]]),
  );
  const files = numstat.map((l) => {
    const [a, d, ...rest] = l.split('\t');
    const path = rest.at(-1).replace(/^.*\{(.*) => (.*)\}(.*)$/, (_, __, to, tail) => to + tail).replace(/^.* => /, '');
    return { path, status: status[path] ?? 'M', additions: a === '-' ? null : Number(a), deletions: d === '-' ? null : Number(d) };
  });
  const patch = git('show', '--format=', '-U0', '--no-color', sha, '--', '*.ts', '*.tsx', '*.csv', '*.json', ':!*.lock', ':!package-lock.json');
  const areas = areasOf(files.map((f) => f.path));

  let e = {
    schema: SCHEMA,
    kind: 'change',
    sha,
    parent,
    pr: prNum,
    title: subject.replace(/\s*\(#\d+\)\s*$/, ''),
    url: `https://github.com/${REPO}/commit/${sha}`,
    merged_at: committedAt,
    body: git('log', '-1', '--format=%b', sha).trim(),
    authors: [{ login: null, name: git('log', '-1', '--format=%an', sha) }],
    commits: [{ sha, message: git('log', '-1', '--format=%B', sha).trim(), author: git('log', '-1', '--format=%an', sha), at: git('log', '-1', '--format=%aI', sha) }],
    files,
    additions: files.reduce((n, f) => n + (f.additions ?? 0), 0),
    deletions: files.reduce((n, f) => n + (f.deletions ?? 0), 0),
    areas,
  };

  if (prNum) {
    const pr = gh(`repos/${REPO}/pulls/${prNum}`);
    const commits = gh(`repos/${REPO}/pulls/${prNum}/commits?per_page=100`, true);
    const reviews = gh(`repos/${REPO}/pulls/${prNum}/reviews?per_page=100`, true);
    const comments = gh(`repos/${REPO}/issues/${prNum}/comments?per_page=100`, true);
    const reviewComments = gh(`repos/${REPO}/pulls/${prNum}/comments?per_page=100`, true);
    const story = parseStory(pr.body);
    const ideas = [];
    for (const n of ideaRefs(pr.title, pr.body, story)) {
      try {
        const is = gh(`repos/${REPO}/issues/${n}`);
        if (is.pull_request) continue;
        const w = parseWish(is.body ?? '');
        ideas.push({ issue: n, url: is.html_url, title: is.title, text: w.text, name: w.name, street: w.street, asked_at: is.created_at, from_idea_box: w.fromIdeaBox });
      } catch {}
    }
    e = {
      ...e,
      title: pr.title,
      url: pr.html_url,
      branch: pr.head.ref,
      opened_at: pr.created_at,
      merged_at: pr.merged_at,
      merged_by: pr.merged_by?.login ?? null,
      body: pr.body ?? '',
      summary: summaryOf(pr.body),
      story,
      ideas,
      authors: [...new Map([pr.user, ...commits.map((c) => c.author)].filter(Boolean).map((u) => [u.login, { login: u.login }])).values()],
      requested_reviewers: (pr.requested_reviewers ?? []).map((u) => u.login),
      reviews: reviews.map((r) => ({ by: r.user?.login, state: r.state, at: r.submitted_at, body: r.body })),
      labels: pr.labels.map((l) => l.name),
      // the PR's own commits, before the squash: how it got there
      commits: commits.map((c) => ({ sha: c.sha, message: c.commit.message, author: c.commit.author?.name, login: c.author?.login ?? null, at: c.commit.author?.date })),
      discussion: [
        ...comments.map((c) => ({ at: c.created_at, by: c.user?.login, body: c.body, bot: c.user?.type === 'Bot' })),
        ...reviewComments.map((c) => ({ at: c.created_at, by: c.user?.login, body: c.body, path: c.path, bot: c.user?.type === 'Bot' })),
      ].sort((a, b) => a.at.localeCompare(b.at)),
      preview_url: previewUrl(comments),
      days_open: Math.round(((Date.parse(pr.merged_at) - Date.parse(pr.created_at)) / 86_400_000) * 10) / 10,
    };
    e.made_with = makers(pr.body ?? '', e.commits);
  } else {
    e.summary = e.body || null;
    e.story = parseStory('');
    e.ideas = [];
    e.made_with = makers('', e.commits);
  }
  e.census = census(sha);

  const dir = changeDir({ pr: prNum, sha, at: e.merged_at, title: e.title });
  const old = recorded.get(sha);
  const prev = old ? readJson(join(OUT, old, 'entry.json')) : null;
  const abs = join(OUT, dir);
  if (old && old !== dir) renameSync(join(OUT, old), abs);
  mkdirSync(abs, { recursive: true });

  const places = placesFor(e.story, files, patch, areas);
  e.shots = places.map((p) => ({ query: p.query, lat: p.lat ?? null, lon: p.lon ?? null, label: p.label ?? null, guessed: !e.story.where.length }));
  const samePlaces =
    prev?.shots?.length === places.length && prev.shots.every((s, i) => s.query === places[i].query && (s.after || !SHOTS));
  if (samePlaces && !opt.reshoot) {
    // a re-record (the description was edited): the photos still show the same places
    e.shots = prev.shots.map((s, i) => ({ ...s, label: e.shots[i].label, guessed: e.shots[i].guessed }));
    if (prev.camera) e.camera = prev.camera;
  } else if (SHOTS && places.length) {
    for (const f of readdirSync(abs)) if (/^(before|after|moving)-\d+\.webp$/.test(f)) rmSync(join(abs, f));
    const before = parent ? await photograph(parent, places, abs, 'before', false) : [];
    const after = await photograph(sha, places, abs, 'after', true);
    e.shots.forEach((s, i) => {
      s.before = before[i]?.still ?? null;
      s.after = after[i]?.still ?? null;
      s.moving = after[i]?.moving ?? null;
      s.problems = { before: before[i]?.problems ?? [], after: after[i]?.problems ?? [] };
    });
    e.camera = { viewport: (await import('./shoot.mjs')).VIEWPORT, zoom: 3, note: 'stills lossless; moving loop half size' };
  }
  // a re-record never loses what was there: earlier descriptions are kept, oldest first
  e.first_recorded_at = prev?.first_recorded_at ?? prev?.recorded_at ?? NOW;
  e.earlier = prev?.earlier ?? [];
  if (prev && (prev.body !== e.body || prev.title !== e.title))
    e.earlier.push({ recorded_at: prev.recorded_at, title: prev.title, body: prev.body, story: prev.story });
  e.recorded_at = NOW;
  e.recorded_by = RUN;
  writeJson(join(abs, 'entry.json'), e);
  log(`recorded ${dir}${e.shots.length ? ` (${e.shots.length} place${e.shots.length > 1 ? 's' : ''})` : ''}`);
}

// ---------------------------------------------------------------------------------------------
// Wishes: every idea-box issue, kept as it first arrived

function syncWishes(entries) {
  const issues = gh(`repos/${REPO}/issues?labels=suggestion&state=all&per_page=100`, true).filter(isRealWish);
  const answered = new Map();
  for (const { entry: e } of entries)
    for (const w of e.ideas ?? []) answered.set(w.issue, [...(answered.get(w.issue) ?? []), { pr: e.pr, sha: e.sha, title: e.title, merged_at: e.merged_at }]);
  let n = 0;
  for (const is of issues) {
    const file = join(OUT, 'wishes', `${String(is.number).padStart(4, '0')}.json`);
    const prev = existsSync(file) ? readJson(file) : null;
    const comments = is.comments ? gh(`repos/${REPO}/issues/${is.number}/comments?per_page=100`, true) : [];
    const rec = updateWish(prev, is, comments, NOW);
    rec.answered_by = (answered.get(is.number) ?? []).sort((a, b) => a.merged_at.localeCompare(b.merged_at));
    const same = prev && JSON.stringify({ ...prev, last_recorded_at: 0 }) === JSON.stringify({ ...rec, last_recorded_at: 0 });
    if (!same) {
      writeJson(file, rec);
      n++;
    }
  }
  log(`wishes: ${issues.length} real, ${n} new or changed`);
}

// ---------------------------------------------------------------------------------------------
// Portraits: every spot, photographed as it is today (a weekly time-lapse, change or no change)

async function portraits() {
  const head = git('rev-parse', opt.branch);
  const places = [
    START,
    parseWhere('arcade'),
    ...readJson('src/content/placesData.json').map((p) => ({ ...parseWhere(`${p.lat},${p.lon}`), label: p.name, id: p.id })),
  ];
  const day = NOW.slice(0, 10);
  const dir = join(OUT, 'portraits', day);
  const shots = await photograph(head, places, dir, 'spot', false);
  writeJson(join(dir, 'index.json'), {
    schema: SCHEMA,
    kind: 'portraits',
    at: NOW,
    sha: head,
    census: census(head),
    places: places.map((p, i) => ({ id: p.id ?? (i === 0 ? 'start' : 'arcade'), label: p.label, query: p.query, file: shots[i].still, problems: shots[i].problems })),
  });
  log(`portraits: ${places.length} places → portraits/${day}`);
}

// ---------------------------------------------------------------------------------------------

try {
  let entries = loadEntries();
  const recorded = new Map(entries.map(({ dir, entry }) => [entry.sha, dir]));
  const todo = [];
  for (const c of opt.commit ?? []) todo.push(git('rev-parse', c));
  for (const p of opt.pr ?? []) todo.push(gh(`repos/${REPO}/pulls/${p}`).merge_commit_sha);
  if (opt.missing) {
    const all = git('rev-list', '--first-parent', '--reverse', opt.branch).split('\n').filter(Boolean);
    todo.push(...all.filter((s) => !recorded.has(s)).slice(0, Number(opt.limit)));
  }
  for (const sha of [...new Set(todo)]) {
    if (recorded.has(sha) && !opt.redo) {
      log(`already recorded ${sha.slice(0, 7)} (--redo to redo)`);
      continue;
    }
    try {
      await recordChange(sha, recorded);
      cleanBuilds(sha); // the next change's "before" is this one's "after"
    } catch (e) {
      // facts we couldn't fetch: leave it unrecorded, the next run tries again
      console.error(`could not record ${sha.slice(0, 7)}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  if (opt.portraits) await portraits();
  entries = loadEntries();
  if (opt.wishes) syncWishes(entries);
  if (opt.chronicle) {
    const wishes = loadWishes();
    writeFileSync(join(OUT, 'README.md'), renderChronicle(entries, wishes, REPO));
    writeJson(join(OUT, 'story.json'), renderIndex(entries, wishes));
    log(`chronicle: ${entries.length} changes, ${wishes.length} wishes`);
  }
} finally {
  if (camera) await camera.browser.close();
  cleanBuilds();
}
