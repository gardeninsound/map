/**
 * The story log's rules: pure, so they're unit-tested (lib.test.mjs, run by `npm test`).
 * record.mjs does the fetching, building and shooting; everything that decides *what* gets
 * written lives here.
 *
 * Shapes (schema 1) are documented in scripts/story/README.md.
 */

export const SCHEMA = 1;

// ---------------------------------------------------------------------------------------------
// The "## Story" section of a PR description (see .github/pull_request_template.md)

const FIELDS = {
  idea: 'ideas',
  ideas: 'ideas',
  where: 'where',
  'asked vs made': 'askedVsMade',
  'asked vs. made': 'askedVsMade',
  mike: 'mike',
  'mike says': 'mike',
  note: 'note',
  notes: 'note',
  shots: 'shots',
  tags: 'tags',
  tag: 'tags',
};

/**
 * Reads the `## Story` section: `Key: value` lines (a value may run on over following lines
 * until the next key). HTML comments (the template's hints) are dropped.
 */
export function parseStory(body) {
  const out = { ideas: [], where: [], askedVsMade: null, mike: null, note: null, shots: true, tags: [], present: false };
  if (!body) return out;
  const text = body.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n');
  const m = /^#{1,3}\s*story\s*$/im.exec(text);
  if (!m) return out;
  out.present = true;
  const rest = text.slice(m.index + m[0].length);
  const end = /^#{1,3}\s+\S/m.exec(rest);
  const section = end ? rest.slice(0, end.index) : rest;

  // Only the known keys start a field; any other line continues the one before (text before
  // the first key is a note), so nothing written there is dropped.
  let key = 'notes';
  const raw = {};
  for (const line of section.split('\n')) {
    const kv = /^\s*[-*]?\s*\**([A-Za-z][A-Za-z .]{1,20}?)\s*:\**\s*(.*)$/.exec(line);
    const k = kv && kv[1].trim().toLowerCase();
    if (k && k in FIELDS) {
      key = k;
      raw[key] = (raw[key] ? raw[key] + '\n' : '') + kv[2].replace(/^\*\*\s*/, '').trim();
    } else if (line.trim()) raw[key] = (raw[key] ? raw[key] + '\n' : '') + line.trim();
  }
  for (const [k, v] of Object.entries(raw)) {
    const field = FIELDS[k];
    const val = v.trim();
    if (field === 'ideas') out.ideas = [...new Set([...val.matchAll(/#(\d+)/g)].map((x) => Number(x[1])))];
    else if (field === 'where') out.where = val.split(/\n|;/).map(parseWhere).filter(Boolean);
    else if (field === 'tags') out.tags = parseTags(val);
    else if (field === 'shots') out.shots = !/^(no|none|off|skip|false)\b/i.test(val);
    else out[field] = val && !/^(-|none|n\/a)$/i.test(val) ? val : null;
  }
  return out;
}

/**
 * One place to photograph, as the site's own review hooks take it:
 *   `47.5310, -122.3960` (lat, lon) · `arcade` (the Duck Arcade door) · `tile 120, 340` ·
 *   `title` (the title screen) · `open:garden` (a ?open= link: inside a scene, a character's
 *   dialog) · `?open=garden&time=2026-04-15` (any query, as is). Anything after `—` or `(` is a
 *   caption. `none` → null.
 *
 * An `open` place can add ` @ lat, lon`, where to stand and press {A} on a build from before the
 * ?open= links (#71): `open:scene:rush-hour @ 47.56373, -122.386654`. Its `way` is that query, and
 * `goal` is what's on screen once you're in (a scene, the arcade, a dialog…), for either path.
 */
export function parseWhere(s) {
  if (!s) return null;
  const [spot0, ...cap] = s.split(/\s+(?:—|--|\()\s*/);
  const caption = cap.join(' ').replace(/\)\s*$/, '').trim() || null;
  const [spot, standAt] = spot0.split(/\s+@\s*/);
  const place = placeOf(spot, caption);
  if (!place) return null;
  const open = /(?:^|&)open=([^&]+)/.exec(place.query)?.[1];
  if (open) {
    place.goal = openGoal(open);
    const time = /(?:^|&)(time=[^&]+)/.exec(place.query)?.[1];
    const ll = standAt && /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/.exec(standAt.trim());
    const at = /^arcade\b/.test(decodeURIComponent(open)) ? 'at=arcade' : ll ? `at=${ll[1]},${ll[2]}` : null;
    if (at) place.way = [at, time].filter(Boolean).join('&');
    if (ll && place.lat == null) Object.assign(place, { lat: Number(ll[1]), lon: Number(ll[2]) });
  }
  return place;
}

function placeOf(spot, caption) {
  const t = spot.trim().toLowerCase().replace(/[`*]/g, '');
  if (!t || /^(none|-|n\/a|nowhere)$/.test(t)) return null;
  if (t === 'arcade') return { query: 'at=arcade', label: caption ?? 'the Duck Arcade' };
  if (t === 'title') return { query: 'title', label: caption ?? 'the title screen' };
  // the site's ?open= links (src/ui/openLink.ts): `open:garden`, `open:arcade:duck-on-the-moon`
  const open = /^open\s*:\s*(\S+)$/.exec(t);
  if (open) return { query: `open=${open[1]}`, label: caption ?? open[1] };
  // any query the site understands, as is: `?open=garden&time=2026-04-15`
  if (/^\?[\w-]+=/.test(spot.trim())) return { query: spot.trim().slice(1), label: caption };
  const tile = /^tile\s*:?\s*(\d+)\s*,\s*(\d+)$/.exec(t);
  if (tile) return { query: `atTile=${tile[1]},${tile[2]}`, label: caption };
  const ll = /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/.exec(t);
  if (ll) return { query: `at=${ll[1]},${ll[2]}`, lat: Number(ll[1]), lon: Number(ll[2]), label: caption };
  return null;
}

/** the Duck Arcade's door, for builds from before `?at=arcade` worked (they read it as a number) */
export const ARCADE_DOOR = 'at=47.560470,-122.386619';

/** the same problem seen over and over (a page error every frame) once, with how many times */
export function squeeze(problems) {
  const n = new Map();
  for (const p of problems) n.set(p, (n.get(p) ?? 0) + 1);
  return [...n].map(([p, k]) => (k > 1 ? `${p} (×${k})` : p));
}

/** what's on screen once a ?open= value has opened (a selector the camera waits for) */
export function openGoal(value) {
  const head = decodeURIComponent(value).toLowerCase().split(':')[0];
  if (head === 'scene') return '.scene';
  if (head === 'arcade') return '.arcade-scene';
  if (head === 'ride') return '.luna-ride';
  if (head === 'minigame') return '.minigame-canvas';
  if (head === 'idea' || head === 'spots') return null;
  return '.dialog';
}

/**
 * Hand-picked places for changes recorded before their PR could say (scripts/story/curated.json,
 * by PR number or the commit's first 7): they win over the PR's `Where:` and the guess.
 */
export function curatedFor(curated, { pr, sha }) {
  return (pr != null && curated?.[String(pr)]) || curated?.[sha?.slice(0, 7)] || null;
}

/** a record photographed somewhere other than where it should be now (its places, or where to stand for them, were curated since) */
export const placesMoved = (shots, places) =>
  (shots ?? []).length !== places.length || places.some((p, i) => shots[i].query !== p.query || (shots[i].way ?? null) !== (p.way ?? null));

// ---------------------------------------------------------------------------------------------
// Facts we can read without anyone writing them down

/** Idea-box issues a PR answers: "(idea box #38, #34)" in the title, "Closes #36", the Story's `Idea:`. */
export function ideaRefs(title = '', body = '', story = parseStory(body)) {
  const found = new Set(story.ideas);
  const ib = /idea box\s+((?:#\d+[,\s&and]*)+)/gi;
  for (const m of `${title}\n${body}`.matchAll(ib)) for (const n of m[1].matchAll(/#(\d+)/g)) found.add(Number(n[1]));
  for (const m of (body ?? '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
}

/**
 * An idea-box issue body (made by wish/src/issue.ts) back into its parts. Older or hand-made
 * issues may not match; then the whole body is the text.
 */
export function parseWish(body = '') {
  const [quoted, footer = ''] = body.split(/\n---\n/);
  const text = quoted
    .split('\n')
    .map((l) => l.replace(/^>\s?/, ''))
    .join('\n')
    .replace(/​/g, '')
    .trim();
  const name = /\bby \*\*(.+?)\*\*/.exec(footer)?.[1] ?? null;
  const street = /the rabbit was on (.+?)\.?<\/sub>/.exec(footer)?.[1]?.replace(/​/g, '') ?? null;
  const preview = /on the (pr-\d+) preview/.exec(footer)?.[1] ?? null;
  return { text, name, street, preview, fromIdeaBox: /idea box/.test(footer) };
}

/** Who helped make it: Co-Authored-By trailers, and the tools that leave a mark. */
export function makers(prBody = '', commits = []) {
  const coauthors = new Set();
  const tools = new Set();
  for (const c of commits) {
    for (const m of (c.message ?? '').matchAll(/^co-authored-by:\s*(.+?)\s*(?:<[^>]*>)?\s*$/gim)) coauthors.add(m[1]);
    if (/^aider:/im.test(c.message ?? '') || /\(aider\)/i.test(c.author ?? '')) tools.add('Aider');
  }
  if (/generated with \[?claude code/i.test(prBody) || [...coauthors].some((n) => /^claude\b/i.test(n))) tools.add('Claude Code');
  if (/scripts\/ai\/run\.mjs/.test(prBody)) tools.add('the free-model helper (scripts/ai)');
  return { coauthors: [...coauthors], tools: [...tools] };
}

const AREAS = [
  [/^src\/city\//, 'city'],
  [/^scripts\/city\/|^content\/landmarks\.csv/, 'map pipeline'],
  [/^src\/game\//, 'characters & map life'],
  [/^src\/experiences\//, 'scenes & games'],
  [/^src\/ui\//, 'ui'],
  [/^src\/content\/|^content\//, 'words & content'],
  [/^public\/(art|sprites|audio|music|sounds)\/|^public\/.*\.(png|webp|avif|mp3|mp4|ogg)$/, 'art & sound'],
  [/^relay\/|^src\/net\//, 'relay'],
  [/^wish\//, 'idea box'],
  [/^\.github\//, 'ci'],
  [/(^|\/)CLAUDE\.md$|^docs\/|README\.md$/, 'docs'],
  [/^scripts\//, 'tools'],
];

/** Coarse areas a change touched, in a stable order. */
export function areasOf(paths) {
  const hit = new Set();
  for (const p of paths) for (const [re, name] of AREAS) if (re.test(p)) { hit.add(name); break; }
  return AREAS.map(([, n]) => n).filter((n, i, a) => hit.has(n) && a.indexOf(n) === i);
}

// ---------------------------------------------------------------------------------------------
// Tags: what kind of change it was, to sort the log by (README: "Tags")

/** every tag, in the order they're listed */
export const TAGS = ['wish', 'map', 'character', 'scene', 'arcade', 'art', 'sound', 'words', 'ui', 'multiplayer', 'idea-box', 'code', 'agent', 'story-log', 'infra', 'docs'];

const big = (f) => (f.additions ?? 0) + (f.deletions ?? 0) >= 15;
const isTest = (p) => /\.test\.[cm]?[jt]sx?$/.test(p);
/** tag ← a file it touched (tests only count for `agent`, below) */
const TAG_FILES = [
  // (before the city moved to src/city/, its map and drawing lived in scripts/ and src/game/)
  ['map', (p) => /^scripts\/city\/|^scripts\/(build-map|map-config|review-map|fetch-|landmarks)|^content\/landmarks\.csv|^src\/(city\/)?(world|render)\/|^src\/game\/(world|render)\//.test(p)],
  ['character', (p) => /^src\/game\/(?!actions\.ts|look\.ts|plugins\/index\.ts|plugins\/visitors\.ts|world\/|render\/)/.test(p) || /^src\/content\/(crow|chicken|ham|ponies|mermaids|pegasus|dinos|lunaPark|garden|busker|bikeRace|chickenBoxing|neighbors)\b/.test(p)],
  ['scene', (p) => /^src\/experiences\/(?!arcade\/)/.test(p)],
  ['arcade', (p) => /^src\/experiences\/arcade\/|^public\/arcade\/|duckArcade|arcadeBear/.test(p)],
  ['art', (p) => /^public\/(art|sprites)\/|^data\/source\/|artManifest|^scripts\/(images|art-publish|make-)/.test(p)],
  ['sound', (p) => !/^scripts\/ai\//.test(p) && /^public\/(audio|music|sounds)\/|\.(mp3|ogg|wav)$|sounds?\.ts$|music|busker/i.test(p)],
  ['words', (p) => /^src\/content\/(?!artManifest|placesData)|^content\/places\.csv/.test(p)],
  ['ui', (p) => /^src\/ui\/(?!sounds\.ts)|^src\/[^/]+\.css$|^src\/city\/(hud|ui)\//.test(p)],
  ['multiplayer', (p) => /^relay\/|^src\/net\/|plugins\/visitors\.ts/.test(p)],
  ['idea-box', (p) => /^wish\/|IdeaBox/.test(p)],
  ['code', (p, f) => /^src\/city\/engine\/|^src\/game\/actions\.ts|^src\/game\/plugins\/index\.ts|^vite\.config|^tsconfig|^index\.html$/.test(p) || (/^src\/(App|main)\.tsx$/.test(p) && (f.additions ?? 0) + (f.deletions ?? 0) >= 60)],
  ['agent', (p) => /^scripts\/ai\/|^\.claude\//.test(p)],
  ['story-log', (p) => /^scripts\/story\/|^src\/story\/|^story\//.test(p)],
  ['infra', (p) => /^\.github\/|^preview\//.test(p)],
  ['docs', (p) => /^docs\/|(^|\/)README\.md$/.test(p)],
];

/** `ui, +sound, -code` → [['+','ui'], ['+','sound'], ['-','code']] (a Story `Tags:` line, curated tags) */
export function parseTags(s) {
  const list = Array.isArray(s) ? s : String(s ?? '').split(/[,\s]+/);
  return list
    .map((t) => /^([+-]?)#?([a-z][a-z-]*)$/.exec(String(t).trim().toLowerCase()))
    .filter(Boolean)
    .map((m) => [m[1] || '+', m[2]]);
}

/**
 * A change's tags, from what it touched: the files (see TAG_FILES), whether it answered a wish,
 * and changes to how agents work (scripts/ai, a CLAUDE.md rewritten rather than given a line, the
 * guards that tell Claude where things go, a title about Claude or agents). Then the PR's own
 * `Tags:` line and curated tags add (`sound`) or take away (`-code`).
 */
export function tagsOf({ files = [], title = '', ideas = [], story = {} }, curated = []) {
  const on = new Set();
  if (ideas.length) on.add('wish');
  for (const f of files) {
    const p = f.path;
    if (/(^|\/)CLAUDE\.md$/.test(p) && big(f)) on.add('agent').add('docs');
    if (/onInteract\.test\.ts$/.test(p)) on.add('agent');
    if (isTest(p)) continue;
    for (const [tag, hit] of TAG_FILES) if (hit(p, f)) on.add(tag);
  }
  if (/\b(claude|agents?|ai helper|free models?)\b/i.test(title)) on.add('agent');
  // only notes changed: docs, and a CLAUDE.md is what every Claude reads before working
  const md = files.filter((f) => !isTest(f.path));
  if (md.length && md.every((f) => /\.md$/.test(f.path))) {
    on.add('docs');
    if (md.some((f) => /(^|\/)CLAUDE\.md$/.test(f.path))) on.add('agent');
  }
  for (const [sign, tag] of [...(story.tags ?? []), ...parseTags(curated)]) sign === '-' ? on.delete(tag) : on.add(tag);
  return [...TAGS.filter((t) => on.has(t)), ...[...on].filter((t) => !TAGS.includes(t)).sort()];
}

/**
 * West Seattle coordinates a diff adds (`lat: 47.53, lon: -122.39`, `[47.53, -122.39]`, a CSV
 * row): where to point the camera when the PR didn't say. First few distinct, in diff order.
 */
export function coordsFromPatches(patches, max = 3) {
  const out = [];
  const seen = new Set();
  for (const patch of patches) {
    for (const line of (patch ?? '').split('\n')) {
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      const m = /(47\.[45]\d{2,})\D{1,40}?(-122\.[34]\d{2,})/.exec(line);
      if (!m) continue;
      const key = `${Number(m[1]).toFixed(4)},${Number(m[2]).toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(parseWhere(`${m[1]},${m[2]}`));
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** the `base` a commit's vite.config.ts builds for (the setting, not a comment that mentions one) */
export const baseOf = (config) => /^\s*base:\s*['"]([^'"]+)['"]/m.exec(config)?.[1] ?? '/';

/**
 * True when a commit's App.tsx only honours `?at=` in development (`import.meta.env.DEV && …get('at')`,
 * as it did until early November): a production build of it would always show the title screen,
 * so the recorder builds it in development mode to reach the place.
 */
export const devOnlyAt = (app) => /import\.meta\.env\.DEV\s*&&[^\n]*get\(\s*['"]at['"]\s*\)/.test(app ?? '');

/**
 * A record whose photos should be taken again: a missing photo, a failure, or a title screen where
 * a place was wanted. `canReach` says whether each side's build has a ?at= hook at all (a commit
 * from before it existed can only show its title, so that's not worth retrying).
 */
export function shotsNeedRetry(entry, canReach = { before: true, after: true }) {
  const bad = (problems, side) =>
    (problems ?? []).some((p) => /build failed|shot failed/.test(p) || (canReach[side] && /no \?at= hook/.test(p)));
  return (entry.shots ?? []).some(
    (s) => (s.query !== 'title' && !s.after && canReach.after) || bad(s.problems?.before, 'before') || bad(s.problems?.after, 'after'),
  );
}

/** a short folder-safe slug from a title */
export function slug(s, max = 40) {
  return (
    s
      .toLowerCase()
      .replace(/\(idea box[^)]*\)/g, '')
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .slice(0, max)
      .replace(/-+$/, '') || 'change'
  );
}

/**
 * A change's folder: `changes/2026-11-15-pr064-pastel-ponies-in-lincoln-parks-meadow`, or for a
 * commit that went to main without a PR (the early days), `changes/2026-10-18-8066597-bear-island-map…`.
 */
export const changeDir = ({ pr, sha, at, title }) =>
  `changes/${seattleDay(at)}-${pr ? `pr${String(pr).padStart(3, '0')}` : sha.slice(0, 7)}-${slug(title)}`;

/** the calendar day in West Seattle (YYYY-MM-DD): a change merged at 5 pm is that day's, not tomorrow's UTC */
export const seattleDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

/** the PR number of a change folder, or null */
export const prOfDir = (dir) => {
  const m = /-pr(\d+)-/.exec(dir);
  return m ? Number(m[1]) : null;
};

/** the PR a squash-merge commit came from: GitHub ends its subject with "(#64)" */
export const prOfSubject = (subject) => {
  const m = /\(#(\d+)\)\s*$/.exec(subject);
  return m ? Number(m[1]) : null;
};

/** the PR description's opening paragraph(s), without the closing keywords or tool footers */
export function summaryOf(body = '') {
  const text = (body ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n');
  const head = text.split(/^#{1,3}\s/m)[0];
  return (
    head
      .split('\n')
      .filter((l) => !/^\s*(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#\d+/i.test(l) && !/generated with/i.test(l) && !/^co-authored-by:/i.test(l))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || null
  );
}

/** the Preview workflow's link, from the PR's comments */
export function previewUrl(comments) {
  for (const c of comments) {
    const m = /\*\*Preview:\*\*\s*(https:\/\/\S+)/.exec(c.body ?? '');
    if (m) return m[1];
  }
  return null;
}

/**
 * A wish's record, updated: the words as they first arrived are never overwritten (`original`),
 * and every change of state is appended to `history`.
 */
export function updateWish(prev, issue, comments, now) {
  const parsed = parseWish(issue.body ?? '');
  const state = issue.state_reason && issue.state === 'closed' ? `closed:${issue.state_reason}` : issue.state;
  const rec = prev
    ? structuredClone(prev)
    : {
        schema: SCHEMA,
        kind: 'wish',
        issue: issue.number,
        url: issue.html_url,
        asked_at: issue.created_at,
        original: { title: issue.title, body: issue.body ?? '', ...parsed },
        first_recorded_at: now,
        history: [{ at: issue.created_at, state: 'open' }],
        state: 'open',
        answered_by: [],
      };
  if (rec.original.body !== (issue.body ?? '') || rec.title !== issue.title) {
    rec.current = { title: issue.title, body: issue.body ?? '', ...parsed };
  }
  rec.title = issue.title;
  rec.labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
  if (rec.state !== state) rec.history.push({ at: issue.closed_at && issue.state === 'closed' ? issue.closed_at : now, state });
  rec.state = state;
  rec.closed_at = issue.closed_at ?? null;
  rec.comments = comments.map((c) => ({ at: c.created_at, by: c.user?.login ?? null, body: c.body ?? '' }));
  rec.last_recorded_at = now;
  return rec;
}

/** a wish is a real visitor's (not a test, not from a PR preview) */
export const isRealWish = (issue) =>
  (issue.labels ?? []).some((l) => (typeof l === 'string' ? l : l.name) === 'suggestion') &&
  !issue.pull_request &&
  !/^\[preview /.test(issue.title) &&
  !/\btest(ing)?\b/i.test(issue.title.slice(0, 30));

/** whole days between two ISO times */
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// ---------------------------------------------------------------------------------------------
// The readable chronicle: the story branch's README.md

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
const quote = (s) => s.split('\n').map((l) => `> ${l}`).join('\n');
const esc = (s) => s.replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'));

/** `entries`: [{ dir, entry }], `wishes`: [record]. Newest first. */
export function renderChronicle(entries, wishes, repo) {
  const byDate = [...entries].sort((a, b) => b.entry.merged_at.localeCompare(a.entry.merged_at));
  // open on GitHub and nothing built for it yet
  const open = wishes.filter((w) => w.state === 'open' && !w.answered_by?.length);
  const answered = wishes.filter((w) => w.answered_by?.length).length;
  const L = [];
  L.push('# The Garden in Sound: how the island grew', '');
  L.push(
    `Every change that went live on [gardeninsound.website](https://gardeninsound.website), newest first, with the wish that started it, ` +
      `what was made, who made it, and how the spot looked before and after. Written automatically by ` +
      `[\`.github/workflows/story.yml\`](https://github.com/${repo}/blob/main/.github/workflows/story.yml) when a change merges; ` +
      `the raw records are in \`changes/\` and \`wishes/\`, and \`story.json\` indexes them all.`,
    '',
  );
  L.push(`**${entries.length}** changes · **${wishes.length}** wishes from visitors, **${answered}** answered · **${open.length}** still waiting`, '');

  for (const { dir, entry: e } of byDate) {
    L.push('---', '', `### ${fmtDate(e.merged_at)} · ${esc(e.title)} (${e.pr ? `[#${e.pr}](${e.url})` : `[${e.sha.slice(0, 7)}](${e.url})`})`, '');
    for (const w of e.ideas ?? []) {
      L.push(quote(esc(w.text || w.title)));
      const who = w.name ? `**${esc(w.name)}**` : 'a visitor';
      const where = w.street ? ` on ${esc(w.street)}` : '';
      const wait = w.asked_at ? `; live ${daysBetween(w.asked_at, e.merged_at)} days later` : '';
      L.push(`>`, `> — ${who}${where}, ${w.asked_at ? fmtDate(w.asked_at) : ''} ([wish #${w.issue}](${w.url})${wait})`, '');
    }
    if (e.story?.askedVsMade) L.push(`**Asked vs made:** ${esc(e.story.askedVsMade)}`, '');
    if (e.story?.mike) L.push(`**Mike:** ${esc(e.story.mike)}`, '');
    if (e.story?.note) L.push(esc(e.story.note), '');
    if (!e.story?.present && e.summary) L.push(esc(e.summary), '');
    for (const s of e.shots ?? []) {
      const cap = s.label ? ` · ${esc(s.label)}` : '';
      if (s.before && s.after) {
        L.push(`| before${cap} | after |`, '|---|---|', `| <img src="${dir}/${s.before}" width="400"> | <img src="${dir}/${s.after}" width="400"> |`, '');
      } else if (s.after) L.push(`<img src="${dir}/${s.after}" width="600">${cap ? `<br><sub>${cap.slice(3)}</sub>` : ''}`, '');
      if (s.moving) L.push(`<img src="${dir}/${s.moving}" width="400" alt="moving">`, '');
    }
    const by = [...new Set(e.authors.map((a) => a.login ?? a.name))].join(', ');
    const tools = e.made_with?.tools?.length ? ` with ${e.made_with.tools.join(', ')}` : '';
    L.push(`<sub>${by}${tools} · ${e.files.length} files, +${e.additions} −${e.deletions} · ${e.areas.join(', ')} · [record](${dir}/entry.json)</sub>`, '');
  }

  if (open.length) {
    L.push('---', '', '## Wishes still waiting', '');
    for (const w of [...open].sort((a, b) => a.asked_at.localeCompare(b.asked_at))) {
      const o = w.original;
      L.push(`- ${fmtDate(w.asked_at)}: “${esc((o.text || w.title).replace(/\s+/g, ' ').slice(0, 200))}”${o.name ? ` — ${esc(o.name)}` : ''} ([#${w.issue}](${w.url}))`);
    }
    L.push('');
  }
  return L.join('\n');
}

/**
 * `story.json`: everything a reader needs in one file (the /story/ page reads only this): each
 * change with its wishes, words, pictures and census, oldest first, and every wish. The full
 * record of each change stays in its `entry.json`.
 */
export function renderIndex(entries, wishes) {
  return {
    schema: SCHEMA,
    generated_at: new Date().toISOString(),
    changes: [...entries]
      .sort((a, b) => a.entry.merged_at.localeCompare(b.entry.merged_at))
      .map(({ dir, entry: e }) => ({
        pr: e.pr,
        sha: e.sha,
        title: e.title.replace(/\s*\(idea box[^)]*\)\s*$/i, ''),
        url: e.url,
        merged_at: e.merged_at,
        dir,
        ideas: (e.ideas ?? []).map((w) => ({ issue: w.issue, url: w.url, text: w.text || w.title, name: w.name ?? null, street: w.street ?? null, asked_at: w.asked_at ?? null })),
        summary: e.summary ?? null,
        story: { askedVsMade: e.story?.askedVsMade ?? null, mike: e.story?.mike ?? null, note: e.story?.note ?? null },
        authors: [...new Set((e.authors ?? []).map((a) => a.login ?? a.name).filter(Boolean))],
        tools: e.made_with?.tools ?? [],
        files: e.files?.length ?? 0,
        additions: e.additions ?? 0,
        deletions: e.deletions ?? 0,
        areas: e.areas ?? [],
        tags: e.tags ?? [],
        shots: (e.shots ?? []).map((s) => ({
          query: s.query,
          lat: s.lat ?? null,
          lon: s.lon ?? null,
          label: s.label ?? null,
          before: s.before ? `${dir}/${s.before}` : null,
          after: s.after ? `${dir}/${s.after}` : null,
          moving: s.moving ? `${dir}/${s.moving}` : null,
        })),
        census: e.census ?? null,
      })),
    wishes: [...wishes]
      .sort((a, b) => a.issue - b.issue)
      .map((w) => ({
        issue: w.issue,
        url: w.url,
        asked_at: w.asked_at,
        text: w.original.text,
        name: w.original.name,
        street: w.original.street,
        state: w.state,
        answered_by: (w.answered_by ?? []).map((a) => ({ pr: a.pr, sha: a.sha, merged_at: a.merged_at })),
      })),
  };
}
