import { describe, expect, it } from 'vitest';
import { HEART, HEART_BEAT, SPIN_BASE, SPIN_FRAMES, lemonFrame, lemonSpin } from './lemonSpin';
import { LEMON_RIPE } from './lemon';

const width = (frame: string[]) => {
  const cols = frame.flatMap((row) => [...row].map((ch, x) => (/[kdmlh]/.test(ch) ? x : -1))).filter((x) => x >= 0);
  return Math.max(...cols) - Math.min(...cols) + 1;
};

describe('spinning lemon', () => {
  const frames = lemonSpin();

  it('has a full turn of same-sized frames, drawn only in the lemon palette', () => {
    expect(frames).toHaveLength(SPIN_FRAMES);
    for (const f of frames) {
      for (const row of f) expect(row).toHaveLength(f[0].length);
      for (const ch of f.join('')) expect(ch === '.' || ch in LEMON_RIPE).toBe(true);
    }
  });

  it('sits on its base row in every frame, with only shadow below', () => {
    for (const f of frames) {
      expect(f[SPIN_BASE]).toMatch(/k/);
      expect(f.slice(SPIN_BASE + 1).join('')).not.toMatch(/[kdmlh]/);
    }
  });

  it('is long side-on and round end-on', () => {
    expect(width(lemonFrame(0))).toBeGreaterThan(width(lemonFrame(Math.PI / 2)) + 4);
    expect(width(lemonFrame(Math.PI))).toBe(width(lemonFrame(0)));
  });

  it('has hearts that are rectangles', () => {
    for (const g of [HEART, HEART_BEAT]) for (const row of g) expect(row).toHaveLength(g[0].length);
  });
});
