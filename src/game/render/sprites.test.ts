import { describe, expect, it } from 'vitest';
import { SPRITE_GRIDS } from './sprites';

describe('sprite grids', () => {
  it.each(Object.entries(SPRITE_GRIDS))('%s is a 16×16 rectangle', (_, grid) => {
    expect(grid).toHaveLength(16);
    for (const row of grid) expect(row).toHaveLength(16);
  });
});
