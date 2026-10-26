import { describe, expect, it } from 'vitest';
import { midrib, progress, type Frond } from './fern';

const up: Frond = { angle: -Math.PI / 2 - 0.3, length: 90, delay: 1 };
const tip = (u: number) => midrib(up, u).at(-1)!;

describe('sword fern fronds', () => {
  it('a rolled-up frond is a fiddlehead near the crown; an open one reaches up', () => {
    expect(-tip(0).y).toBeLessThan(up.length * 0.4);
    expect(-tip(1).y).toBeGreaterThan(up.length * 0.6);
  });

  it('unrolling lifts the tip steadily', () => {
    const heights = [0, 0.2, 0.4, 0.6].map((u) => -tip(u).y);
    heights.slice(1).forEach((h, i) => expect(h).toBeGreaterThan(heights[i]));
  });

  it('the coil is marked closed, the open part open', () => {
    const half = midrib(up, 0.5);
    expect(half[0].open).toBe(1);
    expect(half.at(-1)!.open).toBe(0);
  });

  it('nothing happens before its delay, and it finishes open', () => {
    expect(progress(up, 0)).toEqual({ e: 0, u: 0 });
    expect(progress(up, 60)).toEqual({ e: 1, u: 1 });
  });
});
