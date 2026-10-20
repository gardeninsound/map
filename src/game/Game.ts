import type { ArtLocation } from '../content/locations';
import { Tile, isBuilding, isWalkableTile, type World } from '../world/world';
import { input } from './input';
import { facingFor, step, type Facing, type Vec } from './movement';
import { INK, PAL } from './render/palette';
import { buildArrows, buildCrow, buildPerson, buildSprites, noteCanvases, type SpriteSet, type Walker } from './render/sprites';
import { BuskerMusic } from './busker';
import { altitude, flyTick, newCrow, takeOff, type CrowState } from './crow';
import { buskerVoice } from '../content/neighbors';
import { CROW_NAME, crowStops } from '../content/crow';
import { sfx } from '../ui/sfx';
import { CHUNK, ChunkCache, TS, hash } from './render/tileArt';
import { LEMON_BASE } from './render/lemon';
import { rng, spawnNpcs, wander, type Npc } from './npcs';

const WALK = 8; // tiles / second (a tile is 12 m — game time, not real time)
const RUN = 15;
const REACH = 1.9; // tiles: how close you must be to interact
const NPC_COUNT = 120;
const NPC_ACTIVE = 60; // only neighbors within this many tiles of you walk around
const EARSHOT = 11; // tiles (~130 m): how far the busker's music carries

export interface PlacedLocation extends ArtLocation {
  x: number;
  y: number;
}

/** Something you can walk up to and press the action button on. */
export type Target = { kind: 'place'; loc: PlacedLocation } | { kind: 'npc'; npc: Npc };

/** Map text: neighborhoods loudest, parks (≥ ~2 hectares) in green, big schools small. */
const LABEL_STYLE = {
  hood: { font: '8px "Press Start 2P"', fill: '#e6b23a', stroke: INK, minSize: 0 },
  park: { font: '8px "Press Start 2P"', fill: '#e5f0dc', stroke: '#173f2b', minSize: 150 },
  school: { font: '6px "Press Start 2P"', fill: '#f3e6cc', stroke: INK, minSize: 60 },
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
  private arrows = buildArrows();
  /** keep the street quiet (e.g. while an art scene is open) */
  quiet = false;
  readonly busker: Npc;
  private music = new BuskerMusic();
  private notes = noteCanvases(['#ff7eb6', '#ffe066', '#2ec4b6', '#ffffff']);
  private buskerSprite: Walker;
  /** the snack crow: talk to it and it flies off to its next perch */
  readonly crow: Npc;
  readonly crowState: CrowState;
  private crowPerches: Vec[];
  private crowSprites = buildCrow();
  /** first-visit "go this way" arrow: shown until this time (s), unless you start walking */
  private hint: { until: number; from: Vec } | null = null;
  private now = 0;

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
    // Each spot's lemon sits on the sidewalk beside the nearest walkable spot.
    this.places = locations.map((l) => {
      const p = world.project(l.lat, l.lon);
      const r = world.nearestWalkable(p.x, p.y);
      return { ...l, ...this.besideRoad(r) };
    });
    this.npcs = spawnNpcs(world, NPC_COUNT);
    // The busker plays on the sidewalk outside Easy Street, on the Junction corner.
    const easy = world.shops.find((s) => /easy street/i.test(s.name));
    const spot = easy ? world.nearestWalkable(easy.x, easy.y) : world.project(47.5613, -122.3868);
    this.buskerSprite = buildPerson({ h: '#e0322b', s: '#e0ac69', c: '#ffd166', j: '#3d5a99', b: '#2b2350' });
    this.busker = {
      id: -1,
      pos: { x: spot.x, y: spot.y },
      dir: { x: 0, y: 0 },
      facing: 'down',
      walkT: 0,
      timer: 0,
      talking: false,
      still: true,
      voice: buskerVoice,
      sprite: this.buskerSprite,
    };
    this.npcs.push(this.busker);
    // The crow starts on the sidewalk outside Les Schwab on Alaska; see content/crow.ts.
    this.crowPerches = crowStops.map((s) => {
      const shop = world.shops.find((x) => s.shop.test(x.name));
      const p = shop ?? world.project(s.lat, s.lon);
      return world.nearestWalkable(p.x, p.y);
    });
    this.crowState = newCrow(this.crowPerches);
    this.crow = {
      id: -2,
      pos: this.crowState.pos,
      dir: { x: 0, y: 0 },
      facing: 'right',
      walkT: 0,
      timer: 0,
      talking: false,
      still: true,
      voice: { name: CROW_NAME, lines: [] },
      sprite: this.crowSprites.perch,
    };
    this.npcs.push(this.crow);
    this.resize();
  }

  /**
   * Find open ground next to the street for a marker: not the street itself (so it doesn't
   * block it), and not water, a building, a parking lot or a landmark drawing.
   */
  private besideRoad(r: Vec): Vec {
    const tx = Math.floor(r.x);
    const ty = Math.floor(r.y);
    const open = (t: number) => !isWalkableTile(t) && !isBuilding(t) && t !== Tile.Water && t !== Tile.Landmark;
    for (let d = 1; d < 5; d++) {
      for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
        if (open(this.world.tileAt(tx + dx, ty + dy))) return { x: tx + dx + 0.5, y: ty + dy + 0.5 };
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
    this.music.start();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
      this.last = t;
      this.update(dt);
      this.now = t / 1000;
      this.draw(t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.music.stop();
  }

  /** Flash an arrow beside the player toward the nearest open art spot (first visit). */
  showDirectionHint(seconds = 3.2) {
    this.hint = { until: this.now + seconds, from: { ...this.player.pos } };
  }

  /** A neighbor's down-facing sprite as an image, for the dialog portrait. */
  portraitOf(npc: Npc): string {
    return npc.sprite.down[0].toDataURL();
  }

  /** Let any neighbor you were chatting with get back to their walk. */
  endTalk() {
    for (const n of this.npcs) n.talking = false;
  }

  /** After the snack question: caw and fly to the next perch. */
  crowFlyAway(shared: boolean) {
    if (shared) this.crowState.snacks++;
    this.crow.talking = false;
    takeOff(this.crowState, this.crowPerches);
    sfx.caw();
  }

  teleport(p: Vec) {
    this.player.pos = this.world.nearestWalkable(p.x, p.y);
    this.player.facing = 'down';
  }

  private update(dt: number) {
    const p = this.player;
    // Music swells as you walk up to the busker, fades as you leave.
    const d = Math.hypot(this.busker.pos.x - p.pos.x, this.busker.pos.y - p.pos.y);
    this.music.level = this.quiet ? 0 : Math.max(0, 1 - d / EARSHOT) ** 1.6;
    flyTick(this.crowState, dt);
    this.crow.pos = this.crowState.pos;
    // Perched and idle, the crow looks this way and that.
    if (!this.crowState.flight && !this.crow.talking) this.crow.facing = Math.floor(this.now / 2.7) % 3 === 1 ? 'left' : 'right';
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
      if (npc === this.crow && this.crowState.flight) continue;
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
          // A lemon marks the spot: ripe where there's art to see, still green if coming soon.
          const lemon = live ? this.sprites.lemon.ripe : this.sprites.lemon.unripe;
          ctx.drawImage(lemon, sx - 9, sy - LEMON_BASE - 1);
          if (live) {
            // Mike waits beside the live spots.
            const frame = Math.floor(time * 2) % 2;
            ctx.drawImage(this.sprites.mike[frame], sx + 11, sy - 14);
          }
          if (!this.visited.has(loc.id)) this.drawBeacon(sx + 1, sy - LEMON_BASE - 7, time, live);
        },
      });
    }
    for (const npc of this.npcs) {
      if (npc === this.busker || npc === this.crow) continue;
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
    this.drawBusker(cam, time, actors);
    this.drawCrow(cam, time, actors);
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

    if (this.hint) this.drawHint(cam, time);

    if (this.nearby && !this.paused) {
      const sx = Math.round(p.pos.x * TS - cam.x);
      const sy = Math.round(p.pos.y * TS - cam.y);
      this.drawBubble(sx, sy - 24 + Math.round(Math.sin(time * 6)), this.nearby.kind === 'npc' ? '…' : '!');
    }
  }

  /** The busker: rocks on the beat behind a little keyboard, notes floating up. */
  private drawBusker(cam: Vec, time: number, actors: { y: number; draw: () => void }[]) {
    const b = this.busker;
    const sx = Math.round(b.pos.x * TS - cam.x);
    const sy = Math.round(b.pos.y * TS - cam.y);
    const { width: vw, height: vh } = this.canvas;
    if (sx < -32 || sy < -48 || sx > vw + 32 || sy > vh + 32) return;
    const ctx = this.ctx;
    const beat = this.music.beat;
    const phase = (time / beat) % 2; // two beats per sway
    const rock = b.talking ? 0 : Math.round(Math.sin(phase * Math.PI));
    const frame = Math.floor(time / beat) % 2;
    actors.push({
      y: b.pos.y,
      draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(sx - 7, sy + 1, 14, 2);
        ctx.drawImage(this.buskerSprite[b.facing][b.talking ? 0 : frame], sx - 8 + rock, sy - 15);
        // keyboard on its stand, in front of them
        ctx.fillStyle = INK;
        ctx.fillRect(sx - 8, sy - 6, 16, 5);
        ctx.fillRect(sx - 6, sy - 1, 1, 3);
        ctx.fillRect(sx + 5, sy - 1, 1, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 7, sy - 5, 14, 3);
        ctx.fillStyle = INK;
        for (let k = -6; k < 7; k += 2) if (k !== 0) ctx.fillRect(sx + k, sy - 5, 1, 2);
        ctx.fillStyle = '#ff5d5d';
        ctx.fillRect(sx - 7, sy - 6, 3, 1);
        // notes drift up and fade: a new one each beat while you're in earshot
        if (this.music.level > 0.02 && !this.quiet) {
          const n = Math.floor(time / beat);
          for (let k = 0; k < 4; k++) {
            const born = (n - k) * beat;
            const age = (time - born) / (beat * 4); // 0..1 over four beats
            if (age < 0 || age > 1) continue;
            const seed = hash(n - k, 3, 7);
            const img = this.notes[Math.floor(seed * this.notes.length)];
            const nx = sx + Math.round((seed - 0.5) * 14 + Math.sin(age * 6 + seed * 6) * 3);
            const ny = sy - 18 - Math.round(age * 22);
            ctx.globalAlpha = Math.min(1, (1 - age) * 1.5) * Math.min(1, this.music.level * 3);
            ctx.drawImage(img, nx, ny);
          }
          ctx.globalAlpha = 1;
        }
      },
    });
  }

  /** The crow: hops now and then on its perch; in flight, flaps high over the rooftops. */
  private drawCrow(cam: Vec, time: number, actors: { y: number; draw: () => void }[]) {
    const c = this.crow;
    const f = this.crowState.flight;
    const alt = f ? Math.round(altitude(f) * 40) : 0;
    const sx = Math.round(c.pos.x * TS - cam.x);
    const sy = Math.round(c.pos.y * TS - cam.y);
    const { width: vw, height: vh } = this.canvas;
    if (sx < -32 || sy < -32 || sx > vw + 32 || sy - alt > vh + 32) return;
    const ctx = this.ctx;
    actors.push({
      // airborne, it passes over everything
      y: f ? Infinity : c.pos.y,
      draw: () => {
        const w = alt > 20 ? 4 : 6;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(sx - w / 2, sy + 1, w, 2);
        if (f) {
          const img = this.crowSprites.fly[f.to.x >= f.from.x ? 'right' : 'left'][Math.floor(time * 8) % 2];
          ctx.drawImage(img, sx - 8, sy - 12 - alt);
        } else {
          const hop = !c.talking && (time * 0.6) % 2.5 < 0.12 ? 1 : 0;
          ctx.drawImage(c.sprite[c.facing][hop], sx - 8, sy - 15);
        }
      },
    });
  }

  private drawHint(cam: Vec, time: number) {
    const h = this.hint!;
    const p = this.player.pos;
    // Gone once time's up or you've set off.
    if (time > h.until || Math.hypot(p.x - h.from.x, p.y - h.from.y) > 3) {
      this.hint = null;
      return;
    }
    let best: PlacedLocation | null = null;
    for (const loc of this.places) {
      if (loc.experience && (!best || Math.hypot(loc.x - p.x, loc.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y))) best = loc;
    }
    if (!best) return;
    // Four flashes: on for half of each 0.8 s beat.
    if ((h.until - time) % 0.8 < 0.4) return;
    const angle = Math.atan2(best.x - p.x, -(best.y - p.y));
    const dir = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
    const a = this.arrows[dir];
    const size = a.width * 2;
    const r = 26; // px from the rabbit
    const sx = Math.round(p.x * TS - cam.x + Math.sin(angle) * r - size / 2);
    const sy = Math.round(p.y * TS - cam.y - 6 - Math.cos(angle) * r - size / 2);
    this.ctx.drawImage(a, sx, sy, size, size);
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
