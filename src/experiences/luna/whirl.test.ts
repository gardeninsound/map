import { ARM, HUB, MAST, PHASES, RIDE, seatAt, spinAt, swingOut, TOP_SPEED, turnAt } from './whirl';

describe('the Giant Whirl', () => {
  it('stands still while you board, spins up, holds, winds down, and stops', () => {
    expect(spinAt(1)).toBe(0);
    expect(spinAt(PHASES.board + PHASES.up / 2)).toBeGreaterThan(0);
    expect(spinAt(PHASES.board + PHASES.up / 2)).toBeLessThan(TOP_SPEED);
    expect(spinAt(PHASES.board + PHASES.up + 1)).toBe(TOP_SPEED);
    expect(spinAt(RIDE + 1)).toBe(0);
  });

  it('hangs straight at rest and swings out further the faster it goes, never flat', () => {
    expect(swingOut(0)).toBe(0);
    expect(swingOut(0.6)).toBeLessThan(swingOut(TOP_SPEED));
    const top = (swingOut(TOP_SPEED) * 180) / Math.PI;
    expect(top).toBeGreaterThan(35);
    expect(top).toBeLessThan(70);
  });

  it('keeps the cars off the deck and out over it at full speed', () => {
    const rest = seatAt(0, 12, 0, 0);
    expect(rest.y).toBeCloseTo(MAST - ARM);
    expect(Math.hypot(rest.x, rest.z)).toBeCloseTo(HUB);
    const out = seatAt(0, 12, 0, swingOut(TOP_SPEED));
    expect(out.y).toBeGreaterThan(rest.y);
    expect(Math.hypot(out.x, out.z)).toBeGreaterThan(HUB + ARM * 0.5);
  });

  it('goes round several times in a ride', () => {
    expect(turnAt(RIDE) / (Math.PI * 2)).toBeGreaterThan(3);
  });
});
