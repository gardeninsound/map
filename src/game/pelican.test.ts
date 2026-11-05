import { arc, pelicanAt, phaseAt, PELICAN_TIMES, PELICAN_TIMES_STILL, totalTime, type PelicanPoints } from './pelican';
import { PELICAN_GRIDS } from './sprites';

const pts: PelicanPoints = { from: { x: -80, y: 200 }, byYou: { x: 500, y: 400 }, button: { x: 900, y: 40 }, away: { x: 1200, y: -140 } };
const T = PELICAN_TIMES;

describe('the pelican after you join', () => {
  it('lands beside you, asks, flies to the IDEA button, says its line, flies off — in that order', () => {
    const seen: string[] = [];
    for (let t = 0; t < totalTime() + 0.5; t += 0.05) {
      const { phase } = phaseAt(t);
      if (seen[seen.length - 1] !== phase) seen.push(phase);
    }
    expect(seen).toEqual(['arrive', 'ask', 'hop', 'perch', 'leave', 'done']);
  });

  it('stands beside you while it asks, and on the button while it says "dream it out"', () => {
    const ask = pelicanAt(T.arrive + 1, pts);
    expect(ask).toMatchObject({ phase: 'ask', pos: pts.byYou, flying: false, say: 'ask' });
    const perch = pelicanAt(T.arrive + T.ask + T.hop + 1, pts);
    expect(perch).toMatchObject({ phase: 'perch', pos: pts.button, flying: false, say: 'dream' });
  });

  it('flies in from where it starts and leaves toward the way out', () => {
    expect(pelicanAt(0, pts).pos).toEqual(pts.from);
    const leaving = pelicanAt(totalTime() - 0.01, pts);
    expect(leaving.flying).toBe(true);
    expect(leaving.pos.x).toBeGreaterThan(pts.button!.x);
    expect(leaving.facing).toBe('right');
  });

  it('swoops: mid-flight it is above both ends', () => {
    const mid = arc({ x: 0, y: 100 }, { x: 100, y: 100 }, 0.5, 60);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeLessThan(100);
  });

  it('with the IDEA button hidden, it just flies off after asking (and says nothing more)', () => {
    const perch = pelicanAt(T.arrive + T.ask + T.hop + 1, { ...pts, button: null });
    expect(perch.pos).toEqual(pts.byYou);
    expect(perch.say).toBeNull();
  });

  it('with reduced motion it barely flies, but still gives you time to read', () => {
    expect(PELICAN_TIMES_STILL.ask).toBe(T.ask);
    expect(PELICAN_TIMES_STILL.perch).toBe(T.perch);
    expect(pelicanAt(0.05, pts, PELICAN_TIMES_STILL).phase).toBe('ask');
  });
});

describe('pelican sprites', () => {
  it.each(Object.entries(PELICAN_GRIDS))('%s is a 24-wide rectangle of known colours', (_, grid) => {
    for (const row of grid) {
      expect(row).toHaveLength(24);
      expect(row).toMatch(/^[.kwgboy]+$/);
    }
  });
});
