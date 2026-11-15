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
};

/**
 * Reads the `## Story` section: `Key: value` lines (a value may run on over following lines
 * until the next key). HTML comments (the template's hints) are dropped.
 */
export function parseStory(body) {
  const out = { ideas: [], where: [], askedVsMade: null, mike: null, note: null, shots: true, present: false };
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
    else if (field === 'shots') out.shots = !/^(no|none|off|skip|false)\b/i.test(val);
    else out[field] = val && !/^(-|none|n\/a)$/i.test(val) ? val : null;
  }
  return out;
}

/**
 * One place to photograph, as the site's own review hooks take it:
 *   `47.5310, -122.3960` (lat, lon) · `arcade` (the Duck Arcade door) · `tile 120, 340` ·
 *   `title` (the title screen). Anything after `—` or `(` is a caption. `none` → null.
 */
export function parseWhere(s) {
  if (!s) return null;
  const [spot, ...cap] = s.split(/\s+(?:—|--|\()\s*/);
  const caption = cap.join(' ').replace(/\)\s*$/, '').trim() || null;
  const t = spot.trim().toLowerCase().replace(/[`*]/g, '');
  if (!t || /^(none|-|n\/a|nowhere)$/.test(t)) return null;
  if (t === 'arcade') return { query: 'at=arcade', label: caption ?? 'the Duck Arcade' };
  if (t === 'title') return { query: 'title', label: caption ?? 'the title screen' };
  const tile = /^tile\s*:?\s*(\d+)\s*,\s*(\d+)$/.exec(t);
  if (tile) return { query: `atTile=${tile[1]},${tile[2]}`, label: caption };
  const ll = /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/.exec(t);
  if (ll) return { query: `at=${ll[1]},${ll[2]}`, lat: Number(ll[1]), lon: Number(ll[2]), label: caption };
  return null;
}

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

/** `story.json`: one line per change and wish, for anything built on top (an in-game board, a time-lapse). */
export function renderIndex(entries, wishes) {
  return {
    schema: SCHEMA,
    changes: [...entries]
      .sort((a, b) => a.entry.merged_at.localeCompare(b.entry.merged_at))
      .map(({ dir, entry: e }) => ({
        pr: e.pr,
        sha: e.sha,
        title: e.title,
        merged_at: e.merged_at,
        dir,
        ideas: (e.ideas ?? []).map((w) => w.issue),
        where: (e.shots ?? []).map((s) => ({ query: s.query, lat: s.lat ?? null, lon: s.lon ?? null, label: s.label ?? null })),
        shots: (e.shots ?? []).flatMap((s) => [s.before, s.after, s.moving].filter(Boolean).map((f) => `${dir}/${f}`)),
        areas: e.areas,
        census: e.census ?? null,
      })),
    wishes: [...wishes]
      .sort((a, b) => a.issue - b.issue)
      .map((w) => ({ issue: w.issue, asked_at: w.asked_at, text: w.original.text, name: w.original.name, street: w.original.street, state: w.state, answered_by: w.answered_by })),
  };
}
