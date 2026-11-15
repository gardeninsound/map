import { hash, input, Tile, withButtons, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec } from '../../city';
import { MAZE_CELLS, MAZE_NAME, MAZE_NW, MAZE_SEED, mazeHint, mazeMiddle } from '../../content/forestMaze';
import { sounds } from '../../ui/sounds';
import { makeMaze, type Maze } from '../maze';
import { talk, type Action, type Actor } from '../actions';


/** the maze laid on each map, so React's dev double start doesn't carve it twice */
const laid = new WeakMap<object, { x0: number; y0: number; out: Vec } | null>();

/**
 * The forest maze in Schmitz Preserve (idea box #42; the maze pure + tested in game/maze.ts,
 * words in content/forestMaze.ts): at attach its paths are carved through the old-growth
 * trees (tiles turned walkable, named on the street sign), from a gap on the west side, off
 * the street, to a fairy ring in a clearing in the middle (target `maze`). While you're in
 * it a hint at the top says {B} hops you out — back to the street by the way in.
 */
export class ForestMaze implements CityPlugin, Actor {
  maze: Maze = makeMaze(MAZE_CELLS, MAZE_SEED);
  x0 = 0;
  y0 = 0;
  /** where {B} drops you: the street by the way in */
  out: Vec = { x: 0, y: 0 };
  inside = false;
  private ok = false;

  attach(game: CityGame) {
    const w = game.world;
    const m = this.maze;
    if (!laid.has(w)) {
      const nw = w.project(MAZE_NW.lat, MAZE_NW.lon);
      const x0 = Math.round(nw.x), y0 = Math.round(nw.y);
      let all = true;
      for (let y = 0; y < m.size && all; y++) for (let x = 0; x < m.size && all; x++) all = w.tileAt(x0 + x, y0 + y) === Tile.Park;
      if (!all) laid.set(w, null);
      else {
        w.names.push(MAZE_NAME);
        const name = w.names.length; // street ids are 1-based
        const path = (x: number, y: number) => {
          w.tiles[x + y * w.w] = Tile.Road;
          w.roads[x + y * w.w] = name;
        };
        for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.open[x + y * m.size]) path(x0 + x, y0 + y);
        // the path in from the street to the door
        const dy = y0 + m.door;
        let x = x0 - 1;
        while (x > x0 - 10 && !w.isWalkable(x + 0.5, dy + 0.5)) path(x--, dy);
        laid.set(w, { x0, y0, out: { x: x + 0.5, y: dy + 0.5 } });
      }
    }
    const l = laid.get(w);
    if (!l) return;
    [this.x0, this.y0, this.out, this.ok] = [l.x0, l.y0, l.out, true];
    input.on((b) => {
      if (b !== 'b' || !this.inside || game.paused) return;
      input.consume('b');
      sounds.whoosh();
      game.teleport(this.out);
    });
  }

  /** {A} at the fairy ring in the middle */
  act(t: Target): Action | null {
    return t.kind === 'maze' ? talk(mazeMiddle.label.name, mazeMiddle.lines) : null;
  }

  targets(): Target[] {
    if (!this.ok) return [];
    const c = this.maze.middle + 0.5;
    return [{ key: 'maze:middle', kind: 'maze', x: this.x0 + c, y: this.y0 + c, label: mazeMiddle.label }];
  }

  update(_dt: number, game: CityGame) {
    const p = game.player.pos;
    const s = this.maze.size;
    this.inside = this.ok && p.x > this.x0 + 0.6 && p.y > this.y0 && p.x < this.x0 + s && p.y < this.y0 + s;
  }

  draw(d: DrawContext) {
    if (!this.ok) return;
    const { ctx, time } = d;
    this.drawPaths(d);
    // the fairy ring in the middle clearing
    const c = d.toScreen({ x: this.x0 + this.maze.middle + 0.5, y: this.y0 + this.maze.middle + 0.5 });
    if (d.onScreen(c, 30)) {
      d.push({
        y: this.y0 + this.maze.middle,
        draw: () => {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const mx = Math.round(c.x + Math.cos(a) * 14), my = Math.round(c.y + Math.sin(a) * 9);
            ctx.fillStyle = '#f3efe4';
            ctx.fillRect(mx, my - 1, 1, 2);
            ctx.fillStyle = i % 3 ? '#d63a3a' : '#e8a35a';
            ctx.fillRect(mx - 1, my - 3, 3, 2);
            ctx.fillStyle = '#fff';
            ctx.fillRect(mx, my - 3, 1, 1);
          }
          // the lemon drop, glinting
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 2, 3, 2);
          if (time % 1.6 < 0.2) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(Math.round(c.x) + 1, Math.round(c.y) - 4, 1, 1);
          }
        },
      });
    }
    if (!this.inside) return;
    const text = withButtons(mazeHint).toUpperCase();
    d.push({
      y: Infinity,
      draw: () => {
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'top';
        const w = Math.ceil(ctx.measureText(text).width) + 12;
        const x = Math.round(d.view.w / 2 - w / 2), y = 26;
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(x - 1, y - 1, w + 2, 16);
        ctx.fillStyle = '#fff1e0';
        ctx.fillRect(x, y, w, 14);
        ctx.fillStyle = '#2a1a12';
        ctx.fillText(text, x + 6, y + 3);
      },
    });
  }

  /** dirt trails along the paths, and a bush in any gap in the trees, so the walls read as walls */
  private drawPaths(d: DrawContext) {
    const { ctx } = d;
    const m = this.maze;
    const tl = d.toScreen({ x: this.x0, y: this.y0 });
    if (!d.onScreen({ x: tl.x + m.size * 8, y: tl.y + m.size * 8 }, m.size * 16)) return;
    const open = (x: number, y: number) => x >= 0 && y >= 0 && x < m.size && y < m.size && m.open[x + y * m.size] === 1;
    d.push({
      y: this.y0 - 1,
      draw: () => {
        for (let y = 0; y < m.size; y++) {
          for (let x = 0; x < m.size; x++) {
            if (!open(x, y)) continue;
            const sx = tl.x + x * 16, sy = tl.y + y * 16;
            ctx.fillStyle = '#9a7a52';
            ctx.fillRect(sx + 4, sy + 4, 8, 8);
            if (open(x + 1, y) || (x === m.size - 1)) ctx.fillRect(sx + 12, sy + 4, 4, 8);
            if (open(x - 1, y) || x === 0) ctx.fillRect(sx, sy + 4, 4, 8);
            if (open(x, y + 1)) ctx.fillRect(sx + 4, sy + 12, 8, 4);
            if (open(x, y - 1)) ctx.fillRect(sx + 4, sy, 8, 4);
            ctx.fillStyle = '#b8955f';
            ctx.fillRect(sx + 6, sy + 6, 3, 2);
          }
        }
      },
    });
    // a bush wherever the forest left a gap in a wall
    for (let y = 0; y < m.size; y++) {
      for (let x = 0; x < m.size; x++) {
        const tx = this.x0 + x, ty = this.y0 + y;
        if (open(x, y) || hash(tx, ty, 11) < 0.82) continue;
        const sx = tl.x + x * 16, sy = tl.y + y * 16;
        if (!d.onScreen({ x: sx + 8, y: sy + 8 }, 20)) continue;
        d.push({
          y: ty + 0.9,
          draw: () => {
            // a round bush: ink outline, two greens
            ctx.fillStyle = '#2a1a12';
            ctx.fillRect(sx + 3, sy + 2, 10, 14);
            ctx.fillRect(sx + 1, sy + 4, 14, 10);
            ctx.fillStyle = '#3e6a32';
            ctx.fillRect(sx + 4, sy + 3, 8, 12);
            ctx.fillRect(sx + 2, sy + 5, 12, 8);
            ctx.fillStyle = '#5a8a44';
            ctx.fillRect(sx + 4, sy + 5, 5, 3);
          },
        });
      }
    }
  }
}
