import { describe, expect, it } from 'vitest';
import { rng } from '../city';
import { CLEAR, FIELD, FIRE_LIFE, ROUND, jump, newRound, step } from './coneCatch';
import { chickenAfter, chickenInvite, chickenQuestions } from '../content/chicken';

describe('Cone Catch', () => {
  it('catches a cone that lands on the chicken and scores it', () => {
    const s = newRound();
    s.drops.push({ x: s.x, y: FIELD.ground - 12, kind: 'cone', vy: 60, flavor: 0 });
    step(s, 0.05, 0, () => 0.9);
    expect(s.score).toBe(1);
    expect(s.caught).toBe(1);
    expect(s.fires).toHaveLength(0);
  });

  it('sets a missed cone on fire where it lands, and the fire burns out', () => {
    const s = newRound();
    s.drops.push({ x: 20, y: FIELD.ground - 1, kind: 'cone', vy: 200, flavor: 2 });
    step(s, 0.1, 0, () => 0.9);
    expect(s.score).toBe(0);
    expect(s.burst).toBe(1);
    expect(s.fires).toEqual([{ x: 20, age: 0, flavor: 2 }]);
    step(s, FIRE_LIFE + 0.1, 0, () => 0.9);
    expect(s.fires).toHaveLength(0);
  });

  it('burns the chicken (once) if she runs into a fire on the ground', () => {
    const s = newRound();
    s.fires.push({ x: s.x + 3, age: 0.2, flavor: 0 });
    step(s, 0.01, 0, () => 0.9);
    expect(s.lives).toBe(2);
    expect(s.scorched).toBe(1);
    // the same fire doesn't burn her again, even once she's not blinking any more
    for (let i = 0; i < 20; i++) step(s, 0.1, 0, () => 0.9);
    expect(s.lives).toBe(2);
  });

  it('lets her jump clear over a fire', () => {
    const s = newRound();
    expect(jump(s)).toBe(true);
    expect(jump(s)).toBe(false); // no double jump
    step(s, 0.08, 0, () => 0.9);
    expect(s.z).toBeGreaterThanOrEqual(CLEAR);
    s.fires.push({ x: s.x, age: 0.2, flavor: 0 });
    step(s, 0.01, 0, () => 0.9);
    expect(s.lives).toBe(3);
    // and she comes back down
    for (let i = 0; i < 30; i++) step(s, 0.05, 1, () => 0.9);
    expect(s.z).toBe(0);
  });

  it('catches a cone mid-jump', () => {
    const s = newRound();
    jump(s);
    step(s, 0.1, 0, () => 0.9);
    s.drops.push({ x: s.x, y: FIELD.ground - s.z - 4, kind: 'cone', vy: 1, flavor: 1 });
    step(s, 0.001, 0, () => 0.9);
    expect(s.score).toBe(1);
  });

  it('lets a rock land without a fire', () => {
    const s = newRound();
    s.drops.push({ x: 20, y: FIELD.ground - 1, kind: 'rock', vy: 200, flavor: 0 });
    step(s, 0.1, 0, () => 0.9);
    expect(s.fires).toHaveLength(0);
    expect(s.lives).toBe(3);
  });

  it('loses a life to a rock (then blinks safe for a moment), and the round ends at three', () => {
    const s = newRound();
    s.drops.push({ x: s.x, y: FIELD.ground - 5, kind: 'rock', vy: 1, flavor: 0 });
    step(s, 0.01, 0, () => 0.9);
    s.drops.push({ x: s.x, y: FIELD.ground - 5, kind: 'rock', vy: 1, flavor: 0 });
    step(s, 0.01, 0, () => 0.9);
    expect(s.lives).toBe(2); // the second one bounced off during the blink
    for (let i = 0; i < 2; i++) {
      s.grace = 0;
      s.drops.push({ x: s.x, y: FIELD.ground - 5, kind: 'rock', vy: 1, flavor: 0 });
      step(s, 0.01, 0, () => 0.9);
    }
    expect(s.lives).toBe(0);
    expect(s.over).toBe(true);
  });

  it('keeps the chicken on the field and stops at the bell', () => {
    const s = newRound();
    for (let i = 0; i < 100; i++) step(s, 0.1, 1, () => 0.9);
    expect(s.x).toBeLessThanOrEqual(FIELD.w - 8);
    const r = rng(1);
    const t = newRound();
    while (!t.over) step(t, 1 / 30, Math.sin(t.t), r);
    expect(t.t).toBeLessThanOrEqual(ROUND + 1e-6);
  });
});

describe('the chicken', () => {
  it('asks two questions, each with exactly two answers, then the mini game', () => {
    expect(chickenQuestions).toHaveLength(2);
    for (const q of chickenQuestions) {
      expect(q.answers).toHaveLength(2);
      expect(q.lines.at(-1)).toMatch(/\?$/);
    }
    expect(chickenInvite.lines.at(-1)).toBe('Want to play my mini game?');
    expect(chickenAfter(1, 3)[0]).toMatch(/^1 cone!/);
  });
});
