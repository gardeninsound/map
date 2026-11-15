import { FAR, FLEE, newBird, SPAWN, STARTLE, spotNear, stepBird } from './flock';
import { GULL_GRIDS } from './sprites';

let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** a beach along y 0..10 */
const beach = (_x: number, y: number) => y >= 0 && y <= 10;

describe('birds about the island', () => {
  it('turns up only where it suits it', () => {
    for (let i = 0; i < 50; i++) {
      const p = spotNear({ x: 0, y: 5 }, 3, 12, beach, rand);
      expect(p && beach(p.x, p.y)).toBe(true);
    }
    expect(spotNear({ x: 0, y: 500 }, 3, 12, beach, rand)).toBeNull();
  });

  it('takes off when you come close, lands a way off from you, where it suits it', () => {
    const b = newBird({ x: 10.5, y: 5.5 }, rand);
    const you = { x: 10.5 - STARTLE + 0.5, y: 5.5 };
    expect(stepBird(b, 0.1, you, beach, rand)).toBe('flew');
    const to = b.flight!.to;
    expect(beach(to.x, to.y)).toBe(true);
    const dist = Math.hypot(to.x - 10.5, to.y - 5.5);
    expect(dist).toBeGreaterThanOrEqual(FLEE[0] - 1);
    // further from you than it was
    expect(Math.hypot(to.x - you.x, to.y - you.y)).toBeGreaterThan(STARTLE);
    for (let i = 0; i < 100 && b.flight; i++) stepBird(b, 0.1, you, beach, rand);
    expect(b.flight).toBeNull();
    expect(b.pos).toEqual(to);
  });

  it('left far behind, turns up again near you', () => {
    const b = newBird({ x: 0.5, y: 5.5 }, rand);
    const you = { x: FAR + 20, y: 5 };
    expect(stepBird(b, 0.1, you, beach, rand)).toBe('moved');
    const d = Math.hypot(b.pos.x - you.x, b.pos.y - you.y);
    expect(d).toBeGreaterThanOrEqual(SPAWN[0] - 1);
    expect(d).toBeLessThanOrEqual(SPAWN[1] + 1);
  });

  it.each(Object.entries(GULL_GRIDS))('the gull %s is 16×16', (_, g) => {
    expect(g).toHaveLength(16);
    for (const row of g) expect(row).toHaveLength(16);
  });
});
