import { dice, now, Tile, tone, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec } from '../../city';
import { ANNOUNCER, boxers, boxingWatch, ringside, RING_AT } from '../../content/chickenBoxing';
import { sounds } from '../../ui/sounds';
import { boutAt, type Bout } from '../chickenBoxing';
import type { BoxingScene } from '../boxing3d';
import { buildChicken } from '../sprites';
import { talk, type Action, type Actor } from '../actions';


/** the 3D scene loads once you're this close (tiles); thuds carry this far */
const LOAD_NEAR = 45;
const HEAR = 22;
/** the ring, tiles a side (boxing3d's RING) */
const RING = 5;

interface Feather {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Giant chickens boxing in West Seattle Stadium: a ring on the football field (its tiles
 * blocked, so you watch from the track), two chickens three storeys tall in gloves and
 * trunks, slugging it out round after round. The fight runs on the wall clock
 * (game/chickenBoxing.ts), so every rabbit sees the same punch. The chickens are three.js
 * (game/boxing3d.ts, loaded lazily when you come near), rendered at map-pixel size and drawn
 * into the map depth-sorted; feathers fly when a punch lands, with a thud, and the bell
 * rings each round. Ringside, {A}: the announcer (words in content/chickenBoxing.ts).
 */
let announcerPortrait: string | undefined;

export class ChickenBoxing implements CityPlugin, Actor {
  private rand = dice('boxing-feathers');
  ring: Vec = { x: 0, y: 0 };
  bout: Bout = boutAt(0);
  private scene: BoxingScene | null = null;
  private loading = false;
  private feathers: Feather[] = [];
  private lastImpact: number | null = null;
  private lastPhase = '';
  private near = Infinity;

  attach(game: CityGame) {
    const w = game.world;
    this.ring = w.project(RING_AT.lat, RING_AT.lon);
    // the ring's tiles: solid
    for (let y = Math.floor(this.ring.y - RING / 2); y <= this.ring.y + RING / 2; y++) {
      for (let x = Math.floor(this.ring.x - RING / 2); x <= this.ring.x + RING / 2; x++) {
        if (Math.abs(x + 0.5 - this.ring.x) < RING / 2 && Math.abs(y + 0.5 - this.ring.y) < RING / 2) w.tiles[x + y * w.w] = Tile.Landmark;
      }
    }
  }

  /** {A} ringside: the announcer on the bout so far */
  act(t: Target): Action | null {
    if (t.kind !== 'boxing') return null;
    sounds.cluck();
    const b = this.bout;
    return talk(ANNOUNCER, ringside(b.round, b.rest, b.landed), { portrait: (announcerPortrait ??= buildChicken().right[0]!.toDataURL()) });
  }

  targets(): Target[] {
    return [{ key: 'boxing', kind: 'boxing', x: this.ring.x, y: this.ring.y + RING / 2 + 0.9, label: boxingWatch, bubble: '!' }];
  }

  update(dt: number, game: CityGame) {
    const p = game.player.pos;
    this.near = Math.hypot(p.x - this.ring.x, p.y - this.ring.y);
    if (this.near < LOAD_NEAR && !this.scene && !this.loading) {
      this.loading = true;
      void import('../boxing3d').then(({ BoxingScene }) => {
        try {
          this.scene = new BoxingScene(boxers);
        } catch {
          // no WebGL here: the stadium stays a stadium
        }
      });
    }
    this.bout = boutAt(now() / 1000);
    const b = this.bout;
    const loud = this.near < HEAR && !game.quiet ? 1 - this.near / HEAR : 0;
    // the bell, start and end of each round
    const phase = `${b.bout}:${b.round}:${b.rest}`;
    if (phase !== this.lastPhase) {
      if (this.lastPhase && loud > 0) sounds.boxingBell(loud);
      this.lastPhase = phase;
    }
    // a punch lands: a thud and a puff of feathers off the one it hit
    const impact = b.impactAt !== null && b.inRound >= b.impactAt ? b.impactAt : null;
    if (impact !== null && impact !== this.lastImpact) {
      this.lastImpact = impact;
      if (loud > 0) tone(85, 0.14, 'triangle', 0.08 * loud, -40);
      const hit = b.fighters[0].hit > 0 || b.fighters[0].down > 0 ? 0 : 1;
      const head = this.scene?.headPx(hit as 0 | 1);
      if (head) {
        for (let i = 0; i < 7; i++) {
          this.feathers.push({ x: head.x, y: head.y, vx: (this.rand() - 0.5) * 50, vy: -10 - this.rand() * 30, life: 1.2 + this.rand() * 0.6 });
        }
      }
    }
    for (const f of this.feathers) {
      f.x += f.vx * dt + Math.sin(f.life * 6) * 0.4;
      f.y += f.vy * dt;
      f.vx *= 0.96;
      f.vy = Math.min(f.vy + 40 * dt, 14);
      f.life -= dt;
    }
    this.feathers = this.feathers.filter((f) => f.life > 0);
  }

  draw(d: DrawContext) {
    const scene = this.scene;
    const s = d.toScreen(this.ring);
    if (!scene || !d.onScreen(s, 120)) return;
    const { ctx, time } = d;
    const b = this.bout;
    d.push({
      // depth: the ring's front ropes
      y: this.ring.y + RING / 2,
      draw: () => {
        scene.render(b.fighters, time, b.rest);
        const x0 = Math.round(s.x - scene.anchor.x), y0 = Math.round(s.y - scene.anchor.y);
        ctx.drawImage(scene.canvas, x0, y0);
        for (const f of this.feathers) {
          ctx.fillStyle = f.life > 0.4 ? '#fff8ec' : 'rgba(255,248,236,0.6)';
          ctx.fillRect(Math.round(x0 + f.x), Math.round(y0 + f.y), 2, 1);
        }
        // the round card over the ring
        const card = b.rest ? `ROUND ${b.round} OVER` : `ROUND ${b.round}`;
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const tw = ctx.measureText(card).width + 8;
        const cy = Math.round(y0 + Math.min(scene.headPx(0).y, scene.headPx(1).y) - 44);
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(Math.round(s.x - tw / 2) - 1, cy - 1, Math.round(tw) + 2, 12);
        ctx.fillStyle = '#ff2e93';
        ctx.fillRect(Math.round(s.x - tw / 2), cy, Math.round(tw), 10);
        ctx.fillStyle = '#fff1e0';
        ctx.fillText(card, Math.round(s.x), cy + 1);
        ctx.textAlign = 'start';
      },
    });
  }
}
