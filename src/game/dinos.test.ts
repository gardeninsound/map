import { createWorld } from '../city';
import { DINO_SPEED, eastWestSpot, FAR, HEAR, HEAR_GAP, hearDino, isEastWestName, spawnSpot, stepDino, type Dino } from './dinos';

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

  it('turns up on an east–west street with road to walk west along', () => {
    for (let i = 0; i < 20; i++) {
      const p = spawnSpot(world, junction, rand)!;
      expect(p).not.toBeNull();
      expect(world.isWalkable(p.x, p.y)).toBe(true);
      expect(world.streetAt(p.x, p.y)).toMatch(/\bSt\b/);
      expect(world.isWalkable(p.x - 4, p.y)).toBe(true);
    }
  });

  it('is never on an avenue', () => {
    // the middle of California Ave, north of the Junction
    const ave = world.project(47.5655, -122.3866);
    expect(eastWestSpot(world, ave.x, ave.y)).toBeNull();
  });

  it('is heard once as it goes by you, and not two at once', () => {
    const you = { x: 100, y: 100 };
    const a: Dino = { pos: { x: 100 + HEAR + 2, y: 100 }, phase: 0 };
    expect(hearDino(a, you, Infinity)).toBe(false); // still too far
    a.pos.x = 100 + HEAR - 1;
    expect(hearDino(a, you, Infinity)).toBe(true);
    a.pos.x = 100;
    expect(hearDino(a, you, Infinity)).toBe(false); // once per pass
    const b: Dino = { pos: { x: 101, y: 100 }, phase: 0 };
    expect(hearDino(b, you, 1)).toBe(false); // another just played
    expect(hearDino(b, you, HEAR_GAP)).toBe(true);
  });

  it('can be heard again after it turns up somewhere new', () => {
    const d: Dino = { pos: { x: 5, y: 5 }, phase: 0, heard: true };
    // far from you: it moves on, and is new again
    stepDino(d, 0.1, world, junction, rand);
    expect(d.heard).toBe(false);
  });

  it('always walks west, and starts over near you when the street ends', () => {
    const p = spawnSpot(world, junction, rand)!;
    const d: Dino = { pos: p, phase: 0 };
    let moved = 0;
    for (let i = 0; i < 2000; i++) {
      const was = { ...d.pos };
      const jumped = stepDino(d, 0.1, world, junction, rand);
      if (jumped) {
        moved++;
        expect(Math.hypot(d.pos.x - junction.x, d.pos.y - junction.y)).toBeLessThan(FAR);
        continue;
      }
      expect(d.pos.x).toBeCloseTo(was.x - DINO_SPEED * 0.1);
      expect(d.pos.y).toBe(was.y);
      expect(world.isWalkable(d.pos.x, d.pos.y)).toBe(true);
    }
    expect(moved).toBeGreaterThan(0); // 320 tiles of walking: some street ran out
  });
});
