import { createWorld, Tile } from '../city';
import { MAZE_CELLS, MAZE_NW, MAZE_SEED } from '../content/forestMaze';
import { makeMaze, stepsToMiddle } from './maze';

describe('the forest maze', () => {
  const m = makeMaze(MAZE_CELLS, MAZE_SEED);

  it('is the same maze every time', () => {
    expect(makeMaze(MAZE_CELLS, MAZE_SEED).open).toEqual(m.open);
  });

  it('has a way from the door to the middle, and it is a proper walk', () => {
    expect(stepsToMiddle(m)).toBeGreaterThan(MAZE_CELLS * 2);
  });

  it('every room can be reached', () => {
    // a perfect maze: open tiles = rooms + passages between them (cells² + cells² − 1) + clearing + door
    let rooms = 0;
    for (let y = 1; y < m.size; y += 2) for (let x = 1; x < m.size; x += 2) rooms += m.open[x + y * m.size]!;
    expect(rooms).toBe(MAZE_CELLS * MAZE_CELLS);
  });

  it('walls all round, but for the door', () => {
    for (let i = 0; i < m.size; i++) {
      expect(m.open[i]).toBe(0);
      expect(m.open[i + (m.size - 1) * m.size]).toBe(0);
      expect(m.open[m.size - 1 + i * m.size]).toBe(0);
      expect(m.open[i * m.size]).toBe(i === m.door ? 1 : 0);
    }
  });

  it('fits in Schmitz Preserve, all forest, with a street to walk in from on the west', () => {
    const w = createWorld();
    const nw = w.project(MAZE_NW.lat, MAZE_NW.lon);
    const x0 = Math.round(nw.x), y0 = Math.round(nw.y);
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) expect(w.tileAt(x0 + x, y0 + y)).toBe(Tile.Park);
    let street = false;
    for (let x = x0 - 1; x > x0 - 8 && !street; x--) street = w.isWalkable(x + 0.5, y0 + m.door + 0.5);
    expect(street).toBe(true);
  });
});
