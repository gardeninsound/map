import { Tile, markerSpot, type World } from '../world/world';
import { input } from './input';
import { facingFor, step, type Facing, type Vec } from './movement';
import { INK, PAL } from '../render/palette';
import { buildArrows, buildSprites, type SpriteSet, type Walker } from '../render/sprites';
import { CHUNK, ChunkCache, TS, hash } from '../render/tileArt';
import { rng, spawnNpcs, wander, type Npc, type NeighborVoice } from './npcs';

const WALK = 8; // tiles / second (a tile is 12 m — game time, not real time)
const RUN = 15;
const REACH = 1.9; // tiles: how close you must be to interact
const NPC_ACTIVE = 60; // only neighbors within this many tiles of you walk around

/**
 * Something you can walk up to and press the action button on. The city offers its
 * neighbors (kind 'npc'); plugins offer their own kinds and carry what they need in `data`.
 */
export interface Target {
  /** stable id, unique across all targets */
  key: string;
  kind: string;
  x: number;
  y: number;
  /** what the HUD shows: name, optional caption, and the verb on the button hint */
  label: { name: string; where?: string; verb: string };
  /** speech-bubble glyph over the player when close ('!' by default) */
  bubble?: string;
  /** < 1 makes it lose ties to closer-ranked targets (neighbors use 0.8) */
  weight?: number;
  /** for kind 'npc': the neighbor, who stops and turns to face you */
  npc?: Npc;
  data?: unknown;
}

/** A depth-sorted draw call: actors with a larger `y` draw on top. */
export interface DrawItem {
  y: number;
  draw: () => void;
}

/** What a plugin gets each frame to draw with. Coordinates: `toScreen` maps tiles → px. */
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  time: number;
  cam: Vec;
  view: { w: number; h: number };
  toScreen(p: Vec): Vec;
  /** true if a screen point is within the view plus a margin */
  onScreen(s: Vec, margin?: number): boolean;
  push(item: DrawItem): void;
}

/**
 * Plug-ins add things to the city without the city knowing about them: art spots,
 * a busker, a crow… Each can update every frame, draw depth-sorted, and offer targets.
 */
export interface CityPlugin {
  /** once, when the city is built — e.g. add your own characters to `game.npcs` */
  attach?(game: CityGame): void;
  /** every frame, even while paused (`paused` says whether the player can move) */
  update?(dt: number, game: CityGame): void;
  draw?(d: DrawContext, game: CityGame): void;
  targets?(game: CityGame): Target[];
  start?(): void;
  stop?(): void;
}

export interface CityGameEvents {
  onStreet?(name: string | null): void;
  onStorefront?(name: string | null): void;
  onNearby?(target: Target | null): void;
  onInteract?(target: Target): void;
}

export interface CityGameOptions {
  /** where you start, in tile coords (snapped to the nearest street) */
  start: Vec;
  events?: CityGameEvents;
  plugins?: CityPlugin[];
  /** how many neighbors wander the streets */
  npcCount?: number;
  /** what neighbors say; defaults to friendly city small talk */
  voices?: NeighborVoice[];
  /** the player's sprite; defaults to the rabbit */
  player?: Walker;
}

/** Map text: neighborhoods loudest, parks (≥ ~2 hectares) in green, big schools small. */
const LABEL_STYLE = {
  hood: { font: '8px "Press Start 2P"', fill: '#e6b23a', stroke: INK, minSize: 0 },
  park: { font: '8px "Press Start 2P"', fill: '#e5f0dc', stroke: '#173f2b', minSize: 150 },
  school: { font: '6px "Press Start 2P"', fill: '#f3e6cc', stroke: INK, minSize: 60 },
} as const;

/** Integer zoom that keeps ~16 tiles across the short side of the screen. */
export function zoomFor(w: number, h: number): number {
  return Math.max(2, Math.min(4, Math.round(Math.min(w, h) / (TS * 16))));
}

/**
 * The walkable city: a canvas-rendered West Seattle with a player, wandering neighbors,
 * street names, and room for plugins. Pause it while something is on top of the map.
 */
export class CityGame {
  player: { pos: Vec; facing: Facing; walkT: number; moving: boolean };
  /** the player can't move (a dialog or scene is open) */
  paused = false;
  /** keep the street quiet (e.g. while a full-screen scene is open) — plugins read this */
  quiet = false;
  readonly npcs: Npc[];
  readonly plugins: CityPlugin[];
  /** seconds since start, the clock everything animates on */
  now = 0;
  private rand = rng(42);
  private sprites: SpriteSet;
  private playerSprite: Walker;
  private chunks: ChunkCache;
  private ctx: CanvasRenderingContext2D;
  private zoom = 3;
  private raf = 0;
  private last = 0;
  private street: string | null = null;
  private storefront: string | null = null;
  private nearby: Target | null = null;
  /** the target whose '!' bubble is up (plugins keep their own bubbles clear of it) */
  get nearbyTarget(): Target | null {
    return this.paused ? null : this.nearby;
  }
  private arrows = buildArrows();
  private hint: { until: number; from: Vec; to: Vec } | null = null;
  private events: CityGameEvents;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly world: World,
    options: CityGameOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.sprites = buildSprites();
    this.playerSprite = options.player ?? this.sprites.rabbit;
    this.chunks = new ChunkCache(world);
    this.events = options.events ?? {};
    this.plugins = options.plugins ?? [];
    this.player = { pos: world.nearestWalkable(options.start.x, options.start.y), facing: 'up', walkT: 0, moving: false };
    this.npcs = spawnNpcs(world, options.npcCount ?? 120, options.voices);
    this.plugins.forEach((p) => p.attach?.(this));
    this.resize();
  }

  /** Where a sign or marker can stand beside the nearest street, always within reach (see markerSpot). */
  besideRoad(p: Vec): Vec {
    return markerSpot(this.world, p);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.zoom = zoomFor(w, h);
    this.canvas.width = Math.ceil(w / this.zoom);
    this.canvas.height = Math.ceil(h / this.zoom);
    this.canvas.style.width = `${this.canvas.width * this.zoom}px`;
    this.canvas.style.height = `${this.canvas.height * this.zoom}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  start() {
    this.plugins.forEach((p) => p.start?.());
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
      this.last = t;
      this.now = t / 1000;
      this.update(dt);
      this.draw(this.now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.plugins.forEach((p) => p.stop?.());
  }

  /** Flash an arrow beside the player pointing toward `to` (tile coords). */
  showDirectionHint(to: Vec, seconds = 3.2) {
    this.hint = { until: this.now + seconds, from: { ...this.player.pos }, to };
  }

  /** A sprite's down-facing frame as an image, for a dialog portrait. */
  portraitOf(npc: Npc): string {
    return npc.sprite.down[0].toDataURL();
  }

  /** Let anyone you were chatting with get back to what they were doing. */
  endTalk() {
    for (const n of this.npcs) n.talking = false;
    this.lastTalked = null;
  }

  /** the neighbor you're talking to (also set for plugin targets that carry an `npc`) */
  lastTalked: Npc | null = null;

  teleport(p: Vec) {
    this.player.pos = this.world.nearestWalkable(p.x, p.y);
    this.player.facing = 'down';
  }

  private update(dt: number) {
    for (const plugin of this.plugins) plugin.update?.(dt, this);
    const p = this.player;
    if (this.paused) {
      p.moving = false;
      return;
    }
    const dir = input.dir();
    const next = step(p.pos, dir, dt, input.running() ? RUN : WALK, this.world.isWalkable);
    p.moving = next !== p.pos && (next.x !== p.pos.x || next.y !== p.pos.y);
    p.facing = facingFor(dir, p.facing);
    p.pos = next;
    p.walkT = p.moving ? p.walkT + dt : 0;

    for (const npc of this.npcs) {
      if (Math.abs(npc.pos.x - p.pos.x) > NPC_ACTIVE || Math.abs(npc.pos.y - p.pos.y) > NPC_ACTIVE) continue;
      wander(npc, dt, this.world.isWalkable, this.rand);
    }

    const street = this.world.streetAt(p.pos.x, p.pos.y);
    if (street !== this.street) {
      this.street = street;
      this.events.onStreet?.(street);
    }

    let shop: string | null = null;
    let shopD = 3.5;
    for (const s of this.world.shops) {
      const d = Math.hypot(s.x - p.pos.x, s.y - p.pos.y);
      if (d < shopD) {
        shopD = d;
        shop = s.name;
      }
    }
    if (shop !== this.storefront) {
      this.storefront = shop;
      this.events.onStorefront?.(shop);
    }

    // The closest thing you can interact with: plugin targets and the neighbors.
    const candidates: Target[] = this.plugins.flatMap((pl) => pl.targets?.(this) ?? []);
    for (const npc of this.npcs) {
      if (npc.inactive || Math.abs(npc.pos.x - p.pos.x) > 4 || Math.abs(npc.pos.y - p.pos.y) > 4) continue;
      candidates.push({
        key: `npc:${npc.id}`,
        kind: 'npc',
        x: npc.pos.x,
        y: npc.pos.y,
        label: { name: npc.voice.name, verb: 'say hi' },
        bubble: '…',
        weight: 0.8,
        npc,
      });
    }
    let near: Target | null = null;
    let best = REACH;
    for (const t of candidates) {
      const d = Math.hypot(t.x - p.pos.x, t.y - p.pos.y) / (t.weight ?? 1);
      if (d < best) {
        best = d;
        near = t;
      }
    }
    if ((near?.key ?? '') !== (this.nearby?.key ?? '')) {
      this.nearby = near;
      this.events.onNearby?.(near);
    }
    if (input.consume('a') && near) {
      const n = near.npc;
      if (n) {
        // Turn to face each other.
        n.talking = true;
        this.lastTalked = n;
        n.facing = facingFor({ x: p.pos.x - n.pos.x, y: p.pos.y - n.pos.y }, n.facing);
        p.facing = facingFor({ x: n.pos.x - p.pos.x, y: n.pos.y - p.pos.y }, p.facing);
      }
      this.events.onInteract?.(near);
    }
  }

  private camera() {
    const { width: vw, height: vh } = this.canvas;
    const maxX = this.world.w * TS - vw;
    const maxY = this.world.h * TS - vh;
    return {
      x: Math.round(Math.max(0, Math.min(maxX, this.player.pos.x * TS - vw / 2))),
      y: Math.round(Math.max(0, Math.min(maxY, this.player.pos.y * TS - vh / 2))),
    };
  }

  private draw(time: number) {
    const ctx = this.ctx;
    const { width: vw, height: vh } = this.canvas;
    const cam = this.camera();
    ctx.fillStyle = PAL.water;
    ctx.fillRect(0, 0, vw, vh);

    // Terrain chunks.
    const span = CHUNK * TS;
    for (let cy = Math.floor(cam.y / span); cy <= Math.floor((cam.y + vh) / span); cy++) {
      for (let cx = Math.floor(cam.x / span); cx <= Math.floor((cam.x + vw) / span); cx++) {
        ctx.drawImage(this.chunks.get(cx, cy), cx * span - cam.x, cy * span - cam.y);
      }
    }

    // Twinkling water.
    const tx0 = Math.floor(cam.x / TS);
    const ty0 = Math.floor(cam.y / TS);
    for (let ty = ty0; ty <= ty0 + vh / TS + 1; ty++) {
      for (let tx = tx0; tx <= tx0 + vw / TS + 1; tx++) {
        if (this.world.tileAt(tx, ty) !== Tile.Water) continue;
        const h = hash(tx, ty, 99);
        if (h > 0.22) continue;
        const phase = (time * 0.8 + h * 20) % 3;
        if (phase > 1) continue;
        const x = tx * TS - cam.x + Math.floor(hash(tx, ty, 98) * 10);
        const y = ty * TS - cam.y + Math.floor(hash(tx, ty, 97) * 12);
        ctx.fillStyle = PAL.waterLight;
        ctx.fillRect(x, y, phase < 0.5 ? 3 : 5, 1);
        if (phase < 0.5) {
          ctx.fillStyle = PAL.foam;
          ctx.fillRect(x + 1, y, 1, 1);
        }
      }
    }

    this.drawLabels(cam);

    // Depth-sorted actors: plugins' sprites, the neighbors, the player.
    const items: DrawItem[] = [];
    const toScreen = (q: Vec) => ({ x: Math.round(q.x * TS - cam.x), y: Math.round(q.y * TS - cam.y) });
    const dc: DrawContext = {
      ctx,
      time,
      cam,
      view: { w: vw, h: vh },
      toScreen,
      onScreen: (s, m = 32) => s.x > -m && s.y > -m && s.x < vw + m && s.y < vh + m,
      push: (item) => items.push(item),
    };
    for (const plugin of this.plugins) plugin.draw?.(dc, this);
    for (const npc of this.npcs) {
      if (npc.custom) continue; // drawn by its plugin
      const s = toScreen(npc.pos);
      if (!dc.onScreen(s, 16)) continue;
      const f = npc.walkT ? Math.floor(npc.walkT * 6) % 2 : 0;
      items.push({
        y: npc.pos.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(s.x - 5, s.y + 1, 10, 2);
          ctx.drawImage(npc.sprite[npc.facing][f], s.x - 8, s.y - 15);
        },
      });
    }
    const p = this.player;
    const frames = this.playerSprite[p.facing];
    const frame = p.moving ? Math.floor(p.walkT * 8) % 2 : 0;
    items.push({
      y: p.pos.y,
      draw: () => {
        const s = toScreen(p.pos);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(s.x - 5, s.y + 1, 10, 2);
        ctx.drawImage(frames[frame], s.x - 8, s.y - 14);
      },
    });
    items.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

    if (this.hint) this.drawHint(cam, time);

    if (this.nearby && !this.paused) {
      const s = toScreen(p.pos);
      this.drawBubble(s.x, s.y - 24 + Math.round(Math.sin(time * 6)), this.nearby.bubble ?? '!');
    }
  }

  private drawHint(cam: Vec, time: number) {
    const h = this.hint!;
    const p = this.player.pos;
    // Gone once time's up or you've set off.
    if (time > h.until || Math.hypot(p.x - h.from.x, p.y - h.from.y) > 3) {
      this.hint = null;
      return;
    }
    // Four flashes: on for half of each 0.8 s beat.
    if ((h.until - time) % 0.8 < 0.4) return;
    const angle = Math.atan2(h.to.x - p.x, -(h.to.y - p.y));
    const dir = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
    const a = this.arrows[dir];
    const size = a.width * 2;
    const r = 26; // px from the player
    const sx = Math.round(p.x * TS - cam.x + Math.sin(angle) * r - size / 2);
    const sy = Math.round(p.y * TS - cam.y - 6 - Math.cos(angle) * r - size / 2);
    this.ctx.drawImage(a, sx, sy, size, size);
  }

  private drawBubble(x: number, y: number, text: string) {
    const ctx = this.ctx;
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, 13, 11);
    ctx.fillRect(x - 1, y + 5, 3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 5, y - 5, 11, 9);
    ctx.fillStyle = INK;
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 1, y);
  }

  private drawLabels(cam: Vec) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const l of this.world.labels) {
      const style = LABEL_STYLE[l.kind];
      if (l.size < style.minSize) continue;
      const x = Math.round(l.x * TS - cam.x);
      const y = Math.round(l.y * TS - cam.y);
      if (x < -200 || y < -20 || x > this.canvas.width + 200 || y > this.canvas.height + 20) continue;
      ctx.font = style.font;
      const text = l.kind === 'school' ? l.name : l.name.toUpperCase();
      ctx.lineWidth = 3;
      ctx.strokeStyle = style.stroke;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = style.fill;
      ctx.fillText(text, x, y);
    }
  }
}
