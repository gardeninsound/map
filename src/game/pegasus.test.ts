import { createWorld, type CityGame } from '../city';
import { altitude, FLY_TIME, HELLO_TIME, HOME, newPegasus, NOTICE, pegasusTick, WALK_TIME, type PegasusState } from './pegasus';
import { Pegasus } from './plugins/pegasus';
import { PEGASUS_GRIDS } from './sprites';

describe('the pegasus on the map', () => {
  const world = createWorld();
  const peg = new Pegasus();
  peg.attach({ world } as CityGame);

  it('finds Pegasus Books and steps out onto a walkable sidewalk on California', () => {
    expect(peg.step).not.toBeNull();
    expect(world.isWalkable(peg.step!.x, peg.step!.y)).toBe(true);
    expect(world.streetAt(peg.step!.x, peg.step!.y)).toMatch(/California/);
    // the door is inside the shop, a short walk from the step
    expect(Math.hypot(peg.door!.x - peg.step!.x, peg.door!.y - peg.step!.y)).toBeLessThan(3);
  });
});

const door = { x: 10, y: 20 };
const step = { x: 12, y: 20 };

/** run the clock in small steps, collecting the phases it enters */
function run(s: PegasusState, seconds: number, player: { x: number; y: number }) {
  const seen: string[] = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const p = pegasusTick(s, 0.05, player, door, step);
    if (p) seen.push(p);
  }
  return seen;
}

describe('the bookshop pegasus', () => {
  it('stays inside until you come by', () => {
    const s = newPegasus(door);
    expect(run(s, 5, { x: step.x + NOTICE + 3, y: step.y })).toEqual([]);
    expect(s.phase).toBe('inside');
  });

  it('walks out, says hello, flies off, in that order', () => {
    const s = newPegasus(door);
    const near = { x: step.x + 2, y: step.y + 1 };
    expect(run(s, WALK_TIME + HELLO_TIME + FLY_TIME + 1, near)).toEqual(['out', 'hello', 'flying', 'gone']);
    expect(s.visits).toBe(1);
  });

  it('ends its walk on the doorstep, facing you', () => {
    const s = newPegasus(door);
    run(s, WALK_TIME + 0.2, { x: step.x - 3, y: step.y });
    expect(s.phase).toBe('hello');
    expect(s.pos).toEqual(step);
    expect(s.facing).toBe('left');
  });

  it('climbs as it flies, and is off the ground only in flight', () => {
    const s = newPegasus(door);
    const near = { x: step.x + 1, y: step.y };
    run(s, WALK_TIME + HELLO_TIME + 0.2, near);
    expect(s.phase).toBe('flying');
    const low = altitude(s);
    run(s, FLY_TIME / 2, near);
    expect(altitude(s)).toBeGreaterThan(low);
    run(s, FLY_TIME, near);
    expect(altitude(s)).toBe(0); // gone
  });

  it("is home again once you've wandered off, and comes out next time you pass", () => {
    const s = newPegasus(door);
    const near = { x: step.x + 1, y: step.y };
    run(s, WALK_TIME + HELLO_TIME + FLY_TIME + 1, near);
    expect(run(s, 3, near)).toEqual([]); // still gone while you hang about
    expect(run(s, 0.2, { x: step.x + HOME + 1, y: step.y })).toEqual(['inside']);
    expect(s.pos).toEqual(door);
    expect(run(s, 0.2, near)).toEqual(['out']);
  });
});

describe('pegasus sprites', () => {
  it.each(Object.entries(PEGASUS_GRIDS))('%s is a 24×20 rectangle of known colours', (_, grid) => {
    expect(grid).toHaveLength(20);
    for (const row of grid) {
      expect(row).toHaveLength(24);
      expect(row).toMatch(/^[.kwgmyohn]+$/);
    }
  });
});
