import { DEFAULT_LOOK, FURS, HATS, headAnchor, LOOK_SCARVES, lookCode, lookFrom } from './look';

describe("your rabbit's look", () => {
  it('goes over the wire as one number and comes back the same', () => {
    for (let fur = 0; fur < FURS.length; fur++)
      for (let scarf = 0; scarf < LOOK_SCARVES.length; scarf++)
        for (let hat = 0; hat < HATS.length; hat++) expect(lookFrom(lookCode({ fur, scarf, hat }))).toEqual({ fur, scarf, hat });
    expect(lookCode(DEFAULT_LOOK)).toBe(0);
  });

  it('ignores anything malformed from the network', () => {
    for (const bad of [-1, 1.5, 'x', null, undefined, 99 * 256, 15, 15 * 16]) expect(lookFrom(bad)).toBeNull();
  });

  it('every hat is a tidy grid with its colours', () => {
    for (const h of HATS) {
      for (const row of h.grid) expect(row).toHaveLength(h.grid[0]!.length);
      for (const ch of h.grid.join('')) if (ch !== '.' && ch !== 'k') expect(h.colors[ch], `${h.name} ${ch}`).toBeDefined();
    }
  });

  it('finds the top of the head between the ears', () => {
    // the rabbit facing down: ears are 2-wide columns, the head a wide row
    const g = ['....kk....kk....', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kkwkkkkwkk...', '..kwwwwwwwwwwk..', '..kwwwwwwwwwwk..'];
    const a = headAnchor((x, y) => g[y]![x] === 'w', 16, g.length)!;
    expect(a).toEqual({ x: 8, y: 3 });
  });
});
