/**
 * A block face of Junction shops (data: src/content/storefronts.ts), drawn into a landmark
 * box beside California Ave. Same SNES 3/4 cheats as the other buildings: roofs from above,
 * each building's south face showing below its roof. Along the street edge runs a thin
 * storefront column (awning, glass, doors), and every business hangs its own sign.
 *
 * Distances are measured from the street edge (`d`), so the same code draws the west side
 * (street on the right) and the east side (street on the left); text is never mirrored.
 */
import { FACES, type Building } from '../world/storefronts';
import { FACADES } from './facades';
import { pixelText, textWidth } from './landmarks';
import { INK } from './palette';

type Ctx = CanvasRenderingContext2D;

const STOREFRONT = 6; // px: awning (2) + glass/doors (3) + its eave line (1)
const GLASS = '#a9d8cc';
const DOOR = '#2a1a12';

export function drawBlockFace(ctx: Ctx, id: string, W: number, H: number) {
  const face = FACES[id];
  if (!face) return;
  /** a rect `w` deep starting `d` px in from the street */
  const rect = (color: string, d: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(face.side === 'W' ? W - d - w : d, y, w, h);
  };
  const text = (s: string, d: number, y: number, color: string) =>
    pixelText(ctx, s, face.side === 'W' ? W - d - textWidth(s) : d, y, color);

  const total = face.buildings.reduce((a, b) => a + b.tenants.reduce((t, x) => t + (x.weight ?? 1), 0), 0);
  const unit = H / total;
  let acc = 0;
  const signs: (() => void)[] = [];
  const fronts: (() => void)[] = [];
  face.buildings.forEach((b, bi) => {
    const segs = b.tenants.map((t) => {
      const y0 = Math.round(acc * unit);
      acc += t.weight ?? 1;
      return { t, y0, y1: Math.round(acc * unit) };
    });
    const y0 = segs[0].y0;
    const y1 = segs[segs.length - 1].y1;
    const F = Math.min(b.campbell ? 15 : b.stories === 1 ? 5 : b.stories === 2 ? 8 : 10, y1 - y0 - 4);
    drawRoof(b, rect, W, y0, y1 - F, bi);
    drawSouthFace(b, rect, text, W, y1 - F, y1);
    // storefront column along the street
    for (const [k, s] of segs.entries()) {
      const h = s.y1 - s.y0;
      rect(GLASS, 2, s.y0, 3, h);
      for (let y = s.y0 + 1; y < s.y1 - 1; y += 3) rect(s.t.bg, 3, y, 1, 1); // things in the window
      rect(DOOR, 2, s.y0 + Math.floor(h / 2) - 1, 3, 2);
      const awning = b.canopy ?? s.t.awning;
      if (awning) {
        rect(awning, 0, s.y0, 2, h);
        if (!b.canopy) for (let y = s.y0 + 1; y < s.y1; y += 3) rect('#ffffff', 0, y, 2, 1);
      }
      if (k) rect(INK, 0, s.y0, STOREFRONT, 1); // party wall
    }
    if (b.canopy) rect(INK, 0, y0, 1, y1 - y0);
    rect(INK, STOREFRONT - 1, y0, 1, y1 - y0);
    rect(INK, 0, y0, W, 1);
    // signs go on last, over roofs and faces; a shop with its own front gets that instead
    for (const s of segs) {
      const facade = s.t.facade && FACADES[s.t.facade];
      if (facade) {
        fronts.push(() => facade(ctx, 0, s.y0, W, s.y1 - s.y0));
        continue;
      }
      signs.push(() => {
        const avail = W - STOREFRONT - 3 - 4;
        let label = s.t.sign;
        while (textWidth(label) > avail && label.length > 1) label = label.slice(0, -1);
        const sw = textWidth(label) + 4;
        const mid = Math.round((s.y0 + s.y1) / 2);
        const sy = Math.max(y0 + 1, Math.min(H - 8, mid - 3));
        rect(INK, STOREFRONT - 1, sy - 1, sw + 2, 9);
        rect(s.t.bg, STOREFRONT, sy, sw, 7);
        text(label, STOREFRONT + 2, sy + 1, s.t.fg);
      });
    }
  });
  rect(INK, W - 1, 0, 1, H); // back wall
  rect(INK, 0, H - 1, W, 1);
  fronts.forEach((draw) => draw());
  signs.forEach((draw) => draw());
}

type Rect = (color: string, d: number, y: number, w: number, h: number) => void;

function drawRoof(b: Building, rect: Rect, W: number, y0: number, y1: number, seed: number) {
  const h = y1 - y0;
  if (h <= 0) return;
  switch (b.roof) {
    case 'gable': {
      // ridge runs back from the street; shingle rows
      const mid = y0 + Math.floor(h / 2);
      rect('#8a4a3a', 0, y0, W, mid - y0);
      rect('#6b3428', 0, mid, W, y1 - mid);
      for (let y = y0 + 2; y < y1; y += 3) rect(y < mid ? '#7a4032' : '#5a2a20', 0, y, W, 1);
      rect('#b06a55', 0, mid - 1, W, 1);
      break;
    }
    case 'metal':
      rect('#a9c4bc', 0, y0, W, h);
      for (let d = 2; d < W; d += 3) rect('#8aa8a0', d, y0, 1, h);
      rect('#cfe0d8', 0, y0, W, 1);
      break;
    case 'modern':
      rect('#8a9690', 0, y0, W, h);
      rect('#a6b0a8', 0, y0, W, 2);
      for (let y = y0 + 4; y < y1 - 2; y += 6) rect('#7a8680', 4, y, W - 8, 1);
      if (b.balconies) for (let y = y0 + 3; y < y1 - 1; y += 5) rect('#9be15d', W - 4, y, 3, 2);
      break;
    default:
      rect('#8f8076', 0, y0, W, h);
      rect('#a8998a', 0, y0, W, 2);
      // rooftop unit or hatch, somewhere stable
      if (h > 9) {
        const d = 14 + ((seed * 13) % Math.max(1, W - 26));
        rect('#6e6058', d, y0 + 3, 6, 4);
        rect('#c2b2a0', d + 1, y0 + 4, 4, 1);
      }
  }
}

function drawSouthFace(b: Building, rect: Rect, text: (s: string, d: number, y: number, c: string) => void, W: number, y0: number, y1: number) {
  const F = y1 - y0;
  if (F <= 0) return;
  rect(INK, 0, y0 - 1, W, 1); // eave
  rect(b.wall, 0, y0, W, F);
  if (b.campbell) {
    // cream terracotta cornice, upper windows with a bay, green awnings over the shops
    const cream = '#efe2bf';
    rect(cream, 0, y0, W, 2);
    for (let d = 1; d < W; d += 2) rect('#c9b98f', d, y0 + 2, 1, 1);
    for (let d = 8; d < W - 4; d += 7) {
      rect(cream, d - 1, y0 + 3, 6, 5);
      rect('#3b4a6b', d, y0 + 4, 4, 3);
    }
    rect(cream, 24, y0 + 2, 10, 7); // the bay window
    rect('#6f86b8', 25, y0 + 3, 8, 5);
    const ay = y0 + 9;
    rect('#1f7a4a', 0, ay, W, 5);
    for (let d = 2; d < W; d += 8) rect('#ffffff', d, ay + 4, 4, 1); // scalloped edge
    text('4218', 26, ay, '#ffffff');
  } else if (b.stories >= 2 && F >= 7) {
    for (let d = 8; d < W - 3; d += 6) {
      rect('#3b4a6b', d, y0 + 1, 3, 3);
      rect('#6f86b8', d, y0 + 1, 3, 1);
    }
    if (b.stories === 3) for (let d = 8; d < W - 3; d += 6) rect('#3b4a6b', d, y0 + 5, 3, 2);
  } else {
    for (let d = 9; d < W - 3; d += 8) rect('#3b4a6b', d, y0 + 1, 4, 2);
  }
  rect(INK, 0, y1 - 1, W, 1);
}
