import { createWorld } from '../city';
import { BETWEEN, DINO_SPEED, EAST, eastWestSpot, FAR, FIRST, isEastWestName, ROWS, sightingSpot, stepDino, waitFor, type Dino } from './dinos';

const world = createWorld();
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const junction = world.project(47.5612, -122.3868);

describe('dinosaurs on the east–west streets', () => {
  it('knows the east–west streets by name', () => {
    expect(isEastWestName('SW Alaska St')).toBe(true);
    expect(isEastWestName('SW 98th St')).toBe(true);
    expect(isEastWestName('California Ave SW')).toBe(false);
    expect(isEastWestName(null)).toBe(false);
  });

  it('turns up just off the east edge of the screen, on an east–west street in view', () => {
    for (let i = 0; i < 20; i++) {
      const p = sightingSpot(world, junction, rand)!;
      expect(p).not.toBeNull();
      expect(world.isWalkable(p.x, p.y)).toBe(true);
      expect(world.streetAt(p.x, p.y)).toMatch(/\bSt\b/);
      expect(world.isWalkable(p.x - 4, p.y)).toBe(true);
      expect(p.x - junction.x).toBeGreaterThanOrEqual(EAST.min);
      expect(p.x - junction.x).toBeLessThanOrEqual(EAST.max + 1);
      expect(Math.abs(p.y - junction.y)).toBeLessThanOrEqual(ROWS + 1);
    }
  });

  it('is a sighting now and then: a minute or so in, then minutes apart', () => {
    for (let i = 0; i < 50; i++) {
      const first = waitFor(FIRST, rand);
      const next = waitFor(BETWEEN, rand);
      expect(first).toBeGreaterThanOrEqual(30);
      expect(first).toBeLessThanOrEqual(90);
      expect(next).toBeGreaterThanOrEqual(120);
      expect(next).toBeLessThanOrEqual(300);
    }
  });

  it('finds no street out in the water', () => {
    expect(sightingSpot(world, { x: 2, y: 2 }, rand)).toBeNull();
  });

  it('is never on an avenue', () => {
    // the middle of California Ave, north of the Junction
    const ave = world.project(47.5655, -122.3866);
    expect(eastWestSpot(world, ave.x, ave.y)).toBeNull();
  });

  it('walks west across the screen, then is gone when the street ends or it is far behind', () => {
    for (let n = 0; n < 10; n++) {
      const d: Dino = { pos: sightingSpot(world, junction, rand)!, phase: 0 };
      let steps = 0;
      for (;;) {
        const was = { ...d.pos };
        if (!stepDino(d, 0.1, world, junction)) break;
        steps++;
        expect(d.pos.x).toBeCloseTo(was.x - DINO_SPEED * 0.1);
        expect(d.pos.y).toBe(was.y);
        expect(world.isWalkable(d.pos.x, d.pos.y)).toBe(true);
        expect(Math.hypot(d.pos.x - junction.x, d.pos.y - junction.y)).toBeLessThanOrEqual(FAR + 1);
        expect(steps).toBeLessThan(1000); // FAR + EAST tiles at most
      }
    }
  });
});
