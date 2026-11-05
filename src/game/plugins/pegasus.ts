import type { CityGame, CityPlugin, DrawContext, Vec } from '../../city';
import { INK } from '../../city';
import { PEGASUS_HOME, pegasusHellos } from '../../content/pegasus';
import { sounds } from '../../ui/sounds';
import { altitude, newPegasus, pegasusTick, type PegasusState } from '../pegasus';
import { buildPegasus, type PegasusSprites } from '../sprites';
import { storefrontSlot } from '../storefrontSlot';
import { drawTiny, TINY_H, tinyWidth } from '../tinyFont';

/** px it climbs to by the end of its flight */
const CEILING = 90;

/**
 * The pegasus who lives in Pegasus Books: walk by and it comes out of the door, says hello
 * in a bubble and flies off over the rooftops (state in game/pegasus.ts, words in
 * content/pegasus.ts). Not something to talk to; it just greets you in passing.
 */
export class Pegasus implements CityPlugin {
  state: PegasusState | null = null;
  /** just inside the shop front, and the sidewalk outside its door */
  door: Vec | null = null;
  step: Vec | null = null;
  /** the shop front's street edge, in tiles: it's hidden behind it while still inside */
  private front = 0;
  private toStreet = 1;
  /** drawn on first use (so the plugin can be set up without a canvas, as in tests) */
  private sprites: PegasusSprites | null = null;

  attach(game: CityGame) {
    const slot = storefrontSlot(game.world, PEGASUS_HOME.face, PEGASUS_HOME.tenant);
    if (!slot) return;
    const { lm, side } = slot;
    // the facade's door is low in its slice (render/facades.ts), so it comes out near the bottom
    const y = slot.y1 - 0.3;
    this.toStreet = side === 'W' ? 1 : -1;
    this.front = side === 'W' ? lm.x + lm.w : lm.x;
    this.door = { x: this.front - this.toStreet * 1.2, y };
    this.step = game.world.nearestWalkable(this.front + this.toStreet * 0.8, y);
    this.state = newPegasus(this.door);
  }

  update(dt: number, game: CityGame) {
    const s = this.state;
    if (!s || !this.door || !this.step) return;
    const entered = pegasusTick(s, dt, game.player.pos, this.door, this.step);
    if (entered === 'hello') sounds.whinny();
    if (entered === 'flying') sounds.flap();
  }

  draw(d: DrawContext) {
    const s = this.state;
    if (!s || s.phase === 'inside' || s.phase === 'gone') return;
    const alt = Math.round(altitude(s) * CEILING);
    const p = d.toScreen(s.pos);
    if (!d.onScreen({ x: p.x, y: p.y - alt })) return;
    const { ctx, time } = d;
    const sprites = (this.sprites ??= buildPegasus());
    const flying = s.phase === 'flying';
    const front = d.toScreen({ x: this.front, y: s.pos.y }).x;
    d.push({
      // airborne, it passes over everything
      y: flying ? Infinity : s.pos.y,
      draw: () => {
        const w = alt > 30 ? 8 : 14;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(p.x - w / 2, p.y + 1, w, 2);
        let img: HTMLCanvasElement;
        if (flying) img = sprites.fly[s.facing][Math.floor(time * 7) % 2];
        else if (s.phase === 'out') img = sprites.walk[s.facing][Math.floor(time * 6) % 2];
        else img = sprites.walk[s.facing][0];
        ctx.save();
        if (s.phase === 'out') {
          // coming out of the door: only the part past the shop front shows
          ctx.beginPath();
          if (this.toStreet > 0) ctx.rect(front, p.y - 40, 64, 48);
          else ctx.rect(front - 64, p.y - 40, 64, 48);
          ctx.clip();
        }
        ctx.drawImage(img, p.x - 12, p.y - 19 - alt);
        ctx.restore();
        if (s.phase === 'hello') this.bubble(ctx, p.x, p.y - 21, pegasusHellos[s.visits % pegasusHellos.length]!);
      },
    });
  }

  /** a speech bubble whose tail points down at (x, y) */
  private bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
    const w = tinyWidth(text) + 6;
    const h = TINY_H + 4;
    const l = Math.round(x - w / 2);
    const top = Math.round(y - h - 3);
    ctx.fillStyle = INK;
    ctx.fillRect(l - 1, top - 1, w + 2, h + 2);
    ctx.fillRect(Math.round(x) - 2, top + h, 4, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(l, top, w, h);
    ctx.fillRect(Math.round(x) - 1, top + h, 2, 2);
    drawTiny(ctx, text, l + 3, top + 2, INK);
  }
}
