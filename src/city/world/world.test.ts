import { describe, expect, it } from 'vitest';
import { hasLandmarkSprite } from '../render/landmarks';
import landmarkRows from './landmarksData.json';
import { createWorld, Tile } from './world';

const world = createWorld();

describe('world', () => {
  it('puts the Junction on California Ave', () => {
    const p = world.project(47.5612, -122.3868);
    const r = world.nearestWalkable(p.x, p.y);
    expect(world.streetAt(r.x, r.y)).toMatch(/California|Alaska/);
  });

  it('every landmark row has a drawing and found a place on the map', () => {
    for (const row of landmarkRows) {
      expect(hasLandmarkSprite(row.sprite), row.sprite).toBe(true);
      expect(world.landmarks.some((l) => l.id === row.id), row.id).toBe(true);
    }
  });

  it('has one connected street network', () => {
    const seen = new Uint8Array(world.tiles.length);
    const start = world.tiles.indexOf(Tile.Road);
    const stack = [start];
    seen[start] = 1;
    let reached = 0;
    while (stack.length) {
      const i = stack.pop()!;
      reached++;
      const x = i % world.w;
      for (const j of [x > 0 ? i - 1 : -1, x < world.w - 1 ? i + 1 : -1, i - world.w, i + world.w]) {
        if (j >= 0 && j < world.tiles.length && !seen[j] && world.tiles[j] === Tile.Road) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    expect(reached).toBe(world.tiles.filter((t) => t === Tile.Road).length);
  });
});
