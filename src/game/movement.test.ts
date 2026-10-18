import { describe, expect, it } from 'vitest';
import { facingFor, fits, step } from './movement';

/** Build a walkable predicate from an ASCII grid ('#' = road). */
function grid(rows: string[]) {
  return (x: number, y: number) => rows[Math.floor(y)]?.[Math.floor(x)] === '#';
}

describe('step', () => {
  const road = grid([
    '.....',
    '#####',
    '#####',
    '.....',
  ]);

  it('moves freely along open road', () => {
    const p = step({ x: 1.5, y: 2 }, { x: 1, y: 0 }, 0.1, 3, road);
    expect(p.x).toBeCloseTo(1.8);
    expect(p.y).toBe(2);
  });

  it('slides along the curb when pushing diagonally into it', () => {
    const p = step({ x: 1.5, y: 1.3 }, { x: 1, y: -1 }, 0.1, 3, road);
    expect(p.x).toBeGreaterThan(1.5);
    expect(p.y).toBeCloseTo(1.3);
  });

  it('stops at a dead end', () => {
    const p = step({ x: 4.7, y: 2 }, { x: 1, y: 0 }, 0.1, 3, road);
    expect(p).toEqual({ x: 4.7, y: 2 });
  });

  it('caps a single step so a long frame cannot tunnel through walls', () => {
    const thin = grid(['#.#']);
    const p = step({ x: 0.5, y: 0.5 }, { x: 1, y: 0 }, 1, 10, thin);
    expect(fits(p.x, p.y, thin)).toBe(true);
    expect(p.x).toBeLessThan(1);
  });

  it('sidesteps around a staircase corner on a diagonal street', () => {
    // A 2-wide diagonal street drawn as stairs.
    const stairs = grid([
      '##....',
      '###...',
      '.###..',
      '..###.',
      '...###',
    ]);
    let p = { x: 0.9, y: 0.6 };
    for (let i = 0; i < 40; i++) p = step(p, { x: 1, y: 0 }, 0.05, 4, stairs);
    expect(p.x).toBeGreaterThan(2.5); // made real progress down-right
    expect(fits(p.x, p.y, stairs)).toBe(true);
  });

  it('does nothing without input', () => {
    const p = { x: 1.5, y: 1.5 };
    expect(step(p, { x: 0, y: 0 }, 0.1, 3, road)).toBe(p);
  });
});

describe('facingFor', () => {
  it('follows the dominant axis and keeps facing when idle', () => {
    expect(facingFor({ x: 1, y: 0.2 }, 'up')).toBe('right');
    expect(facingFor({ x: 0, y: -1 }, 'left')).toBe('up');
    expect(facingFor({ x: 0, y: 0 }, 'left')).toBe('left');
  });
});
