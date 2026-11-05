import { describe, expect, it } from 'vitest';
import { EMOTES, SCARF_NAMES } from '../content/emotes';
import { MY_SCARF, PRESENCE, RateLimit, SCARVES, SEND_INTERVAL, decode, decodeEmote, easeVisitor, encode, newVisitor, presence, rabbitName, scarfFor, sendLimit, shouldSend, stackBubbles, type RabbitState } from './visitors';

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

  it('names every rabbit after its scarf and a place, the same for everyone', () => {
    expect(rabbitName('peer1')).toBe(rabbitName('peer1'));
    expect(rabbitName('peer1')).toMatch(new RegExp(`^${SCARF_NAMES[scarfFor('peer1')]} `));
    expect(rabbitName('me', MY_SCARF)).toMatch(/^Teal /);
    for (const c of SCARVES) expect(SCARF_NAMES[c]).toBeTruthy();
    const names = new Set(Array.from({ length: 200 }, (_, i) => rabbitName(`p${i}`)));
    expect(names.size).toBeGreaterThan(40);
  });

  it('only shows emotes from the fixed list', () => {
    expect(decodeEmote(0)).toBe(0);
    expect(decodeEmote(EMOTES.length - 1)).toBe(EMOTES.length - 1);
    for (const bad of [-1, EMOTES.length, 1.5, '1', null, 'hello world', [0]]) expect(decodeEmote(bad)).toBeNull();
  });

  it('rate-limits emotes: a burst, then one per interval', () => {
    const r = new RateLimit(3, 2);
    expect([r.take(0), r.take(0), r.take(0), r.take(0)]).toEqual([true, true, true, false]);
    expect(r.take(1)).toBe(false);
    expect(r.take(2.1)).toBe(true);
    expect(r.take(2.2)).toBe(false);
    // a long pause refills only up to the burst
    expect([0, 0, 0, 0].map(() => r.take(100))).toEqual([true, true, true, false]);
    // mashing for a minute sends at most burst + 60 / interval
    const s = sendLimit();
    let sent = 0;
    for (let t = 0; t < 60; t += 0.05) if (s.take(t)) sent++;
    expect(sent).toBeLessThanOrEqual(3 + 30);
  });
});

describe('stackBubbles', () => {
  it('leaves apart bubbles alone and lifts overlapping ones clear', () => {
    const b = (x: number, y: number, w = 40) => ({ x, y, w, h: 10 });
    expect(stackBubbles([b(0, 100), b(100, 100)])).toEqual([100, 100]);
    const [a, c, d] = stackBubbles([b(0, 100), b(20, 100), b(10, 100)]);
    expect(a).toBe(100); // the first at a height stays put
    const tops = [a!, c!, d!].sort((p, q) => q - p);
    // each lifted at least a bubble's height + gap above the one below
    expect(tops[0]! - tops[1]!).toBeGreaterThanOrEqual(12);
    expect(tops[1]! - tops[2]!).toBeGreaterThanOrEqual(12);
  });
});

describe('stackBubbles with fixed bubbles', () => {
  it('lifts a bubble above a fixed one it would cover', () => {
    const [y] = stackBubbles([{ x: 0, y: 100, w: 40, h: 10 }], 2, [{ x: 0, y: 102, w: 15, h: 15 }]);
    expect(y).toBeLessThanOrEqual(102 - 15 - 2);
  });
});

describe('presence: here, away or gone', () => {
  it('a visible tab in use is here', () => {
    expect(presence(null, 0)).toBe('here');
    expect(presence(null, PRESENCE.idleAway - 1)).toBe('here');
  });

  it('a hidden tab fades at once, then leaves after two minutes', () => {
    expect(PRESENCE.hiddenGone).toBe(120);
    expect(presence(0, 0)).toBe('away');
    expect(presence(PRESENCE.hiddenGone - 1, 0)).toBe('away');
    expect(presence(PRESENCE.hiddenGone, 0)).toBe('gone');
  });

  it('no input for ten minutes fades, thirty leaves', () => {
    expect(PRESENCE.idleAway).toBe(600);
    expect(PRESENCE.idleGone).toBe(1800);
    expect(presence(null, PRESENCE.idleAway)).toBe('away');
    expect(presence(null, PRESENCE.idleGone - 1)).toBe('away');
    expect(presence(null, PRESENCE.idleGone)).toBe('gone');
  });

  it('hidden wins over recent input, and timings can be shortened (dev ?presence=N)', () => {
    expect(presence(5, 0, { hiddenGone: 2, idleAway: 4, idleGone: 8 })).toBe('gone');
    expect(presence(null, 5, { hiddenGone: 2, idleAway: 4, idleGone: 8 })).toBe('away');
  });
});
