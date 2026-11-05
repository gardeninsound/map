import { describe, expect, it } from 'vitest';
import { hasLandmarkSprite } from '../render/landmarks';
import landmarkRows from './landmarksData.json';
import { createWorld, isWalkableTile, Tile } from './world';

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

  it('walks the alley behind 1918 45th Ave SW (ALLEYS in map-config), beside its hidden house', () => {
    for (const lat of [47.5857, 47.5861, 47.5865]) {
      const p = world.project(lat, -122.38836);
      const r = world.nearestWalkable(p.x, p.y);
      expect(Math.hypot(r.x - p.x, r.y - p.y), `${lat}`).toBeLessThan(1);
      expect(world.streetAt(r.x, r.y)).toBe('Alley');
    }
    expect(world.landmarks.find((l) => l.id === 'craftsman-45th')?.name).toBe('');
  });

  it('has one connected walkable network (streets, paths, parking lots)', () => {
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
        if (j >= 0 && j < world.tiles.length && !seen[j] && isWalkableTile(world.tiles[j])) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    expect(reached).toBe(world.tiles.filter((t) => isWalkableTile(t)).length);
  });
});

describe('detailed places', () => {
  it('Hiawatha has its fields and walkable footpaths joined to the streets', () => {
    expect(world.parkFeatures.some((f) => f.s.includes('tennis'))).toBe(true);
    expect(world.parkFeatures.some((f) => f.k === 'track')).toBe(true);
    const paths = world.roadLines.filter((l) => l.k === 1);
    expect(paths.length).toBeGreaterThan(10);
    for (const l of paths) {
      const [x, y] = l.p[Math.floor(l.p.length / 2)];
      expect(world.isWalkable(x, y)).toBe(true);
    }
  });

  it('West Seattle High School is drawn from its outline, with a walkable parking lot', () => {
    expect(world.drawnBuildings.some((b) => b.k === 'civic' && b.rings.length > b.n)).toBe(true); // courtyards
    expect(world.parkingLots.length).toBeGreaterThan(0);
    expect(world.tiles.some((t) => t === Tile.Parking)).toBe(true);
  });
});
