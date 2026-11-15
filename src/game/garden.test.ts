import { createWorld, Tile } from '../city';
import { GARDEN_BOX, gardenSign, plantings } from '../content/garden';
import { beds, inBloom } from './garden';

describe('the seasonal garden', () => {
  it('has something growing every month of the year', () => {
    for (let m = 0; m < 12; m++) expect(inBloom(new Date(2026, m, 15)).length, `month ${m + 1}`).toBeGreaterThan(0);
  });

  it('grows the season: daffodils in spring, sunflowers in summer, pumpkins in October', () => {
    const names = (d: Date) => inBloom(d).map((b) => b.plant.name);
    expect(names(new Date(2026, 3, 1))).toContain('daffodils');
    expect(names(new Date(2026, 3, 1))).not.toContain('sunflowers');
    expect(names(new Date(2026, 7, 10))).toContain('sunflowers');
    expect(names(new Date(2026, 9, 20))).toContain('pumpkins');
    expect(names(new Date(2026, 0, 10))).toContain('snowdrops');
  });

  it('flowers come up, fill out, and fade at the end of their run', () => {
    const tulipsEarly = inBloom(new Date(2026, 3, 1)).find((b) => b.plant.name === 'tulips')!;
    const tulipsLate = inBloom(new Date(2026, 4, 28)).find((b) => b.plant.name === 'tulips')!;
    expect(tulipsEarly.stage).toBeLessThan(tulipsLate.stage);
    expect(tulipsEarly.fading).toBe(false);
    expect(tulipsLate.fading).toBe(true);
    for (let m = 0; m < 12; m++) for (const b of inBloom(new Date(2026, m, 20))) expect(b.stage).toBeLessThanOrEqual(1);
  });

  it('the sign lists what is out', () => {
    const lines = gardenSign(4, ['daffodils', 'tulips']).join(' ');
    expect(lines).toContain('April');
    expect(lines).toContain('daffodils and tulips');
  });

  it('every planting has months that are real months', () => {
    for (const p of plantings) for (const m of p.months) expect(m >= 1 && m <= 12).toBe(true);
  });

  it('beds fit the garden', () => {
    for (const b of beds(6, 8)) expect(b.y + b.h).toBeLessThanOrEqual(8);
  });

  it('is in Dragonfly Garden, by a street you can see it from', () => {
    const w = createWorld();
    const a = w.project(GARDEN_BOX.north, GARDEN_BOX.west), b = w.project(GARDEN_BOX.south, GARDEN_BOX.east);
    let park = 0, street = false;
    for (let y = Math.floor(a.y); y <= b.y; y++) for (let x = Math.floor(a.x); x <= b.x; x++) if (w.tileAt(x, y) === Tile.Park) park++;
    for (let y = Math.floor(a.y); y <= b.y; y++) street ||= w.isWalkable(a.x - 1.5, y + 0.5) || w.isWalkable(a.x - 2.5, y + 0.5);
    expect(park).toBeGreaterThan(20);
    expect(street).toBe(true);
  });
});
