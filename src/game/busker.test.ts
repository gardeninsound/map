import { describe, expect, it } from 'vitest';
import { CYCLE, midi, score, slotSeconds, SONGS, whereNow } from './busker';

describe('busker songs', () => {
  it('parses note names', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('F#6')).toBe(90);
    expect(midi('Bb2')).toBe(46);
  });

  it.each(SONGS.map((s) => [s.name, s] as const))('%s: lead is whole bars and matches its bass line', (_, song) => {
    const beats = song.lead.trim().split(/\s+/).reduce((a, tok) => a + Number(tok.split(':')[1]), 0);
    expect(beats % 4).toBe(0);
    expect(beats).toBe(song.bass.length * 4);
    const { notes } = score(song);
    expect(notes.filter((n) => n.voice !== 'hat').every((n) => n.midi > 30 && n.midi < 100)).toBe(true);
    // the groove and hats sit inside the bar
    for (const [, at, dur] of song.groove ?? []) expect(at + dur).toBeLessThanOrEqual(4);
    for (const at of song.hats ?? []) expect(at >= 0 && at < 4).toBe(true);
  });

  it('has a calm slow song and a funky one, both quieter than the bouncy ones', () => {
    const calm = SONGS.find((s) => s.bpm <= 80)!;
    expect(calm).toBeDefined();
    expect(calm.wave).toBe('triangle');
    const funk = SONGS.find((s) => s.hats?.length)!;
    expect(funk).toBeDefined();
    expect(funk.groove!.some(([, at]) => at % 0.5 !== 0)).toBe(true); // syncopated: off the eighths
    for (const s of [calm, funk]) expect(s.gain! < 1 && s.sparkle === 0).toBe(true);
  });
});

describe('what the busker is playing now (the same for everyone)', () => {
  it('starts the cycle on the first song and wraps round', () => {
    expect(whereNow(0)).toEqual({ song: 0, at: 0 });
    const later = whereNow(CYCLE * 1000 + 1);
    expect(later.song).toBe(whereNow(1).song);
    expect(later.at).toBeCloseTo(whereNow(1).at, 6);
    expect(whereNow(-1).song).toBe(SONGS.length - 1); // before 1970 still lands somewhere sensible
  });

  it('runs straight through the playlist: time moves on, or the next song starts', () => {
    const t0 = 1_793_000_000; // some afternoon in 2026
    let prev = whereNow(t0);
    for (let t = t0 + 0.25; t < t0 + CYCLE * 2; t += 0.25) {
      const now = whereNow(t);
      expect(now.at).toBeLessThan(slotSeconds(now.song));
      if (now.song === prev.song) expect(now.at - prev.at).toBeCloseTo(0.25, 6);
      else {
        expect(now.song).toBe((prev.song + 1) % SONGS.length);
        expect(now.at).toBeLessThan(0.25);
      }
      prev = now;
    }
  });

  it('every song gets its turn each cycle', () => {
    const seen = new Set<number>();
    for (let t = 0; t < CYCLE; t += 0.5) seen.add(whereNow(t).song);
    expect(seen.size).toBe(SONGS.length);
  });
});
