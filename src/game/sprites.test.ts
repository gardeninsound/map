import { describe, expect, it } from 'vitest';
import { BEAR_GRIDS } from './sprites';

describe('bear island sprite grids', () => {
  it.each(Object.entries(BEAR_GRIDS))('%s is a 16×16 rectangle', (_, grid) => {
    expect(grid).toHaveLength(16);
    for (const row of grid) expect(row).toHaveLength(16);
  });
});
