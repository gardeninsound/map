import { describe, expect, it } from 'vitest';
import { SCARVES, SEND_INTERVAL, decode, easeVisitor, encode, newVisitor, scarfFor, shouldSend, type RabbitState } from './visitors';

const at = (x: number, y: number, more: Partial<RabbitState> = {}): RabbitState => ({ pos: { x, y }, facing: 'down', moving: false, away: false, ...more });

describe('visitors', () => {
  it('round-trips a rabbit through the wire, to 1/20 tile', () => {
    const s = at(101.234, 55.01, { facing: 'left', moving: true, away: true });
    const back = decode(JSON.parse(JSON.stringify(encode(s))));
    expect(back).toEqual({ pos: { x: 101.25, y: 55 }, facing: 'left', moving: true, away: true });
  });

  it('rejects malformed messages from the network', () => {
    for (const bad of [null, 'hi', [1, 2], ['x', 1, 0, 0, 0], [NaN, 1, 0, 0, 0], { x: 1 }]) expect(decode(bad)).toBeNull();
    expect(decode([1, 2, 99, 0, 0])?.facing).toBe('down');
  });

  it('sends only on change, positions at most every SEND_INTERVAL', () => {
    const still = encode(at(10, 10));
    expect(shouldSend(null, still, 0)).toBe(true);
    expect(shouldSend(still, still, 10)).toBe(false);
    const moved = encode(at(10.5, 10));
    expect(shouldSend(still, moved, SEND_INTERVAL / 2)).toBe(false);
    expect(shouldSend(still, moved, SEND_INTERVAL)).toBe(true);
    // stopping, turning or going into a scene goes out at once
    expect(shouldSend(encode(at(10, 10, { moving: true })), still, 0.01)).toBe(true);
    expect(shouldSend(still, encode(at(10, 10, { facing: 'up' })), 0.01)).toBe(true);
    expect(shouldSend(still, encode(at(10, 10, { away: true })), 0.01)).toBe(true);
  });

  it('glides toward new positions and snaps on a teleport', () => {
    const v = newVisitor('abc', at(0, 0));
    v.target = at(2, 0, { moving: true });
    easeVisitor(v, 1 / 60);
    expect(v.shown.x).toBeGreaterThan(0);
    expect(v.shown.x).toBeLessThan(2);
    for (let i = 0; i < 30; i++) easeVisitor(v, 1 / 60);
    expect(v.shown.x).toBeCloseTo(2, 1);
    expect(v.walkT).toBeGreaterThan(0);
    v.target = at(500, 300);
    easeVisitor(v, 1 / 60);
    expect(v.shown).toEqual({ x: 500, y: 300 });
    expect(v.walkT).toBe(0);
  });

  it('gives each player a stable scarf that is never the teal one', () => {
    expect(scarfFor('peer1')).toBe(scarfFor('peer1'));
    expect(SCARVES).not.toContain('#2ec4b6');
    const seen = new Set(Array.from({ length: 50 }, (_, i) => scarfFor(`p${i}`)));
    expect(seen.size).toBeGreaterThan(3);
  });
});
