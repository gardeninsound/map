import { CALM, FAR, forageSpot, nearestTree, newSquirrel, SCARE, stepSquirrel, type Ground } from './squirrels';
import { SQUIRREL_GRIDS } from './squirrelSprites';

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** ground everywhere; a tree on every tile where x is a multiple of 6 */
const g: Ground = { ground: () => true, tree: (tx) => tx % 6 === 0 };
const run = (s: ReturnType<typeof newSquirrel>, secs: number, people: { x: number; y: number }[], you = s.pos) => {
  for (let t = 0; t < secs; t += 0.05) stepSquirrel(s, 0.05, people, you, g, rand);
};

describe('squirrels', () => {
  it('forage near a tree', () => {
    const p = forageSpot({ x: 30, y: 30 }, 3, 10, g, rand)!;
    expect(nearestTree(p, g)).not.toBeNull();
  });

  it('dash up the nearest tree when a person comes close, and hide there', () => {
    const s = newSquirrel({ x: 3.5, y: 4.5 });
    run(s, 2, [{ x: 3.5 + SCARE - 1, y: 4.5 }]);
    expect(s.mode).toBe('hiding');
    expect(Math.floor(s.pos.x) % 6).toBe(0);
  });

  it("don't mind rabbits", () => {
    const s = newSquirrel({ x: 3.5, y: 4.5 });
    run(s, 2, [], { x: 3.6, y: 4.5 });
    expect(s.mode).toBe('forage');
  });

  it('come back down once the coast is clear, not before', () => {
    const s = newSquirrel({ x: 3.5, y: 4.5 });
    const person = { x: 4.5, y: 4.5 };
    run(s, 2, [person]);
    run(s, CALM + 2, [person]);
    expect(s.mode).toBe('hiding');
    run(s, CALM + 2, []);
    expect(s.mode).toBe('forage');
    // back home, scampering about it
    expect(Math.hypot(s.pos.x - s.home.x, s.pos.y - s.home.y)).toBeLessThan(1.5);
  });

  it('left far behind, turn up near you', () => {
    const s = newSquirrel({ x: 3.5, y: 4.5 });
    const you = { x: 3.5 + FAR + 10, y: 4.5 };
    run(s, 0.1, [], you);
    expect(Math.hypot(s.pos.x - you.x, s.pos.y - you.y)).toBeLessThan(23);
  });

  it.each(Object.entries(SQUIRREL_GRIDS))('the %s sprite is 16×16', (_, grid) => {
    expect(grid).toHaveLength(16);
    for (const row of grid) expect(row).toHaveLength(16);
  });
});
