import { describe, expect, it } from 'vitest';
import { altitude, flyTick, newCrow, takeOff } from './crow';
import { crowGreeting, crowStops } from '../content/crow';
import worldData from '../world/worldData.json';

const perches = [{ x: 0, y: 0 }, { x: 90, y: 0 }, { x: 90, y: 40 }];

describe('snack crow', () => {
  it('flies to each perch in turn and lands there', () => {
    const c = newCrow(perches);
    takeOff(c, perches);
    expect(c.stop).toBe(1);
    expect(c.flight!.dur).toBeCloseTo(3);
    flyTick(c, 1.5);
    expect(c.pos.x).toBeCloseTo(45);
    expect(altitude(c.flight!)).toBe(1);
    flyTick(c, 2);
    expect(c.flight).toBeNull();
    expect(c.pos).toEqual({ x: 90, y: 0 });
  });

  it('wraps home and counts the lap', () => {
    const c = newCrow(perches);
    for (let i = 0; i < 3; i++) {
      takeOff(c, perches);
      flyTick(c, 99);
    }
    expect(c.stop).toBe(0);
    expect(c.lap).toBe(1);
    expect(c.pos).toEqual(perches[0]);
  });

  it('is on the ground at both ends of a flight', () => {
    const f = { from: perches[0], to: perches[1], t: 0, dur: 4 };
    expect(altitude(f)).toBe(0);
    expect(altitude({ ...f, t: 4 })).toBe(0);
  });

  it('perches at real storefronts', () => {
    for (const s of crowStops) expect(worldData.shops.some((shop) => s.shop.test(shop.name)), String(s.shop)).toBe(true);
  });

  it('always ends its greeting asking for snacks', () => {
    crowStops.forEach((_, i) => expect(crowGreeting(i, 0, 0).at(-1)).toMatch(/snacks\?/i));
    expect(crowGreeting(0, 1, 2).at(-1)).toMatch(/snacks\?/i);
    expect(crowGreeting(0, 1, 1)[1]).toContain('once');
  });
});
