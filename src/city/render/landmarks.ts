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

const SPRITES: Record<string, (ctx: Ctx, w: number, h: number, id: string) => void> = {
  'seven-eleven': sevenEleven,
  'satterlee-house': satterleeHouse,
  'hainsworth-house': hainsworthHouse,
  'alki-homestead': alkiHomestead,
  'undersea-aviary': underseaAviary,
  'admiral-theatre': admiralTheatre,
  'easy-street-records': easyStreetRecords,
  'gas-station-76': gasStation76,
  // a whole block face of shops; the landmark id picks the face in content/storefronts.ts
  storefronts: (ctx, w, h, id) => drawBlockFace(ctx, id, w, h),
};

export const hasLandmarkSprite = (sprite: string) => sprite in SPRITES;

/** Draw landmark `sprite` with its top-left at the current origin, `w`×`h` px. */
export function drawLandmark(ctx: Ctx, sprite: string, w: number, h: number, id = sprite) {
  SPRITES[sprite]?.(ctx, w, h, id);
}
