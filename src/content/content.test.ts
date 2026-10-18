import { describe, expect, it } from 'vitest';
import { createWorld } from '../world/world';
import { START, locations } from './locations';
import { artManifest } from './artManifest';
import { experiences } from '../experiences/registry';
import { chooseTurns, slideshows, wallTurns } from './wallTurns';
import { crossedMilestone } from '../experiences/WallTurns';
import { hasLandmarkSprite } from '../game/render/landmarks';
import landmarkRows from './landmarksData.json';

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

  it('start in the Junction, on California Ave', () => {
    const p = world.project(START.lat, START.lon);
    const r = world.nearestWalkable(p.x, p.y);
    expect(world.streetAt(r.x, r.y)).toMatch(/California|Alaska/);
  });
});

describe('landmarks', () => {
  it('every sheet row has a drawing and found a place on the map', () => {
    for (const row of landmarkRows) {
      expect(hasLandmarkSprite(row.sprite), row.sprite).toBe(true);
      expect(world.landmarks.some((l) => l.id === row.id), row.id).toBe(true);
    }
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
