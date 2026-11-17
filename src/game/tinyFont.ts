/**
 * A 3×5 pixel font for the little bits of text over rabbits: name tags and emote bubbles.
 * Press Start 2P is only crisp at 8 px, which reads like the map's own place labels;
 * this one sits on the pixel grid at any zoom. Letters, space, '!' and '?' only — what
 * rabbit names and the emotes (content/emotes.ts) use.
 */

/** Each glyph: 5 rows of 3, '#' = ink. */
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  ' ': ['...', '...', '...', '...', '...'],
};

export const TINY_H = 5;
/** advance per character: 3 px glyph + 1 px gap */
const ADVANCE = 4;

export function tinyWidth(text: string): number {
  return text.length ? text.length * ADVANCE - 1 : 0;
}

/** Draws `text` (upper-cased) with its top-left at (x, y), one canvas pixel per font pixel. */
export function drawTiny(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  const t = text.toUpperCase();
  for (let i = 0; i < t.length; i++) {
    const g = GLYPHS[t[i]!];
    if (!g) continue;
    for (let row = 0; row < TINY_H; row++)
      for (let col = 0; col < 3; col++) if (g[row]![col] === '#') ctx.fillRect(x + i * ADVANCE + col, y + row, 1, 1);
  }
}

/** Does the font have every character of `text`? (tested against the names and emotes) */
export const tinyCovers = (text: string) => [...text.toUpperCase()].every((c) => c in GLYPHS);

/** For tests: every glyph is 5 rows of 3. */
export const tinyGlyphs = () => Object.values(GLYPHS);

/**
 * A white speech bubble in the tiny font, its tail pointing down at (x, y): what the pegasus
 * and the mermaids say over their heads. (Other rabbits' emote bubbles stack and lift, so they
 * draw their own, in plugins/visitors.ts.)
 */
export function drawSpeech(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, ink: string) {
  const w = tinyWidth(text) + 6;
  const h = TINY_H + 4;
  const l = Math.round(x - w / 2);
  const top = Math.round(y - h - 3);
  ctx.fillStyle = ink;
  ctx.fillRect(l - 1, top - 1, w + 2, h + 2);
  ctx.fillRect(Math.round(x) - 2, top + h, 4, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(l, top, w, h);
  ctx.fillRect(Math.round(x) - 1, top + h, 2, 2);
  drawTiny(ctx, text, l + 3, top + 2, ink);
}
