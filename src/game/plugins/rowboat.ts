import { buildRabbit, Tile, TS, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec, type Vehicle } from '../../city';
import { rowboatWords } from '../../content/rowboat';
import { sounds } from '../../ui/sounds';
import { BOAT_HOME, BOAT_SPEED, canRow, DOCK_STREET, layDock, shoreNear, streetEnd } from '../rowboat';
import { buildRowboat, type RowboatSprites } from '../sprites';

/** the dock laid on each map, so a second game on the same map (React's dev double start) reuses it */
const laid = new WeakMap<object, { tiles: Vec[]; mooring: Vec } | null>();

const PLANK = '#a77d52', PLANK_DARK = '#7d5a39', POST = '#5a3f28';

/**
 * A little rowboat tied up at the end of 58th Ave SW on Alki (rules in game/rowboat.ts): a
 * wooden dock runs from the street out across the sand to it. Climb in ({A}) and the city's
 * `vehicle` takes over: you row on the water only, the rabbit drawn in the boat. Row up to the
 * dock, or anywhere ground you can walk on is right beside you, and {A} climbs out; the boat
 * stays where you left it until you wander far off, then it's back at the dock.
 */
export class Rowboat implements CityPlugin {
  /** the dock's tiles (walkable once attached) */
  dock: Vec[] = [];
  /** where it ties up at the dock */
  mooring: Vec = { x: 0, y: 0 };
  /** where the boat is floating (while you're out of it) */
  boat: Vec = { x: 0, y: 0 };
  aboard = false;
  private sprites: RowboatSprites | null = null;
  private vehicle: Vehicle | null = null;
  private lastStroke = -1;

  attach(game: CityGame) {
    const w = game.world;
    if (laid.has(w)) {
      const dock = laid.get(w);
      if (dock) [this.dock, this.mooring, this.boat] = [dock.tiles, dock.mooring, dock.mooring];
      return;
    }
    const end = streetEnd(w, DOCK_STREET);
    const dock = (end && layDock(w, end)) || null;
    laid.set(w, dock);
    if (!dock) return;
    this.dock = dock.tiles;
    this.mooring = this.boat = dock.mooring;
    // the planks become ground you can walk on, with their own street sign
    w.names.push(rowboatWords.dock);
    const name = w.names.length;
    for (const t of dock.tiles) {
      w.tiles[t.x + t.y * w.w] = Tile.Road;
      w.roads[t.x + t.y * w.w] = name;
    }
  }

  private spritesFor() {
    return (this.sprites ??= buildRowboat(buildRabbit()));
  }

  targets(game: CityGame): Target[] {
    if (!this.dock.length) return [];
    if (!this.aboard) {
      return [{ key: 'rowboat', kind: 'boat', x: this.boat.x, y: this.boat.y, label: rowboatWords.boat }];
    }
    const shore = shoreNear(game.world, game.player.pos);
    return shore ? [{ key: 'rowboat:shore', kind: 'boat', x: shore.x, y: shore.y, label: rowboatWords.shore }] : [];
  }

  /** {A} at the boat or at the shore: climb in, or out. */
  interact(game: CityGame) {
    const p = game.player;
    if (!this.aboard) {
      const sprites = this.spritesFor();
      this.vehicle ??= { canGo: (x, y) => canRow(game.world, x, y), speed: BOAT_SPEED, sprite: sprites.rowing, fps: 3 };
      game.vehicle = this.vehicle;
      p.pos = { ...this.boat };
      p.facing = this.boat.x < this.mooring.x + 0.1 ? 'left' : p.facing;
      this.aboard = true;
      sounds.hop();
      return;
    }
    const shore = shoreNear(game.world, p.pos);
    if (!shore) return;
    this.boat = { ...p.pos };
    game.vehicle = null;
    p.pos = shore;
    this.aboard = false;
    sounds.hop();
  }

  update(_dt: number, game: CityGame) {
    if (!this.dock.length) return;
    const p = game.player;
    if (this.aboard) {
      // a soft splash on each stroke
      const stroke = p.moving ? Math.floor(p.walkT * 3) : -1;
      if (stroke !== this.lastStroke && stroke >= 0 && !game.quiet) sounds.paddle();
      this.lastStroke = stroke;
      // if something else moved you ashore (a teleport, the spots menu), you've left the boat
      if (!canRow(game.world, p.pos.x, p.pos.y)) {
        this.aboard = false;
        game.vehicle = null;
        this.boat = { ...this.mooring };
      }
      return;
    }
    // left far behind, it drifts home to the dock
    if (Math.hypot(this.boat.x - p.pos.x, this.boat.y - p.pos.y) > BOAT_HOME) this.boat = { ...this.mooring };
  }

  draw(d: DrawContext, game: CityGame) {
    if (!this.dock.length) return;
    const { ctx, time } = d;
    // the dock: planks under everyone, posts at the corners
    d.push({
      y: -1e9,
      draw: () => {
        for (const t of this.dock) {
          const s = d.toScreen({ x: t.x, y: t.y });
          if (!d.onScreen(s, TS)) continue;
          ctx.fillStyle = PLANK;
          ctx.fillRect(s.x, s.y, TS, TS);
          ctx.fillStyle = PLANK_DARK;
          for (let x = 3; x < TS; x += 4) ctx.fillRect(s.x + x, s.y, 1, TS);
        }
        for (const t of this.dock) {
          const s = d.toScreen({ x: t.x, y: t.y });
          ctx.fillStyle = POST;
          if (!this.dock.some((o) => o.y === t.y && o.x === t.x - 1)) {
            ctx.fillRect(s.x - 1, s.y + 1, 3, 3);
            ctx.fillRect(s.x - 1, s.y + TS - 4, 3, 3);
          }
        }
      },
    });
    const sprites = this.spritesFor();
    // ripples round the boat: rings on the water, a wake while you row
    const at = this.aboard ? game.player.pos : this.boat;
    const s = d.toScreen(at);
    if (!d.onScreen(s, 40)) return;
    d.push({
      y: at.y - 0.01,
      draw: () => {
        ctx.fillStyle = 'rgba(232,246,251,0.55)';
        const r = 10 + Math.round((Math.sin(time * 2) + 1) * 2);
        ctx.fillRect(s.x - r, s.y + 2, 4, 1);
        ctx.fillRect(s.x + r - 4, s.y + 2, 4, 1);
        if (this.aboard && game.player.moving) {
          const back = game.player.facing;
          const bx = back === 'left' ? 16 : back === 'right' ? -16 : 0;
          const by = back === 'up' ? 12 : back === 'down' ? -12 : 0;
          ctx.fillRect(s.x + bx - 2, s.y + by, 5, 1);
          ctx.fillRect(s.x + bx * 1.4 - 3, s.y + by * 1.4 + 2, 7, 1);
        }
      },
    });
    if (this.aboard) return; // the city draws you in it
    // the empty boat seen from above, bobbing at its rope (tied to the dock when it's home)
    const bob = Math.round(Math.sin(time * 1.6));
    const img = sprites.empty.end;
    const home = this.boat.x === this.mooring.x && this.boat.y === this.mooring.y;
    d.push({
      y: at.y,
      draw: () => {
        const x = s.x - (img.width >> 1), y = s.y - img.height + 8 + bob;
        if (home) {
          ctx.fillStyle = '#d9c9a0';
          for (let i = 0; i < 7; i++) ctx.fillRect(x + img.width - 2 + i, y + 6 + (i > 3 ? 1 : 0), 1, 1);
        }
        ctx.drawImage(img, x, y);
      },
    });
  }
}
