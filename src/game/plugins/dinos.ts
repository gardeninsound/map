import type { CityGame, CityPlugin, DrawContext } from '../../city';
import { DINO_COUNT, spawnSpot, stepDino, type Dino } from '../dinos';
import { DINO_SHEET } from '../dinoSheet';

/** A seeded random, so a session's dinosaurs don't depend on frame timing in tests. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * Toy dinosaurs plodding west along the east–west streets (walking in game/dinos.ts, sprite
 * from Mike's GIF via scripts/make-dino.mjs). Scenery: nothing to talk to.
 */
export class Dinos implements CityPlugin {
  dinos: Dino[] = [];
  private rand = rng(Date.now());
  private sheet: HTMLImageElement | null = null;

  attach(game: CityGame) {
    const you = game.player.pos;
    for (let i = 0; i < DINO_COUNT; i++) {
      const spot = spawnSpot(game.world, you, this.rand);
      if (spot) this.dinos.push({ pos: spot, phase: this.rand() * 5 });
    }
    if (typeof Image !== 'undefined') {
      this.sheet = new Image();
      this.sheet.src = `${import.meta.env.BASE_URL}${DINO_SHEET.file}`;
    }
  }

  update(dt: number, game: CityGame) {
    if (game.paused) return;
    for (const d of this.dinos) stepDino(d, dt, game.world, game.player.pos, this.rand);
  }

  draw(d: DrawContext) {
    const img = this.sheet;
    if (!img?.complete || !img.naturalWidth) return;
    const { frameW: w, frameH: h, frames, fps } = DINO_SHEET;
    for (const dino of this.dinos) {
      const s = d.toScreen(dino.pos);
      if (!d.onScreen(s, w)) continue;
      const f = Math.floor((d.time + dino.phase) * fps) % frames;
      d.push({
        y: dino.pos.y,
        // feet on the spot, centred on it, facing west as in the GIF
        draw: () => d.ctx.drawImage(img, f * w, 0, w, h, s.x - (w >> 1), s.y - h + 4, w, h),
      });
    }
  }
}
