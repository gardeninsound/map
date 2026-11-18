/**
 * The /story/ page's data: `story.json` from the story branch (written by scripts/story/), and
 * the pure rules for showing it. Tested in model.test.ts.
 */

export type StoryShot = {
  query: string;
  lat: number | null;
  lon: number | null;
  label: string | null;
  before: string | null;
  after: string | null;
  moving: string | null;
};
export type StoryIdea = { issue: number; url: string; text: string; name: string | null; street: string | null; asked_at: string | null };
export type Census = Partial<Record<'spots' | 'plugins' | 'scenes' | 'content_files' | 'arcade_cabinets_ready' | 'source_lines' | 'commits', number>>;
export type StoryChange = {
  pr: number | null;
  sha: string;
  title: string;
  url: string;
  merged_at: string;
  dir: string;
  ideas: StoryIdea[];
  summary: string | null;
  story: { askedVsMade: string | null; mike: string | null; note: string | null };
  /** who made it, by name (Jim, Mike) */
  authors: string[];
  files: number;
  additions: number;
  deletions: number;
  areas: string[];
  /** what kind of change (scripts/story/lib.mjs `tagsOf`); missing in logs written before tags */
  tags?: string[];
  shots: StoryShot[];
  census: Census | null;
};
export type StoryWish = {
  issue: number;
  url: string;
  asked_at: string;
  text: string;
  name: string | null;
  street: string | null;
  state: string;
  answered_by: { pr: number | null; sha: string; merged_at: string }[];
};
export type StoryIndex = { schema: number; generated_at?: string; changes: StoryChange[]; wishes: StoryWish[] };

/** the story branch, as raw files (public repo; raw.githubusercontent.com allows cross-origin reads) */
export const DEFAULT_SRC = 'https://raw.githubusercontent.com/gardeninsound/map/story/';

/** where to read the log from: `?src=<base url>` (a local copy, a test fixture) or the story branch */
export function srcFrom(search: string): string {
  const s = new URLSearchParams(search).get('src');
  if (!s) return DEFAULT_SRC;
  return s.endsWith('/') ? s : `${s}/`;
}

// dates, shared with the recorder (scripts/story/lib.mjs)
import { dateLabel, dayLabel, seattleDay, waitDays } from './dates.mjs';
export { dateLabel, dayLabel, seattleDay, waitDays };
const monthLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });


/** an anchor for a change: #pr-64, or #c-8066597 for the early commits */
/** Where the before/after line sits (0–100 %) for a pointer at `x` over a frame from `left`, `width` wide. */
export const wipeAt = (x: number, left: number, width: number) => (width > 0 ? Math.min(100, Math.max(0, ((x - left) / width) * 100)) : 50);

/** The line after a key: arrows move it 5 % (Shift: 1 %), Home/End to the ends; null for any other key. */
export function wipeKey(pos: number, key: string, fine = false): number | null {
  const step = fine ? 1 : 5;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(0, pos - step);
  if (key === 'ArrowRight' || key === 'ArrowUp') return Math.min(100, pos + step);
  if (key === 'Home') return 0;
  if (key === 'End') return 100;
  return null;
}

export const anchorOf = (c: Pick<StoryChange, 'pr' | 'sha'>) => (c.pr ? `pr-${c.pr}` : `c-${c.sha.slice(0, 7)}`);

export type Filter = 'all' | 'wishes' | 'pictures';
export function applyFilter(changes: StoryChange[], filter: Filter): StoryChange[] {
  if (filter === 'wishes') return changes.filter((c) => c.ideas.length > 0);
  if (filter === 'pictures') return changes.filter((c) => c.shots.some((s) => s.after));
  return changes;
}

/** each tag with how many changes have it, most first (ties in the log's own order) */
export function tagCounts(changes: StoryChange[]): { tag: string; n: number }[] {
  const n = new Map<string, number>();
  for (const c of changes) for (const t of c.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].map(([tag, k]) => ({ tag, n: k })).sort((a, b) => b.n - a.n);
}

/** the changes with this tag (all of them for null) */
export const withTag = (changes: StoryChange[], tag: string | null) => (tag ? changes.filter((c) => c.tags?.includes(tag)) : changes);

export type Day = { day: string; label: string; changes: StoryChange[] };
export type Month = { month: string; label: string; days: Day[] };
/** newest month first, newest day first, newest change first */
export function groupByMonth(changes: StoryChange[]): Month[] {
  const sorted = [...changes].sort((a, b) => b.merged_at.localeCompare(a.merged_at));
  const months: Month[] = [];
  for (const c of sorted) {
    const day = seattleDay(c.merged_at);
    const month = day.slice(0, 7);
    let m = months.at(-1);
    if (!m || m.month !== month) months.push((m = { month, label: monthLabel(day), days: [] }));
    let d = m.days.at(-1);
    if (!d || d.day !== day) m.days.push((d = { day, label: dayLabel(c.merged_at), changes: [] }));
    d.changes.push(c);
  }
  return months;
}

/** open on GitHub with nothing built for it yet, oldest first */
export const waitingWishes = (idx: StoryIndex) =>
  idx.wishes.filter((w) => w.state === 'open' && !w.answered_by.length).sort((a, b) => a.asked_at.localeCompare(b.asked_at));

export function stats(idx: StoryIndex) {
  const answered = idx.wishes.filter((w) => w.answered_by.length);
  const waits = answered
    .map((w) => waitDays(w.asked_at, [...w.answered_by].sort((a, b) => a.merged_at.localeCompare(b.merged_at))[0].merged_at))
    .sort((a, b) => a - b);
  const first = idx.changes.reduce<string | null>((m, c) => (!m || c.merged_at < m ? c.merged_at : m), null);
  return {
    changes: idx.changes.length,
    wishes: idx.wishes.length,
    answered: answered.length,
    waiting: waitingWishes(idx).length,
    firstDay: first,
    /** the middle wait from wish to live, in days (null with no answered wishes) */
    medianWait: waits.length ? waits[Math.floor((waits.length - 1) / 2)] : null,
  };
}

export type Point = { t: number; v: number; at: string; what: string };
export type Series = { key: string; label: string; points: Point[] };

/**
 * How the island grew, one series per measure (shown as small multiples, one line each): a
 * point wherever the value changed. Wishes count up from each wish's arrival.
 */
export function growth(idx: StoryIndex): Series[] {
  const changes = [...idx.changes].sort((a, b) => a.merged_at.localeCompare(b.merged_at));
  const measure = (key: keyof Census, label: string): Series => {
    const points: Point[] = [];
    for (const c of changes) {
      const v = c.census?.[key];
      if (typeof v !== 'number' || points.at(-1)?.v === v) continue;
      points.push({ t: Date.parse(c.merged_at), v, at: c.merged_at, what: c.title });
    }
    return { key, label, points };
  };
  const wishes = [...idx.wishes].sort((a, b) => a.asked_at.localeCompare(b.asked_at));
  return [
    measure('spots', 'Art spots'),
    measure('plugins', 'Life on the map'),
    measure('scenes', 'Scenes & games'),
    { key: 'wishes', label: 'Wishes received', points: wishes.map((w, i) => ({ t: Date.parse(w.asked_at), v: i + 1, at: w.asked_at, what: w.text })) },
  ].filter((s) => s.points.length > 0);
}
