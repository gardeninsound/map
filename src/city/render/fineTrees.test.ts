import { buildFineTrees, RES, TS } from './tileArt';

describe('the fine trees (half-size pixels)', () => {
  const trees = buildFineTrees();

  it('come in a few shapes, each the size of a tile at RES×', () => {
    expect(trees.length).toBeGreaterThan(1);
    for (const t of trees) expect(t.length).toBe((TS * RES) ** 2);
  });

  it('each has a canopy with an outline, a lit side and shade, a trunk and a shadow', () => {
    for (const t of trees) {
      const has = (c: number) => t.some((v) => v === c);
      for (const c of [0, 1, 2, 3, 4]) expect(has(c)).toBe(true);
    }
  });

  it('are not all the same shape', () => {
    expect(trees[0]!.join()).not.toBe(trees[1]!.join());
  });
});
