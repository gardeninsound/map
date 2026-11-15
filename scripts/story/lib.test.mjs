// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
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
  prOfDir,
  prOfSubject,
  previewUrl,
  renderChronicle,
  renderIndex,
  summaryOf,
  updateWish,
} from './lib.mjs';

const TEMPLATE_FILLED = `Five pastel ponies graze in Lincoln Park.

## Story
<!-- one line each; leave a key blank if it doesn't apply -->
Idea: #36
Where: 47.5310, -122.3960 — the meadow
Asked vs made: They asked for My Little Pony G1;
those are someone else's, so these are our own herd.
**Mike:** I always wanted horses in that meadow.
Shots: yes

## Checks
- npm test

Closes #36

🤖 Generated with [Claude Code](https://claude.com/claude-code)`;

describe('parseStory', () => {
  it('reads every field, with run-on lines, and ignores the template hints', () => {
    const s = parseStory(TEMPLATE_FILLED);
    expect(s.present).toBe(true);
    expect(s.ideas).toEqual([36]);
    expect(s.where).toEqual([{ query: 'at=47.5310,-122.3960', lat: 47.531, lon: -122.396, label: 'the meadow' }]);
    expect(s.askedVsMade).toBe("They asked for My Little Pony G1;\nthose are someone else's, so these are our own herd.");
    expect(s.mike).toBe('I always wanted horses in that meadow.');
    expect(s.shots).toBe(true);
    expect(s.note).toBeNull();
  });

  it('is empty when there is no Story section, and keeps loose text as a note', () => {
    expect(parseStory('just a body').present).toBe(false);
    expect(parseStory(null).present).toBe(false);
    const s = parseStory('## Story\nThe wall got a new coat.\nWhere: none\nShots: no');
    expect(s.note).toBe('The wall got a new coat.');
    expect(s.where).toEqual([]);
    expect(s.shots).toBe(false);
  });

  it('takes several places, one per line or split by ;', () => {
    const s = parseStory('## Story\nWhere: arcade; title\n47.56, -122.38 (the Junction)');
    expect(s.where.map((w) => w.query)).toEqual(['at=arcade', 'title', 'at=47.56,-122.38']);
    expect(s.where[2].label).toBe('the Junction');
  });
});

describe('parseWhere', () => {
  it('knows the review hooks', () => {
    expect(parseWhere('arcade')).toEqual({ query: 'at=arcade', label: 'the Duck Arcade' });
    expect(parseWhere('tile 120, 340')).toEqual({ query: 'atTile=120,340', label: null });
    expect(parseWhere('none')).toBeNull();
    expect(parseWhere('somewhere nice')).toBeNull();
  });
});

describe('ideaRefs', () => {
  it('finds ideas in the title, closing keywords and the Story', () => {
    expect(ideaRefs("Pick your rabbit's look (idea box #38, #34)", 'Closes #38')).toEqual([34, 38]);
    expect(ideaRefs('Crows (idea box #43, #40)', '')).toEqual([40, 43]);
    expect(ideaRefs('x', TEMPLATE_FILLED)).toEqual([36]);
    expect(ideaRefs('Fix the dinos (#53)', 'see #12 for context')).toEqual([]);
  });
});

describe('parseWish', () => {
  it('reads back what the idea box wrote', () => {
    const w = parseWish("> add my little ponys (g1)\n\n---\n<sub>Sent from the map's idea box · the rabbit was on 47th Ave SW.</sub>");
    expect(w).toEqual({ text: 'add my little ponys (g1)', name: null, street: '47th Ave SW', preview: null, fromIdeaBox: true });
    const n = parseWish("> line one\n>\n> line @​three\n\n---\n<sub>Sent from the map's idea box on the pr-21 preview by **Sam from Delridge**.</sub>");
    expect(n.text).toBe('line one\n\nline @three');
    expect(n.name).toBe('Sam from Delridge');
    expect(n.preview).toBe('pr-21');
  });
});

describe('makers', () => {
  it('names co-authors and the tools that left a mark', () => {
    const m = makers('🤖 Generated with [Claude Code](https://claude.com/claude-code)', [
      { message: 'Ponies\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>' },
      { message: 'aider: add a crow stop', author: 'Mike (aider)' },
    ]);
    expect(m.coauthors).toEqual(['Claude Opus 5.5']);
    expect(m.tools.sort()).toEqual(['Aider', 'Claude Code']);
  });
});

describe('areasOf / coordsFromPatches / dirs', () => {
  it('sorts paths into areas, once each, in a stable order', () => {
    expect(areasOf(['src/content/ponies.ts', 'src/game/plugins/ponies.ts', 'src/App.tsx', 'src/game/ponies.ts'])).toEqual([
      'characters & map life',
      'words & content',
    ]);
    expect(areasOf(['.github/workflows/story.yml', 'src/city/CLAUDE.md'])).toEqual(['city', 'ci']);
  });

  it('finds added West Seattle coordinates in a diff', () => {
    const patch = ['@@', '-  lat: 47.5000, lon: -122.3000,', '+  center: { lat: 47.53102, lon: -122.39601 },', '+  [47.53102, -122.39601],', '+hope,Hope Lutheran,,4456 42nd Ave SW,47.5640,-122.3840,'].join('\n');
    expect(coordsFromPatches([patch]).map((w) => w.query)).toEqual(['at=47.53102,-122.39601', 'at=47.5640,-122.3840']);
  });

  it('names change folders by date and PR, and reads the PR back', () => {
    const d = changeDir({ pr: 64, sha: 'abc1234def', at: '2026-11-15T00:24:24Z', title: "Pastel ponies in Lincoln Park's meadow (idea box #36)" });
    expect(d).toBe('changes/2026-11-14-pr064-pastel-ponies-in-lincoln-parks-meadow');
    expect(prOfDir(d)).toBe(64);
    const early = changeDir({ pr: null, sha: '8066597aaaa', at: '2026-10-18T10:00:00Z', title: 'Bear Island map: pixel West Seattle overworld' });
    expect(early).toBe('changes/2026-10-18-8066597-bear-island-map-pixel-west-seattle-overw');
    expect(prOfDir(early)).toBeNull();
    expect(prOfSubject("Pick your rabbit's look (idea box #38, #34) (#67)")).toBe(67);
    expect(prOfSubject('Wider, straighter roads')).toBeNull();
  });

  it('summarises a PR body without the footers', () => {
    expect(summaryOf(TEMPLATE_FILLED)).toBe('Five pastel ponies graze in Lincoln Park.');
    expect(summaryOf('Closes #3\n\n🤖 Generated with [Claude Code](x)')).toBeNull();
  });

  it("reads a build's base from its vite config, not from a comment", () => {
    expect(baseOf("  // set base: '/map/' — every asset URL…\n  base: '/',\n")).toBe('/');
    expect(baseOf("export default { base: '/bearisland-map/' }".replace('{ ', '{\n  '))).toBe('/bearisland-map/');
    expect(baseOf('')).toBe('/');
  });

  it('finds the preview link', () => {
    expect(previewUrl([{ body: 'nice' }, { body: '**Preview:** https://pr-64-garden-preview.x.workers.dev\n\nUpdated' }])).toBe('https://pr-64-garden-preview.x.workers.dev');
  });
});

const issue = (over = {}) => ({
  number: 36,
  html_url: 'https://github.com/o/r/issues/36',
  title: 'Idea: add my little ponys (g1)',
  body: "> add my little ponys (g1)\n\n---\n<sub>Sent from the map's idea box · the rabbit was on 47th Ave SW.</sub>",
  state: 'open',
  state_reason: null,
  created_at: '2026-11-05T04:44:46Z',
  closed_at: null,
  labels: [{ name: 'suggestion' }],
  ...over,
});

describe('wishes', () => {
  it('keeps the words as first sent, and appends each change of state', () => {
    const a = updateWish(null, issue(), [], '2026-11-05T05:00:00Z');
    expect(a.original.text).toBe('add my little ponys (g1)');
    expect(a.history).toEqual([{ at: '2026-11-05T04:44:46Z', state: 'open' }]);
    const b = updateWish(a, issue({ body: '> edited', state: 'closed', state_reason: 'completed', closed_at: '2026-11-15T00:24:26Z' }), [{ created_at: 'x', user: { login: 'exit320-stack' }, body: 'Done!' }], 'later');
    expect(b.original.text).toBe('add my little ponys (g1)');
    expect(b.current.text).toBe('edited');
    expect(b.history.at(-1)).toEqual({ at: '2026-11-15T00:24:26Z', state: 'closed:completed' });
    expect(b.comments).toEqual([{ at: 'x', by: 'exit320-stack', body: 'Done!' }]);
    expect(updateWish(b, issue({ body: '> edited', state: 'closed', state_reason: 'completed', closed_at: '2026-11-15T00:24:26Z' }), [], 'again').history).toHaveLength(2);
  });

  it('leaves out preview and test ideas', () => {
    expect(isRealWish(issue())).toBe(true);
    expect(isRealWish(issue({ title: '[preview pr-21] Idea: testing' }))).toBe(false);
    expect(isRealWish(issue({ title: 'Idea: TEST: checking ideas now come' }))).toBe(false);
    expect(isRealWish(issue({ labels: [] }))).toBe(false);
  });
});

describe('chronicle', () => {
  const dir = 'changes/2026-11-14-pr064-ponies';
  const entry = {
    pr: 64,
    sha: 'abc1234',
    title: "Pastel ponies in Lincoln Park's meadow",
    url: 'https://github.com/o/r/pull/64',
    merged_at: '2026-11-15T00:24:24Z',
    authors: [{ login: 'exit320-stack' }],
    made_with: { tools: ['Claude Code'] },
    files: [{}, {}],
    additions: 274,
    deletions: 2,
    areas: ['characters & map life'],
    ideas: [{ issue: 36, url: 'u', text: 'add my little ponys (g1)', street: '47th Ave SW', asked_at: '2026-11-05T04:44:46Z' }],
    story: parseStory(TEMPLATE_FILLED),
    shots: [{ query: 'at=47.53,-122.39', label: 'the meadow', before: 'before-1.webp', after: 'after-1.webp', moving: 'moving-1.webp' }],
  };
  const wishes = [updateWish(null, issue({ number: 50, title: 'Idea: a ferry' , body: '> a ferry\n\n---\n<sub>idea box</sub>'}), [], 'now')];

  it('tells each change with its wish, words and pictures, and lists the waiting wishes', () => {
    const md = renderChronicle([{ dir, entry }], wishes, 'o/r');
    expect(md).toContain('### Nov 14, 2026 · Pastel ponies');
    expect(md).toContain('> add my little ponys (g1)');
    expect(md).toContain('on 47th Ave SW');
    expect(md).toContain('live 10 days later');
    expect(md).toContain('**Mike:** I always wanted horses');
    expect(md).toContain(`<img src="${dir}/before-1.webp"`);
    expect(md).toContain('exit320-stack with Claude Code');
    expect(md).toContain('## Wishes still waiting');
    expect(md).toContain('“a ferry”');
  });

  it('indexes changes oldest first with everything the page shows', () => {
    const idx = renderIndex([{ dir, entry }], wishes);
    const c = idx.changes[0];
    expect(c.title).toBe("Pastel ponies in Lincoln Park's meadow");
    expect(c.shots[0]).toMatchObject({ before: `${dir}/before-1.webp`, after: `${dir}/after-1.webp`, moving: `${dir}/moving-1.webp`, label: 'the meadow' });
    expect(c.ideas[0]).toMatchObject({ issue: 36, text: 'add my little ponys (g1)', street: '47th Ave SW' });
    expect(c.story.mike).toBe('I always wanted horses in that meadow.');
    expect(c.authors).toEqual(['exit320-stack']);
    expect(c.files).toBe(2);
    expect(idx.wishes[0].text).toBe('a ferry');
  });
});
