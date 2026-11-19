import { describe, expect, it } from 'vitest';
import { checkOf, daily, sumDays, lastDays, nameOf, otherIssues, pullOf, sourcesFrom, spotsTodo, totals, wishesOf, ageLabel, type GhIssue, type Stats } from './model';

const stats: Stats = {
  generated_at: '2026-11-19T20:00:00Z',
  today: '2026-11-19',
  now: 2,
  days: [
    { day: '2026-11-19', visits: 5, peak: 3, opened: { crow: 2, 'scene:gas-station-wall': 1 } },
    { day: '2026-11-17', visits: 4, peak: 4, opened: { crow: 1, 'arcade:duck-scroller': 3 } },
    { day: '2026-10-01', visits: 50, peak: 9, opened: { crow: 40 } },
  ],
};
const names = { places: [{ id: 'gas-station-wall', name: 'The Wall That Kept Turning' }], games: [{ id: 'duck-scroller', title: 'Duck Scroller' }] };

describe('the counts', () => {
  it('fills the days with nothing, oldest first', () => {
    expect(lastDays(stats, 3).map((d) => [d.day, d.visits])).toEqual([
      ['2026-11-17', 4],
      ['2026-11-18', 0],
      ['2026-11-19', 5],
    ]);
  });

  it('adds up a stretch of days: visits, the busiest moment, the most opened first', () => {
    const t = totals(stats, 7);
    expect(t.visits).toBe(9);
    expect(t.peak).toBe(4);
    expect(t.opened).toEqual([
      { key: 'arcade:duck-scroller', n: 3 },
      { key: 'crow', n: 3 },
      { key: 'scene:gas-station-wall', n: 1 },
    ]);
    expect(totals(stats, 60).visits).toBe(59);
  });

  it('lays out any daily numbers as bars, and sums them', () => {
    const rows = [
      { day: '2026-11-19', v: 5 },
      { day: '2026-11-17', v: 2 },
    ];
    expect(daily(rows, '2026-11-19', 3, (r) => r.v)).toEqual([
      { day: '2026-11-17', n: 2 },
      { day: '2026-11-18', n: 0 },
      { day: '2026-11-19', n: 5 },
    ]);
    expect(sumDays(rows, '2026-11-19', 2, (r) => r.v)).toBe(5);
  });

  it('names what was opened in words', () => {
    expect(nameOf('place:gas-station-wall', names)).toBe('Mike at The Wall That Kept Turning');
    expect(nameOf('scene:gas-station-wall', names)).toBe('inside The Wall That Kept Turning');
    expect(nameOf('arcade:duck-scroller', names)).toBe('Duck Scroller');
    expect(nameOf('ride:whirl', names)).toBe('the Giant Whirl');
    expect(nameOf('idea', names)).toBe('the idea box');
    expect(nameOf('luna:hiram', names)).toBe('Hiram at Luna Park');
    expect(nameOf('luna:figure-eight', names)).toBe('Luna Park: figure eight');
    expect(nameOf('crow', names)).toBe('the snack crow');
    expect(nameOf('pony:3', names)).toBe('a pony');
    expect(nameOf('something:new', names)).toBe('something new');
  });
});

describe('GitHub', () => {
  const now = Date.parse('2026-11-19T20:00:00Z');
  it("reads the Check's run", () => {
    expect(checkOf({ check_runs: [{ name: 'check', status: 'completed', conclusion: 'success' }] })).toBe('pass');
    expect(checkOf({ check_runs: [{ name: 'check', status: 'completed', conclusion: 'failure' }] })).toBe('fail');
    expect(checkOf({ check_runs: [{ name: 'check', status: 'in_progress', conclusion: null }] })).toBe('running');
    expect(checkOf({ check_runs: [{ name: 'preview', status: 'completed', conclusion: 'success' }] })).toBe('none');
    expect(checkOf(null)).toBe('none');
  });

  it('names who opened a PR and links its preview', () => {
    const p = pullOf({ number: 93, title: 'Admin', html_url: 'u', user: { login: 'exit320-stack' }, created_at: '2026-11-17T10:00:00Z', head: { sha: 'x' } }, 'pass', now);
    expect(p).toMatchObject({ who: 'Mike', age: 2, draft: false, preview: 'https://pr-93-garden-preview.gardeninsound.workers.dev', check: 'pass' });
    expect(ageLabel(0)).toBe('today');
    expect(ageLabel(1)).toBe('1 day');
  });

  it('lists the wishes waiting, oldest first, without the previews or pull requests', () => {
    const issue = (n: number, title: string, created: string, labels = ['suggestion'], pr = false): GhIssue => ({
      number: n,
      title,
      html_url: `u${n}`,
      created_at: created,
      labels: labels.map((name) => ({ name })),
      ...(pr ? { pull_request: {} } : {}),
    });
    const issues = [
      issue(40, 'Idea: more dinosaurs', '2026-11-18T00:00:00Z'),
      issue(30, 'Idea: a ferris wheel', '2026-11-10T00:00:00Z'),
      issue(41, '[preview pr-9] Idea: test', '2026-11-18T00:00:00Z'),
      issue(42, 'Fix the crow', '2026-11-19T00:00:00Z', []),
      issue(43, 'A PR', '2026-11-19T00:00:00Z', [], true),
    ];
    expect(wishesOf(issues, now).map((w) => [w.number, w.text, w.age])).toEqual([
      [30, 'a ferris wheel', 9],
      [40, 'more dinosaurs', 1],
    ]);
    expect(otherIssues(issues, now).map((i) => i.number)).toEqual([42]);
  });

  it('reads from the real sources, or the ones a link names', () => {
    expect(sourcesFrom('')).toEqual({
      stats: 'https://relay.gardeninsound.website/stats/bearisland/island',
      traffic: 'https://relay.gardeninsound.website/traffic',
      github: 'https://api.github.com/repos/gardeninsound/map',
    });
    expect(sourcesFrom('?stats=/x.json&gh=/gh/').github).toBe('/gh');
  });
});

describe('the spots', () => {
  it("lists pins Mike hasn't confirmed and spots with no scene yet", () => {
    const t = spotsTodo([
      { id: 'a', name: 'A', approx: true, experience: 'wall' },
      { id: 'b', name: 'B', experience: null },
      { id: 'c', name: 'C', experience: 'cup' },
    ]);
    expect(t).toEqual({ unconfirmed: ['A'], comingSoon: ['B'] });
  });
});
