import { describe, expect, it } from 'vitest';
import { BIKE_GRIDS, SPRITE_GRIDS } from './sprites';

describe('sprite grids', () => {
  it.each(Object.entries(SPRITE_GRIDS))('%s is a 16×16 rectangle', (_, grid) => {
    expect(grid).toHaveLength(16);
    for (const row of grid) expect(row).toHaveLength(16);
  });
});

describe('bicycle grids', () => {
  it.each(Object.entries(BIKE_GRIDS))('%s is a rectangle (20×18 side on, 16×20 head on)', (name, grid) => {
    expect(grid).toHaveLength(name.includes('RIGHT') ? 18 : 20);
    for (const row of grid) expect(row).toHaveLength(name.includes('RIGHT') ? 20 : 16);
  });
});
