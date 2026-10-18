import { describe, expect, it } from 'vitest';
import { midi, score, SONGS } from './busker';

describe('busker songs', () => {
  it('parses note names', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('F#6')).toBe(90);
    expect(midi('Bb2')).toBe(46);
  });

  it.each(SONGS.map((s, i) => [i, s] as const))('song %i: lead is whole bars and matches its bass line', (_, song) => {
    const beats = song.lead.trim().split(/\s+/).reduce((a, tok) => a + Number(tok.split(':')[1]), 0);
    expect(beats % 4).toBe(0);
    expect(beats).toBe(song.bass.length * 4);
    const { notes } = score(song);
    expect(notes.every((n) => n.midi > 30 && n.midi < 100)).toBe(true);
  });
});
