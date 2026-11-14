/**
 * Your rabbit's look (idea box #38 "more character customization", #34 "little hats the
 * rabbits could wear"): fur, scarf and hat, picked in the LOOK panel, remembered in this
 * browser, and sent with your rabbit so everyone sees it (one number on the visitors wire).
 * The choosing and the code are pure + tested; `dress()` paints a sprite set.
 */
import type { Grid, Walker } from '../city';

export interface Fur {
  name: string;
  main: string;
  shade: string;
}
export const FURS: Fur[] = [
  { name: 'Snow', main: '#ffffff', shade: '#d9d4ec' },
  { name: 'Cream', main: '#f6e7c8', shade: '#dcc8a0' },
  { name: 'Silver', main: '#c9ccd6', shade: '#a2a6b4' },
  { name: 'Cocoa', main: '#a87a58', shade: '#86603f' },
  { name: 'Midnight', main: '#4a4458', shade: '#35303f' },
];

/** teal (the original) first, then the colours other rabbits get by default */
export const LOOK_SCARVES = ['#2ec4b6', '#ff9f1c', '#e84a5f', '#9b5de5', '#f15bb5', '#fee440', '#3a86ff', '#80ed99'];

export interface Hat {
  name: string;
  /** k ink, a main, b band/trim, c a third colour; bottom row sits on the head */
  grid: Grid;
  colors: Record<string, string>;
}

export const HATS: Hat[] = [
  { name: 'No hat', grid: [], colors: {} },
  { name: 'Beanie', grid: ['...kk...', '..kcck..', '.kaaaak.', 'kaaaaaak', 'kbbbbbbk'], colors: { a: '#e84a5f', b: '#ffd23f', c: '#fff1e0' } },
  { name: 'Top hat', grid: ['.kkkkkk.', '.kaaaak.', '.kaaaak.', '.kbbbbk.', 'kkkkkkkk'], colors: { a: '#2a2433', b: '#e84a5f' } },
  { name: 'Party hat', grid: ['...c....', '...k....', '..kak...', '..kbak..', '.kaabak.', 'kkkkkkkk'], colors: { a: '#ff2e93', b: '#ffd23f', c: '#2ec4b6' } },
  { name: 'Crown', grid: ['.k.kk.k.', 'kakaakak', 'kaaaaaak', 'kacaacak', 'kkkkkkkk'], colors: { a: '#ffd23f', c: '#e84a5f' } },
  { name: 'Flower crown', grid: ['.a.c.b.a.', 'gagcgbgag', '.ggggggg.'], colors: { a: '#ff7eb6', b: '#ffd23f', c: '#f3efe4', g: '#4f8a3a' } },
  { name: 'Bucket hat', grid: ['..kkkk..', '.kaaaak.', '.kbbbbk.', 'kaaaaaak', 'kkkkkkkk'], colors: { a: '#7a9a5a', b: '#5a7a3a' } },
  { name: 'Ball cap', grid: ['..kkkk..', '.kaaaak.', 'kaacaaak', 'kbbbbbbk', '.kkkkkk.'], colors: { a: '#3a86ff', b: '#2a4f9f', c: '#fff1e0' } },
];

export interface Look {
  fur: number;
  scarf: number;
  hat: number;
}
export const DEFAULT_LOOK: Look = { fur: 0, scarf: 0, hat: 0 };

/** One number for the wire: fur × 256 + scarf × 16 + hat. */
export const lookCode = (l: Look) => l.fur * 256 + l.scarf * 16 + l.hat;

/** From the wire (or storage): anything out of range or malformed is null. */
export function lookFrom(code: unknown): Look | null {
  if (typeof code !== 'number' || !Number.isInteger(code) || code < 0) return null;
  const l = { fur: Math.floor(code / 256), scarf: Math.floor(code / 16) % 16, hat: code % 16 };
  if (l.fur >= FURS.length || l.scarf >= LOOK_SCARVES.length || l.hat >= HATS.length) return null;
  return l;
}

const KEY = 'bearisland.look';
export function loadLook(): Look {
  try {
    return lookFrom(Number(localStorage.getItem(KEY))) ?? DEFAULT_LOOK;
  } catch {
    return DEFAULT_LOOK;
  }
}
export function saveLook(l: Look) {
  try {
    localStorage.setItem(KEY, String(lookCode(l)));
  } catch {
    // private window: it just isn't remembered
  }
}

/**
 * Where a hat goes on a frame: the head's top is the highest row with a run of at least
 * `run` fur pixels; the hat sits centred on that run, its bottom row on the row above.
 */
export function headAnchor(isFur: (x: number, y: number) => boolean, w: number, h: number, run = 6): { x: number; y: number } | null {
  for (let y = 0; y < h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const f = x < w && isFur(x, y);
      if (f && start < 0) start = x;
      if (!f && start >= 0) {
        if (x - start >= run) return { x: (start + x) / 2, y: y - 1 };
        start = -1;
      }
    }
  }
  return null;
}

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * Dress a sprite set drawn in the default fur (white): recolour the fur and put the hat on
 * each frame, wherever its head is (walking, riding, every direction and hop).
 */
export function dress(base: Walker, look: Look): Walker {
  const fur = FURS[look.fur] ?? FURS[0]!;
  const hat = HATS[look.hat] ?? HATS[0]!;
  const white = rgbOf(FURS[0]!.main), whiteShade = rgbOf(FURS[0]!.shade);
  const main = rgbOf(fur.main), shade = rgbOf(fur.shade);
  const frame = (src: HTMLCanvasElement) => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const at = (x: number, y: number) => (x + y * c.width) * 4;
    const isWhite = (x: number, y: number) => d[at(x, y) + 3]! > 0 && d[at(x, y)] === white[0] && d[at(x, y) + 1] === white[1] && d[at(x, y) + 2] === white[2];
    const anchor = headAnchor(isWhite, c.width, c.height);
    if (look.fur) {
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const px = [d[i], d[i + 1], d[i + 2]];
        const to = px.every((v, k) => v === white[k]) ? main : px.every((v, k) => v === whiteShade[k]) ? shade : null;
        if (to) [d[i], d[i + 1], d[i + 2]] = to;
      }
      ctx.putImageData(img, 0, 0);
    }
    if (anchor && hat.grid.length) {
      const hw = hat.grid[0]!.length;
      const x0 = Math.round(anchor.x - hw / 2), y0 = anchor.y - hat.grid.length + 2;
      hat.grid.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const col = ch === 'k' ? '#1c1b22' : hat.colors[ch];
          if (!col) return;
          ctx.fillStyle = col;
          ctx.fillRect(x0 + x, y0 + y, 1, 1);
        }),
      );
    }
    return c;
  };
  return { down: base.down.map(frame), up: base.up.map(frame), left: base.left.map(frame), right: base.right.map(frame) };
}
