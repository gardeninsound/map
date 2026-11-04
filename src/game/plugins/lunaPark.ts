import { INK, PAL, Tile, TS, pixelText, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec } from '../../city';
import { LUNA_BRIDGE, LUNA_ORIGIN, LUNA_PIER, lunaRides, lunaWagon, type LunaRide, type TileRect } from '../../content/lunaPark';

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};
const text = (ctx: Ctx, s: string, cx: number, y: number, color: string) => pixelText(ctx, s, Math.round(cx - (s.length * 4 - 1) / 2), y, color);

const WOOD = '#b98a5a';
const WOOD_DARK = '#8a5f3a';
const WOOD_LINE = '#a3764a';
const WHITE = '#f3ede0';
const WHITE_SHADE = '#d6ccb8';
const GREEN = '#3f8f5a';
const GREEN_DARK = '#2c6b42';
const GOLD = '#e6b23a';
const RED = '#b8322a';
const BULB = '#ffe9a8';
const BULB_OFF = '#c9a46a';

/** A string of bulbs from a to b, one every `gap` px, a chase running along it. */
function bulbs(ctx: Ctx, ax: number, ay: number, bx: number, by: number, t: number, gap = 4, seed = 0) {
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / gap));
  for (let i = 0; i <= n; i++) {
    const lit = (i + Math.floor(t * 6) + seed) % 5 !== 0;
    px(ctx, lit ? BULB : BULB_OFF, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
  }
}

/**
 * Luna Park, 1907–1913, back on its pilings off Duwamish Head: a boardwalk you can walk
 * onto from Alki Ave, the gate, the Great Figure Eight with its train going round, the
 * Shoot-the-Chutes, Looff's carousel, the Giant Whirl, the Natatorium and two midway
 * booths, every one strung with bulbs, and Pat the Educated Horse's hall. Each has a sign
 * (targets of kind 'luna'). Out front, Uncle Hiram drives his wagon up and down Alki Ave
 * behind Betsy the Pig; walk up to him and he's a target too.
 * Layout and words: src/content/lunaPark.ts.
 */
export class LunaPark implements CityPlugin {
  /** the origin tile (top-left corner of the tile at the tip of the Head) */
  origin: Vec = { x: 0, y: 0 };
  private deck: HTMLCanvasElement | null = null;
  private signSprite: HTMLCanvasElement | null = null;
  private train = 0; // Figure Eight: where the train is on the track, 0..2π
  private chutes = 0; // seconds into the Shoot-the-Chutes cycle
  private wagon = 0; // tiles along the wagon's route, there and back: 0..2 × its length
  private route: { x: number; y: number; at: number }[] = []; // in tiles, with distance along

  attach(game: CityGame) {
    const w = game.world;
    const o = w.project(LUNA_ORIGIN.lat, LUNA_ORIGIN.lon);
    this.origin = { x: Math.floor(o.x), y: Math.floor(o.y) };
    // the boardwalk and bridge become ground you can walk on, named for the street sign
    w.names.push('Luna Park');
    const name = w.names.length;
    const open = (r: TileRect) => this.each(r, (x, y) => {
      if (x < 0 || y < 0 || x >= w.w || y >= w.h) return;
      w.tiles[x + y * w.w] = Tile.Road;
      w.roads[x + y * w.w] = name;
    });
    open(LUNA_PIER);
    open(LUNA_BRIDGE);
    // rides, buildings and the gate's towers stand in the way
    for (const r of lunaRides) for (const b of r.blocks) this.each(b, (x, y) => (w.tiles[x + y * w.w] = Tile.Landmark));
    let at = 0;
    this.route = lunaWagon.route.map((p, i, all) => {
      if (i) at += Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y);
      return { x: this.origin.x + p.x, y: this.origin.y + p.y, at };
    });
  }

  /** Where the wagon is (or, `ahead` tiles on, Betsy): tile coords and which way it's heading. */
  wagonAt(ahead = 0): { x: number; y: number; dx: number } {
    const len = this.route[this.route.length - 1]?.at ?? 0;
    if (!len) return { x: 0, y: 0, dx: 1 };
    const back = this.wagon > len;
    const d = Math.min(len, Math.max(0, back ? 2 * len - this.wagon - ahead : this.wagon + ahead));
    const i = Math.max(1, this.route.findIndex((p) => p.at >= d));
    const a = this.route[i - 1];
    const b = this.route[i];
    const k = (d - a.at) / (b.at - a.at || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: (b.x - a.x) * (back ? -1 : 1) };
  }

  /** every tile of a rect relative to the origin */
  private each(r: TileRect, f: (x: number, y: number) => void) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) f(this.origin.x + x, this.origin.y + y);
  }

  /** a rect's top-left corner in tile coords */
  private at(r: { x: number; y: number }): Vec {
    return { x: this.origin.x + r.x, y: this.origin.y + r.y };
  }

  update(dt: number) {
    // the train crawls up the lift hill, then runs faster the lower it gets
    const s = this.train;
    const speed = s < LIFT ? 0.22 : 0.45 + 0.9 * Math.sqrt(Math.max(0, (TOP - elevation(s)) / TOP));
    this.train = (s + speed * dt) % (Math.PI * 2);
    this.chutes = (this.chutes + dt) % CHUTE_CYCLE;
    const len = this.route[this.route.length - 1]?.at ?? 0;
    if (len) this.wagon = (this.wagon + WAGON_SPEED * dt) % (2 * len);
  }

  targets(): Target[] {
    const wg = this.wagonAt();
    const wagon: Target = {
      key: 'luna:hiram',
      kind: 'luna',
      x: wg.x,
      y: wg.y,
      label: { name: lunaWagon.name, where: 'Luna Park · 1907–1913', verb: 'read' },
      data: lunaWagon,
    };
    return [wagon, ...lunaRides.map((r): Target => {
      const p = this.at(r.sign);
      return {
        key: `luna:${r.id}`,
        kind: 'luna',
        x: p.x + 0.5,
        y: p.y + 0.5,
        label: { name: r.name, where: 'Luna Park · 1907–1913', verb: 'read' },
        data: r,
      };
    })];
  }

  draw(d: DrawContext) {
    const pier = d.toScreen(this.at(LUNA_PIER));
    const pw = LUNA_PIER.w * TS;
    const ph = LUNA_PIER.h * TS;
    // nothing to do unless some of the park is on screen (rides reach up to ~70 px above it)
    if (pier.x > d.view.w + 40 || pier.y > d.view.h + 40 || pier.x + pw < -40 || pier.y + ph + 40 < -80) return;
    const { ctx, time } = d;
    this.deck ??= drawDeck();
    const deck = this.deck;
    d.push({ y: -1e9, draw: () => {
      ctx.drawImage(deck, pier.x, pier.y);
      // bulbs along the railings, chasing
      bulbs(ctx, pier.x + 1, pier.y + 1, pier.x + pw - 2, pier.y + 1, time, 6);
      bulbs(ctx, pier.x + 1, pier.y + 1, pier.x + 1, pier.y + ph - 2, time, 6, 2);
      bulbs(ctx, pier.x + pw - 2, pier.y + 1, pier.x + pw - 2, pier.y + ph - 2, time, 6, 3);
      // the water lapping round the pilings
      for (let i = 0; i < pw; i += 16) {
        const f = (Math.floor(time * 2) + i / 16) % 3;
        if (f === 0) px(ctx, PAL.foam, pier.x + i + 3, pier.y + ph + 9, 3, 1);
      }
    } });

    for (const r of lunaRides) {
      const b = r.kind === 'gate' ? { x: 5, y: -2, w: 8, h: 1 } : r.blocks[0];
      const s = d.toScreen(this.at(b));
      const w = b.w * TS;
      const h = b.h * TS;
      if (s.x > d.view.w + 32 || s.x + w < -32 || s.y - 80 > d.view.h || s.y + h < -32) continue;
      d.push({ y: this.origin.y + b.y + b.h - 0.01, draw: () => this.drawRide(ctx, r, s.x, s.y, w, h, time) });
    }

    // Uncle Hiram's wagon, Betsy out in front
    const wg = this.wagonAt();
    const ws = d.toScreen(wg);
    if (d.onScreen(ws)) {
      const pig = d.toScreen(this.wagonAt(BETSY_AHEAD));
      d.push({ y: wg.y, draw: () => drawWagon(ctx, ws, pig, wg.dx < 0 ? -1 : 1, time) });
    }

    // the signs: a little post at each
    this.signSprite ??= drawSignpost();
    const post = this.signSprite;
    for (const r of lunaRides) {
      const p = this.at(r.sign);
      const s = d.toScreen({ x: p.x + 0.5, y: p.y + 0.5 });
      if (!d.onScreen(s)) continue;
      d.push({ y: p.y + 0.3, draw: () => ctx.drawImage(post, s.x - 5, s.y - 12) });
    }
  }

  private drawRide(ctx: Ctx, r: LunaRide, x: number, y: number, w: number, h: number, t: number) {
    switch (r.kind) {
      case 'gate': return drawGate(ctx, x, y, w, t);
      case 'figure8': return drawFigureEight(ctx, x, y, w, h, t, this.train);
      case 'chutes': return drawChutes(ctx, x, y, w, h, t, this.chutes);
      case 'carousel': return drawCarousel(ctx, x, y, t);
      case 'whirl': return drawWhirl(ctx, x, y, t);
      case 'natatorium': return drawNatatorium(ctx, x, y, w, h, t);
      case 'booth': return drawBooth(ctx, r, x, y, w, h, t);
      case 'pat': return drawPat(ctx, x, y, w, h, t);
    }
  }
}

// ---------- the boardwalk ----------

function drawDeck(): HTMLCanvasElement {
  const pw = LUNA_PIER.w * TS;
  const ph = LUNA_PIER.h * TS;
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph + TS + 12;
  const ctx = c.getContext('2d')!;
  // pilings under the south edge, standing in the water
  for (let i = 3; i < pw; i += 8) {
    px(ctx, '#3a2a1e', i, ph, 2, 10);
    px(ctx, '#5a4030', i, ph, 1, 10);
  }
  // planks, running east–west, a few odd boards
  px(ctx, WOOD, 0, 0, pw, ph);
  for (let y = 2; y < ph; y += 3) px(ctx, WOOD_LINE, 0, y, pw, 1);
  for (let y = 0; y < ph; y += 3) {
    for (let x = ((y * 7) % 23); x < pw; x += 23 + ((x + y) % 11)) px(ctx, WOOD_DARK, x, y, 1, 2);
  }
  // the deck's south face, and railings round three sides
  px(ctx, WOOD_DARK, 0, ph - 3, pw, 3);
  px(ctx, INK, 0, ph, pw, 1);
  px(ctx, WHITE, 0, 0, pw, 1);
  px(ctx, WHITE, 0, 0, 1, ph);
  px(ctx, WHITE, pw - 1, 0, 1, ph);
  for (let x = 0; x < pw; x += 6) px(ctx, WHITE_SHADE, x, 1, 1, 2);
  // the entrance bridge from Alki Ave
  const bx = (LUNA_BRIDGE.x - LUNA_PIER.x) * TS;
  const bw = LUNA_BRIDGE.w * TS;
  px(ctx, WOOD, bx, ph, bw, TS);
  for (let y = ph + 2; y < ph + TS; y += 3) px(ctx, WOOD_LINE, bx, y, bw, 1);
  px(ctx, WHITE, bx, ph, 1, TS);
  px(ctx, WHITE, bx + bw - 1, ph, 1, TS);
  for (let y = ph; y < ph + TS; y += 4) {
    px(ctx, WHITE_SHADE, bx + 1, y, 1, 2);
    px(ctx, WHITE_SHADE, bx + bw - 2, y, 1, 2);
  }
  return c;
}

function drawSignpost(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 10;
  c.height = 13;
  const ctx = c.getContext('2d')!;
  px(ctx, INK, 4, 6, 2, 7);
  px(ctx, '#6b3f1d', 4, 7, 1, 6);
  px(ctx, INK, 0, 0, 10, 8);
  px(ctx, WHITE, 1, 1, 8, 6);
  px(ctx, RED, 1, 1, 8, 1);
  px(ctx, '#7a6a5a', 2, 3, 6, 1);
  px(ctx, '#7a6a5a', 2, 5, 4, 1);
  return c;
}

/** The sign's picture for the dialog box: a park sign with a crescent moon, 40×40. */
export function lunaSignPortrait(): string {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 40;
  const ctx = c.getContext('2d')!;
  px(ctx, '#1d2a4a', 0, 0, 40, 40);
  px(ctx, INK, 4, 6, 32, 24);
  px(ctx, WHITE, 5, 7, 30, 22);
  px(ctx, RED, 5, 7, 30, 4);
  moon(ctx, 20, 18, 5);
  text(ctx, 'LUNA', 20, 22, INK);
  px(ctx, INK, 18, 30, 4, 10);
  px(ctx, '#6b3f1d', 19, 30, 2, 10);
  for (let i = 0; i < 8; i++) px(ctx, i % 2 ? BULB : GOLD, 6 + i * 4, 8);
  return c.toDataURL();
}

function moon(ctx: Ctx, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const bx = x - Math.ceil(r * 0.5);
      const by = y + 1;
      if (bx * bx + by * by <= r * r * 0.7) continue;
      px(ctx, GOLD, cx + x, cy + y);
    }
  }
}

// ---------- the gate ----------

function drawGate(ctx: Ctx, x: number, y: number, w: number, t: number) {
  const base = y + TS;
  const towerW = 24;
  const towerH = 48;
  for (const tx of [x + 4, x + w - 4 - towerW]) {
    px(ctx, 'rgba(0,0,0,0.2)', tx + 2, base - 2, towerW, 3);
    px(ctx, INK, tx - 1, base - towerH - 1, towerW + 2, towerH + 1);
    px(ctx, WHITE, tx, base - towerH, towerW, towerH);
    px(ctx, WHITE_SHADE, tx + towerW - 6, base - towerH, 6, towerH);
    for (const wy of [base - 40, base - 26]) {
      px(ctx, '#3a4a6a', tx + 8, wy, 8, 9);
      px(ctx, '#3a4a6a', tx + 9, wy - 1, 6, 1);
    }
    px(ctx, RED, tx, base - 14, towerW, 2);
    // the dome and its spike
    for (let i = 0; i < 9; i++) {
      const half = Math.round(Math.sqrt(81 - (8 - i) * (8 - i)) * 1.4);
      px(ctx, INK, tx + towerW / 2 - half - 1, base - towerH - 9 + i, half * 2 + 2, 1);
      px(ctx, RED, tx + towerW / 2 - half, base - towerH - 9 + i, half * 2, 1);
    }
    px(ctx, '#e0786a', tx + towerW / 2 - 6, base - towerH - 6, 3, 2);
    px(ctx, INK, tx + towerW / 2, base - towerH - 15, 1, 6);
    px(ctx, GOLD, tx + towerW / 2 - 1, base - towerH - 16, 3, 2);
    bulbs(ctx, tx, base - towerH, tx, base - 2, t, 4);
    bulbs(ctx, tx + towerW - 1, base - towerH, tx + towerW - 1, base - 2, t, 4, 2);
  }
  // the arch over the way in, with the name and the moon
  const ax0 = x + 4 + towerW;
  const ax1 = x + w - 4 - towerW;
  const ay = base - 44;
  px(ctx, INK, ax0, ay - 1, ax1 - ax0, 13);
  px(ctx, WHITE, ax0, ay, ax1 - ax0, 11);
  px(ctx, RED, ax0 + 4, ay + 2, ax1 - ax0 - 8, 7);
  text(ctx, 'LUNA PARK', (ax0 + ax1) / 2, ay + 3, '#fff3d6');
  bulbs(ctx, ax0, ay, ax1, ay, t, 3, 1);
  bulbs(ctx, ax0, ay + 10, ax1, ay + 10, t, 3, 4);
  moon(ctx, (ax0 + ax1) / 2, ay - 9, 7);
}

// ---------- the Great Figure Eight ----------

/** where the lift hill ends (radians along the track) */
const LIFT = 0.7;
/** the top of the lift, px above the deck */
const TOP = 40;
/** track height above the deck in px at s (0..2π): up the lift, then rolling down in waves */
export function elevation(s: number): number {
  if (s < LIFT) return 4 + (TOP - 4) * (s / LIFT);
  const k = (Math.PI * 2 - s) / (Math.PI * 2 - LIFT);
  return 4 + (TOP - 4) * k * (0.78 + 0.22 * Math.cos((s - LIFT) * 4));
}

function drawFigureEight(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, train: number) {
  const cx = x + w / 2;
  const cy = y + h / 2 + 4;
  const A = w / 2 - 10;
  const B = h / 2 - 14;
  const ground = (s: number) => ({ x: cx + A * Math.sin(2 * s), y: cy + B * Math.sin(s) });
  const N = 96;
  const pts = Array.from({ length: N }, (_, i) => {
    const s = (i / N) * Math.PI * 2;
    const g = ground(s);
    return { s, gx: g.x, gy: g.y, e: elevation(s) };
  });
  // shadow of the whole thing on the deck
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (const p of pts) ctx.fillRect(Math.round(p.gx) - 2, Math.round(p.gy), 5, 2);
  // trestle posts and the track, far (north) to near, so the two loops cross properly
  const segs = pts.map((p, i) => ({ a: p, b: pts[(i + 1) % N] })).sort((m, n) => m.a.gy + m.b.gy - (n.a.gy + n.b.gy));
  for (const { a, b } of segs) {
    // a white bent under the track: two legs, shaded on one side, braced every 6 px
    const gx = Math.round(a.gx);
    const top = Math.round(a.gy - a.e);
    const leg = Math.max(1, Math.round(a.e));
    px(ctx, '#8a7a6a', gx + 2, top + 1, 1, leg);
    px(ctx, WHITE, gx - 1, top + 1, 1, leg);
    px(ctx, WHITE, gx + 1, top + 1, 1, leg);
    for (let yy = top + 5; yy < a.gy - 2; yy += 6) px(ctx, WHITE_SHADE, gx - 1, yy, 3, 1);
    // the track: an outline, the wooden bed, a worn top
    const line = (color: string, width: number, dy: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a.gx + 0.5, a.gy - a.e + dy);
      ctx.lineTo(b.gx + 0.5, b.gy - b.e + dy);
      ctx.stroke();
    };
    line(INK, 4, 0.5);
    line('#7a4a2a', 2, 0.5);
    line('#e8d2a8', 1, 0);
  }
  // bulbs along the track
  pts.forEach((p, i) => {
    if (i % 4) return;
    const lit = (i / 4 + Math.floor(t * 5)) % 4 !== 0;
    px(ctx, lit ? BULB : BULB_OFF, p.gx, p.gy - p.e - 1);
  });
  // the station at the crossing, where the train starts up the lift
  const st = ground(0);
  px(ctx, INK, st.x - 9, st.y - 1, 18, 7);
  px(ctx, RED, st.x - 8, st.y, 16, 2);
  px(ctx, WHITE, st.x - 8, st.y + 2, 16, 3);
  // the train: three cars, riders' heads showing
  for (let k = 2; k >= 0; k--) {
    const s = (train - k * 0.09 + Math.PI * 2) % (Math.PI * 2);
    const g = ground(s);
    const e = elevation(s);
    const cxr = Math.round(g.x);
    const cyr = Math.round(g.y - e);
    px(ctx, INK, cxr - 3, cyr - 4, 7, 5);
    px(ctx, k === 0 ? RED : '#d8503e', cxr - 2, cyr - 3, 5, 3);
    px(ctx, '#f1c9a5', cxr - 2, cyr - 5, 1, 1);
    px(ctx, '#6b3f1d', cxr + 1, cyr - 5, 1, 1);
  }
}

// ---------- Shoot-the-Chutes ----------

const CHUTE_CYCLE = 7;

function drawChutes(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, c: number) {
  const mx = x + w / 2;
  // stood well back from the pier's north edge: the map ends just past it, and the camera with it
  const towerBase = y + 58;
  const towerTop = towerBase - 50;
  const poolTop = y + 104;
  const poolBot = y + h - 8;
  // the splash pool, its rim, and the white bridge across it
  px(ctx, '#d9d3c4', x + 4, poolTop - 2, w - 8, poolBot - poolTop + 4);
  px(ctx, PAL.waterDeep, x + 6, poolTop, w - 12, poolBot - poolTop);
  for (let i = 0; i < 6; i++) {
    const f = (Math.floor(t * 3) + i) % 4;
    if (f < 2) px(ctx, PAL.waterLight, x + 10 + ((i * 17) % (w - 24)), poolTop + 6 + ((i * 11) % 30), 4, 1);
  }
  const by = poolTop + 30;
  px(ctx, INK, x + 2, by - 1, w - 4, 6);
  px(ctx, WHITE, x + 3, by, w - 6, 4);
  for (let i = x + 5; i < x + w - 5; i += 5) px(ctx, WHITE_SHADE, i, by - 4, 1, 4);
  px(ctx, WHITE, x + 3, by - 5, w - 6, 1);
  // the slide: twin rails from the top of the tower down to the pool, on a trestle
  const slide = (k: number) => ({ x: mx, y: towerTop + 6 + (poolTop - towerTop - 6) * k });
  for (let k = 0; k <= 1; k += 0.08) {
    const g = towerBase + (poolTop - towerBase) * k;
    const p = slide(k);
    px(ctx, WHITE_SHADE, p.x - 6, p.y, 1, Math.max(0, g - p.y));
    px(ctx, WHITE_SHADE, p.x + 6, p.y, 1, Math.max(0, g - p.y));
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(mx + dx + 0.5, towerTop + 6);
    ctx.lineTo(mx + dx + 0.5, poolTop);
    ctx.stroke();
  }
  px(ctx, '#e8d2a8', mx - 4, towerTop + 6, 9, poolTop - towerTop - 6);
  for (let yy = towerTop + 8; yy < poolTop; yy += 4) px(ctx, WOOD_LINE, mx - 4, yy, 9, 1);
  // the tower: a white lattice with a little house on top and a flag
  px(ctx, INK, mx - 13, towerTop, 26, towerBase - towerTop);
  px(ctx, WHITE, mx - 12, towerTop + 1, 24, towerBase - towerTop - 1);
  for (let yy = towerTop + 6; yy < towerBase; yy += 6) {
    for (let xx = 0; xx < 22; xx++) px(ctx, WHITE_SHADE, mx - 11 + xx, yy + Math.abs(((xx + yy) % 6) - 3), 1, 1);
  }
  px(ctx, RED, mx - 14, towerTop - 6, 28, 7);
  px(ctx, INK, mx - 14, towerTop - 7, 28, 1);
  text(ctx, 'CHUTES', mx, towerTop - 5, '#fff3d6');
  px(ctx, INK, mx, towerTop - 18, 1, 11);
  px(ctx, Math.floor(t * 3) % 2 ? RED : '#e0786a', mx + 1, towerTop - 18, 6, 4);
  bulbs(ctx, mx - 13, towerTop, mx - 13, towerBase - 1, t, 4);
  bulbs(ctx, mx + 12, towerTop, mx + 12, towerBase - 1, t, 4, 2);
  // the boat: down the slide, a splash, across the pool, then back up out of sight
  const boat = (bx: number, byy: number) => {
    px(ctx, INK, bx - 5, byy - 2, 11, 5);
    px(ctx, '#7a4a2a', bx - 4, byy - 1, 9, 3);
    px(ctx, '#f1c9a5', bx - 2, byy - 3, 1, 1);
    px(ctx, '#6b3f1d', bx + 1, byy - 3, 1, 1);
    px(ctx, GOLD, bx + 3, byy - 3, 1, 1);
  };
  if (c < 1.4) {
    const k = (c / 1.4) ** 2;
    const p = slide(k);
    boat(p.x, p.y);
  } else if (c < 5) {
    const k = (c - 1.4) / 3.6;
    const bx = mx;
    const byy = poolTop + 4 + (poolBot - poolTop - 10) * (1 - (1 - k) ** 2);
    boat(bx, byy);
    if (c < 2.2) {
      const f = (c - 1.4) / 0.8;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        px(ctx, PAL.foam, mx + Math.cos(a) * (6 + f * 10), poolTop + 4 + Math.sin(a) * (2 + f * 4) - f * 6 * Math.abs(Math.sin(a * 2)));
      }
    }
  } else {
    boat(mx, towerTop + 6);
  }
}

// ---------- Looff's carousel ----------

function drawCarousel(ctx: Ctx, x: number, y: number, t: number) {
  const cx = x + 16;
  const cy = y + 20;
  const ellipse = (rx: number, ry: number, yy: number, color: string) => {
    for (let i = -ry; i <= ry; i++) {
      const half = Math.round(rx * Math.sqrt(1 - (i * i) / (ry * ry)));
      px(ctx, color, cx - half, yy + i, half * 2 + 1, 1);
    }
  };
  ellipse(17, 9, cy + 1, 'rgba(0,0,0,0.18)');
  ellipse(16, 8, cy, '#c9a26b');
  ellipse(14, 6, cy - 1, '#dcb880');
  // the horses, bobbing as they go round; the roof hides the poles' tops
  const horses = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + t * 1.1;
    return { a, x: cx + Math.cos(a) * 12, y: cy + Math.sin(a) * 5, bob: Math.round(Math.sin(t * 4 + i) * 1.5), c: ['#f3ede0', '#8a5a3a', '#f3ede0', '#3a2a22', '#d8a070'][i % 5] };
  }).sort((m, n) => m.y - n.y);
  px(ctx, GOLD, cx - 1, cy - 20, 3, 20);
  for (const hz of horses) {
    px(ctx, GOLD, hz.x, hz.y - 14, 1, 14);
    px(ctx, INK, hz.x - 2, hz.y - 6 + hz.bob, 6, 4);
    px(ctx, hz.c, hz.x - 1, hz.y - 5 + hz.bob, 4, 2);
    px(ctx, hz.c, hz.x + 2, hz.y - 7 + hz.bob, 2, 2);
  }
  // the green three-tier pagoda roof, trimmed in gold and bulbs
  ellipse(18, 7, cy - 17, GREEN_DARK);
  ellipse(17, 6, cy - 18, GREEN);
  ellipse(12, 5, cy - 24, GREEN_DARK);
  ellipse(11, 4, cy - 25, GREEN);
  ellipse(6, 3, cy - 30, GREEN_DARK);
  ellipse(5, 2, cy - 31, GREEN);
  for (const [rx, ry, yy] of [[17, 6, cy - 18], [11, 4, cy - 25]] as const) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI + 0.13;
      const lit = (i + Math.floor(t * 6)) % 3 !== 0;
      px(ctx, lit ? BULB : GOLD, cx + Math.cos(a) * rx, yy + Math.sin(a) * ry);
    }
  }
  px(ctx, INK, cx, cy - 39, 1, 7);
  px(ctx, RED, cx + 1, cy - 39, 4, 3);
}

// ---------- the Giant Whirl ----------

function drawWhirl(ctx: Ctx, x: number, y: number, t: number) {
  const cx = x + 16;
  const cy = y + 24;
  const topY = cy - 46;
  const cars = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + t * 1.6;
    return { x: cx + Math.cos(a) * 17, y: cy - 22 + Math.sin(a) * 7, depth: Math.sin(a), c: [RED, GOLD, '#5fa8a0', '#e8a59a', '#3a6fd8', GREEN][i] };
  });
  const car = (k: (typeof cars)[number]) => {
    ctx.strokeStyle = '#7a6a5a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, topY + 4);
    ctx.lineTo(k.x + 0.5, k.y - 2);
    ctx.stroke();
    px(ctx, INK, k.x - 3, k.y - 2, 7, 5);
    px(ctx, k.c, k.x - 2, k.y - 1, 5, 3);
    px(ctx, '#f1c9a5', k.x - 1, k.y - 3, 1, 1);
  };
  px(ctx, 'rgba(0,0,0,0.18)', cx - 14, cy - 2, 28, 4);
  for (const k of cars) if (k.depth < 0) car(k);
  // the mast, striped, a cap and a pennant
  px(ctx, INK, cx - 2, topY, 5, cy - topY);
  for (let yy = topY; yy < cy; yy += 4) px(ctx, (yy / 4) % 2 ? RED : WHITE, cx - 1, yy, 3, 4);
  px(ctx, INK, cx - 6, topY - 2, 13, 5);
  px(ctx, GOLD, cx - 5, topY - 1, 11, 3);
  bulbs(ctx, cx - 5, topY + 2, cx + 5, topY + 2, t, 2);
  px(ctx, INK, cx, topY - 9, 1, 7);
  px(ctx, '#5fa8a0', cx + 1, topY - 9, 4, 2);
  for (const k of cars) if (k.depth >= 0) car(k);
  px(ctx, INK, cx - 5, cy - 1, 11, 3);
  px(ctx, WHITE_SHADE, cx - 4, cy - 1, 9, 1);
}

// ---------- the Natatorium ----------

function drawNatatorium(ctx: Ctx, x: number, y: number, w: number, h: number, t: number) {
  const front = y + h - 30;
  // roof (the long gable, seen from above) and the wall facing the midway
  px(ctx, INK, x - 1, y - 7, w + 2, front - y + 8);
  for (let yy = y - 6; yy < front; yy++) {
    const k = (yy - (y - 6)) / (front - y + 6);
    px(ctx, k < 0.5 ? '#8a3a2a' : '#a8483a', x, yy, w, 1);
  }
  px(ctx, '#c8665a', x, y + (front - y) / 2 - 4, w, 1);
  px(ctx, INK, x - 1, front, w + 2, y + h - front + 1);
  px(ctx, WHITE, x, front + 1, w, y + h - front - 1);
  px(ctx, WHITE_SHADE, x, y + h - 4, w, 3);
  // tall arched windows, and the doors in the middle
  for (let wx = x + 6; wx < x + w - 8; wx += 12) {
    if (Math.abs(wx + 3 - (x + w / 2)) < 12) continue;
    px(ctx, '#3a6a8a', wx, front + 10, 7, 13);
    px(ctx, '#3a6a8a', wx + 1, front + 9, 5, 1);
    px(ctx, '#7fb6c8', wx + 1, front + 11, 2, 4);
  }
  px(ctx, INK, x + w / 2 - 7, front + 14, 14, 15);
  px(ctx, '#6b3f1d', x + w / 2 - 6, front + 15, 12, 13);
  px(ctx, INK, x + w / 2, front + 15, 1, 13);
  // the sign over the doors
  px(ctx, INK, x + w / 2 - 25, front + 2, 50, 9);
  px(ctx, '#2f6b8a', x + w / 2 - 24, front + 3, 48, 7);
  text(ctx, 'NATATORIUM', x + w / 2, front + 4, '#fff3d6');
  // corner towers with flags
  for (const tx of [x + 2, x + w - 12]) {
    px(ctx, INK, tx - 1, front - 14, 12, 16);
    px(ctx, WHITE, tx, front - 13, 10, 14);
    px(ctx, RED, tx, front - 16, 10, 3);
    px(ctx, INK, tx + 5, front - 25, 1, 9);
    px(ctx, Math.floor(t * 2 + tx) % 2 ? '#3a6fd8' : '#5fa8a0', tx + 6, front - 25, 4, 3);
  }
  bulbs(ctx, x, front + 1, x + w - 1, front + 1, t, 4);
  bulbs(ctx, x, y - 6, x + w - 1, y - 6, t, 6, 3);
}

// ---------- the midway booths ----------

function drawBooth(ctx: Ctx, r: LunaRide, x: number, y: number, w: number, h: number, t: number) {
  const cave = r.id === 'cave';
  const front = y + 8;
  px(ctx, INK, x - 1, y - 3, w + 2, h + 4);
  px(ctx, cave ? '#4a4038' : '#6a5a8a', x, y - 2, w, front - y + 2);
  px(ctx, cave ? '#6a5a4c' : '#2f6b8a', x, front, w, h - 8);
  if (cave) {
    // a rock face with a dark mouth
    for (let i = 0; i < 9; i++) px(ctx, '#857464', x + 3 + ((i * 13) % (w - 8)), front + 2 + ((i * 7) % 10), 4, 2);
    px(ctx, INK, x + w / 2 - 8, y + h - 12, 16, 12);
    px(ctx, '#120c08', x + w / 2 - 7, y + h - 11, 14, 11);
    px(ctx, INK, x + w / 2 - 5, y + h - 13, 10, 1);
    if (Math.floor(t * 1.3) % 3 === 0) {
      px(ctx, '#e8e04a', x + w / 2 - 3, y + h - 7, 1, 1);
      px(ctx, '#e8e04a', x + w / 2 + 2, y + h - 7, 1, 1);
    }
  } else {
    // painted water and a gondola gliding under the sign
    px(ctx, '#3d827d', x + 2, y + h - 9, w - 4, 7);
    const g = x + 6 + ((t * 8) % (w - 16));
    px(ctx, INK, g, y + h - 7, 10, 2);
    px(ctx, '#f3ede0', g + 1, y + h - 7, 8, 1);
    px(ctx, INK, g + 7, y + h - 12, 1, 5);
  }
  const lines = r.facade ?? [];
  px(ctx, INK, x + 2, front + 1, w - 4, lines.length * 7 + 2);
  px(ctx, cave ? '#7a2a1e' : '#e6b23a', x + 3, front + 2, w - 6, lines.length * 7);
  lines.forEach((l, i) => text(ctx, l, x + w / 2, front + 3 + i * 7, cave ? '#fff3d6' : INK));
  bulbs(ctx, x, y - 2, x + w - 1, y - 2, t, 4, r.id.length);
}

// ---------- Pat, the Educated Horse ----------

/** After the photo: a white hall with a curved false front, the name painted big, an arcade below. */
function drawPat(ctx: Ctx, x: number, y: number, w: number, h: number, t: number) {
  const cx = x + w / 2;
  const ledge = y + 14;
  // the roof behind the false front
  px(ctx, INK, x - 1, y - 3, w + 2, ledge - y + 4);
  px(ctx, '#8f8678', x, y - 2, w, ledge - y + 2);
  for (let yy = y; yy < ledge; yy += 3) px(ctx, '#7a7264', x, yy, w, 1);
  // the false front: a wide board, curving up into a hump in the middle over the roof
  const half = (yy: number) => {
    if (yy >= y + 2) return w / 2 - 2;
    const k = (y + 2 - yy) / 13;
    return Math.round((w / 2 - 2) * (k < 0.3 ? 1 : 0.75) * Math.sqrt(Math.max(0, 1 - k * k)));
  };
  for (let yy = y - 11; yy < ledge; yy++) if (half(yy) > 0) px(ctx, INK, cx - half(yy) - 1, yy - 1, half(yy) * 2 + 2, 2);
  for (let yy = y - 10; yy < ledge; yy++) if (half(yy) > 1) px(ctx, WHITE, cx - half(yy) + 1, yy, half(yy) * 2 - 2, 1);
  text(ctx, 'PAT', cx, y - 6, INK);
  text(ctx, 'EDUCATED', cx, y + 1, INK);
  text(ctx, 'HORSE', cx, y + 7, INK);
  // the ledge, then the arcade: three arches on posts, Pat looking out of the middle one
  px(ctx, INK, x - 1, ledge, w + 2, y + h - ledge + 1);
  px(ctx, WHITE, x, ledge + 1, w, y + h - ledge - 1);
  px(ctx, WHITE_SHADE, x, ledge + 1, w, 1);
  for (const ax of [x + 3, x + 19, x + 35]) {
    px(ctx, '#2a2420', ax, ledge + 5, 10, y + h - ledge - 7);
    px(ctx, '#2a2420', ax + 1, ledge + 4, 8, 1);
    px(ctx, '#2a2420', ax + 3, ledge + 3, 4, 1);
  }
  px(ctx, '#bdb4a2', x, y + h - 2, w, 2);
  // Pat: a bay with a white blaze, tapping out answers in fours, then a rest
  const ox = x + 21;
  const oy = y + h - 2;
  const beat = (t * 3) % 6;
  const tap = beat < 4 && beat % 1 < 0.5;
  px(ctx, '#6a3820', ox + 1, oy - 15, 1, 2); // ears
  px(ctx, '#6a3820', ox + 4, oy - 15, 1, 2);
  px(ctx, '#3a2418', ox + 1, oy - 14, 4, 1); // forelock
  px(ctx, '#8a4a28', ox + 1, oy - 13, 4, 6); // head
  px(ctx, WHITE, ox + 2, oy - 12, 2, 4); // blaze
  px(ctx, INK, ox + 1, oy - 11, 1, 1);
  px(ctx, INK, ox + 4, oy - 11, 1, 1);
  px(ctx, '#7a4224', ox, oy - 7, 6, 4); // chest
  px(ctx, '#6a3820', ox + 1, oy - 3, 1, 3); // legs; the right one taps
  px(ctx, '#6a3820', ox + 4, oy - (tap ? 4 : 3), 1, 3);
  if (tap) px(ctx, WHITE, ox + 6, oy - 1, 1, 1);
  // the barker's megaphone by the left arch
  px(ctx, '#7a6a5a', x + 15, ledge + 9, 1, y + h - ledge - 11);
  px(ctx, '#c8c0b0', x + 14, ledge + 8, 3, 2);
  px(ctx, '#c8c0b0', x + 17, ledge + 7, 1, 4);
  bulbs(ctx, x + 2, ledge, x + w - 3, ledge, t, 4, 1);
}

// ---------- Uncle Hiram's wagon ----------

/** tiles a second: a pig's walking pace */
const WAGON_SPEED = 0.9;
/** how far ahead of the wagon Betsy walks, in tiles */
const BETSY_AHEAD = 1.7;

/** The Studebaker wagon (green box, red wheels), Uncle Hiram on the seat, Betsy in harness ahead. */
function drawWagon(ctx: Ctx, at: Vec, pig: Vec, dir: number, t: number) {
  const wx = Math.round(at.x);
  const wy = Math.round(at.y);
  const f = (dx: number, w = 1) => (dir > 0 ? wx + dx : wx - dx - w + 1); // x of a w-wide run, mirrored heading west
  const bx = Math.round(pig.x);
  const by = Math.round(pig.y);
  const g = (dx: number, w = 1) => (dir > 0 ? bx + dx : bx - dx - w + 1);
  const trot = Math.floor(t * 7) % 2;
  // the traces, from the wagon's tongue to Betsy's harness
  ctx.strokeStyle = '#4a2e1a';
  ctx.lineWidth = 1;
  for (const dy of [-9, -7]) {
    ctx.beginPath();
    ctx.moveTo(f(15) + 0.5, wy + dy + 0.5);
    ctx.lineTo(g(-6) + 0.5, by + dy + 0.5);
    ctx.stroke();
  }
  // Betsy: a big pink pig with a curly tail, trotting
  px(ctx, 'rgba(0,0,0,0.2)', bx - 8, by - 1, 17, 3);
  px(ctx, INK, g(-8, 15), by - 13, 15, 10);
  px(ctx, INK, g(7, 4), by - 11, 4, 6); // snout outline
  px(ctx, '#f0a8a8', g(-7, 13), by - 12, 13, 8);
  px(ctx, '#f8c4c0', g(-6, 10), by - 12, 10, 2); // back, in the light
  px(ctx, '#d8868c', g(-7, 13), by - 5, 13, 1); // belly
  px(ctx, '#e08a8e', g(7, 3), by - 10, 3, 4); // snout
  px(ctx, '#9a4a52', g(9), by - 9, 1, 1); // nostril
  px(ctx, INK, g(4), by - 10, 1, 1); // eye
  px(ctx, INK, g(2, 3), by - 15, 3, 3); // ear
  px(ctx, '#d87a80', g(3, 2), by - 14, 2, 2);
  px(ctx, '#d87a80', g(-9), by - 11 + trot, 1, 1); // tail, curling
  px(ctx, '#d87a80', g(-10), by - 12 + trot, 1, 1);
  px(ctx, '#d87a80', g(-9), by - 13 + trot, 1, 1);
  px(ctx, '#4a2e1a', g(-2, 2), by - 12, 2, 8); // harness band
  px(ctx, GOLD, g(-2, 2), by - 9, 2, 1);
  for (const [dx, up] of [[-6, trot], [-3, 1 - trot], [3, trot], [5, 1 - trot]]) {
    px(ctx, INK, g(dx, 2), by - 4, 2, 4 - up);
    px(ctx, '#e08a8e', g(dx, 2), by - 4, 2, 2 - up);
  }
  // the wagon box, on its tongue
  const spin = Math.floor(t * 5) % 2;
  px(ctx, 'rgba(0,0,0,0.2)', wx - 15, wy - 1, 31, 3);
  px(ctx, '#4a2e1a', f(13, 4), wy - 8, 4, 1); // tongue
  px(ctx, INK, wx - 15, wy - 18, 31, 11);
  px(ctx, '#3f7a4a', wx - 14, wy - 17, 29, 9);
  px(ctx, '#5a9a62', wx - 14, wy - 17, 29, 2); // top board, catching light
  px(ctx, '#2c5a36', wx - 14, wy - 10, 29, 2);
  px(ctx, GOLD, wx - 13, wy - 13, 27, 1); // pinstripe
  // red wheels with turning spokes; the back ones bigger
  for (const [dx, r] of [[-9, 5], [9, 4]] as const) {
    const c = f(dx);
    const cy = wy - r;
    for (let yy = -r; yy <= r; yy++) {
      const half = Math.round(Math.sqrt(r * r - yy * yy));
      px(ctx, INK, c - half, cy + yy, half * 2 + 1, 1);
    }
    for (let yy = -r + 1; yy <= r - 1; yy++) {
      const half = Math.round(Math.sqrt((r - 1) * (r - 1) - yy * yy));
      px(ctx, RED, c - half, cy + yy, half * 2 + 1, 1);
    }
    const a = spin ? 0 : Math.PI / 4;
    for (let k = 0; k < 4; k++) {
      const s = a + (k * Math.PI) / 2;
      px(ctx, '#7a1a14', c + Math.round(Math.cos(s) * (r - 2)), cy + Math.round(Math.sin(s) * (r - 2)));
    }
    px(ctx, GOLD, c, cy, 1, 1);
  }
  // Uncle Hiram up on the seat: a tall hat, a white beard, the reins in hand
  const hx = f(6, 7);
  const hy = wy - 18;
  px(ctx, INK, hx - 1, hy - 20, 9, 21);
  px(ctx, '#2a2a2a', hx + 1, hy - 19, 5, 7); // hat crown
  px(ctx, '#b8322a', hx + 1, hy - 14, 5, 1); // hat band
  px(ctx, '#2a2a2a', hx, hy - 12, 7, 1); // brim
  px(ctx, '#f1c9a5', hx + 1, hy - 11, 5, 4); // face
  px(ctx, '#e88a7a', f(9), hy - 9, 1, 1); // a clown's red nose
  px(ctx, INK, f(8), hy - 10, 1, 1); // eye
  px(ctx, WHITE, hx + 1, hy - 8, 5, 3); // the beard
  px(ctx, '#d8d0c0', hx, hy - 5, 7, 5); // coat
  px(ctx, '#3a6fd8', hx + 2, hy - 5, 3, 5); // overalls
  px(ctx, '#f1c9a5', f(11), hy - 3, 1, 1); // hands on the reins
  ctx.strokeStyle = '#4a2e1a';
  ctx.beginPath();
  ctx.moveTo(f(11) + 0.5, hy - 2.5);
  ctx.lineTo(g(-2) + 0.5, by - 11.5);
  ctx.stroke();
}
