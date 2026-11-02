import { describe, expect, it } from 'vitest';
import { EMOTES, PLACE_NAMES, SCARF_NAMES } from '../content/emotes';
import { tinyCovers, tinyGlyphs, tinyWidth } from './tinyFont';

describe('tiny font', () => {
  it('every glyph is 5 rows of 3', () => {
    for (const g of tinyGlyphs()) {
      expect(g).toHaveLength(5);
      for (const row of g) expect(row).toMatch(/^[.#]{3}$/);
    }
  });

  it('covers every rabbit name and every text emote', () => {
    for (const n of [...Object.values(SCARF_NAMES), ...PLACE_NAMES]) expect(tinyCovers(n), n).toBe(true);
    for (const e of EMOTES) if (!e.icon) expect(tinyCovers(e.text), e.text).toBe(true);
  });

  it('measures 4 px a character less the last gap', () => {
    expect(tinyWidth('')).toBe(0);
    expect(tinyWidth('HI!')).toBe(11);
  });
});
