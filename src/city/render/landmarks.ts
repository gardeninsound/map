/**
 * Hand-drawn landmarks, painted into the map chunks over their cleared footprint
 * (placed by scripts/city/build-map.mjs from content/landmarks.csv). Drawn at native pixels
 * (16 px per tile), SNES-town style: the street face of the building turned toward you.
 * Add one: a draw function here keyed by the CSV's `sprite`, and a row in landmarks.csv.
 */
import { INK } from './palette';
import { drawBlockFace } from './storefronts';

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** 3×5 pixel letters for signs. */
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  ' ': ['...', '...', '...', '...', '...'],
};

/** Pixel text, 4 px per character (3 + 1 gap). Returns its width. */
export function pixelText(ctx: Ctx, text: string, x: number, y: number, color: string): number {
  ctx.fillStyle = color;
  [...text.toUpperCase()].forEach((ch, i) => {
    GLYPHS[ch]?.forEach((row, gy) =>
      [...row].forEach((c, gx) => c === '#' && ctx.fillRect(x + i * 4 + gx, y + gy, 1, 1)),
    );
  });
  return text.length * 4 - 1;
}
export const textWidth = (t: string) => t.length * 4 - 1;

function ring(ctx: Ctx, cx: number, cy: number, outer: string, inner: string) {
  px(ctx, outer, cx - 1, cy - 2, 3, 5);
  px(ctx, outer, cx - 2, cy - 1, 5, 3);
  px(ctx, inner, cx - 1, cy - 1, 3, 3);
}

/** Admiral Theatre (1942): blue-grey deco box, red wave, portholes, the big red marquee. */
function admiralTheatre(ctx: Ctx, w: number, h: number) {
  const wall = '#c9d3e3';
  const wallHi = '#dbe3ef';
  const red = '#e0322b';
  const navy = '#2b3a6b';
  // shadow + roof
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - 3, w - 2, 3);
  px(ctx, '#9aa3b5', 0, 0, w, 9);
  px(ctx, '#aeb6c6', 0, 0, w, 2);
  // the rooftop rail with its curvy middle
  px(ctx, navy, 2, 2, w - 4, 1);
  px(ctx, navy, 14, 1, w - 28, 1);
  for (let x = 4; x < w - 4; x += 6) px(ctx, navy, x, 2, 1, 4);
  px(ctx, INK, 0, 8, w, 1);
  // facade: side wings + raised centre
  px(ctx, wall, 0, 9, w, h - 12);
  px(ctx, wallHi, 13, 9, w - 26, 20);
  for (let y = 14; y < 30; y += 4) {
    px(ctx, '#b8c3d6', 0, y, 13, 1);
    px(ctx, '#b8c3d6', w - 13, y, 13, 1);
  }
  // red wave + stars across the top of the centre
  for (let x = 14; x < w - 14; x++) {
    const y = 11 + Math.round(Math.sin((x - 14) / 2.4) * 1.2);
    px(ctx, red, x, y, 1, 2);
  }
  for (let x = 17; x < w - 15; x += 6) px(ctx, navy, x, 16, 1, 1);
  // portholes
  for (const y of [14, 19, 24]) {
    ring(ctx, 6, y, red, navy);
    ring(ctx, w - 7, y, red, navy);
  }
  // anchor badge
  px(ctx, '#f4e6c8', w / 2 - 6, 22, 12, 6);
  px(ctx, '#f4e6c8', w / 2 - 4, 20, 8, 2);
  px(ctx, red, w / 2 - 4, 24, 1, 3);
  px(ctx, red, w / 2 + 3, 24, 1, 3);
  // marquee
  const my = 28;
  px(ctx, INK, 2, my - 1, w - 4, 13);
  px(ctx, red, 3, my, w - 6, 11);
  const half = (w - 6) / 2;
  pixelText(ctx, 'ADMIRAL', 3 + Math.round((half - textWidth('ADMIRAL')) / 2), my + 1, '#ffffff');
  pixelText(ctx, 'THEATRE', 3 + half + Math.round((half - textWidth('THEATRE')) / 2), my + 1, '#ffffff');
  px(ctx, '#ffffff', 5, my + 7, half - 4, 3);
  px(ctx, '#ffffff', 5 + half, my + 7, half - 4, 3);
  for (let x = 7; x < w - 7; x += 3) px(ctx, INK, x, my + 8, 2, 1);
  px(ctx, red, w / 2, my, 1, 11);
  // ground floor: columns, doors, the red ticket booth
  const gy = my + 11;
  px(ctx, '#aab4c6', 0, gy, w, h - gy - 3);
  px(ctx, INK, 10, gy, 12, h - gy - 3);
  px(ctx, INK, w - 22, gy, 12, h - gy - 3);
  px(ctx, red, w / 2 - 3, gy, 6, h - gy - 3);
  px(ctx, '#f0d8d8', w / 2 - 2, gy + 1, 4, 2);
  px(ctx, INK, 0, h - 3, w, 1);
}

/** The 76 on California: canopy with the orange ball, Food Mart, and the mural wall. */
function gasStation76(ctx: Ctx, w: number, h: number) {
  // lot
  px(ctx, '#8b88a0', 0, 0, w, h);
  for (let x = 18; x < w; x += 9) px(ctx, '#ffffff', x, h - 7, 1, 5);
  // THE WALL: retaining wall under the fence along the west edge, painted
  px(ctx, '#a07850', 0, 0, 3, h);
  for (let y = 1; y < h; y += 3) px(ctx, '#7a5a3a', 0, y, 3, 1);
  const coats = ['#ff7eb6', '#ffe066', '#2ec4b6', '#ff8c42', '#a77bff', '#57cc99'];
  px(ctx, '#ff9ac0', 3, 0, 6, h);
  for (let y = 2; y < h - 2; y += 6) px(ctx, coats[(y / 6) % coats.length | 0], 4, y, 4, 4);
  px(ctx, INK, 9, 0, 1, h);
  // Food Mart along the back
  const bx = 14;
  px(ctx, 'rgba(0,0,0,0.2)', bx + 2, 22, w - bx - 2, 3);
  px(ctx, '#e9e9ee', bx, 0, w - bx - 2, 10);
  px(ctx, '#f6f6f9', bx, 0, w - bx - 2, 2);
  px(ctx, INK, bx, 9, w - bx - 2, 1);
  px(ctx, '#ffffff', bx, 10, w - bx - 2, 12);
  const label = 'FOOD MART';
  pixelText(ctx, label, bx + Math.round((w - bx - 2 - textWidth(label)) / 2), 11, '#e0322b');
  px(ctx, '#2b3b5c', bx + 3, 17, w - bx - 8, 4);
  px(ctx, '#8a4f2a', bx + (w - bx) / 2 - 2, 16, 4, 6);
  px(ctx, INK, bx, 22, w - bx - 2, 1);
  // pump islands
  for (const x of [24, w - 18]) {
    px(ctx, '#c9c6d4', x - 3, 45, 9, 4);
    px(ctx, '#ff6a1a', x, 40, 3, 7);
    px(ctx, '#ffffff', x, 41, 3, 2);
  }
  // canopy (and its shadow)
  const cy = 26;
  px(ctx, 'rgba(0,0,0,0.22)', 14, cy + 16, w - 14, 4);
  px(ctx, INK, 12, cy - 1, w - 13, 18);
  px(ctx, '#f7f7fa', 13, cy, w - 15, 16);
  px(ctx, '#ffffff', 13, cy, w - 15, 2);
  px(ctx, '#f2a35a', 30, cy + 12, w - 34, 2);
  px(ctx, '#3b6fd8', 46, cy + 14, w - 50, 1);
  // the 76 ball
  const bx76 = 21;
  const by76 = cy + 8;
  px(ctx, INK, bx76 - 6, by76 - 5, 13, 11);
  px(ctx, INK, bx76 - 5, by76 - 6, 11, 13);
  px(ctx, '#ff6a1a', bx76 - 5, by76 - 4, 11, 9);
  px(ctx, '#ff6a1a', bx76 - 4, by76 - 5, 9, 11);
  pixelText(ctx, '76', bx76 - 3, by76 - 2, '#ffffff');
}

/**
 * Easy Street Records, NW corner of California & Alaska: the 1926 Crescent-Hamm Building.
 * Buff brick upstairs with a dentil cornice and paired windows, green neon EASY STREET
 * over the bright blue storefront, windows full of posters, dark tile below, and the
 * red-and-white sign on its arm at the corner with the show marquee under it.
 */
function easyStreetRecords(ctx: Ctx, w: number, h: number) {
  const buff = '#d8c39a';
  const buffHi = '#efe2bf';
  const mortar = '#c4ad84';
  const blue = '#2160d8';
  const tile = '#1d2a4a';
  const red = '#e0322b';
  const neon = '#39ff6a';
  const base = h - 3; // facade foot
  // shadow + flat tar roof with its parapet
  px(ctx, 'rgba(0,0,0,0.2)', 2, base, w - 2, 3);
  px(ctx, '#8f8076', 0, 0, w, 12);
  px(ctx, '#a8998a', 0, 0, w, 2);
  px(ctx, '#6e6058', 6, 4, 6, 4); // rooftop hatch
  px(ctx, '#6e6058', 30, 6, 4, 3);
  px(ctx, INK, 0, 11, w, 1);
  // cornice with dentils
  px(ctx, buffHi, 0, 12, w, 3);
  for (let x = 1; x < w; x += 2) px(ctx, mortar, x, 14, 1, 1);
  // upper floor: buff brick, three pairs of windows
  px(ctx, buff, 0, 15, w, 12);
  for (let y = 17; y < 27; y += 3) px(ctx, mortar, 0, y, w, 1);
  for (const x of [3, 18, 33]) {
    for (const dx of [0, 6]) {
      px(ctx, buffHi, x + dx - 1, 16, 7, 9);
      px(ctx, '#3b4a6b', x + dx, 17, 5, 7);
      px(ctx, buffHi, x + dx, 20, 5, 1); // sash
      px(ctx, '#6f86b8', x + dx, 17, 2, 1);
    }
  }
  // the dark band with green neon EASY STREET
  px(ctx, '#1b2440', 0, 27, w, 7);
  pixelText(ctx, 'EASY STREET', Math.round((w - textWidth('EASY STREET')) / 2), 28, neon);
  // ground floor: blue frame, poster-filled windows, corner door, tile bulkhead
  const gy = 34;
  px(ctx, blue, 0, gy, w, base - gy);
  const posters = ['#ff7eb6', '#ffe066', '#ffffff', '#2ec4b6', '#ff8c42', '#a77bff', '#e0322b'];
  for (const [x0, x1] of [[2, 18], [21, 37]]) {
    px(ctx, '#2b2350', x0, gy + 1, x1 - x0, 7);
    for (let x = x0 + 1; x < x1 - 2; x += 4) {
      for (let y = gy + 2; y < gy + 7; y += 3) px(ctx, posters[(x * 3 + y) % posters.length], x, y, 3, 2);
    }
  }
  px(ctx, '#2b2350', 40, gy + 1, 6, base - gy - 1); // corner entrance
  px(ctx, '#6f86b8', 41, gy + 2, 4, 3);
  px(ctx, tile, 0, gy + 8, 40, base - gy - 8);
  px(ctx, INK, 0, base, w, 1);
  // the sign on its arm at the corner, marquee under it
  px(ctx, INK, 44, 4, 4, 1); // arm
  px(ctx, INK, 27, 1, 21, 9);
  px(ctx, red, 28, 2, 19, 7);
  px(ctx, '#ffffff', 29, 3, 17, 5);
  pixelText(ctx, 'EASY', 30, 3, red);
  px(ctx, INK, 29, 10, 17, 7);
  px(ctx, '#5b7cff', 30, 11, 15, 5);
  px(ctx, '#ffffff', 31, 12, 13, 3);
  for (let x = 32; x < 43; x += 2) px(ctx, INK, x, 13, 1, 1); // tonight's bands
}

/**
 * The Undersea Aviary, Michael Henderson's backyard sculpture garden on 45th Ave SW: a
 * grotto of bone-white mortar set with tile, its unfinished top a bare web of rust rebar,
 * a giant squid climbing over it, mirror-mosaic creatures flashing sky and sun, coral banks
 * and anemones — sea creatures who want to see the birds (Seattle Weekly photos, 2016).
 */
function underseaAviary(ctx: Ctx, w: number, h: number) {
  const rust = '#b5651d';
  const rustDark = '#7a3f12';
  const mortar = '#ece4d2';
  const mortarShade = '#cfc4ad';
  const tiles = ['#5fa8a0', '#e0a93a', '#b8322a', '#4f8fc0', '#e8a59a'];
  const cx = w / 2;
  const base = h - 5;
  const rx = w / 2 - 9;
  // yard: gravel and moss, a shadow under the dome
  px(ctx, '#8a7a66', 0, 0, w, h);
  for (let i = 0; i < 70; i++) px(ctx, i % 3 ? '#9a8a74' : '#5e7a52', (i * 37) % w, (i * 23) % h, 2, 1);
  px(ctx, 'rgba(0,0,0,0.22)', 8, base - 1, w - 12, 4);
  const top = (x: number) => base - Math.round(30 * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)));
  // rebar web: nested arches, then ribs and cross-ties
  for (const k of [0, 4, 8]) {
    for (let x = cx - rx + k; x <= cx + rx - k; x++) {
      const y = base - Math.round((30 - k) * Math.sqrt(Math.max(0, 1 - ((x - cx) / (rx - k)) ** 2)));
      px(ctx, k === 4 ? rustDark : rust, x, y, 1, 1);
    }
  }
  for (let x = cx - rx + 3; x < cx + rx - 2; x += 5) {
    for (let y = top(x); y < base - 10; y += 2) px(ctx, (x + y) % 4 ? rust : rustDark, x + ((y >> 1) % 2), y, 1, 1);
  }
  for (let y = base - 26; y < base - 10; y += 4) {
    for (let x = cx - rx; x < cx + rx; x++) if (y > top(x) + 1) px(ctx, (x >> 1) % 2 ? rust : rustDark, x, y, 1, 1);
  }
  // the mortared lower half, set with tile, with its grotto mouths
  for (let x = cx - rx; x <= cx + rx; x++) {
    const t = Math.max(top(x), base - 12 - Math.round(3 * Math.sin(x / 3)));
    px(ctx, mortar, x, t, 1, base - t);
    px(ctx, mortarShade, x, base - 2, 1, 2);
    if ((x * 7) % 5 === 0) px(ctx, tiles[(x * 3) % tiles.length], x, t + 2 + (x % 4), 1, 1);
  }
  for (const [gx, gw] of [[cx - 15, 8], [cx + 5, 9]]) {
    px(ctx, '#2a1a12', gx, base - 8, gw, 8);
    px(ctx, '#2a1a12', gx + 1, base - 9, gw - 2, 1);
    px(ctx, '#2a1a12', gx + 2, base - 10, gw - 4, 1);
    px(ctx, '#3d827d', gx + 2, base - 3, gw - 4, 1); // a glint of water inside
  }
  // the giant squid, clambering over the top
  const sx = cx - 4;
  const sy = 3;
  px(ctx, '#e8a59a', sx + 2, sy, 4, 2);
  px(ctx, '#e8a59a', sx + 1, sy + 2, 6, 3);
  px(ctx, '#e8a59a', sx, sy + 5, 8, 4);
  px(ctx, '#d98c78', sx + 1, sy + 7, 6, 2);
  px(ctx, '#ffffff', sx + 1, sy + 6, 2, 2); // eyes
  px(ctx, '#ffffff', sx + 5, sy + 6, 2, 2);
  px(ctx, '#2a1a12', sx + 2, sy + 7, 1, 1);
  px(ctx, '#2a1a12', sx + 5, sy + 7, 1, 1);
  for (const [i, dir] of [[0, -1], [1, -1], [2, -1], [5, 1], [6, 1], [7, 1]] as const) {
    for (let k = 0; k < 9; k++) {
      const tx = sx + i + dir * Math.round(k * 0.9 + Math.sin(k / 1.6) * 1.5);
      px(ctx, k % 2 ? '#d98c78' : '#e8a59a', tx, sy + 9 + k, 1, 1);
    }
  }
  for (let i = 0; i < 6; i++) px(ctx, tiles[i % tiles.length], sx + 1 + ((i * 3) % 6), sy + 2 + (i % 3) * 2, 1, 1); // mosaic
  // mirror-mosaic creatures: a fish on the left, a bird on the right, checkered silver
  // throwing back sky blue and sunset orange
  const mirror = (mx: number, my: number, cells: string[]) =>
    cells.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c === '.') return;
        const glint = (i + j) % 3 === 0 ? '#8fb4d8' : (i * j) % 5 === 1 ? '#e0a060' : (i + j) % 2 ? '#d8dde3' : '#7a8794';
        px(ctx, c === 'k' ? '#2a1a12' : glint, mx + i, my + j, 1, 1);
      }),
    );
  mirror(1, base - 20, ['...kkkk...k', '..kmmmmkk.k', '.kmmmmmmmkk', 'kmmkmmmmmmk', '.kmmmmmmmkk', '..kmmmmkk.k', '...kkkk...k']);
  mirror(w - 12, base - 24, ['....kk.....', '...kmmk....', '..kmmmk..kk', 'kkmmmmmkkmk', '.kmmmmmmmk.', '..kmmmmmk..', '...k...k...', '..kk..kk...']);
  // coral banks and anemones at the foot
  for (const [bx, color] of [[4, '#d9603a'], [w - 8, '#b8322a']] as const) {
    px(ctx, color, bx + 2, base - 7, 1, 7);
    px(ctx, color, bx, base - 6, 1, 3);
    px(ctx, color, bx + 1, base - 4, 1, 1);
    px(ctx, color, bx + 4, base - 8, 1, 4);
    px(ctx, color, bx + 3, base - 5, 1, 1);
  }
  for (const ax of [cx - rx + 2, cx + rx - 5]) {
    px(ctx, '#5fa8a0', ax, base - 2, 4, 2);
    for (let i = 0; i < 4; i++) px(ctx, i % 2 ? '#e8a59a' : '#7fc0b0', ax + i, base - 4 + (i % 2), 1, 2);
  }
  // birds on the rebar
  for (const [bx, by] of [[cx - 16, top(cx - 16) - 2], [cx + 13, top(cx + 13) - 2], [cx + 20, top(cx + 20) - 2]]) {
    px(ctx, '#f3e6cc', bx, by, 2, 2);
    px(ctx, '#4f8fc0', bx + 2, by, 1, 1);
    px(ctx, '#2a1a12', bx - 1, by + 1, 1, 1);
  }
}

/** A window: `frame`-coloured sash with `cols`×`rows` panes of dark glass, a glint top-left. */
function paneWindow(ctx: Ctx, x: number, y: number, w: number, h: number, cols: number, rows: number, frame = '#f3f0ea', glass = '#3b4a6b') {
  px(ctx, frame, x, y, w, h);
  const pw = (w - 1) / cols, ph = (h - 1) / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const gx = x + 1 + Math.round(i * pw), gy = y + 1 + Math.round(j * ph);
      const gw = Math.max(1, Math.round((i + 1) * pw) - Math.round(i * pw) - 1);
      const gh = Math.max(1, Math.round((j + 1) * ph) - Math.round(j * ph) - 1);
      px(ctx, glass, gx, gy, gw, gh);
    }
  }
  px(ctx, '#6f86b8', x + 1, y + 1, 1, 1);
}

/** A house lot's lawn behind the drawing, so its corners read as yard, not paving. */
function lawn(ctx: Ctx, w: number, h: number) {
  px(ctx, '#5e9a72', 0, 0, w, h);
  for (let i = 0; i < 40; i++) px(ctx, i % 2 ? '#4b8460' : '#79b48a', (i * 29) % w, (i * 17) % h, 1, 2);
}

/** A hipped roof seen from the front: a trapezoid from a ridge down to the eaves, ink-edged. */
function hipRoof(ctx: Ctx, x0: number, x1: number, top: number, eave: number, slope: number, color: string, light: string) {
  for (let y = top; y <= eave; y++) {
    const inset = Math.round((eave - y) * slope);
    px(ctx, y < top + 3 ? light : color, x0 + inset, y, x1 - x0 - inset * 2, 1);
    px(ctx, INK, x0 + inset - 1, y, 1, 1);
    px(ctx, INK, x1 - inset, y, 1, 1);
  }
  const ridge = Math.round((eave - top) * slope);
  px(ctx, INK, x0 + ridge, top - 1, x1 - x0 - ridge * 2, 1);
}

/**
 * The Satterlee House, 4866 Beach Dr SW — "the Painted Lady", a ca. 1906 Seattle Box and
 * city landmark: pale blue-grey shingles, hipped roofs with a front dormer of diamond-pane
 * windows, white trim, a balcony over the full-width porch, rose-pink brackets, a brick
 * chimney, hedges in front (Historic Seattle photo).
 */
function satterleeHouse(ctx: Ctx, w: number, h: number) {
  const shingle = '#a9bccb', line = '#93a8b8', trim = '#f3f0ea', roof = '#6f7380', roofLight = '#8a8f9a';
  const rose = '#c87a86', porch = '#7d8ea0';
  const base = h - 3;
  lawn(ctx, w, h);
  px(ctx, 'rgba(0,0,0,0.2)', 2, base, w - 2, 3);
  // brick chimney behind the roof
  px(ctx, INK, 33, 0, 5, 7);
  px(ctx, '#a8442e', 34, 1, 3, 6);
  // the main hipped roof, then the hipped dormer on its front
  hipRoof(ctx, 3, w - 3, 3, 16, 0.85, roof, roofLight);
  hipRoof(ctx, 16, w - 16, 8, 10, 1, roofLight, '#9aa0aa');
  px(ctx, shingle, 17, 11, w - 34, 5);
  for (const dx of [18, 25]) {
    paneWindow(ctx, dx, 11, 6, 5, 1, 1, trim, '#3b4a6b');
    // diamond lattice in the glass
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) if ((i + j) % 2 === 0) px(ctx, trim, dx + 1 + i, 12 + j);
  }
  // eaves and fascia
  px(ctx, INK, 1, 16, w - 2, 1);
  px(ctx, trim, 1, 17, w - 2, 1);
  // upper storey: shingles; a bay window, the balcony door and balustrade, a window
  px(ctx, shingle, 3, 18, w - 6, 10);
  for (let y = 19; y < 28; y += 2) px(ctx, line, 3, y, w - 6, 1);
  paneWindow(ctx, 6, 19, 9, 7, 1, 2, trim);
  for (let i = 0; i < 7; i++) if (i % 2 === 0) px(ctx, trim, 7 + i, 20);
  paneWindow(ctx, 21, 19, 6, 8, 1, 2, trim, '#a9d8cc');
  px(ctx, trim, 18, 23, 12, 1); // balustrade rail
  for (let x = 18; x < 30; x += 2) px(ctx, trim, x, 24, 1, 3);
  px(ctx, trim, 18, 27, 12, 1);
  paneWindow(ctx, 33, 19, 8, 7, 2, 1, trim);
  // the porch roof
  px(ctx, INK, 1, 28, w - 2, 1);
  px(ctx, roof, 1, 29, w - 2, 2);
  px(ctx, trim, 1, 31, w - 2, 1);
  // under the porch: shaded shingles, windows, the front door
  px(ctx, porch, 3, 32, w - 6, 10);
  paneWindow(ctx, 6, 34, 7, 6, 2, 2, trim);
  paneWindow(ctx, 35, 34, 7, 6, 2, 2, trim);
  px(ctx, trim, 21, 33, 6, 9);
  px(ctx, '#a9d8cc', 22, 34, 4, 4);
  px(ctx, '#5a6070', 22, 38, 4, 3);
  // porch columns with rose brackets
  for (const cx of [3, 15, 31, 43]) {
    px(ctx, trim, cx, 32, 2, 10);
    px(ctx, rose, cx - 1, 32, 1, 2);
    px(ctx, rose, cx + 2, 32, 1, 2);
  }
  // porch floor and steps
  px(ctx, '#d8d3cc', 1, 42, w - 2, 1);
  px(ctx, '#c8c2b8', 19, 43, 10, 1);
  px(ctx, '#9a948e', 18, 44, 12, 1);
  px(ctx, INK, 1, base, w - 2, 1);
  // hedges either side of the steps
  for (const [hx, hw] of [[0, 15], [33, 15]] as const) {
    px(ctx, '#2f6b48', hx, 40, hw, 5);
    px(ctx, INK, hx, 39, hw, 1);
    for (let i = hx + 1; i < hx + hw; i += 3) px(ctx, '#4f8f63', i, 41 + (i % 2), 1, 1);
  }
}

/**
 * The Hainsworth House, 2657 37th Ave SW — Tudor Revival, 1907, by Graham & Myers, a city
 * landmark: cream stucco crossed with dark half-timbering, two steep front gables with dark
 * bargeboards, banks of multi-pane windows, a slate roof, roses on the wall, and the
 * wrought-iron fence along the front (Commons photos, 2657 37th Ave SW).
 */
function hainsworthHouse(ctx: Ctx, w: number, h: number) {
  const stucco = '#efe2bf', timber = '#3a2a22', slate = '#5a5f6a', slateLight = '#727884', frame = '#f3f0ea';
  const base = h - 3;
  lawn(ctx, w, h);
  px(ctx, 'rgba(0,0,0,0.2)', 2, base, w - 2, 3);
  // slate roof behind the gables
  hipRoof(ctx, 2, w - 2, 7, 20, 0.6, slate, slateLight);
  // a steep gable: stucco face, half-timbering, dark bargeboards, a window near the peak
  const gable = (cx: number, top: number, bottom: number, half: number) => {
    for (let y = top; y <= bottom; y++) {
      const hw = Math.round(((y - top) / (bottom - top)) * half);
      px(ctx, stucco, cx - hw, y, hw * 2 + 1, 1);
      px(ctx, timber, cx - hw - 2, y, 2, 1);
      px(ctx, timber, cx + hw + 1, y, 2, 1);
      px(ctx, INK, cx - hw - 3, y, 1, 1);
      px(ctx, INK, cx + hw + 3, y, 1, 1);
    }
    px(ctx, INK, cx - 1, top - 1, 3, 1);
    // timbers: verticals, and the collar beam
    for (let dx = -half + 3; dx < half - 2; dx += 4) {
      const yTop = top + Math.ceil((Math.abs(dx) / half) * (bottom - top)) + 1;
      if (yTop < bottom) px(ctx, timber, cx + dx, yTop, 1, bottom - yTop + 1);
    }
    px(ctx, timber, cx - Math.round(half * 0.55), top + Math.round((bottom - top) * 0.55), Math.round(half * 1.1) + 1, 1);
    paneWindow(ctx, cx - 2, top + Math.round((bottom - top) * 0.25), 5, 4, 1, 1, frame);
  };
  gable(17, 1, 21, 13);
  gable(37, 8, 21, 8);
  // the jettied upper floor: a timber-framed band with the big bay window
  px(ctx, INK, 1, 22, w - 2, 1);
  px(ctx, stucco, 2, 23, w - 4, 7);
  for (let x = 2; x < w - 2; x += 5) px(ctx, timber, x, 23, 1, 7);
  px(ctx, timber, 2, 29, w - 4, 1);
  paneWindow(ctx, 7, 23, 20, 6, 5, 2, frame);
  paneWindow(ctx, 32, 23, 10, 6, 3, 2, frame);
  // the overhang's shadow and brackets
  px(ctx, INK, 1, 30, w - 2, 1);
  for (const bx of [4, 14, 24, 34, 43]) px(ctx, timber, bx, 31, 2, 2);
  // ground floor: stucco between studs and braces, windows, the arched door
  px(ctx, stucco, 3, 31, w - 6, 13);
  for (let x = 3; x < w - 3; x += 4) px(ctx, timber, x, 33, 1, 11);
  px(ctx, timber, 3, 37, w - 6, 1);
  paneWindow(ctx, 6, 33, 9, 7, 3, 2, frame);
  paneWindow(ctx, 33, 33, 10, 7, 3, 2, frame);
  px(ctx, timber, 21, 33, 7, 11);
  px(ctx, timber, 22, 32, 5, 1);
  px(ctx, '#5a3a2a', 22, 34, 5, 10);
  px(ctx, '#e0a93a', 25, 39, 1, 1); // the door handle
  // roses climbing the wall by the door
  for (let i = 0; i < 14; i++) {
    const rx = 15 + ((i * 5) % 6), ry = 30 + ((i * 7) % 11);
    px(ctx, i % 3 ? '#4f8f63' : '#e8a59a', rx, ry, 1, 1);
  }
  px(ctx, INK, 1, base, w - 2, 1);
  // the wrought-iron fence: a rail of pointed arches along the front
  const iron = '#22302b';
  px(ctx, iron, 0, 39, w, 1);
  for (let x = 0; x < w; x += 6) {
    px(ctx, iron, x, 40, 1, 5);
    px(ctx, iron, x + 1, 39, 1, 1);
    px(ctx, iron, x + 2, 38, 2, 1);
    px(ctx, iron, x + 4, 39, 1, 1);
    px(ctx, iron, x + 3, 40, 1, 5);
  }
}

/**
 * The Alki Homestead — Fir Lodge, a 1904 log house at 2717 61st Ave SW, later a restaurant,
 * a city landmark: walls of dark horizontal logs with notched log ends at the corners, a
 * broad low hipped roof with a wide shed dormer, a river-rock chimney and porch pillar, big
 * white-framed French windows (Commons photos, Alki Homestead 2017).
 */
function alkiHomestead(ctx: Ctx, w: number, h: number) {
  const log = '#4a3428', logLight = '#6b4e3a', logDark = '#36261e', frame = '#f3f0ea';
  const stones = ['#9a958c', '#b8b3aa', '#7a766e', '#a8a39a'];
  const base = h - 3;
  lawn(ctx, w, h);
  px(ctx, 'rgba(0,0,0,0.2)', 2, base, w - 2, 3);
  const rocks = (x: number, y: number, rw: number, rh: number) => {
    px(ctx, INK, x - 1, y, rw + 2, rh);
    for (let j = 0; j < rh; j += 2) {
      for (let i = 0; i < rw; i += 2) px(ctx, stones[(i * 3 + j * 5 + (j % 4 ? 1 : 0)) % 4], x + i + ((j / 2) % 2), y + j, 2, 2);
    }
  };
  // the river-rock chimney rising past the eaves
  rocks(8, 2, 5, 20);
  // broad low hipped roof with deep eaves, and the wide shed dormer
  hipRoof(ctx, 0, w, 5, 20, 1.15, '#6f6c75', '#88858e');
  rocks(8, 2, 5, 8); // the chimney top shows above the roof
  px(ctx, INK, 13, 9, 23, 1);
  px(ctx, '#88858e', 13, 10, 23, 2);
  px(ctx, log, 14, 12, 21, 6);
  for (const dx of [15, 20, 25, 30]) paneWindow(ctx, dx, 13, 4, 4, 1, 1, frame, '#2a2a33');
  px(ctx, '#b8b3aa', 38, 13, 3, 2); // a skylight
  // eaves, then the log walls (each log: lit top, body, dark bottom)
  px(ctx, INK, 0, 20, w, 1);
  px(ctx, logDark, 1, 21, w - 2, 1);
  for (let y = 22; y < base; y += 3) {
    px(ctx, logLight, 2, y, w - 4, 1);
    px(ctx, log, 2, y + 1, w - 4, 1);
    px(ctx, logDark, 2, y + 2, w - 4, 1);
  }
  // notched log ends at both corners
  for (let y = 22; y < base - 1; y += 3) {
    for (const ex of [0, w - 3]) {
      px(ctx, logLight, ex, y, 3, 2);
      px(ctx, logDark, ex + 1, y, 1, 1);
    }
  }
  // the stone chimney down the left wall
  rocks(8, 21, 5, base - 21);
  // the porch: a shaded recess with a stone pillar, French doors, steps
  px(ctx, '#2a2a33', 18, 25, 13, 14);
  rocks(18, 25, 3, 18);
  paneWindow(ctx, 23, 27, 7, 10, 2, 3, frame);
  px(ctx, '#9a948e', 20, 41, 12, 2);
  px(ctx, '#b8b3aa', 21, 39, 10, 2);
  // the big French windows on the right
  paneWindow(ctx, 34, 25, 10, 11, 4, 2, frame);
  px(ctx, INK, 1, base, w - 2, 1);
}

/** The 7-Eleven stripes: orange, red, green. */
const STRIPES = ['#f47b20', '#e4202c', '#008061'];

/** A 7-Eleven logo: white tile, green 7, the red band across it. */
function sevenLogo(ctx: Ctx, x: number, y: number) {
  px(ctx, INK, x - 1, y - 1, 9, 9);
  px(ctx, '#ffffff', x, y, 7, 7);
  px(ctx, '#f47b20', x, y, 7, 1);
  pixelText(ctx, '7', x + 2, y + 1, '#008061');
  px(ctx, '#e4202c', x + 1, y + 4, 5, 1);
}

/**
 * 7-Eleven at California & Charlestown (3801 California Ave SW): the store on the west
 * of the lot, the fuel canopy toward California, pumps, a car filling up and the price
 * sign on the corner. No photo to go on — this is the chain's look (white, stripes, the 7).
 */
function sevenEleven(ctx: Ctx, w: number, h: number) {
  const white = '#f6f4ef';
  // forecourt asphalt, parking stripes, shadow under the canopy
  px(ctx, '#7d726c', 0, 0, w, h);
  for (let x = 3; x < 28; x += 6) px(ctx, '#f3e6cc', x, h - 7, 1, 5);
  px(ctx, 'rgba(0,0,0,0.2)', 31, 22, w - 31, 14);
  // the store: flat roof, then its front with the stripe band, logo and posters
  px(ctx, '#a8998a', 1, 2, 26, 18);
  px(ctx, '#c2b2a0', 1, 2, 26, 2);
  px(ctx, '#6e6058', 5, 6, 6, 4);
  px(ctx, INK, 1, 2, 26, 1);
  px(ctx, INK, 1, 2, 1, 36);
  px(ctx, INK, 26, 2, 1, 36);
  px(ctx, INK, 1, 19, 26, 1);
  px(ctx, white, 2, 20, 24, 17);
  STRIPES.forEach((c, i) => px(ctx, c, 2, 21 + i * 2, 24, 2));
  sevenLogo(ctx, 4, 21);
  px(ctx, '#a9d8cc', 3, 28, 22, 8);
  for (let x = 4; x < 24; x += 4) px(ctx, ['#e4202c', '#f47b20', '#008061', '#e0a93a'][(x >> 2) % 4], x, 29, 2, 3); // posters
  px(ctx, '#2a1a12', 12, 29, 4, 7); // door
  px(ctx, '#a9d8cc', 13, 30, 2, 3);
  px(ctx, INK, 1, 37, 26, 1);
  // pump islands and a car at the near pump
  for (const ix of [34, 50]) {
    px(ctx, '#cbbba8', ix, 27, 10, 6);
    px(ctx, INK, ix + 3, 24, 4, 7);
    px(ctx, white, ix + 4, 25, 2, 5);
    px(ctx, '#e4202c', ix + 4, 25, 2, 1);
    px(ctx, '#008061', ix + 4, 28, 2, 1);
  }
  px(ctx, 'rgba(0,0,0,0.2)', 33, 37, 13, 2);
  px(ctx, INK, 32, 33, 13, 5);
  px(ctx, '#5fa8a0', 33, 34, 11, 3);
  px(ctx, '#a9d8cc', 39, 34, 3, 3);
  // the canopy: white roof on columns, fascia striped along its front
  px(ctx, '#9a948e', 38, 18, 2, 10);
  px(ctx, '#9a948e', 55, 18, 2, 10);
  px(ctx, INK, 30, 3, w - 31, 20);
  px(ctx, white, 31, 4, w - 33, 13);
  px(ctx, '#ffffff', 31, 4, w - 33, 2);
  STRIPES.forEach((c, i) => px(ctx, c, 31, 17 + i, w - 33, 1));
  px(ctx, white, 31, 20, w - 33, 2);
  sevenLogo(ctx, 42, 9);
  // price sign on the corner
  px(ctx, '#9a948e', w - 6, 38, 2, h - 38);
  px(ctx, INK, w - 11, 34, 11, 11);
  px(ctx, white, w - 10, 35, 9, 9);
  STRIPES.forEach((c, i) => px(ctx, c, w - 10, 35 + i, 9, 1));
  px(ctx, '#2a1a12', w - 9, 39, 7, 4);
  for (let x = w - 8; x < w - 3; x += 2) px(ctx, '#e4202c', x, 40, 1, 2); // the price, in LEDs
}

/** A bench of potted plants: a slatted top on legs, terracotta pots with leaves and a bloom. */
function plantBench(ctx: Ctx, x: number, y: number, w: number, seed: number) {
  const blooms = ['#ff7eb6', '#ffd166', '#9b6ad1', '#e4202c', '#f6f4ef', '#f47b20'];
  px(ctx, 'rgba(0,0,0,0.2)', x + 1, y + 6, w, 2);
  px(ctx, INK, x, y + 4, w, 1);
  px(ctx, '#7a5a3a', x, y + 5, w, 1);
  px(ctx, '#5a3f28', x + 1, y + 6, 1, 2);
  px(ctx, '#5a3f28', x + w - 2, y + 6, 1, 2);
  for (let i = 0, px0 = x; px0 + 3 <= x + w; i++, px0 += 4) {
    px(ctx, '#2f6b3a', px0, y, 3, 2);
    px(ctx, '#4f9a4f', px0 + 1, y, 1, 1);
    px(ctx, blooms[(i * 5 + seed) % blooms.length], px0 + ((i + seed) % 3), y - 1, 1, 1);
    px(ctx, '#b5562f', px0, y + 2, 3, 2);
  }
}

/** A young tree in a tub: round canopy over a short trunk. */
function tubTree(ctx: Ctx, x: number, y: number, leaf: string, light: string) {
  px(ctx, 'rgba(0,0,0,0.2)', x - 3, y + 11, 9, 2);
  px(ctx, INK, x - 3, y - 1, 8, 8);
  px(ctx, leaf, x - 2, y, 6, 6);
  px(ctx, light, x - 1, y + 1, 2, 2);
  px(ctx, '#5a3f28', x, y + 7, 2, 2);
  px(ctx, INK, x - 2, y + 9, 6, 3);
  px(ctx, '#8a6a4a', x - 1, y + 9, 4, 2);
}

/**
 * West Seattle Nursery, 5275 California Ave SW (since 1990): the original shop, an old
 * fast-food building (Herfy's, then Arby's) with a brown mansard roof under the big green
 * sign, and beside it the glass retail greenhouse that went up in 2016; out front, benches
 * of potted flowers, trees in tubs and a chalkboard. No photo traced — drawn from the
 * West Seattle Blog / Westside Seattle write-ups of the place.
 */
function westSeattleNursery(ctx: Ctx, w: number, h: number) {
  const cream = '#f3e6b8', green = '#2f6b3a', glass = '#bfe3d6', mullion = '#f3f0ea';
  // the yard: packed gravel with flecks
  px(ctx, '#c9b994', 0, 0, w, h);
  for (let i = 0; i < 60; i++) px(ctx, i % 2 ? '#b3a27c' : '#ddd0ad', (i * 37) % w, (i * 23) % h, 1, 1);
  px(ctx, 'rgba(0,0,0,0.2)', 2, 38, 50, 3);
  px(ctx, 'rgba(0,0,0,0.2)', 53, 38, w - 54, 3);
  // the shop: mansard roof, then the sign board across it
  px(ctx, INK, 1, 8, 50, 30);
  px(ctx, '#6b4a36', 2, 9, 48, 16);
  for (let y = 11; y < 25; y += 2) px(ctx, '#5a3c2a', 2, y, 48, 1);
  px(ctx, '#8a6248', 2, 9, 48, 1);
  px(ctx, INK, 3, 10, 46, 14);
  px(ctx, green, 4, 11, 44, 12);
  pixelText(ctx, 'WEST SEATTLE', 2 + Math.round((48 - textWidth('WEST SEATTLE')) / 2), 12, cream);
  pixelText(ctx, 'NURSERY', 2 + Math.round((48 - textWidth('NURSERY')) / 2), 18, cream);
  // stucco front under a striped awning: windows full of plants, the door in the middle
  px(ctx, '#efe6d2', 2, 25, 48, 12);
  for (let x = 2; x < 50; x += 4) px(ctx, x % 8 === 2 ? green : cream, x, 25, 4, 3);
  px(ctx, INK, 2, 28, 48, 1);
  for (const wx of [4, 34]) {
    paneWindow(ctx, wx, 30, 12, 6, 3, 1, '#f3f0ea', '#3b4a6b');
    px(ctx, '#4f9a4f', wx + 1, 34, 10, 1);
    px(ctx, '#ff7eb6', wx + 3, 33, 1, 1);
    px(ctx, '#ffd166', wx + 8, 33, 1, 1);
  }
  px(ctx, INK, 21, 29, 10, 8);
  px(ctx, '#a9d8cc', 22, 30, 8, 7);
  px(ctx, INK, 26, 30, 1, 7);
  // the greenhouse: glass gable on glass walls, white mullions, plants and baskets inside
  const gx0 = 53, gx1 = w - 2, mid = (gx0 + gx1) / 2;
  for (let y = 4; y <= 15; y++) {
    const half = Math.round(((y - 4) / 11) * ((gx1 - gx0) / 2));
    px(ctx, INK, Math.round(mid - half) - 1, y, half * 2 + 2, 1);
    if (half > 0) px(ctx, y % 4 === 0 ? mullion : glass, Math.round(mid - half), y, half * 2, 1);
  }
  px(ctx, INK, gx0 - 1, 15, gx1 - gx0 + 2, 23);
  px(ctx, glass, gx0, 16, gx1 - gx0, 21);
  px(ctx, '#d8efe6', gx0, 16, gx1 - gx0, 2);
  for (const [bx, c] of [[gx0 + 4, '#ff7eb6'], [gx0 + 12, '#9b6ad1'], [gx0 + 20, '#ffd166']] as const) {
    px(ctx, '#4f9a4f', bx, 19, 3, 2);
    px(ctx, c, bx + 1, 19, 1, 1);
  }
  px(ctx, '#2f6b3a', gx0, 29, gx1 - gx0, 8);
  for (let x = gx0; x < gx1; x += 3) px(ctx, '#76c85a', x + (x % 2), 28 + (x % 3 === 0 ? 0 : 1), 2, 2);
  for (let x = gx0 + 5; x < gx1; x += 6) px(ctx, mullion, x, 16, 1, 21);
  px(ctx, mullion, gx0, 26, gx1 - gx0, 1);
  px(ctx, mullion, Math.round(mid) - 3, 30, 6, 7);
  px(ctx, '#a9d8cc', Math.round(mid) - 2, 31, 4, 6);
  // the yard out front: benches of flowers, trees in tubs, the chalkboard by the door
  plantBench(ctx, 3, 44, 20, 0);
  plantBench(ctx, 29, 44, 20, 2);
  plantBench(ctx, 55, 44, 22, 4);
  plantBench(ctx, 3, 54, 20, 1);
  plantBench(ctx, 55, 54, 22, 3);
  tubTree(ctx, 34, 51, '#3b7d47', '#5fa86a');
  tubTree(ctx, 44, 51, '#7a9a3a', '#a8c45a');
  px(ctx, INK, 25, 38, 5, 6);
  px(ctx, '#2a3a2e', 26, 39, 3, 4);
  px(ctx, cream, 26, 40, 3, 1);
  px(ctx, '#ff7eb6', 27, 42, 1, 1);
}

/** A US flag on a pole, the pole's foot at (x, y). */
function flagpole(ctx: Ctx, x: number, y: number, height: number) {
  px(ctx, INK, x - 1, y - height, 3, height);
  px(ctx, '#d8d3cc', x, y - height + 1, 1, height - 1);
  px(ctx, '#e8c25a', x, y - height - 1, 1, 1);
  const fy = y - height + 1;
  px(ctx, INK, x + 1, fy - 1, 10, 8);
  for (let j = 0; j < 6; j++) px(ctx, j % 2 ? '#f6f4ef' : '#c8382f', x + 2, fy + j, 8, 1);
  px(ctx, '#2b3f7a', x + 2, fy, 4, 3);
  px(ctx, '#f6f4ef', x + 3, fy + 1, 1, 1);
}

/** A rolled-down apparatus door: a frame, then panels with a band of windows. */
function bayDoor(ctx: Ctx, x: number, y: number, w: number, h: number, frame: string) {
  px(ctx, INK, x - 1, y - 1, w + 2, h + 1);
  px(ctx, frame, x, y, w, h);
  px(ctx, '#f3f0ea', x + 2, y + 2, w - 4, h - 2);
  for (let j = y + 4; j < y + h; j += 3) px(ctx, '#d8d3cc', x + 2, j, w - 4, 1);
  px(ctx, '#3b4a6b', x + 3, y + 6, w - 6, 2);
  for (let i = x + 3; i < x + w - 3; i += 4) px(ctx, '#d8d3cc', i, y + 6, 1, 2);
}

/**
 * A Seattle fire station: the station number over two big apparatus bays, the office door
 * at the side and the concrete apron the engines roll out onto. The landmark id carries the
 * number (fire-station-29 → STATION 29). Station 32 in the Junction (rebuilt 2017) is the
 * modern one — charcoal panels and glass; the others are brick neighborhood stations.
 */
function fireStation(ctx: Ctx, w: number, h: number, id: string) {
  const n = id.match(/\d+/)?.[0] ?? '';
  const modern = n === '32';
  const wall = modern ? '#5d6470' : '#a8442e';
  const seam = modern ? '#4c525d' : '#8a3624';
  const red = '#c8382f';
  // the apron
  px(ctx, '#b8b2a8', 0, 0, w, h);
  px(ctx, '#cfc9be', 0, h - 9, w, 9);
  // the building
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - 9, w - 3, 2);
  px(ctx, INK, 1, 3, w - 2, h - 11);
  px(ctx, wall, 2, 6, w - 4, h - 15);
  for (let y = 8; y < h - 9; y += modern ? 6 : 2) px(ctx, seam, 2, y, w - 4, 1);
  if (modern) for (let x = 10; x < w - 2; x += 12) px(ctx, seam, x, 6, 1, h - 15);
  px(ctx, modern ? red : '#d8d3cc', 2, 4, w - 4, 2);
  // the sign band with the number
  const label = `STATION ${n}`;
  px(ctx, INK, 3, 8, w - 6, 9);
  px(ctx, modern ? '#f3f0ea' : '#f3e6b8', 4, 9, w - 8, 7);
  pixelText(ctx, label, Math.round((w - textWidth(label)) / 2), 10, red);
  // two apparatus bays, then the office door and a window
  const bay = Math.floor((w - 20) / 2) - 2;
  bayDoor(ctx, 4, 20, bay, h - 29, red);
  bayDoor(ctx, 8 + bay, 20, bay, h - 29, red);
  const ox = 12 + bay * 2;
  if (modern) {
    px(ctx, INK, ox, 19, w - ox - 3, h - 28);
    px(ctx, '#a9d8cc', ox + 1, 20, w - ox - 5, h - 30);
    px(ctx, '#d8efe6', ox + 1, 20, 1, h - 30);
  } else {
    paneWindow(ctx, ox, 20, w - ox - 4, 6, 2, 1);
    px(ctx, INK, ox + 1, 28, 6, h - 37);
    px(ctx, red, ox + 2, 29, 4, h - 38);
  }
  // red lights over the bays, drive lines on the apron
  for (const lx of [4 + bay / 2, 8 + bay * 1.5]) {
    px(ctx, '#e4202c', Math.round(lx) - 1, 18, 2, 1);
    px(ctx, '#f6f4ef', Math.round(lx) - 4, h - 7, 1, 6);
    px(ctx, '#f6f4ef', Math.round(lx) + 3, h - 7, 1, 6);
  }
  if (!modern) flagpole(ctx, w - 4, h - 2, 18);
}

/**
 * The West Seattle post office, 4412 California Ave SW in the Junction: a low brick box with
 * a white cornice and the lettering over glass doors, the flag out front and a blue
 * collection box by the curb (the real one was stolen years back — here it's returned).
 */
function postOffice(ctx: Ctx, w: number, h: number) {
  const brick = '#b9744c', mortar = '#9c5e3c', trim = '#f3f0ea';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - 8, w - 3, 2);
  // flat roof, cornice, then brick
  px(ctx, INK, 1, 2, w - 2, h - 9);
  px(ctx, '#8f8a84', 2, 3, w - 4, 4);
  px(ctx, trim, 2, 7, w - 4, 2);
  px(ctx, brick, 2, 9, w - 4, h - 18);
  for (let y = 11; y < h - 9; y += 2) px(ctx, mortar, 2, y, w - 4, 1);
  // the lettering band
  px(ctx, trim, 4, 11, w - 8, 7);
  pixelText(ctx, 'POST OFFICE', Math.round((w - textWidth('POST OFFICE')) / 2), 12, '#2b3f7a');
  // windows either side of the glass doors, under a white lintel
  paneWindow(ctx, 5, 21, 12, 10, 3, 2, trim);
  paneWindow(ctx, w - 17, 21, 12, 10, 3, 2, trim);
  const dx = Math.round(w / 2) - 6;
  px(ctx, trim, dx - 1, 19, 14, 2);
  px(ctx, INK, dx, 21, 12, h - 30);
  px(ctx, '#a9d8cc', dx + 1, 22, 10, h - 31);
  px(ctx, INK, dx + 6, 22, 1, h - 31);
  // steps, the flag, the blue collection box
  px(ctx, '#d8d3cc', dx - 2, h - 9, 16, 1);
  px(ctx, '#bdb7ad', dx - 3, h - 8, 18, 1);
  flagpole(ctx, 3, h - 2, 22);
  px(ctx, INK, w - 10, h - 9, 7, 8);
  px(ctx, '#2b4f9a', w - 9, h - 8, 5, 5);
  px(ctx, '#3f6bc0', w - 9, h - 8, 5, 1);
  px(ctx, '#f6f4ef', w - 8, h - 6, 3, 1);
  px(ctx, INK, w - 9, h - 3, 1, 2);
  px(ctx, INK, w - 5, h - 3, 1, 2);
}

/**
 * The West Seattle & Fauntleroy YMCA, 3622 SW Snoqualmie St (by 36th & Oregon): a long
 * two-tone block — pale panels and warm wood — with a band of gym windows, the pool hall's
 * blue glass, the red Y by the entry, and a plaza with trees and bike racks out front.
 */
function ymca(ctx: Ctx, w: number, h: number) {
  const panel = '#d6d3cc', wood = '#b07a4a', woodDark = '#8f5f38', red = '#e4202c';
  lawn(ctx, w, h);
  px(ctx, '#c8c2b8', 0, h - 14, w, 14);
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - 14, w - 3, 2);
  // the gym block (taller, left) and the pool hall (right)
  px(ctx, INK, 1, 3, 46, h - 16);
  px(ctx, panel, 2, 4, 44, h - 18);
  px(ctx, '#ebe8e2', 2, 4, 44, 2);
  px(ctx, INK, 47, 13, w - 48, h - 26);
  px(ctx, wood, 48, 14, w - 50, h - 28);
  for (let x = 50; x < w - 2; x += 3) px(ctx, woodDark, x, 14, 1, h - 28);
  // gym windows: a long clerestory band; pool: blue glass with glints of light
  paneWindow(ctx, 4, 7, 40, 6, 6, 1);
  px(ctx, INK, 50, 20, w - 54, h - 37);
  px(ctx, '#5fb8d8', 51, 21, w - 56, h - 39);
  for (let i = 0; i < 6; i++) px(ctx, '#a9e2f0', 52 + ((i * 7) % (w - 60)), 23 + (i % 3) * 3, 3, 1);
  pixelText(ctx, 'YMCA', 4 + Math.round((40 - textWidth('YMCA')) / 2), 16, '#2b3f7a');
  // the entry: glass doors under a canopy, the red Y beside them
  px(ctx, INK, 14, 26, 22, h - 40);
  px(ctx, '#a9d8cc', 15, 27, 20, h - 42);
  for (const x of [20, 25, 30]) px(ctx, INK, x, 27, 1, h - 42);
  px(ctx, INK, 11, 23, 28, 3);
  px(ctx, woodDark, 12, 24, 26, 1);
  px(ctx, INK, 2, 25, 10, 11);
  px(ctx, red, 3, 26, 8, 9);
  px(ctx, '#ffffff', 4, 27, 2, 3);
  px(ctx, '#ffffff', 8, 27, 2, 3);
  px(ctx, '#ffffff', 5, 29, 4, 2);
  px(ctx, '#ffffff', 6, 31, 2, 3);
  // plaza: trees in tubs, bike racks
  tubTree(ctx, 6, h - 12, '#3b7d47', '#5fa86a');
  tubTree(ctx, w - 8, h - 12, '#3b7d47', '#5fa86a');
  for (let x = 44; x < 60; x += 4) {
    px(ctx, INK, x, h - 7, 3, 4);
    px(ctx, '#d8d3cc', x + 1, h - 6, 1, 2);
  }
}

/**
 * The West Seattle Branch of the Seattle Public Library, 2306 42nd Ave SW at College St —
 * a Carnegie library (Somervell & Coté, 1910; Seattle's first permanent branch building, a
 * city landmark): brick with cream stone trim under a low hipped roof, a central entry with
 * a big arched window, the name in the frieze, wide steps with the 2015 handrails, lamps,
 * and lawn and trees around it.
 */
function westSeattleLibrary(ctx: Ctx, w: number, h: number) {
  const brick = '#9a5240', mortar = '#84443a', stone = '#efe2bf', stoneShade = '#d6c79e';
  const roof = '#5f6b6a', roofLight = '#7a8786';
  lawn(ctx, w, h);
  px(ctx, 'rgba(0,0,0,0.2)', 3, h - 8, w - 5, 3);
  // low hipped roof over the whole block
  hipRoof(ctx, 3, w - 3, 3, 12, 0.9, roof, roofLight);
  // stone cornice and frieze with the name
  px(ctx, INK, 2, 12, w - 4, 1);
  px(ctx, stone, 2, 13, w - 4, 7);
  px(ctx, stoneShade, 2, 19, w - 4, 1);
  const name = 'PUBLIC LIBRARY';
  pixelText(ctx, name, Math.round((w - textWidth(name)) / 2), 14, '#5a3a2a');
  // brick walls with tall windows, stone sills
  px(ctx, INK, 2, 20, w - 4, h - 28);
  px(ctx, brick, 3, 20, w - 6, h - 29);
  for (let y = 22; y < h - 9; y += 2) px(ctx, mortar, 3, y, w - 6, 1);
  for (const wx of [6, 14, w - 20, w - 12]) {
    paneWindow(ctx, wx, 23, 6, 11, 2, 3, stone, '#3b4a6b');
    px(ctx, stone, wx - 1, 34, 8, 1);
  }
  // the entry pavilion: stone pilasters, an arched window over the doors
  const ex = Math.round(w / 2) - 9;
  px(ctx, INK, ex - 1, 19, 20, h - 26);
  px(ctx, stone, ex, 20, 18, h - 28);
  px(ctx, stoneShade, ex, 20, 2, h - 28);
  px(ctx, stoneShade, ex + 16, 20, 2, h - 28);
  // arched window
  px(ctx, '#3b4a6b', ex + 5, 23, 8, 6);
  px(ctx, '#3b4a6b', ex + 6, 22, 6, 1);
  px(ctx, stone, ex + 9, 22, 1, 7);
  px(ctx, '#6f86b8', ex + 6, 23, 1, 2);
  // doors
  px(ctx, INK, ex + 4, 30, 10, h - 38);
  px(ctx, '#5a3a2a', ex + 5, 31, 8, h - 39);
  px(ctx, '#e8c25a', ex + 8, 35, 1, 2);
  px(ctx, '#e8c25a', ex + 10, 35, 1, 2);
  // wide steps with handrails, lamps either side
  for (let i = 0; i < 3; i++) px(ctx, i % 2 ? '#c8c2b8' : '#d8d3cc', ex - 2 - i * 2, h - 8 + i * 2, 22 + i * 4, 2);
  px(ctx, INK, ex + 2, h - 9, 1, 7);
  px(ctx, INK, ex + 15, h - 9, 1, 7);
  for (const lx of [ex - 4, ex + 21]) {
    px(ctx, INK, lx, h - 16, 3, 10);
    px(ctx, '#fff3b0', lx, h - 17, 3, 3);
    px(ctx, INK, lx - 1, h - 18, 5, 1);
  }
  // shrubs along the foundation
  for (const sx of [4, w - 18]) {
    px(ctx, INK, sx, h - 11, 14, 4);
    px(ctx, '#2f6b48', sx + 1, h - 10, 12, 3);
    for (let i = sx + 2; i < sx + 13; i += 3) px(ctx, '#4f8f63', i, h - 10, 1, 1);
  }
}

/** A row of shopping carts, nested, `n` deep, from (x, y). */
function carts(ctx: Ctx, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    const cx = x + i * 3;
    px(ctx, INK, cx, y, 5, 4);
    px(ctx, '#c9c4bd', cx + 1, y + 1, 3, 2);
    px(ctx, INK, cx + 1, y + 4, 1, 1);
    px(ctx, INK, cx + 4, y + 4, 1, 1);
  }
}

/** A flat-roofed shop box: ink outline, roof band, wall, the sign board centred over the front. */
function shopBox(ctx: Ctx, w: number, h: number, wall: string, roof: string, sign: { text: string; bg: string; fg: string }, top = 4, front = 9) {
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - front, w - 3, 2);
  px(ctx, INK, 1, top, w - 2, h - front - top + 1);
  px(ctx, roof, 2, top + 1, w - 4, 3);
  px(ctx, wall, 2, top + 4, w - 4, h - front - top - 4);
  const sw = textWidth(sign.text) + 6;
  const sx = Math.round((w - sw) / 2);
  px(ctx, INK, sx - 1, top + 5, sw + 2, 9);
  px(ctx, sign.bg, sx, top + 6, sw, 7);
  pixelText(ctx, sign.text, sx + 3, top + 7, sign.fg);
}

/** Caffe Ladro, 7011 California Ave SW (Morgan Junction): a red-trimmed café front, tables out on the sidewalk. */
function caffeLadro(ctx: Ctx, w: number, h: number) {
  const red = '#b5322b';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  shopBox(ctx, w, h, '#3a2a26', '#5a4038', { text: 'CAFFE LADRO', bg: '#f3e6cc', fg: red });
  // red awning, big windows with the warm inside, the door
  for (let x = 2; x < w - 2; x += 4) px(ctx, x % 8 === 2 ? red : '#f3e6cc', x, 19, 4, 3);
  px(ctx, INK, 2, 22, w - 4, 1);
  for (const wx of [4, w - 22]) {
    px(ctx, INK, wx, 24, 18, 12);
    px(ctx, '#e8b36a', wx + 1, 25, 16, 10);
    px(ctx, '#7a4a2a', wx + 2, 31, 14, 1); // the counter
    px(ctx, '#fff3b0', wx + 3, 26, 2, 2); // a lamp
  }
  px(ctx, INK, Math.round(w / 2) - 4, 24, 8, 15);
  px(ctx, '#a9d8cc', Math.round(w / 2) - 3, 25, 6, 14);
  // two café tables with chairs
  for (const tx of [8, w - 14]) {
    px(ctx, INK, tx, h - 6, 7, 2);
    px(ctx, '#d8d3cc', tx + 1, h - 6, 5, 1);
    px(ctx, INK, tx + 3, h - 4, 1, 3);
    px(ctx, red, tx - 2, h - 5, 2, 3);
    px(ctx, red, tx + 7, h - 5, 2, 3);
  }
}

/** Box Bar, 5401 California Ave SW: a small dark cocktail bar under a neon box. */
function boxBar(ctx: Ctx, w: number, h: number) {
  const neon = '#ff7eb6';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  shopBox(ctx, w, h, '#2a2830', '#1c1b22', { text: 'BOX BAR', bg: '#1c1b22', fg: neon });
  // the neon box beside the sign
  px(ctx, '#7fd9c4', 5, 11, 7, 1);
  px(ctx, '#7fd9c4', 5, 17, 7, 1);
  px(ctx, '#7fd9c4', 5, 11, 1, 7);
  px(ctx, '#7fd9c4', 11, 11, 1, 7);
  px(ctx, '#7fd9c4', 7, 9, 7, 1);
  px(ctx, '#7fd9c4', 13, 9, 1, 7);
  // low amber windows, a black door with a brass handle
  for (const wx of [4, w - 20]) {
    px(ctx, INK, wx, 24, 16, 9);
    px(ctx, '#c97a2a', wx + 1, 25, 14, 7);
    for (let i = wx + 2; i < wx + 15; i += 4) px(ctx, '#ffd166', i, 26, 2, 1);
  }
  px(ctx, INK, Math.round(w / 2) - 4, 23, 8, 16);
  px(ctx, '#2a1a12', Math.round(w / 2) - 3, 24, 6, 15);
  px(ctx, '#e8c25a', Math.round(w / 2) + 1, 31, 1, 2);
  px(ctx, neon, Math.round(w / 2) - 3, 21, 6, 1);
}

/**
 * Trader Joe's, 4545 Fauntleroy Way SW: the old Huling Brothers Buick showroom, kept and
 * converted (opened April 2012) — tall showroom glass, the red name over it, flower buckets
 * and carts out front.
 */
function traderJoes(ctx: Ctx, w: number, h: number) {
  const red = '#c8102e';
  px(ctx, '#bdb7ad', 0, 0, w, h);
  shopBox(ctx, w, h, '#efe6d2', '#a8998a', { text: "TRADER JOE'S", bg: '#f6f4ef', fg: red }, 3, 12);
  // showroom glass in a long band
  px(ctx, INK, 3, 21, w - 6, 16);
  px(ctx, '#7fb3c8', 4, 22, w - 8, 14);
  for (let x = 4; x < w - 4; x += 8) px(ctx, '#efe6d2', x, 22, 1, 14);
  px(ctx, '#a9d8e8', 5, 23, 3, 4);
  // shelves inside
  for (let x = 10; x < w - 8; x += 8) px(ctx, ['#e4202c', '#ffd23f', '#4f9a4f', '#f47b20'][(x >> 3) % 4], x, 31, 5, 4);
  // doors
  px(ctx, INK, Math.round(w / 2) - 6, 26, 12, 12);
  px(ctx, '#d8efe6', Math.round(w / 2) - 5, 27, 10, 11);
  px(ctx, INK, Math.round(w / 2), 27, 1, 11);
  // flower buckets and carts
  for (let x = 4; x < 26; x += 4) {
    px(ctx, '#3a6fd8', x, h - 9, 3, 3);
    px(ctx, ['#ff7eb6', '#ffd23f', '#e4202c', '#f6f4ef', '#9b6ad1'][(x >> 2) % 5], x, h - 11, 3, 2);
    px(ctx, '#4f9a4f', x + 1, h - 10, 1, 1);
  }
  carts(ctx, w - 26, h - 9, 6);
}

/** The Shell station across Fauntleroy from Trader Joe's: the yellow-and-red canopy, pumps, the pecten. */
function shellStation(ctx: Ctx, w: number, h: number) {
  const yellow = '#ffd23f', red = '#dd1d21';
  px(ctx, '#7d726c', 0, 0, w, h);
  // the kiosk at the back
  px(ctx, INK, 3, 2, 22, 14);
  px(ctx, '#efe6d2', 4, 3, 20, 12);
  px(ctx, red, 4, 3, 20, 2);
  px(ctx, '#a9d8cc', 6, 7, 12, 6);
  px(ctx, '#2a1a12', 19, 7, 4, 8);
  // pumps under the canopy, a car filling up
  for (const ix of [10, 34]) {
    px(ctx, '#cbbba8', ix, 30, 12, 6);
    px(ctx, INK, ix + 4, 26, 4, 8);
    px(ctx, yellow, ix + 5, 27, 2, 5);
    px(ctx, red, ix + 5, 27, 2, 1);
  }
  px(ctx, INK, 24, 36, 14, 6);
  px(ctx, '#3a6fd8', 25, 37, 12, 4);
  px(ctx, '#a9d8ff', 31, 37, 3, 3);
  // the canopy: red fascia with a yellow band
  px(ctx, '#9a948e', 14, 18, 2, 12);
  px(ctx, '#9a948e', w - 16, 18, 2, 12);
  px(ctx, INK, 6, 14, w - 12, 8);
  px(ctx, red, 7, 15, w - 14, 3);
  px(ctx, yellow, 7, 18, w - 14, 3);
  // the pecten on a pole by the street
  const px0 = w - 11;
  px(ctx, '#9a948e', px0 + 3, 30, 2, h - 30);
  px(ctx, INK, px0 - 1, 22, 10, 9);
  px(ctx, yellow, px0, 23, 8, 7);
  px(ctx, red, px0, 29, 8, 1);
  for (let i = 0; i < 4; i++) px(ctx, red, px0 + 1 + i * 2, 24, 1, 5);
  px(ctx, red, px0 + 1, 23, 6, 1);
}

/** Safeway (Admiral, 2622 California; the Junction, 4754 42nd): brown block, the red S, carts by the doors. */
function safeway(ctx: Ctx, w: number, h: number) {
  const red = '#e4202c';
  px(ctx, '#7d726c', 0, 0, w, h);
  for (let x = 4; x < w; x += 8) px(ctx, '#f3e6cc', x, h - 7, 1, 5);
  shopBox(ctx, w, h, '#a87a56', '#8a6a52', { text: 'SAFEWAY', bg: '#f6f4ef', fg: red }, 3, 12);
  // the S logo left of the sign
  const lx = Math.round(w / 2) - textWidth('SAFEWAY') / 2 - 14;
  px(ctx, INK, lx, 8, 10, 10);
  px(ctx, red, lx + 1, 9, 8, 8);
  pixelText(ctx, 'S', lx + 3, 10, '#ffffff');
  // entry vestibule with glass, windows
  px(ctx, INK, 4, 22, w - 8, 1);
  for (const wx of [6, w - 22]) {
    px(ctx, INK, wx, 24, 16, 10);
    px(ctx, '#7fb3c8', wx + 1, 25, 14, 8);
  }
  px(ctx, INK, Math.round(w / 2) - 8, 23, 16, 14);
  px(ctx, '#d8efe6', Math.round(w / 2) - 7, 24, 14, 13);
  px(ctx, INK, Math.round(w / 2), 24, 1, 13);
  px(ctx, red, Math.round(w / 2) - 8, 22, 16, 1);
  carts(ctx, 4, h - 10, 5);
}

/** PCC Community Market, 2749 California Ave SW (Admiral): wood and glass, green sign, produce out front. */
function pccMarket(ctx: Ctx, w: number, h: number) {
  const green = '#2f7a3a';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  shopBox(ctx, w, h, '#b07a4a', '#5d6470', { text: 'PCC', bg: green, fg: '#f6f4ef' }, 3, 12);
  for (let x = 4; x < w - 2; x += 3) px(ctx, '#8f5f38', x, 17, 1, h - 30);
  pixelText(ctx, 'COMMUNITY MARKET', Math.round((w - textWidth('COMMUNITY MARKET')) / 2), 18, '#f6f4ef');
  // a long glass front
  px(ctx, INK, 3, 24, w - 6, 13);
  px(ctx, '#a9d8cc', 4, 25, w - 8, 11);
  for (let x = 4; x < w - 4; x += 10) px(ctx, '#5d6470', x, 25, 1, 11);
  px(ctx, INK, Math.round(w / 2) - 5, 26, 10, 11);
  px(ctx, '#d8efe6', Math.round(w / 2) - 4, 27, 8, 10);
  // produce stands out front
  for (const sx of [4, w - 24]) {
    px(ctx, INK, sx, h - 10, 20, 6);
    px(ctx, '#7a5a3a', sx + 1, h - 6, 18, 2);
    for (let i = 0; i < 6; i++) px(ctx, ['#e4202c', '#f47b20', '#ffd23f', '#4f9a4f', '#9b6ad1', '#76c85a'][i], sx + 1 + i * 3, h - 9, 3, 3);
  }
}

/** School of Rock, 4701 41st Ave SW: black front, red-and-yellow name, a guitar in the window. */
function schoolOfRock(ctx: Ctx, w: number, h: number) {
  const red = '#e4202c', yellow = '#ffd23f';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  shopBox(ctx, w, h, '#1c1b22', '#3a3540', { text: 'SCHOOL OF ROCK', bg: red, fg: yellow });
  // windows: a guitar in one, an amp in the other
  for (const wx of [4, w - 22]) {
    px(ctx, INK, wx, 22, 18, 13);
    px(ctx, '#3b4a6b', wx + 1, 23, 16, 11);
  }
  // guitar
  px(ctx, red, 8, 28, 6, 5);
  px(ctx, red, 9, 27, 4, 1);
  px(ctx, INK, 10, 30, 2, 1);
  px(ctx, '#8a5a34', 13, 24, 1, 5);
  px(ctx, '#8a5a34', 14, 23, 2, 2);
  // amp
  px(ctx, INK, w - 18, 26, 10, 8);
  px(ctx, '#3a3540', w - 17, 27, 8, 6);
  px(ctx, '#9a948e', w - 15, 28, 4, 4);
  px(ctx, yellow, w - 17, 27, 2, 1);
  // door with a lightning bolt
  px(ctx, INK, Math.round(w / 2) - 4, 22, 8, 17);
  px(ctx, '#2a1a12', Math.round(w / 2) - 3, 23, 6, 16);
  px(ctx, yellow, Math.round(w / 2), 26, 1, 3);
  px(ctx, yellow, Math.round(w / 2) - 1, 28, 1, 3);
}

/** BECU on Fauntleroy Way SW, by Alaska: a white credit-union branch, the navy band and name, glass front, an ATM. */
function becu(ctx: Ctx, w: number, h: number) {
  const navy = '#0a3a82';
  px(ctx, '#bdb7ad', 0, 0, w, h);
  shopBox(ctx, w, h, '#f3f0ea', navy, { text: 'BECU', bg: navy, fg: '#ffffff' }, 4, 10);
  // a thin sky-blue stripe under the roof band
  px(ctx, '#3fb0ff', 2, 8, w - 4, 1);
  // glass front either side of the doors
  for (const wx of [4, w - 22]) {
    px(ctx, INK, wx, 22, 18, 14);
    px(ctx, '#7fb3c8', wx + 1, 23, 16, 12);
    px(ctx, '#f3f0ea', wx + 9, 23, 1, 12);
    px(ctx, '#a9d8e8', wx + 2, 24, 3, 4);
  }
  // doors
  px(ctx, INK, Math.round(w / 2) - 5, 24, 10, 14);
  px(ctx, '#d8efe6', Math.round(w / 2) - 4, 25, 8, 13);
  px(ctx, INK, Math.round(w / 2), 25, 1, 13);
  // the ATM out front, screen lit
  px(ctx, INK, w - 9, h - 10, 6, 8);
  px(ctx, '#d8d3cc', w - 8, h - 9, 4, 6);
  px(ctx, '#3fb0ff', w - 7, h - 8, 2, 2);
  px(ctx, navy, w - 8, h - 5, 4, 1);
  // parking stripes
  for (let x = 4; x < 26; x += 7) px(ctx, '#f3f0ea', x, h - 7, 1, 6);
}

/**
 * Colman Pool, Lincoln Park: the heated saltwater pool out on Point Williams, right on the
 * beach — blue water in lanes, the white deck and its seawall edge, the low bathhouse, the
 * spiral tube slide.
 */
function colmanPool(ctx: Ctx, w: number, h: number) {
  const deck = '#ece6da', blue = '#2f8fd8', light = '#7fd0ff', rope = ['#e4202c', '#f3f0ea'];
  // the deck, its concrete seawall edge along the bottom
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - 2, w - 2, 2);
  px(ctx, INK, 0, 0, w, h - 1);
  px(ctx, deck, 1, 1, w - 2, h - 3);
  px(ctx, '#a8a29a', 1, h - 6, w - 2, 4);
  for (let x = 6; x < w - 2; x += 8) px(ctx, '#8a857c', x, h - 6, 1, 4);
  // the bathhouse along the top: green roof, doors
  px(ctx, INK, 3, 2, w - 22, 12);
  px(ctx, '#3f7f5f', 4, 3, w - 24, 4);
  px(ctx, '#f3f0ea', 4, 7, w - 24, 6);
  pixelText(ctx, 'COLMAN POOL', 8, 8, '#2a5a7a');
  for (const dx of [5, w - 25]) px(ctx, '#2a1a12', dx, 9, 2, 4);
  // the pool, lane ropes, the shine
  const top = 17, bot = h - 10;
  px(ctx, INK, 4, top - 1, w - 8, bot - top + 2);
  px(ctx, blue, 5, top, w - 10, bot - top);
  for (let y = top + 4; y < bot - 1; y += 5) for (let x = 6; x < w - 6; x += 2) px(ctx, rope[(x >> 1) % 2], x, y, 1, 1);
  for (const [sx, sy] of [[9, top + 2], [30, top + 7], [52, top + 12]]) px(ctx, light, sx, sy, 4, 1);
  // the spiral slide: a yellow tube corkscrewing down from its tower into the shallow end
  px(ctx, INK, w - 17, 1, 13, 14);
  px(ctx, '#c9c4bd', w - 16, 2, 11, 12);
  px(ctx, INK, w - 12, 0, 3, 3);
  const tube = '#ffd23f', tubeDark = '#e5a91a';
  for (let i = 0; i < 4; i++) {
    const y = 3 + i * 3;
    px(ctx, i % 2 ? tubeDark : tube, w - 15, y, 9, 2);
    px(ctx, INK, w - 15 + (i % 2 ? 0 : 8), y + 1, 1, 2);
  }
  px(ctx, tube, w - 11, 15, 3, top - 14);
  // a swimmer, a kickboard, the ladder
  px(ctx, '#e8a59a', 20, top + 8, 2, 2);
  px(ctx, '#ff7eb6', 36, top + 3, 4, 2);
  px(ctx, '#c9c4bd', 6, bot - 5, 1, 4);
  px(ctx, '#c9c4bd', 8, bot - 5, 1, 4);
}

/** Circa, 2605 California Ave SW (Admiral): the neighbourhood bistro — green awning, warm windows, tables out front. */
function circa(ctx: Ctx, w: number, h: number) {
  const green = '#2f5a3f', cream = '#f3e6cc';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  shopBox(ctx, w, h, '#6b3a2a', '#4a2a20', { text: 'CIRCA', bg: cream, fg: green });
  // green-and-cream awning
  for (let x = 2; x < w - 2; x += 4) px(ctx, x % 8 === 2 ? green : cream, x, 19, 4, 3);
  px(ctx, INK, 2, 22, w - 4, 1);
  // two warm windows, a lamp and a diner in each, the door between
  for (const wx of [4, w - 22]) {
    px(ctx, INK, wx, 24, 18, 12);
    px(ctx, '#e8b36a', wx + 1, 25, 16, 10);
    px(ctx, '#fff3b0', wx + 3, 26, 2, 2);
    px(ctx, '#7a4a2a', wx + 2, 32, 14, 1);
    px(ctx, '#2a1a12', wx + 10, 28, 3, 4);
  }
  px(ctx, INK, Math.round(w / 2) - 4, 24, 8, 15);
  px(ctx, green, Math.round(w / 2) - 3, 25, 6, 14);
  px(ctx, '#e8c25a', Math.round(w / 2) + 1, 31, 1, 2);
  // sidewalk tables
  for (const tx of [6, w - 12]) {
    px(ctx, INK, tx, h - 6, 7, 2);
    px(ctx, cream, tx + 1, h - 6, 5, 1);
    px(ctx, INK, tx + 3, h - 4, 1, 3);
    px(ctx, green, tx - 2, h - 5, 2, 3);
    px(ctx, green, tx + 7, h - 5, 2, 3);
  }
}

/** Admiral Bird, 2600 California Ave SW at Admiral Way: the coffee-and-flower shop (2014) — a bird on the sign, buckets of flowers out front. */
function admiralBird(ctx: Ctx, w: number, h: number) {
  const teal = '#2e8f8a', rose = '#ff7eb6';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  shopBox(ctx, w, h, '#f6efd8', teal, { text: 'ADMIRAL BIRD', bg: '#ffffff', fg: teal });
  // a little bird perched on the sign's corner
  const bx = w - 9, by = 7;
  px(ctx, INK, bx, by, 5, 4);
  px(ctx, '#3a6fd8', bx + 1, by + 1, 3, 2);
  px(ctx, '#ffd23f', bx + 5, by + 2, 1, 1);
  px(ctx, INK, bx + 1, by + 4, 1, 1);
  // big café windows: a coffee cup in one, flowers in the other
  for (const wx of [4, w - 22]) {
    px(ctx, INK, wx, 22, 18, 14);
    px(ctx, '#a9d8cc', wx + 1, 23, 16, 12);
    px(ctx, '#d8efe6', wx + 2, 24, 3, 4);
  }
  px(ctx, '#f3f0ea', 9, 28, 6, 5);
  px(ctx, '#7a4a2a', 10, 28, 4, 1);
  px(ctx, '#f3f0ea', 15, 29, 1, 2);
  for (let i = 0; i < 4; i++) px(ctx, [rose, '#ffd23f', '#e4202c', '#9b6ad1'][i], w - 19 + i * 3, 27, 2, 2);
  px(ctx, '#4f9a4f', w - 19, 29, 11, 4);
  // the door
  px(ctx, INK, Math.round(w / 2) - 4, 24, 8, 15);
  px(ctx, teal, Math.round(w / 2) - 3, 25, 6, 14);
  px(ctx, '#d8efe6', Math.round(w / 2) - 2, 26, 4, 5);
  // flower buckets along the sidewalk
  for (let x = 4; x < w - 4; x += 5) {
    if (x > Math.round(w / 2) - 7 && x < Math.round(w / 2) + 4) continue;
    px(ctx, '#3a6fd8', x, h - 6, 4, 4);
    px(ctx, [rose, '#ffd23f', '#f6f4ef', '#e4202c', '#9b6ad1'][(x / 5) % 5 | 0], x, h - 9, 4, 3);
    px(ctx, '#4f9a4f', x + 1, h - 7, 2, 1);
  }
}

/**
 * Uptown Espresso, 4301 SW Edmunds St at California (the Junction), home of the velvet foam:
 * an espresso-brown front, cream sign, red awning, a latte with a foam heart in the window,
 * tables out on the corner.
 */
function uptownEspresso(ctx: Ctx, w: number, h: number) {
  const red = '#a3202a', cream = '#f3e6cc', foam = '#f6f4ef';
  px(ctx, '#c8c2b8', 0, 0, w, h);
  shopBox(ctx, w, h, '#3a241c', '#24160f', { text: 'UPTOWN ESPRESSO', bg: cream, fg: red });
  // red-and-cream awning
  for (let x = 2; x < w - 2; x += 4) px(ctx, x % 8 === 2 ? red : cream, x, 19, 4, 3);
  px(ctx, INK, 2, 22, w - 4, 1);
  // two warm windows, a lamp and the counter in each
  for (const wx of [4, w - 30]) {
    px(ctx, INK, wx, 24, 26, 12);
    px(ctx, '#e8b36a', wx + 1, 25, 24, 10);
    px(ctx, '#fff3b0', wx + 3, 26, 2, 2);
    px(ctx, '#7a4a2a', wx + 2, 32, 22, 1);
  }
  // a big latte in the left window, a foam heart on top
  px(ctx, INK, 12, 26, 9, 6);
  px(ctx, foam, 13, 26, 7, 5);
  px(ctx, '#b07a4a', 14, 27, 5, 2);
  px(ctx, foam, 15, 27, 1, 1);
  px(ctx, foam, 17, 27, 1, 1);
  px(ctx, foam, 16, 28, 1, 1);
  px(ctx, foam, 20, 27, 2, 1);
  px(ctx, foam, 21, 28, 1, 2);
  // the pastry case in the right one
  for (let i = 0; i < 4; i++) px(ctx, ['#e8c25a', '#c97a3a', '#ff7eb6', '#e8c25a'][i], w - 26 + i * 5, 30, 3, 2);
  // the door
  const d = Math.round(w / 2);
  px(ctx, INK, d - 4, 24, 8, 15);
  px(ctx, red, d - 3, 25, 6, 14);
  px(ctx, '#d8efe6', d - 2, 26, 4, 5);
  px(ctx, '#e8c25a', d + 1, 32, 1, 2);
  // sidewalk tables
  for (const tx of [6, w - 13]) {
    px(ctx, INK, tx, h - 6, 7, 2);
    px(ctx, cream, tx + 1, h - 6, 5, 1);
    px(ctx, INK, tx + 3, h - 4, 1, 3);
    px(ctx, red, tx - 2, h - 5, 2, 3);
    px(ctx, red, tx + 7, h - 5, 2, 3);
  }
}

/** Pixel text stacked vertically (one letter per row), 6 px per letter. */
function pixelTextDown(ctx: Ctx, text: string, x: number, y: number, color: string) {
  [...text].forEach((ch, i) => pixelText(ctx, ch, x, y + i * 6, color));
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    px(ctx, color, cx - half, cy + y, half * 2 + 1, 1);
  }
}

/**
 * Shadowland (4458 California Ave SW): the retro neon sign — a mint bar reading SHADOW, a
 * dark V-shaped pylon with a round disc, and LAND stacked down a white column.
 */
function shadowland(ctx: Ctx, w: number, h: number) {
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - 3, w - 2, 3);
  // white two-storey facade with dark windows
  px(ctx, '#f1efe9', 0, 10, w, h - 13);
  px(ctx, '#2f3646', 3, 22, 10, h - 28);
  px(ctx, '#3c4458', 4, 23, 3, h - 30);
  px(ctx, '#7c8a7f', 0, h - 7, w, 3); // the old awning band
  for (let x = 2; x < w; x += 6) px(ctx, '#9ad1c3', x, h - 6, 3, 1);
  // the sign: mint top bar…
  px(ctx, INK, 0, 2, w, 10);
  px(ctx, '#bfe6dc', 1, 3, w - 2, 8);
  px(ctx, '#e8f7f3', 1, 3, w - 2, 1);
  pixelText(ctx, 'SHADOW', Math.max(1, Math.round((w - 23) / 2)), 5, '#f9fbfa');
  pixelText(ctx, 'SHADOW', Math.max(1, Math.round((w - 23) / 2)) + 1, 6, '#5b8f84');
  // …the V pylon with its disc…
  for (let y = 0; y < 26; y++) {
    const half = Math.max(1, Math.round(7 - y * 0.27));
    px(ctx, '#5a5e66', 12 - half, 12 + y, half * 2, 1);
    px(ctx, '#7a7f88', 12 - half, 12 + y, 1, 1);
  }
  disc(ctx, 12, 17, 3, '#c9cdd3');
  px(ctx, '#eef0f2', 11, 15, 2, 1);
  // …and LAND down the white column on the right
  px(ctx, INK, w - 9, 11, 9, 28);
  px(ctx, '#ffffff', w - 8, 12, 7, 26);
  pixelTextDown(ctx, 'LAND', w - 6, 13, '#3a8f7c');
  px(ctx, INK, 0, h - 3, w, 1);
}

/**
 * 1918 45th Ave SW, Admiral — a 1½-storey Craftsman: dark asphalt roof with a wide shed
 * dormer in brown shingles (a pair of white double-hung windows), tan lap siding under a deep
 * porch, the dark front door with its little panes, wide brown steps, a big rhododendron
 * with pumpkins on top, a fir behind, and an autumn leaf pile on the lawn (family photo).
 */
function craftsman45th(ctx: Ctx, w: number, h: number) {
  const roof = '#4c4f57', roofLight = '#62666e', shingle = '#8a6a55', shingleLine = '#76584a';
  const siding = '#cdb994', sidingLine = '#b5a17c', trim = '#f3f0ea', wood = '#7a6150', woodLight = '#94796a';
  const base = h - 3;
  lawn(ctx, w, h);
  // the fir behind, over the right of the roof
  for (let y = 0; y < 22; y++) {
    const half = Math.min(6, 1 + Math.floor(y / 3));
    px(ctx, '#24513a', 40 - half, y, half * 2 + 1, 1);
    if (y % 3 === 2) px(ctx, '#356b4c', 40 - half + 1, y, half, 1);
  }
  px(ctx, 'rgba(0,0,0,0.2)', 2, base, w - 2, 3);
  // the main roof: eaves run the full width, gable ends slope off at the sides
  hipRoof(ctx, 2, w - 2, 10, 25, 0.45, roof, roofLight);
  // the shed dormer: shingled box under its own flat eave
  px(ctx, INK, 9, 3, 30, 1);
  px(ctx, trim, 9, 4, 30, 1);
  px(ctx, roof, 10, 5, 28, 1);
  px(ctx, shingle, 11, 6, 26, 11);
  for (let y = 7; y < 17; y += 2) for (let x = 11 + (y % 4 === 1 ? 2 : 0); x < 37; x += 4) px(ctx, shingleLine, x, y, 1, 1);
  for (let y = 8; y < 17; y += 2) px(ctx, shingleLine, 11, y, 26, 1);
  px(ctx, trim, 15, 7, 18, 9); // the window pair in one white frame
  for (const wx of [16, 25]) {
    px(ctx, '#3b4a6b', wx, 8, 7, 3);
    px(ctx, '#3b4a6b', wx, 12, 7, 3);
    px(ctx, '#6f86b8', wx, 8, 1, 1);
    px(ctx, trim, wx + 3, 8, 1, 3); // upper sash muntin
  }
  px(ctx, INK, 10, 6, 1, 11);
  px(ctx, INK, 37, 6, 1, 11);
  px(ctx, trim, 34, 6, 1, 13); // downspout off the dormer
  // main eave and gutter
  px(ctx, INK, 0, 25, w, 1);
  px(ctx, trim, 0, 26, w, 1);
  // under the porch: tan lap siding, shaded at the top
  px(ctx, siding, 2, 27, w - 4, 18);
  for (let y = 29; y < 45; y += 2) px(ctx, sidingLine, 2, y, w - 4, 1);
  px(ctx, 'rgba(0,0,0,0.18)', 2, 27, w - 4, 3);
  // the front door: white casing, dark wood, a row of little panes, the house number beside
  px(ctx, trim, 10, 30, 8, 13);
  px(ctx, '#4a3328', 11, 31, 6, 12);
  for (let i = 0; i < 3; i++) px(ctx, '#9fb6c9', 12 + i * 2 - (i ? 0 : 0), 32, 1, 2);
  px(ctx, '#3b2a22', 12, 35, 4, 1);
  px(ctx, '#c9a35a', 16, 37, 1, 1); // knob
  px(ctx, '#3a3a3a', 5, 31, 4, 2); // 1918
  px(ctx, '#d8d0c0', 5, 32, 1, 1);
  // the front window
  paneWindow(ctx, 29, 30, 9, 7, 2, 1, trim);
  // porch posts and the downspout by the steps
  px(ctx, trim, 2, 27, 2, 16);
  px(ctx, trim, 21, 27, 2, 16);
  px(ctx, trim, 23, 27, 1, 16);
  // wide wooden steps down to the walk, with a rail on the right
  for (let i = 0; i < 5; i++) {
    const y = 39 + i, x0 = 3 - Math.min(i, 2);
    px(ctx, i % 2 ? wood : woodLight, x0, y, 20 - x0 + 1, 1);
  }
  px(ctx, INK, 1, 44, 22, 1);
  px(ctx, wood, 22, 36, 1, 8);
  px(ctx, wood, 20, 36, 3, 1);
  // the rhododendron, with pumpkins on top
  for (const [cx, cy, r] of [[29, 41, 5], [36, 39, 6], [43, 40, 5], [40, 43, 4]] as const) disc(ctx, cx, cy, r, '#2f5e46');
  for (let i = 0; i < 18; i++) px(ctx, i % 3 ? '#467d5d' : '#5c9470', 26 + ((i * 7) % 21), 35 + ((i * 5) % 10), 1, 1);
  px(ctx, '#e07a2a', 29, 36, 2, 2);
  px(ctx, '#f0a040', 33, 34, 2, 2);
  px(ctx, '#e8e2d0', 26, 37, 2, 2);
  px(ctx, '#3a5a2a', 30, 35, 1, 1);
  // the leaf pile on the lawn
  for (let y = 0; y < 5; y++) {
    const half = 3 + y * 2;
    px(ctx, y % 2 ? '#9a5a2a' : '#b5702e', 34 - half, base - 2 + y, half * 2, 1);
  }
  for (let i = 0; i < 14; i++) px(ctx, ['#d9a03a', '#c0602a', '#7a4422'][i % 3], 25 + ((i * 11) % 19), base - 1 + ((i * 3) % 4), 1, 1);
  px(ctx, '#d9a03a', 21, base + 2, 1, 1);
  px(ctx, '#c0602a', 45, base + 1, 1, 1);
}

/**
 * Dakota Place Park (4304 SW Dakota St, at California): the old California Avenue Substation,
 * a one-story brick Seattle City Light building on a slight rise, a city landmark (2003),
 * renovated in 2012 as a park building; its front door faces Dakota. A paved plaza on its
 * west side with a tree and a bench, lawn and shrubs round it, the brown Seattle Parks sign.
 */
function dakotaPlace(ctx: Ctx, w: number, h: number) {
  const brick = '#a4553f', mortar = '#8a4536', brickLight = '#b8664c';
  const concrete = '#d9d3c4', concreteShade = '#b9b2a2', glass = '#34465e';
  lawn(ctx, w, h);

  // the plaza on the west side: pale pavers with joints
  const pw = 22;
  px(ctx, '#cfc6b2', 0, 14, pw, h - 20);
  for (let y = 17; y < h - 6; y += 4) px(ctx, '#bdb39d', 0, y, pw, 1);
  for (let x = 3; x < pw; x += 5) px(ctx, '#bdb39d', x, 14, 1, h - 20);
  // a path from the plaza down to Dakota
  px(ctx, '#cfc6b2', 8, h - 6, 7, 6);

  // the building: shadow, flat roof seen from just above, a concrete parapet cap
  const bx = 24, bw = w - bx - 2, top = 6, wall = 13, base = h - 9;
  px(ctx, 'rgba(0,0,0,0.22)', bx - 2, base, bw + 3, 3);
  px(ctx, INK, bx - 1, top - 1, bw + 2, wall - top + 1);
  px(ctx, '#7d7a73', bx, top, bw, wall - top - 2);
  for (let i = 0; i < 14; i++) px(ctx, i % 2 ? '#8e8b83' : '#6d6a63', bx + 1 + ((i * 7) % (bw - 2)), top + 1 + ((i * 3) % 4), 1, 1);
  px(ctx, concrete, bx - 1, wall - 2, bw + 2, 2);
  px(ctx, INK, bx - 1, wall, bw + 2, 1);
  // brick walls, a concrete band near the top
  px(ctx, INK, bx - 1, wall, bw + 2, base - wall + 1);
  px(ctx, brick, bx, wall + 1, bw, base - wall - 1);
  for (let y = wall + 5; y < base; y += 2) px(ctx, mortar, bx, y, bw, 1);
  px(ctx, brickLight, bx, wall + 1, bw, 1);
  px(ctx, concrete, bx, wall + 2, bw, 2);
  px(ctx, concreteShade, bx, wall + 3, bw, 1);

  // tall many-paned windows (the industrial sash put back in the 2012 renovation), concrete sills
  const door = bx + Math.round(bw / 2) - 4;
  for (const wx of [bx + 3, bx + bw - 10]) {
    px(ctx, INK, wx - 1, wall + 6, 9, 15);
    paneWindow(ctx, wx, wall + 7, 7, 13, 3, 4, '#e9e4d8', glass);
    px(ctx, concrete, wx - 1, wall + 21, 9, 1);
  }

  // the front door on Dakota: a concrete surround, double doors, a lamp above
  px(ctx, INK, door - 2, wall + 5, 12, base - wall - 5);
  px(ctx, concrete, door - 1, wall + 6, 10, base - wall - 6);
  px(ctx, INK, door + 1, wall + 9, 6, base - wall - 9);
  px(ctx, '#3d5a4c', door + 2, wall + 10, 2, base - wall - 10);
  px(ctx, '#3d5a4c', door + 4, wall + 10, 2, base - wall - 10);
  px(ctx, '#e8c25a', door + 3, wall + 16, 1, 1);
  px(ctx, '#e8c25a', door + 4, wall + 16, 1, 1);
  px(ctx, '#fff3b0', door + 3, wall + 7, 2, 1);

  // up from the sidewalk: steps to the door, a low wall along the rise
  for (let i = 0; i < 3; i++) px(ctx, i % 2 ? '#c8c2b8' : '#d8d3cc', door - 2 - i, base + 1 + i * 2, 12 + i * 2, 2);
  px(ctx, INK, bx - 1, base + 1, door - bx - 2, 1);
  px(ctx, concrete, bx - 1, base + 2, door - bx - 2, 3);
  px(ctx, INK, door + 12, base + 1, bx + bw - door - 11, 1);
  px(ctx, concrete, door + 12, base + 2, bx + bw - door - 11, 3);

  // shrubs along the foundation
  for (const [sx, sw] of [[bx, 9], [bx + bw - 9, 9]] as const) {
    px(ctx, INK, sx, base - 3, sw, 4);
    px(ctx, '#2f6b48', sx + 1, base - 2, sw - 2, 3);
    for (let i = sx + 2; i < sx + sw - 1; i += 3) px(ctx, '#4f8f63', i, base - 2, 1, 1);
  }

  // on the plaza: a tree, a bench, a planter of flowers
  px(ctx, 'rgba(0,0,0,0.2)', 3, 25, 13, 3);
  px(ctx, '#6b4a2b', 9, 16, 2, 10);
  px(ctx, INK, 3, 3, 14, 13);
  px(ctx, '#3f7d4e', 4, 4, 12, 11);
  px(ctx, '#5a9a62', 5, 5, 5, 4);
  px(ctx, '#2f6b48', 11, 10, 4, 4);
  px(ctx, INK, 2, 5, 1, 9);
  px(ctx, INK, 17, 5, 1, 9);
  px(ctx, INK, 12, 30, 9, 1);
  px(ctx, '#8a5a3a', 12, 31, 9, 2);
  px(ctx, INK, 13, 33, 1, 2);
  px(ctx, INK, 19, 33, 1, 2);
  px(ctx, INK, 1, 31, 7, 5);
  px(ctx, '#7a7468', 2, 32, 5, 3);
  for (const [fx, c] of [[2, '#ff7eb6'], [4, '#ffd23f'], [6, '#ff7eb6']] as const) px(ctx, c, fx, 31, 1, 1);

  // the Seattle Parks sign, brown with cream letters, by the sidewalk
  const sign = 'DAKOTA';
  const sw = textWidth(sign) + 4;
  px(ctx, INK, 1, h - 11, sw + 2, 9);
  px(ctx, '#5a3a24', 2, h - 10, sw, 7);
  pixelText(ctx, sign, 4, h - 9, '#f3e6cc');
  px(ctx, INK, 4, h - 2, 1, 2);
  px(ctx, INK, sw - 1, h - 2, 1, 2);
}


const SPRITES: Record<string, (ctx: Ctx, w: number, h: number, id: string) => void> = {
  becu,
  circa,
  'admiral-bird': admiralBird,
  'uptown-espresso': uptownEspresso,
  'colman-pool': colmanPool,
  'caffe-ladro': caffeLadro,
  'box-bar': boxBar,
  'trader-joes': traderJoes,
  'shell-station': shellStation,
  safeway,
  'pcc-market': pccMarket,
  'school-of-rock': schoolOfRock,
  'west-seattle-library': westSeattleLibrary,
  'fire-station': fireStation,
  'post-office': postOffice,
  ymca,
  'west-seattle-nursery': westSeattleNursery,
  'seven-eleven': sevenEleven,
  shadowland,
  'satterlee-house': satterleeHouse,
  'craftsman-45th': craftsman45th,
  'hainsworth-house': hainsworthHouse,
  'alki-homestead': alkiHomestead,
  'undersea-aviary': underseaAviary,
  'admiral-theatre': admiralTheatre,
  'easy-street-records': easyStreetRecords,
  'gas-station-76': gasStation76,
  'dakota-place': dakotaPlace,
  // a whole block face of shops; the landmark id picks the face in content/storefronts.ts
  storefronts: (ctx, w, h, id) => drawBlockFace(ctx, id, w, h),
};

export const hasLandmarkSprite = (sprite: string) => sprite in SPRITES;

/** Draw landmark `sprite` with its top-left at the current origin, `w`×`h` px. */
export function drawLandmark(ctx: Ctx, sprite: string, w: number, h: number, id = sprite) {
  SPRITES[sprite]?.(ctx, w, h, id);
}
