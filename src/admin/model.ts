/**
 * The /admin/ page's data (Mike and Jim's view of the island), and the pure rules for showing it.
 * Everything it reads is public: the relay's counts (relay/src/stats.ts), the repo's open pull
 * requests and issues on GitHub, and the spots in src/content. Tested in model.test.ts.
 */
import { personOf } from '../story/people.mjs';

export const STATS_URL = 'https://relay.gardeninsound.website/stats/bearisland/island';
export const TRAFFIC_URL = 'https://relay.gardeninsound.website/traffic';
export const REPO = 'gardeninsound/map';
export const GITHUB = `https://api.github.com/repos/${REPO}`;

/** `?stats=<url>` for a local relay (http://127.0.0.1:8790/stats/bearisland/island) or a fixture; `?traffic=` and `?gh=` likewise */
export function sourcesFrom(search: string) {
  const q = new URLSearchParams(search);
  return { stats: q.get('stats') ?? STATS_URL, traffic: q.get('traffic') ?? TRAFFIC_URL, github: (q.get('gh') ?? GITHUB).replace(/\/$/, '') };
}

// --- the counts --------------------------------------------------------------------------------

export type DayStats = { day: string; visits: number; peak: number; opened: Record<string, number> };
export type Stats = { generated_at: string; today: string; now: number; days: DayStats[] };

const dayMs = (day: string) => Date.parse(`${day}T12:00:00Z`);
const addDays = (day: string, n: number) => new Date(dayMs(day) + n * 86_400_000).toISOString().slice(0, 10);

/** the last `n` days up to `today`, oldest first, a zero for a day with nothing */
export function lastDays(s: Stats, n: number): DayStats[] {
  const by = new Map(s.days.map((d) => [d.day, d]));
  return Array.from({ length: n }, (_, i) => addDays(s.today, i - n + 1)).map((day) => by.get(day) ?? { day, visits: 0, peak: 0, opened: {} });
}

/** visits, the busiest moment and each thing opened, over the last `n` days (most opened first) */
export function totals(s: Stats, n: number) {
  const days = lastDays(s, n);
  const opened = new Map<string, number>();
  for (const d of days) for (const [k, v] of Object.entries(d.opened)) opened.set(k, (opened.get(k) ?? 0) + v);
  return {
    visits: days.reduce((a, d) => a + d.visits, 0),
    peak: Math.max(0, ...days.map((d) => d.peak)),
    opened: [...opened].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)),
  };
}

export type Names = { places: { id: string; name: string }[]; games: { id: string; title: string }[] };
const RIDES: Record<string, string> = { whirl: 'the Giant Whirl', figure8: 'the Figure Eight' };
const PLAIN: Record<string, string> = {
  arcade: 'the Duck Arcade',
  spots: 'the SPOTS list',
  idea: 'the idea box',
  rabbit: 'another rabbit',
  neighbor: 'a neighbor',
  'minigame:cone-catch': 'Cone Catch',
  // the characters, by plugin id or target key (src/game/plugins/index.ts)
  crow: 'the snack crow',
  ham: 'Ham the cat',
  chicken: 'the chicken by the vet',
  pegasus: 'the pegasus',
  busker: 'the busker',
  seal: 'the seal',
  garden: 'the garden sign',
  boxing: 'chicken boxing',
  rowboat: 'the rowboat',
  'rowboat:shore': 'the rowboat (from the shore)',
  'race:start': 'the bike race',
  'maze:middle': 'the middle of the maze',
  'arcade:door': 'the Duck Arcade door',
  'luna:hiram': 'Hiram at Luna Park',
};
/** numbered things, one name for them all (`pony:2` → a pony) */
const FAMILIES: [RegExp, string][] = [
  [/^pony:\d+$/, 'a pony'],
  [/^mermaid:\d+$/, 'a mermaid'],
];

/** a count's key in words: `place:gas-station-wall` → "Mike at The Wall That Kept Turning" */
export function nameOf(key: string, names: Names): string {
  if (PLAIN[key]) return PLAIN[key];
  const family = FAMILIES.find(([re]) => re.test(key));
  if (family) return family[1];
  const [head, rest = ''] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  const place = names.places.find((p) => p.id === rest)?.name;
  if (key.includes(':')) {
    if (head === 'place' && place) return `Mike at ${place}`;
    if (head === 'scene' && place) return `inside ${place}`;
    if (head === 'arcade') return names.games.find((g) => g.id === rest)?.title ?? rest;
    if (head === 'ride') return RIDES[rest] ?? rest;
    if (head === 'luna') return `Luna Park: ${rest.replace(/[_-]/g, ' ')}`;
  }
  return key.replace(/[:_-]/g, ' ');
}

/** one bar a day for the last `n` days up to `today`, oldest first, zero where a day has nothing */
export function daily<T extends { day: string }>(rows: T[], today: string, n: number, value: (r: T) => number): { day: string; n: number }[] {
  const by = new Map(rows.map((r) => [r.day, value(r)]));
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1)).map((day) => ({ day, n: by.get(day) ?? 0 }));
}
/** a sum over the last `n` days up to `today` */
export const sumDays = <T extends { day: string }>(rows: T[], today: string, n: number, value: (r: T) => number) =>
  daily(rows, today, n, value).reduce((a, d) => a + d.n, 0);

// --- Cloudflare (relay/src/traffic.ts) -------------------------------------------------------

export type { Traffic, TrafficDay, BeaconDay, Ranked } from '../../relay/src/traffic';

// --- GitHub ------------------------------------------------------------------------------------

/** the fields we use of GitHub's pull request and issue JSON */
export type GhPull = { number: number; title: string; html_url: string; user: { login: string } | null; created_at: string; draft?: boolean; head: { sha: string } };
export type GhIssue = { number: number; title: string; html_url: string; created_at: string; labels: { name: string }[]; pull_request?: unknown };
export type GhCheckRuns = { check_runs: { name: string; status: string; conclusion: string | null }[] };

export type Check = 'pass' | 'fail' | 'running' | 'none';
/** the Check workflow's run (`check`, .github/workflows/ci.yml) in a word */
export function checkOf(runs: GhCheckRuns | null): Check {
  const r = runs?.check_runs.find((c) => c.name === 'check');
  if (!r) return 'none';
  if (r.status !== 'completed') return 'running';
  return r.conclusion === 'success' ? 'pass' : 'fail';
}

export const ageDays = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
/** "today", "1 day", "5 days" */
export const ageLabel = (days: number) => (days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`);

export type Pull = { number: number; title: string; url: string; who: string; age: number; draft: boolean; preview: string; check: Check };
export function pullOf(p: GhPull, check: Check, now: number): Pull {
  return {
    number: p.number,
    title: p.title,
    url: p.html_url,
    who: personOf(p.user?.login) ?? 'someone',
    age: ageDays(p.created_at, now),
    draft: !!p.draft,
    preview: `https://pr-${p.number}-garden-preview.gardeninsound.workers.dev`,
    check,
  };
}

export type Wish = { number: number; text: string; url: string; age: number };
/** idea-box wishes still open, oldest first (the previews' test wishes left out) */
export function wishesOf(issues: GhIssue[], now: number): Wish[] {
  return issues
    .filter((i) => !i.pull_request && i.labels.some((l) => l.name === 'suggestion') && !/^\[preview /.test(i.title))
    .map((i) => ({ number: i.number, text: i.title.replace(/^Idea:\s*/, ''), url: i.html_url, age: ageDays(i.created_at, now) }))
    .sort((a, b) => b.age - a.age || a.number - b.number);
}
/** open issues that aren't wishes (bugs, notes to each other) */
export const otherIssues = (issues: GhIssue[], now: number) =>
  issues
    .filter((i) => !i.pull_request && !i.labels.some((l) => l.name === 'suggestion'))
    .map((i) => ({ number: i.number, text: i.title, url: i.html_url, age: ageDays(i.created_at, now) }));

// --- the spots ---------------------------------------------------------------------------------

export type SpotLike = { id: string; name: string; approx?: boolean; experience?: string | null };
/** what the spots are waiting on: a pin Mike hasn't confirmed, a spot with no scene yet ("coming soon") */
export function spotsTodo(spots: SpotLike[]) {
  return {
    unconfirmed: spots.filter((s) => s.approx).map((s) => s.name),
    comingSoon: spots.filter((s) => !s.experience).map((s) => s.name),
  };
}
