import { describe, expect, it } from 'vitest';
import { BEAR_GRIDS } from './sprites';
import { LEMON, LEMON_BASE, LEMON_RIPE } from './lemon';

describe('lemon marker', () => {
  it('is a rectangle using only its palette, sitting on its base row', () => {
    for (const row of LEMON) expect(row).toHaveLength(LEMON[0].length);
    for (const ch of LEMON.join('')) expect(ch === '.' || ch in LEMON_RIPE).toBe(true);
    expect(LEMON[LEMON_BASE]).toMatch(/k/);
    expect(LEMON.slice(LEMON_BASE + 1).join('')).not.toMatch(/[dmlh]/);
  });
});

describe('bear island sprite grids', () => {
  it.each(Object.entries(BEAR_GRIDS))('%s is a 16×16 rectangle', (_, grid) => {
    expect(grid).toHaveLength(16);
    for (const row of grid) expect(row).toHaveLength(16);
  });
});
