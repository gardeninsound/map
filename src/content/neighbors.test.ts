import { describe, expect, it } from 'vitest';
import { buskerVoice, neighborVoices } from './neighbors';

describe('neighbor voices', () => {
  it.each(neighborVoices.map((v, i) => [i, v.name, v] as const))('#%i %s: a name and 1–3 short lines', (_, __, v) => {
    expect(Object.keys(v).sort()).toEqual(['lines', 'name']);
    expect(v.name.trim().length).toBeGreaterThan(0);
    expect(v.name.length).toBeLessThanOrEqual(40);
    expect(v.lines.length).toBeGreaterThanOrEqual(1);
    expect(v.lines.length).toBeLessThanOrEqual(3);
    for (const line of v.lines) {
      expect(line.trim().length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(100);
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u); // no emoji
      expect(line).not.toMatch(/press a\b/i); // {A} is a token; KeyA is WASD-left
      expect(line).not.toMatch(/https?:|www\./i);
    }
  });

  it('has plenty of people, and the busker', () => {
    expect(neighborVoices.length).toBeGreaterThanOrEqual(10);
    expect(buskerVoice.name).toBe('The keyboard busker');
  });
});
