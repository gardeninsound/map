import { afterEach, describe, expect, it } from 'vitest';
import { clockFromSearch, clockPinned, dice, now, setClock, today } from './clock';

afterEach(() => setClock({ at: null, seed: null }));

describe('the game clock', () => {
  it('reads ?time= and ?seed=, ignoring what it cannot read', () => {
    expect(clockFromSearch('')).toEqual({ at: null, seed: null });
    expect(clockFromSearch('?time=2026-03-15T19:30Z&seed=7')).toEqual({ at: Date.parse('2026-03-15T19:30Z'), seed: 7 });
    // a date alone is noon, local
    expect(clockFromSearch('?time=2026-03-15').at).toBe(new Date(2026, 2, 15, 12).getTime());
    expect(clockFromSearch('?time=soon&seed=x')).toEqual({ at: null, seed: null });
  });

  it('starts at the pinned moment and runs on from there', () => {
    expect(clockPinned()).toBe(false);
    const at = Date.parse('2026-03-15T19:30:00Z');
    setClock({ at });
    expect(Math.abs(now() - at)).toBeLessThan(50);
    expect(today().getUTCMonth()).toBe(2);
    expect(clockPinned()).toBe(true);
    setClock({ at: null });
    expect(Math.abs(now() - Date.now())).toBeLessThan(50);
  });

  it('with a seed, each named stream repeats exactly and streams are independent', () => {
    setClock({ seed: 7 });
    const a = [dice('dinos')(), dice('dinos')(), dice('race')()];
    setClock({ seed: 7 });
    // drawing from another stream first changes nothing for the dinosaurs
    const r = dice('race')();
    expect([dice('dinos')(), dice('dinos')(), r]).toEqual(a);
    setClock({ seed: 8 });
    expect(dice('dinos')()).not.toBe(a[0]);
  });

  it('without a seed it is real chance', () => {
    expect(dice('anything')).toBe(Math.random);
  });
});
