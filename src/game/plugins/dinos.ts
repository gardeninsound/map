import { dice, type CityGame, type CityPlugin, type DrawContext } from '../../city';
import { BETWEEN, FIRST, RETRY, sightingSpot, stepDino, waitFor, type Dino } from '../dinos';
import { DINO_SHEET } from '../dinoSheet';

/**
 * A toy dinosaur now and then, plodding west across the screen on an east–west street (when
 * and where in game/dinos.ts, sprite from Mike's GIF via scripts/make-dino.mjs). One at a
 * time, every few minutes. Scenery: nothing to talk to.
 */
export class Dinos implements CityPlugin {
  /** the one out now, if any (a list so the draw and dev checks stay simple) */
  dinos: Dino[] = [];
  private rand = dice('dinos'); // ?seed= makes it repeatable (city/clock.ts)
  private sheet: HTMLImageElement | null = null;
  /** seconds until the next one turns up */
  private wait = 0;

  attach() {
    this.wait = waitFor(FIRST, this.rand);
    if (typeof Image !== 'undefined') {
      this.sheet = new Image();
      this.sheet.src = `${import.meta.env.BASE_URL}${DINO_SHEET.file}`;
    }
  }

  update(dt: number, game: CityGame) {
    if (game.paused) return;
    const you = game.player.pos;
    this.dinos = this.dinos.filter((d) => stepDino(d, dt, game.world, you));
    if (this.dinos.length) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    const spot = sightingSpot(game.world, you, this.rand);
    if (!spot) {
      this.wait = RETRY;
      return;
    }
    this.dinos.push({ pos: spot, phase: this.rand() * 5 });
    this.wait = waitFor(BETWEEN, this.rand);
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
