import { createWorld, Tile } from '../city';
import { mermaids } from '../content/mermaids';
import { bubbleText, CALL_EVERY, callingAt, rockNear } from './mermaids';
import { MERMAID_GRIDS } from './mermaidSprites';
import { tinyCovers } from './tinyFont';

describe('mermaids off Alki', () => {
  const w = createWorld();
  it('each beach mermaid has a rock in the water just off the sand', () => {
    for (const m of mermaids) {
      if (m.at === 'dock') continue;
      const r = rockNear(w, w.project(m.at.lat, m.at.lon), Tile.Water, (t) => t === Tile.Beach)!;
      expect(r).not.toBeNull();
      expect(w.tileAt(Math.floor(r.x), Math.floor(r.y))).toBe(Tile.Water);
    }
  });

  it('call out their phrases in turn, with quiet between', () => {
    const ps = mermaids[0]!.phrases;
    const heard = new Set<string>();
    let quiet = 0;
    for (let t = 0; t < CALL_EVERY * ps.length; t += 0.5) {
      const c = callingAt(t, 0, ps);
      if (c) heard.add(c);
      else quiet++;
    }
    expect(heard.size).toBe(ps.length);
    expect(quiet).toBeGreaterThan(0);
  });

  it('every phrase fits the bubble font', () => {
    for (const m of mermaids) for (const p of m.phrases) expect(tinyCovers(bubbleText(p)), p).toBe(true);
    expect(bubbleText('Eyes closed, sun so close.')).toBe('EYES CLOSED SUN SO CLOSE');
  });

  it.each(Object.entries(MERMAID_GRIDS))('the %s sprite is 16×16', (_, g) => {
    expect(g).toHaveLength(16);
    for (const row of g) expect(row).toHaveLength(16);
  });
});
