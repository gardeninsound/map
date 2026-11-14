import { createWorld } from '../city';
import { boxers, RING_AT, ringside } from '../content/chickenBoxing';
import { BEAT, BOUT, BREAK, boutAt, DOWN, exchange, knockdownOf, ROUND, ROUNDS } from './chickenBoxing';

describe('the chicken boxing match', () => {
  it('runs rounds of fighting with a rest between, then the next bout', () => {
    expect(boutAt(1).round).toBe(1);
    expect(boutAt(1).rest).toBe(false);
    expect(boutAt(ROUND + 1).rest).toBe(true);
    expect(boutAt(ROUND + BREAK + 1).round).toBe(2);
    expect(boutAt(BOUT - 1).round).toBe(ROUNDS);
    expect(boutAt(BOUT + 1)).toMatchObject({ bout: 1, round: 1, rest: false });
  });

  it('is the same fight for everyone at the same moment', () => {
    expect(boutAt(12345.6)).toEqual(boutAt(12345.6));
  });

  it('one punch at a time, and a punch that lands rocks the other chicken back', () => {
    let rocked = 0;
    for (let t = 0; t < BOUT * 3; t += 0.1) {
      const b = boutAt(t);
      const punching = b.fighters.filter((f) => f.punch).length;
      expect(punching).toBeLessThanOrEqual(1);
      b.fighters.forEach((f, i) => {
        if (f.hit > 0) {
          rocked++;
          expect(b.fighters[i === 0 ? 1 : 0]!.punch?.lands).toBe(true);
        }
        expect(f.hit).toBeGreaterThanOrEqual(0);
        expect(f.hit).toBeLessThanOrEqual(1);
      });
    }
    expect(rocked).toBeGreaterThan(50);
  });

  it('a knockdown: down for the count, then back up', () => {
    let found = 0;
    for (let bout = 0; bout < 5; bout++) {
      for (let r = 1; r <= ROUNDS; r++) {
        const ko = knockdownOf(bout, r);
        if (!ko) continue;
        found++;
        const t0 = bout * BOUT + (r - 1) * (ROUND + BREAK) + ko.at;
        expect(ko.at + DOWN).toBeLessThan(ROUND);
        expect(boutAt(t0 + DOWN / 2).fighters[ko.who].down).toBe(1);
        expect(boutAt(t0 + DOWN / 2).fighters[ko.who === 0 ? 1 : 0].cheer).toBe(true);
        expect(boutAt(t0 + DOWN + BEAT * 2).fighters[ko.who].down).toBe(0);
      }
    }
    expect(found).toBeGreaterThan(2);
  });

  it('keeps count of punches landed, only ever going up within a bout', () => {
    let last = 0;
    for (let t = 0; t < BOUT; t += 0.5) {
      const { landed } = boutAt(t);
      expect(landed[0] + landed[1]).toBeGreaterThanOrEqual(last);
      last = landed[0] + landed[1];
    }
    expect(last).toBeGreaterThan(40);
    expect(exchange(0, 1, 0) === null || typeof exchange(0, 1, 0)!.by === 'number').toBe(true);
  });

  it('stands on the stadium field, with the track round it to walk', () => {
    const w = createWorld();
    const p = w.project(RING_AT.lat, RING_AT.lon);
    expect(w.streetAt(p.x, p.y)).toBe('West Seattle Stadium');
    // ringside, where the announcer is: on the field, walkable
    expect(w.isWalkable(p.x, p.y + 3.4)).toBe(true);
  });

  it('the announcer names both corners and who is ahead', () => {
    const lines = ringside(2, false, [7, 3]).join(' ');
    expect(lines).toContain(boxers[0].name);
    expect(lines).toContain(boxers[1].name);
    expect(lines).toContain('round 2');
  });
});
