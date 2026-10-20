/**
 * Hand-drawn shop fronts for a few Junction favourites, drawn face-on (SNES-town style) in
 * the shop's slice of its block face (see storefronts.ts / content/storefronts.ts). Each
 * gets the box it fills, in canvas pixels; they adapt to its width and height.
 *
 * Husky Deli, Poggie Tavern and Pegasus Book Exchange follow street photos (Wikimedia
 * Commons, "Seattle, August 2026" series). Bakery Nouveau follows its sign on the other
 * shop; the Antique Mall had no photo to go on and is a guess.
 */
import { pixelText, textWidth } from './landmarks';
import { INK } from './palette';

type Ctx = CanvasRenderingContext2D;
type Facade = (ctx: Ctx, x: number, y: number, w: number, h: number) => void;

const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
/** centred pixel text */
const centred = (ctx: Ctx, s: string, x: number, w: number, y: number, color: string) =>
  pixelText(ctx, s, x + Math.round((w - textWidth(s)) / 2), y, color);

/** Husky Deli: gold HUSKY on purple 3D blocks in the big window, purple + yellow trim, fan-braced bulkhead. */
const huskyDeli: Facade = (ctx, x, y, w, h) => {
  const purple = '#4b2e83';
  const gold = '#e8b33a';
  // striped canvas canopy
  for (let i = 0; i < w; i++) px(ctx, Math.floor((i + 0) / 3) % 2 ? '#3a3340' : gold, x + i, y, 1, 4);
  px(ctx, INK, x, y + 4, w, 1);
  px(ctx, '#f2c14e', x, y + 5, w, 1); // yellow trim
  const by = y + h - 7; // bulkhead top
  // purple frame, big glass
  px(ctx, purple, x, y + 6, w, by - y - 6);
  px(ctx, '#3a3046', x + 2, y + 7, w - 14, by - y - 8); // dark wood interior through the glass
  px(ctx, '#9fd8ff', x + 3, y + 8, 6, 1); // reflection
  px(ctx, '#9fd8ff', x + 3, y + 9, 3, 1);
  // the door at the end, glazed
  px(ctx, '#6f86b8', x + w - 10, y + 7, 7, by - y - 7);
  px(ctx, purple, x + w - 7, y + 7, 1, by - y - 7);
  // HUSKY: gold letters, each on a purple block set up and to the right; DELICATESSEN under
  const gw = w - 14;
  const gy = y + 7; // glass top
  const tall = by - gy >= 14;
  const ty = tall ? gy + 1 : gy + Math.floor((by - gy - 5) / 2);
  const hx = x + 2 + Math.round((gw - textWidth('HUSKY') - 4) / 2);
  for (let i = 0; i < 5; i++) {
    px(ctx, '#7a5cc4', hx + i * 5 + 1, ty - 1, 4, 6);
    pixelText(ctx, 'HUSKY'[i], hx + i * 5, ty + 1, gold);
  }
  if (tall) centred(ctx, 'DELICATESSEN', x + 2, gw, ty + 7, gold);
  // tan bulkhead with purple fan bracing
  px(ctx, '#c8b48a', x, by, w, 6);
  px(ctx, purple, x, by, w, 1);
  for (let fx = x + 6; fx < x + w - 4; fx += 12) {
    px(ctx, purple, fx, by + 1, 1, 5);
    for (let k = 1; k < 6; k++) {
      px(ctx, purple, fx - k, by + 6 - k, 1, 1);
      px(ctx, purple, fx + k, by + 6 - k, 1, 1);
    }
  }
  px(ctx, INK, x, y + h - 1, w, 1);
};

/** Poggie Tavern: teal-green wood front under the canopy, the red box sign, 4717, slate below. */
const poggieTavern: Facade = (ctx, x, y, w, h) => {
  const teal = '#1f4e4a';
  // dark canopy and its beams
  px(ctx, '#2b2b33', x, y, w, 4);
  for (let i = x + 3; i < x + w; i += 10) px(ctx, '#4a4a55', i, y, 2, 4);
  px(ctx, INK, x, y + 4, w, 1);
  // the red box sign
  const label = 'POGGIE TAVERN';
  const sw = Math.min(w - 20, textWidth(label) + 6);
  px(ctx, '#c8102e', x + 2, y + 5, sw, 9);
  px(ctx, '#ffffff', x + 3, y + 6, sw - 2, 7);
  centred(ctx, textWidth(label) + 4 <= sw - 2 ? label : 'POGGIE', x + 3, sw - 2, y + 7, '#c8102e');
  // teal frame with big dark windows
  const fy = y + 14;
  const sy = y + h - 8; // slate bulkhead top
  px(ctx, teal, x, fy, w, y + h - fy);
  px(ctx, teal, x + sw + 2, y + 5, w - sw - 2, 9);
  pixelText(ctx, '4717', x + w - 17, y + 7, '#e0322b');
  const panes = 3;
  const pw = Math.floor((w - 4 - (panes - 1) * 3) / panes);
  for (let i = 0; i < panes; i++) {
    const wx = x + 2 + i * (pw + 3);
    px(ctx, '#2e3a55', wx, fy + 1, pw, sy - fy - 2);
    px(ctx, '#4f6390', wx + 1, fy + 2, Math.max(1, pw - 6), 1); // reflections
    px(ctx, '#ffd166', wx + pw - 4, fy + 3, 2, 2); // a warm light inside
  }
  // green slate stones
  const stones = ['#8fb9a8', '#a9d3c0', '#76a291'];
  for (let i = 0; i < w; i += 4) {
    for (let j = 0; j < 6; j += 3) {
      px(ctx, stones[(i * 3 + j * 5 + (j ? 2 : 0)) % 3], x + i + (j ? 2 : 0), sy + j, 3, 2);
    }
  }
  px(ctx, teal, x, sy - 1, w, 1);
  px(ctx, INK, x, y + h - 1, w, 1);
};

/** Pegasus Book Exchange: dark board siding, the pegasus sign, stone piers, painted window, BOOKS. */
const pegasusBooks: Facade = (ctx, x, y, w, h) => {
  // dark board siding above
  const sy = y + Math.min(10, Math.floor(h * 0.42));
  px(ctx, '#4a3a30', x, y, w, sy - y);
  for (let i = x + 1; i < x + w; i += 3) px(ctx, '#3a2c24', i, y, 1, sy - y);
  px(ctx, INK, x, y, w, 1);
  // the sign: navy, white border, a blue pegasus and the name
  const signW = Math.min(w - 6, 46);
  px(ctx, '#e8e8f0', x + 3, y + 1, signW, sy - y - 2);
  px(ctx, '#1f2a5a', x + 4, y + 2, signW - 2, sy - y - 4);
  const hx = x + 6;
  const hy = y + 3;
  px(ctx, '#5b8bd8', hx, hy + 2, 5, 2); // body
  px(ctx, '#5b8bd8', hx + 5, hy + 1, 1, 2); // neck + head
  px(ctx, '#8fb4ff', hx + 1, hy, 3, 2); // wing
  px(ctx, '#5b8bd8', hx, hy + 4, 1, 1);
  px(ctx, '#5b8bd8', hx + 4, hy + 4, 1, 1);
  pixelText(ctx, 'PEGASUS', hx + 9, hy, '#ffffff');
  // storefront: stone piers, the painted window, recessed door, BOOKS blade
  const by = y + h - 2;
  const stone = (sx: number, sw: number) => {
    px(ctx, '#a39d92', sx, sy, sw, by - sy);
    for (let j = sy + 1; j < by; j += 2) px(ctx, '#8a8479', sx, j, sw, 1);
    for (let j = sy; j < by; j += 4) px(ctx, '#bdb7ab', sx + (j % 8 ? 1 : 3), j, 2, 1);
  };
  stone(x, 4);
  stone(x + w - 4, 4);
  const ww = Math.floor((w - 8) * 0.55);
  const wx = x + 4;
  px(ctx, '#f4ead0', wx, sy, ww, by - sy);
  // the mural: magenta swoosh, a white horse with a yellow wing, teal mane, flowers
  px(ctx, '#ff7eb6', wx, sy + 2, ww, 2);
  px(ctx, '#ffffff', wx + 4, sy + 4, 6, 3);
  px(ctx, '#ffffff', wx + 9, sy + 2, 2, 3);
  px(ctx, '#2ec4b6', wx + 10, sy + 1, 2, 2);
  px(ctx, '#ffd166', wx + 3, sy + 1, 4, 3);
  for (let i = wx + 14; i < wx + ww - 2; i += 5) px(ctx, ['#ffd166', '#a77bff', '#57cc99'][i % 3], i, sy + 5 + (i % 2), 2, 2);
  px(ctx, '#e0322b', wx + 1, by - 3, ww - 2, 1); // the book shelf
  px(ctx, '#3a86ff', wx + 1, by - 2, ww - 2, 1);
  // door, recessed
  const dx = wx + ww + 1;
  px(ctx, '#2b2350', dx, sy, 7, by - sy);
  px(ctx, '#6f86b8', dx + 1, sy + 1, 5, by - sy - 2);
  // BOOKS blade sign
  const bx = dx + 9;
  const bw = x + w - 4 - bx - 1;
  if (bw >= 21) {
    px(ctx, '#e8e8f0', bx, sy + 1, bw, 9);
    px(ctx, '#1f2a5a', bx + 1, sy + 2, bw - 2, 7);
    centred(ctx, 'BOOKS', bx + 1, bw - 2, sy + 3, '#ffffff');
  }
  px(ctx, '#d9cbb0', x, by, w, 1); // mosaic step
  px(ctx, INK, x, y + h - 1, w, 1);
};

/** Bakery Nouveau: restored 1926 front, the cream oval with brown script, glowing cases. */
const bakeryNouveau: Facade = (ctx, x, y, w, h) => {
  const bronze = '#3a2e2a';
  // stucco parapet with a dark trim line
  px(ctx, '#e6dccb', x, y, w, 5);
  px(ctx, '#cfc3ae', x, y + 4, w, 1);
  px(ctx, INK, x, y, w, 1);
  // the oval sign on iron brackets
  const label = 'BAKERY NOUVEAU';
  const tw = textWidth(label);
  const ow = Math.min(w - 6, tw + 10);
  const ox = x + Math.round((w - ow) / 2);
  const oy = y + 5;
  px(ctx, '#5a3a22', ox + 3, oy, ow - 6, 9);
  px(ctx, '#5a3a22', ox + 1, oy + 1, ow - 2, 7);
  px(ctx, '#5a3a22', ox, oy + 2, ow, 5);
  px(ctx, '#efe2cf', ox + 3, oy + 1, ow - 6, 7);
  px(ctx, '#efe2cf', ox + 1, oy + 2, ow - 2, 5);
  centred(ctx, tw + 4 <= ow ? label : 'NOUVEAU', ox, ow, oy + 2, '#5a3a22');
  px(ctx, bronze, ox - 3, oy + 1, 3, 1); // brackets
  px(ctx, bronze, ox + ow, oy + 1, 3, 1);
  // bronze storefront with warm glass and the pastry cases
  const gy = oy + 10;
  const by = y + h - 4;
  px(ctx, bronze, x, gy, w, y + h - gy);
  const door = x + Math.round(w / 2) - 3;
  for (const [gx, gw] of [[x + 2, door - x - 3], [door + 7, x + w - door - 9]] as const) {
    px(ctx, '#f6d58a', gx, gy + 1, gw, by - gy - 1);
    px(ctx, '#fff1c4', gx + 1, gy + 1, gw - 2, 1); // lamps
    // the case: croissants, macarons, tarts
    const treats = ['#d99a4e', '#ff9ec4', '#9be15d', '#c0392b', '#f4ead0'];
    for (let i = gx + 1; i < gx + gw - 1; i += 3) px(ctx, treats[(i >> 1) % treats.length], i, by - 3, 2, 2);
    px(ctx, '#c9b38a', gx, by - 1, gw, 1);
  }
  px(ctx, '#2b2350', door, gy + 1, 6, y + h - gy - 2);
  px(ctx, '#f6d58a', door + 1, gy + 2, 4, 3);
  px(ctx, INK, x, y + h - 1, w, 1);
};

/** Antique Mall (a guess): an old brick front, cornice, upstairs windows, the name board, window of finds. */
const antiqueMall: Facade = (ctx, x, y, w, h) => {
  const brick = '#9a4a3a';
  px(ctx, brick, x, y, w, h);
  for (let j = y + 2; j < y + h; j += 3) px(ctx, '#86402f', x, j, w, 1);
  // cream cornice
  px(ctx, '#efe2bf', x, y, w, 2);
  for (let i = x + 1; i < x + w; i += 2) px(ctx, '#c9b98f', i, y + 2, 1, 1);
  px(ctx, INK, x, y, w, 1);
  // upstairs: arched windows
  for (let wx = x + 4; wx < x + w - 6; wx += 10) {
    px(ctx, '#efe2bf', wx, y + 4, 6, 7);
    px(ctx, '#3b4a6b', wx + 1, y + 5, 4, 5);
    px(ctx, '#efe2bf', wx + 1, y + 5, 1, 1);
    px(ctx, '#efe2bf', wx + 4, y + 5, 1, 1);
    px(ctx, '#6f86b8', wx + 1, y + 7, 1, 2);
  }
  // the name board
  const ny = y + 12;
  px(ctx, '#1e4d3a', x + 2, ny, w - 4, 8);
  px(ctx, '#e8b33a', x + 2, ny, w - 4, 1);
  px(ctx, '#e8b33a', x + 2, ny + 7, w - 4, 1);
  centred(ctx, textWidth('ANTIQUE MALL') <= w - 6 ? 'ANTIQUE MALL' : 'ANTIQUES', x + 2, w - 4, ny + 2, '#f4ead0');
  // display windows full of finds, door in the middle
  const gy = ny + 9;
  const by = y + h - 3;
  if (by - gy < 4) return;
  const door = x + Math.round(w / 2) - 3;
  for (const [gx, gw] of [[x + 2, door - x - 3], [door + 7, x + w - door - 9]] as const) {
    px(ctx, '#f6e7b0', gx, gy, gw, by - gy);
    // a lamp, a chair, a clock, a vase
    const mid = gx + Math.floor(gw / 2);
    px(ctx, '#ffd166', gx + 2, gy + 1, 4, 2);
    px(ctx, '#7a5a3a', gx + 3, gy + 3, 1, by - gy - 3);
    px(ctx, '#8a4f2a', mid, by - 4, 4, 1);
    px(ctx, '#8a4f2a', mid, by - 7, 1, 7);
    px(ctx, '#8a4f2a', mid + 3, by - 4, 1, 4);
    px(ctx, '#2b2350', gx + gw - 6, gy + 1, 4, 4);
    px(ctx, '#ffffff', gx + gw - 5, gy + 2, 2, 2);
    px(ctx, '#2ec4b6', gx + gw - 4, by - 3, 2, 3);
  }
  px(ctx, '#2b2350', door, gy, 6, y + h - gy - 1);
  px(ctx, '#6f86b8', door + 1, gy + 1, 4, 3);
  px(ctx, INK, x, y + h - 1, w, 1);
};

export const FACADES: Record<string, Facade> = {
  'husky-deli': huskyDeli,
  'poggie-tavern': poggieTavern,
  'pegasus-books': pegasusBooks,
  'bakery-nouveau': bakeryNouveau,
  'antique-mall': antiqueMall,
};
