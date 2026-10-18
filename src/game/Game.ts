import type { ArtLocation } from '../content/locations';
import { Tile, type World } from '../world/world';
import { input } from './input';
import { facingFor, step, type Facing, type Vec } from './movement';
import { INK, PAL } from './render/palette';
import { buildSprites, type SpriteSet } from './render/sprites';
import { CHUNK, ChunkCache, TS, hash } from './render/tileArt';
import { rng, spawnNpcs, wander, type Npc } from './npcs';

const WALK = 8; // tiles / second (a tile is 12 m — game time, not real time)
const RUN = 15;
const REACH = 1.9; // tiles: how close you must be to interact
const NPC_COUNT = 120;
const NPC_ACTIVE = 60; // only neighbors within this many tiles of you walk around

export interface PlacedLocation extends ArtLocation {
  x: number;
  y: number;
}

/** Something you can walk up to and press the action button on. */
export type Target = { kind: 'place'; loc: PlacedLocation } | { kind: 'npc'; npc: Npc };

/** Map text: neighborhoods loudest, parks (≥ ~2 hectares) in green, big schools small. */
const LABEL_STYLE = {
  hood: { font: '8px "Press Start 2P"', fill: '#ffe066', stroke: INK, minSize: 0 },
  park: { font: '8px "Press Start 2P"', fill: '#d9ffb8', stroke: '#1d5e34', minSize: 150 },
  school: { font: '6px "Press Start 2P"', fill: '#ffffff', stroke: INK, minSize: 60 },
} as const;

const targetKey = (t: Target | null) => (!t ? '' : t.kind === 'place' ? `p:${t.loc.id}` : `n:${t.npc.id}`);

export interface GameEvents {
  onStreet(name: string | null): void;
  onStorefront(name: string | null): void;
  onNearby(target: Target | null): void;
  onInteract(target: Target): void;
}

/** Integer zoom that keeps ~16 tiles across the short side of the screen. */
export function zoomFor(w: number, h: number): number {
  return Math.max(2, Math.min(4, Math.round(Math.min(w, h) / (TS * 16))));
}

export class Game {
  player: { pos: Vec; facing: Facing; walkT: number; moving: boolean };
  paused = false;
  visited = new Set<string>();
  readonly places: PlacedLocation[];
  readonly npcs: Npc[];
  private rand = rng(42);
  private storefront: string | null = null;
  private sprites: SpriteSet;
  private chunks: ChunkCache;
  private ctx: CanvasRenderingContext2D;
  private zoom = 3;
  private raf = 0;
  private last = 0;
  private street: string | null = null;
  private nearby: Target | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly world: World,
    locations: ArtLocation[],
    start: Vec,
    private events: GameEvents,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.sprites = buildSprites();
    this.chunks = new ChunkCache(world);
    this.player = { pos: world.nearestWalkable(start.x, start.y), facing: 'up', walkT: 0, moving: false };
    // Easels stand on the sidewalk beside the nearest walkable spot.
    this.places = locations.map((l) => {
      const p = world.project(l.lat, l.lon);
      const r = world.nearestWalkable(p.x, p.y);
      return { ...l, ...this.besideRoad(r) };
    });
    this.npcs = spawnNpcs(world, NPC_COUNT);
    this.resize();
  }

  /** Find a non-road tile next to a road tile, so the marker doesn't block the street. */
  private besideRoad(r: Vec): Vec {
    const tx = Math.floor(r.x);
    const ty = Math.floor(r.y);
    for (let d = 1; d < 5; d++) {
      for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
        const t = this.world.tileAt(tx + dx, ty + dy);
        if (t !== Tile.Road && t !== Tile.Water) return { x: tx + dx + 0.5, y: ty + dy + 0.5 };
      }
    }
    return r;
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
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
      this.last = t;
      this.update(dt);
      this.draw(t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** A neighbor's down-facing sprite as an image, for the dialog portrait. */
  portraitOf(npc: Npc): string {
    return npc.sprite.down[0].toDataURL();
  }

  /** Let any neighbor you were chatting with get back to their walk. */
  endTalk() {
    for (const n of this.npcs) n.talking = false;
  }

  teleport(p: Vec) {
    this.player.pos = this.world.nearestWalkable(p.x, p.y);
    this.player.facing = 'down';
  }

  private update(dt: number) {
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
      this.events.onStreet(street);
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
      this.events.onStorefront(shop);
    }

    let near: Target | null = null;
    let best = REACH;
    for (const loc of this.places) {
      const d = Math.hypot(loc.x - p.pos.x, loc.y - p.pos.y);
      if (d < best) {
        best = d;
        near = { kind: 'place', loc };
      }
    }
    for (const npc of this.npcs) {
      const d = Math.hypot(npc.pos.x - p.pos.x, npc.pos.y - p.pos.y);
      if (d < best * 0.8) {
        best = d / 0.8; // art spots win ties
        near = { kind: 'npc', npc };
      }
    }
    if (targetKey(near) !== targetKey(this.nearby)) {
      this.nearby = near;
      this.events.onNearby(near);
    }
    if (input.consume('a') && near) {
      if (near.kind === 'place') this.visited.add(near.loc.id);
      else {
        // Turn to face each other.
        const n = near.npc;
        n.talking = true;
        n.facing = facingFor({ x: p.pos.x - n.pos.x, y: p.pos.y - n.pos.y }, n.facing);
        p.facing = facingFor({ x: n.pos.x - p.pos.x, y: n.pos.y - p.pos.y }, p.facing);
      }
      this.events.onInteract(near);
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

    // Depth-sorted actors: markers, Mike, the player.
    const actors: { y: number; draw: () => void }[] = [];
    for (const loc of this.places) {
      const sx = Math.round(loc.x * TS - cam.x);
      const sy = Math.round(loc.y * TS - cam.y);
      if (sx < -32 || sy < -32 || sx > vw + 32 || sy > vh + 32) continue;
      const live = !!loc.experience;
      actors.push({
        y: loc.y,
        draw: () => {
          ctx.globalAlpha = live ? 1 : 0.8;
          ctx.drawImage(this.sprites.easel(loc.colors), sx - 8, sy - 14);
          ctx.globalAlpha = 1;
          if (live) {
            // Mike waits beside the live spots.
            const frame = Math.floor(time * 2) % 2;
            ctx.drawImage(this.sprites.mike[frame], sx + 6, sy - 14);
          }
          if (!this.visited.has(loc.id)) this.drawBeacon(sx, sy - 20, time, live);
        },
      });
    }
    for (const npc of this.npcs) {
      const sx = Math.round(npc.pos.x * TS - cam.x);
      const sy = Math.round(npc.pos.y * TS - cam.y);
      if (sx < -16 || sy < -16 || sx > vw + 16 || sy > vh + 16) continue;
      const f = npc.walkT ? Math.floor(npc.walkT * 6) % 2 : 0;
      actors.push({
        y: npc.pos.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(sx - 5, sy + 1, 10, 2);
          ctx.drawImage(npc.sprite[npc.facing][f], sx - 8, sy - 15);
        },
      });
    }
    const p = this.player;
    const frames = this.sprites.rabbit[p.facing];
    const frame = p.moving ? Math.floor(p.walkT * 8) % 2 : 0;
    actors.push({
      y: p.pos.y,
      draw: () => {
        const sx = Math.round(p.pos.x * TS - cam.x);
        const sy = Math.round(p.pos.y * TS - cam.y);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(sx - 5, sy + 1, 10, 2);
        ctx.drawImage(frames[frame], sx - 8, sy - 14);
      },
    });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

    if (this.nearby && !this.paused) {
      const sx = Math.round(p.pos.x * TS - cam.x);
      const sy = Math.round(p.pos.y * TS - cam.y);
      this.drawBubble(sx, sy - 24 + Math.round(Math.sin(time * 6)), this.nearby.kind === 'npc' ? '…' : '!');
    }
  }

  private drawBeacon(x: number, y: number, time: number, live: boolean) {
    const ctx = this.ctx;
    const bob = Math.round(Math.sin(time * 4) * 2);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 4, y + bob - 1, 9, 6);
    ctx.fillStyle = live ? '#ffe066' : '#ffffff';
    // ▼
    ctx.fillRect(x - 3, y + bob, 7, 1);
    ctx.fillRect(x - 2, y + bob + 1, 5, 1);
    ctx.fillRect(x - 1, y + bob + 2, 3, 1);
    ctx.fillRect(x, y + bob + 3, 1, 1);
    if (live && Math.floor(time * 3) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 6, y + bob - 3, 1, 3);
      ctx.fillRect(x + 5, y + bob - 2, 3, 1);
    }
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
