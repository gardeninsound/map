import { buildPerson, hash, INK, noteCanvases, type CityGame, type CityPlugin, type DrawContext, type Npc, type Walker } from '../../city';
import { buskerVoice } from '../../content/neighbors';
import { BuskerMusic } from '../busker';

const EARSHOT = 11; // tiles (~130 m): how far the music carries

/**
 * The keyboard player on the curb outside Easy Street (the Junction). Rocks on the beat,
 * notes float up, and the music swells as you walk up and fades as you leave.
 */
export class Busker implements CityPlugin {
  npc!: Npc;
  private music = new BuskerMusic();
  private notes = noteCanvases(['#ff7eb6', '#ffe066', '#2ec4b6', '#ffffff']);
  private sprite: Walker = buildPerson({ h: '#e0322b', s: '#e0ac69', c: '#ffd166', j: '#3d5a99', b: '#2b2350' });

  attach(game: CityGame) {
    const { world } = game;
    const easy = world.shops.find((s) => /easy street/i.test(s.name));
    const spot = easy ? world.nearestWalkable(easy.x, easy.y) : world.project(47.5613, -122.3868);
    this.npc = {
      id: -1,
      pos: { x: spot.x, y: spot.y },
      dir: { x: 0, y: 0 },
      facing: 'down',
      walkT: 0,
      timer: 0,
      talking: false,
      still: true,
      custom: true,
      voice: buskerVoice,
      sprite: this.sprite,
    };
    game.npcs.push(this.npc);
  }

  start() {
    this.music.start();
  }

  stop() {
    this.music.stop();
  }

  update(_dt: number, game: CityGame) {
    const p = game.player.pos;
    const d = Math.hypot(this.npc.pos.x - p.x, this.npc.pos.y - p.y);
    this.music.level = game.quiet ? 0 : Math.max(0, 1 - d / EARSHOT) ** 1.6;
  }

  draw(d: DrawContext, game: CityGame) {
    const b = this.npc;
    const s = d.toScreen(b.pos);
    if (!d.onScreen(s, 48)) return;
    const { ctx, time } = d;
    const beat = this.music.beat;
    const phase = (time / beat) % 2; // two beats per sway
    const rock = b.talking ? 0 : Math.round(Math.sin(phase * Math.PI));
    const frame = Math.floor(time / beat) % 2;
    d.push({
      y: b.pos.y,
      draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(s.x - 7, s.y + 1, 14, 2);
        ctx.drawImage(this.sprite[b.facing][b.talking ? 0 : frame], s.x - 8 + rock, s.y - 15);
        // keyboard on its stand, in front of them
        ctx.fillStyle = INK;
        ctx.fillRect(s.x - 8, s.y - 6, 16, 5);
        ctx.fillRect(s.x - 6, s.y - 1, 1, 3);
        ctx.fillRect(s.x + 5, s.y - 1, 1, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x - 7, s.y - 5, 14, 3);
        ctx.fillStyle = INK;
        for (let k = -6; k < 7; k += 2) if (k !== 0) ctx.fillRect(s.x + k, s.y - 5, 1, 2);
        ctx.fillStyle = '#ff5d5d';
        ctx.fillRect(s.x - 7, s.y - 6, 3, 1);
        // notes drift up and fade: a new one each beat while you're in earshot
        if (this.music.level > 0.02 && !game.quiet) {
          const n = Math.floor(time / beat);
          for (let k = 0; k < 4; k++) {
            const born = (n - k) * beat;
            const age = (time - born) / (beat * 4); // 0..1 over four beats
            if (age < 0 || age > 1) continue;
            const seed = hash(n - k, 3, 7);
            const img = this.notes[Math.floor(seed * this.notes.length)];
            const nx = s.x + Math.round((seed - 0.5) * 14 + Math.sin(age * 6 + seed * 6) * 3);
            const ny = s.y - 18 - Math.round(age * 22);
            ctx.globalAlpha = Math.min(1, (1 - age) * 1.5) * Math.min(1, this.music.level * 3);
            ctx.drawImage(img, nx, ny);
          }
          ctx.globalAlpha = 1;
        }
      },
    });
  }

  /** for tests / dev tools */
  get level() {
    return this.music.level;
  }
}
