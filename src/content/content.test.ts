import { describe, expect, it } from 'vitest';
import { createWorld, markerSpot } from '../city';
import { START, locations } from './locations';
import { artManifest } from './artManifest';
import { experiences } from '../experiences/registry';
import { chooseTurns, slideshows, wallTurns } from './wallTurns';
import { crossedMilestone } from '../experiences/WallTurns';

const world = createWorld();

describe('locations', () => {
  it('have unique ids', () => {
    expect(new Set(locations.map((l) => l.id)).size).toBe(locations.length);
  });

  it.each(locations.map((l) => [l.id, l] as const))('%s has art and sits near the street network', (_, loc) => {
    expect(artManifest[loc.set]?.length).toBeGreaterThan(0);
    const p = world.project(loc.lat, loc.lon);
    const r = world.nearestWalkable(p.x, p.y);
    expect(world.isWalkable(r.x, r.y)).toBe(true);
    expect(Math.hypot(r.x - p.x, r.y - p.y) * world.tileMeters).toBeLessThan(150);
  });

  it('point experiences at registered scenes', () => {
    for (const l of locations) if (l.experience) expect(experiences[l.experience]).toBeDefined();
  });

  it.each(locations.map((l) => [l.id, l] as const))('%s: its lemon can be reached from the street', (_, loc) => {
    // the lemon stands beside the street; somewhere walkable must be within the 1.9-tile reach
    const m = markerSpot(world, world.project(loc.lat, loc.lon));
    expect(world.isWalkable(m.x, m.y)).toBe(false); // not blocking the street
    let closest = Infinity;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tx = Math.floor(m.x) + dx, ty = Math.floor(m.y) + dy;
        if (!world.isWalkable(tx + 0.5, ty + 0.5)) continue;
        // nearest point of that walkable tile to the lemon
        const px = Math.max(tx, Math.min(tx + 1, m.x)), py = Math.max(ty, Math.min(ty + 1, m.y));
        closest = Math.min(closest, Math.hypot(px - m.x, py - m.y));
      }
    }
    expect(closest).toBeLessThan(1.6);
  });

  it('start in the Junction, on California Ave', () => {
    const p = world.project(START.lat, START.lon);
    const r = world.nearestWalkable(p.x, p.y);
    expect(world.streetAt(r.x, r.y)).toMatch(/California|Alaska/);
  });
});

describe('crossedMilestone', () => {
  const marks = wallTurns.milestones;
  it('fires once when stepping past a mark, never going backwards', () => {
    // 94 frames: 10% → index 9
    expect(crossedMilestone(8, 9, 94, marks)).toBe(0);
    expect(crossedMilestone(9, 10, 94, marks)).toBe(-1);
    expect(crossedMilestone(10, 9, 94, marks)).toBe(-1);
    expect(crossedMilestone(92, 93, 94, marks)).toBe(marks.length - 1);
  });
});

describe('chooseTurns', () => {
  const wall = artManifest['bus-wall'];
  it('keeps the slideshow to stills, evenly spread, first to last', () => {
    const picked = chooseTurns(wall, wallTurns.maxPhotos);
    const stills = wall.filter((a) => a.kind === 'image');
    expect(picked).toHaveLength(wallTurns.maxPhotos);
    expect(picked.every((a) => a.kind === 'image')).toBe(true);
    expect(new Set(picked.map((a) => a.id)).size).toBe(picked.length);
    expect(picked[0]).toBe(stills[0]);
    expect(picked.at(-1)).toBe(stills.at(-1));
  });
  it('uses hand picks when given', () => {
    expect(chooseTurns(wall, 24, [wall[3].id, wall[1].id]).map((a) => a.id)).toEqual([wall[3].id, wall[1].id]);
  });
});

describe('slideshows', () => {
  it('every slideshow spot has a script and enough stills', () => {
    for (const l of locations.filter((x) => x.experience && x.experience in slideshows)) {
      const script = slideshows[l.experience!];
      expect(chooseTurns(artManifest[l.set], script.maxPhotos, script.picks).length, l.id).toBeGreaterThan(10);
    }
  });
});
