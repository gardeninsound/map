import { describe, expect, it } from 'vitest';
import { anchorOf, applyFilter, DEFAULT_SRC, groupByMonth, growth, srcFrom, stats, waitDays, waitingWishes, type StoryChange, type StoryIndex } from './model';

const change = (over: Partial<StoryChange>): StoryChange => ({
  pr: null,
  sha: '8066597aaaa',
  title: 'x',
  url: 'u',
  merged_at: '2026-10-18T17:00:00Z',
  dir: 'changes/x',
  ideas: [],
  summary: null,
  story: { askedVsMade: null, mike: null, note: null },
  authors: [],
  tools: [],
  files: 1,
  additions: 1,
  deletions: 0,
  areas: [],
  shots: [],
  census: null,
  ...over,
});

const idx: StoryIndex = {
  schema: 1,
  changes: [
    change({ title: 'first', census: { spots: 11, plugins: 0, scenes: 1 } }),
    change({ pr: 36, sha: 'b', title: 'roads', merged_at: '2026-10-19T03:00:00Z', census: { spots: 11, plugins: 0, scenes: 1 } }),
    change({
      pr: 64,
      sha: 'c',
      title: 'ponies',
      // 5:24 pm on Nov 14 in Seattle, already Nov 15 in UTC
      merged_at: '2026-11-15T01:24:24Z',
      ideas: [{ issue: 36, url: 'u', text: 'ponies', name: null, street: null, asked_at: '2026-11-05T04:44:46Z' }],
      shots: [{ query: 'at=1,2', lat: 1, lon: 2, label: null, before: 'b.webp', after: 'a.webp', moving: null }],
      census: { spots: 15, plugins: 14, scenes: 9 },
    }),
  ],
  wishes: [
    { issue: 36, url: 'u', asked_at: '2026-11-05T04:44:46Z', text: 'ponies', name: null, street: null, state: 'closed:completed', answered_by: [{ pr: 64, sha: 'c', merged_at: '2026-11-15T01:24:24Z' }] },
    { issue: 50, url: 'u', asked_at: '2026-11-07T00:00:00Z', text: 'a ferry', name: 'Sam', street: null, state: 'open', answered_by: [] },
    { issue: 34, url: 'u', asked_at: '2026-11-04T00:00:00Z', text: 'hats', name: null, street: null, state: 'open', answered_by: [{ pr: 67, sha: 'd', merged_at: '2026-11-15T02:00:00Z' }] },
  ],
};

describe('story page model', () => {
  it('reads from the story branch unless ?src= says otherwise', () => {
    expect(srcFrom('')).toBe(DEFAULT_SRC);
    expect(srcFrom('?src=/fixture')).toBe('/fixture/');
  });

  it('groups by Seattle month and day, newest first', () => {
    const months = groupByMonth(idx.changes);
    expect(months.map((m) => m.label)).toEqual(['November 2026', 'October 2026']);
    expect(months[0].days[0].day).toBe('2026-11-14');
    expect(months[1].days.map((d) => d.day)).toEqual(['2026-10-18']); // 8 pm Oct 18 in Seattle
    expect(months[1].days[0].changes.map((c) => c.title)).toEqual(['roads', 'first']);
  });

  it('filters to answered wishes or changes with pictures', () => {
    expect(applyFilter(idx.changes, 'wishes').map((c) => c.title)).toEqual(['ponies']);
    expect(applyFilter(idx.changes, 'pictures').map((c) => c.title)).toEqual(['ponies']);
    expect(applyFilter(idx.changes, 'all')).toHaveLength(3);
  });

  it('counts wishes: answered, and waiting (open with nothing built yet)', () => {
    expect(waitingWishes(idx).map((w) => w.issue)).toEqual([50]);
    expect(stats(idx)).toMatchObject({ changes: 3, wishes: 3, answered: 2, waiting: 1, firstDay: '2026-10-18T17:00:00Z', medianWait: 10 });
    expect(waitDays('2026-11-05T04:44:46Z', '2026-11-15T01:24:24Z')).toBe(10);
  });

  it('charts growth only where a value changed', () => {
    const g = growth(idx);
    expect(g.map((s) => s.key)).toEqual(['spots', 'plugins', 'scenes', 'wishes']);
    expect(g[0].points.map((p) => p.v)).toEqual([11, 15]);
    expect(g[3].points.map((p) => p.v)).toEqual([1, 2, 3]);
  });

  it('anchors by PR, or by commit for the early days', () => {
    expect(anchorOf({ pr: 64, sha: 'c' })).toBe('pr-64');
    expect(anchorOf({ pr: null, sha: '8066597aaaa' })).toBe('c-8066597');
  });
});
