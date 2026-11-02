import { buildRabbit, gridToCanvas, INK, tone, type CityGame, type CityPlugin, type DrawContext, type Grid, type Walker } from '../../city';
import type { MapMarker } from '../../city';
import { EMOTES } from '../../content/emotes';
import { joinRelay, type RelayRoom } from '../../net/relay';
import {
  decode,
  decodeEmote,
  easeVisitor,
  EMOTE_TIME,
  encode,
  MY_SCARF,
  newVisitor,
  rabbitName,
  scarfFor,
  sendLimit,
  shouldSend,
  showLimit,
  stackBubbles,
  type RabbitWire,
  type RateLimit,
  type Visitor,
} from '../visitors';

const APP_ID = 'bearisland';
const ROOM = 'island';
const HIDE_KEY = 'bearisland-hide-rabbits';
/** Name tags show on rabbits within this many tiles of yours. */
const NAME_RANGE = 3.5;
/** small type, so rabbits side by side can all be heard */
const BUBBLE_FONT = '6px "Press Start 2P"';

const HEART: Grid = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const NOTE: Grid = ['...##', '...#.#', '...#..', '...#..', '.###..', '####..', '.##...'];

/** One rabbit's entry in the HUD's list. */
export interface RabbitInfo {
  id: string;
  name: string;
  color: string;
  street: string | null;
  away: boolean;
}

/**
 * Everyone else on the island, live: each player's rabbit, in its own scarf, through the
 * arcade's relay (src/net/relay.ts). One room for the whole map. Your rabbit is sent
 * when it changes (see visitors.ts), and newcomers get a direct hello so they see
 * rabbits that are standing still. Call `join()` once the player is past the title.
 *
 * Rabbits pass through each other on purpose (nobody can block a doorway), they say
 * things only from the fixed list in content/emotes.ts, rate-limited both ways, and
 * `hidden` takes everyone else off your screen while you stay on theirs.
 */
export class Visitors implements CityPlugin {
  readonly visitors = new Map<string, Visitor>();
  /** called when the set of other rabbits changes (for the HUD) */
  onChange: (() => void) | null = null;
  private room: RelayRoom | null = null;
  private game: CityGame | null = null;
  private sprites = new Map<string, Walker>();
  private last: RabbitWire | null = null;
  private sinceSend = 0;
  private clock = 0;
  /** what each rabbit (and you, under your own id) is saying, and until when */
  private said = new Map<string, { emote: number; until: number }>();
  private shown = new Map<string, RateLimit>();
  private sending = sendLimit();
  private icons = { heart: gridToCanvas(HEART, { '#': '#e84a5f' }), note: gridToCanvas(NOTE, { '#': INK }) };
  private _hidden = (() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  })();

  constructor(
    private readonly relayUrl?: string,
    private readonly roomId = ROOM,
  ) {}

  attach(game: CityGame) {
    this.game = game;
  }

  /** Your name, once you've joined. */
  get myName(): string | null {
    return this.room ? rabbitName(this.room.selfId, MY_SCARF) : null;
  }

  /** Everyone else off your screen and minimap (you still show on theirs). Remembered. */
  get hidden() {
    return this._hidden;
  }
  set hidden(h: boolean) {
    this._hidden = h;
    try {
      localStorage.setItem(HIDE_KEY, h ? '1' : '0');
    } catch {
      /* private mode: forgotten next visit */
    }
    this.onChange?.();
  }

  join() {
    if (this.room) return;
    const room = joinRelay(APP_ID, this.roomId, this.relayUrl);
    this.room = room;
    room.onPeerJoin = (id) => {
      const me = this.mine();
      if (me) room.send('r', me, id);
    };
    room.onPeerLeave = (id) => {
      this.said.delete(id);
      this.shown.delete(id);
      if (this.visitors.delete(id)) this.onChange?.();
    };
    room.onMessage = (type, data, from) => {
      if (type === 'e') return this.heard(from, decodeEmote(data));
      if (type !== 'r') return;
      const s = decode(data);
      if (!s) return;
      const v = this.visitors.get(from);
      if (v) {
        const awayChanged = v.target.away !== s.away;
        v.target = s;
        if (awayChanged) this.onChange?.();
      } else {
        this.visitors.set(from, newVisitor(from, s));
        this.onChange?.();
      }
    };
    this.onChange?.();
  }

  leave() {
    this.room?.leave();
    this.room = null;
    this.visitors.clear();
    this.said.clear();
    this.onChange?.();
  }

  stop() {
    this.leave();
  }

  /**
   * Say something from EMOTES. False (and nothing sent) when you've said too much too
   * fast. Works before joining too, so a solo rabbit can still emote to itself.
   */
  emote(i: number): boolean {
    if (decodeEmote(i) === null || !this.sending.take(this.clock)) return false;
    this.said.set(this.room?.selfId ?? '', { emote: i, until: this.clock + EMOTE_TIME });
    this.room?.send('e', i);
    return true;
  }

  private heard(from: string, emote: number | null) {
    const v = this.visitors.get(from);
    if (emote === null || !v) return;
    let limit = this.shown.get(from);
    if (!limit) this.shown.set(from, (limit = showLimit()));
    if (!limit.take(this.clock)) return;
    this.said.set(from, { emote, until: this.clock + EMOTE_TIME });
    // a soft blip if they're close enough to see
    const g = this.game;
    if (!this._hidden && g && !g.quiet && Math.hypot(v.shown.x - g.player.pos.x, v.shown.y - g.player.pos.y) < 12) {
      tone(780, 0.05, 'square', 0.018, 120);
    }
  }

  /** Other rabbits for the minimap, in their scarf colors. */
  markers(): MapMarker[] {
    if (this._hidden) return [];
    return [...this.visitors.values()].map((v) => ({ x: v.shown.x, y: v.shown.y, color: scarfFor(v.id), above: true }));
  }

  /** Everyone else, for the HUD's list: name, scarf, the street they're on. */
  list(): RabbitInfo[] {
    const w = this.game?.world;
    return [...this.visitors.values()]
      .map((v) => ({ id: v.id, name: rabbitName(v.id), color: scarfFor(v.id), street: w?.streetAt(v.target.pos.x, v.target.pos.y) ?? null, away: v.target.away }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private mine(): RabbitWire | null {
    const g = this.game;
    if (!g) return null;
    const p = g.player;
    return encode({ pos: p.pos, facing: p.facing, moving: p.moving && !g.paused, away: g.paused });
  }

  update(dt: number) {
    this.clock += dt;
    for (const v of this.visitors.values()) easeVisitor(v, dt);
    for (const [id, s] of this.said) if (s.until <= this.clock) this.said.delete(id);
    if (!this.room) return;
    this.sinceSend += dt;
    const me = this.mine();
    if (me && shouldSend(this.last, me, this.sinceSend)) {
      this.room.send('r', me);
      this.last = me;
      this.sinceSend = 0;
    }
  }

  private spriteFor(id: string): Walker {
    let s = this.sprites.get(id);
    if (!s) this.sprites.set(id, (s = buildRabbit(scarfFor(id))));
    return s;
  }

  draw(d: DrawContext, game: CityGame) {
    const { ctx } = d;
    /** who's saying something on screen, collected so the bubbles can be stacked */
    const talking: { x: number; y: number; emote: number; left: number }[] = [];
    // what you're saying, over your own rabbit
    const mine = this.said.get(this.room?.selfId ?? '');
    if (mine) {
      const s = d.toScreen(game.player.pos);
      talking.push({ x: s.x, y: s.y - 18, emote: mine.emote, left: mine.until - this.clock });
    }
    const me = game.player.pos;
    for (const v of this._hidden ? [] : this.visitors.values()) {
      const s = d.toScreen(v.shown);
      if (!d.onScreen(s, 40)) continue;
      const frames = this.spriteFor(v.id)[v.target.facing];
      const frame = v.walkT ? Math.floor(v.walkT * 8) % 2 : 0;
      const said = this.said.get(v.id);
      const near = Math.hypot(v.shown.x - me.x, v.shown.y - me.y) < NAME_RANGE;
      if (said) talking.push({ x: s.x, y: s.y - 18, emote: said.emote, left: said.until - this.clock });
      d.push({
        y: v.shown.y,
        draw: () => {
          ctx.save();
          // Someone inside an art scene or a conversation: here, but not really.
          if (v.target.away) ctx.globalAlpha = 0.45;
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(s.x - 5, s.y + 1, 10, 2);
          ctx.drawImage(frames[frame]!, s.x - 8, s.y - 14);
          ctx.restore();
          if (!said && near) this.nameTag(ctx, s.x, s.y - 19, rabbitName(v.id), scarfFor(v.id));
        },
      });
    }
    if (!talking.length) return;
    // Bubbles go over everything, lifted apart where rabbits stand together.
    d.push({
      y: Infinity,
      draw: () => {
        ctx.save();
        ctx.font = BUBBLE_FONT;
        const sizes = talking.map((t) => this.bubbleSize(ctx, t.emote));
        // the city's own '!' bubble over your rabbit (something to talk to) stays put
        const p = d.toScreen(game.player.pos);
        const fixed = game.nearbyTarget ? [{ x: p.x + 0.5, y: p.y - 16, w: 15, h: 15 }] : [];
        const bottoms = stackBubbles(talking.map((t, i) => ({ x: t.x, y: t.y - 3, ...sizes[i]! })), 2, fixed);
        ctx.restore();
        talking.forEach((t, i) => this.bubble(ctx, t.x, t.y, bottoms[i]!, sizes[i]!, t.emote, t.left));
      },
    });
  }

  private bubbleSize(ctx: CanvasRenderingContext2D, i: number) {
    const e = EMOTES[i]!;
    const icon = e.icon && this.icons[e.icon];
    return icon ? { w: icon.width + 6, h: 11 } : { w: Math.ceil(ctx.measureText(e.text).width) + 6, h: 10 };
  }

  /**
   * A speech bubble with the emote: its tail points down at (x, y), the box sits with
   * its bottom at `bottom` (higher when lifted clear of another). Fades over its last 0.4 s.
   */
  private bubble(ctx: CanvasRenderingContext2D, x: number, y: number, bottom: number, size: { w: number; h: number }, i: number, left: number) {
    const e = EMOTES[i]!;
    const icon = e.icon && this.icons[e.icon];
    const { w, h } = size;
    const cx = Math.round(x);
    const l = Math.round(x - w / 2);
    const top = Math.round(bottom - h);
    const tail = Math.round(y);
    ctx.save();
    ctx.globalAlpha = Math.min(1, left / 0.4);
    ctx.fillStyle = INK;
    ctx.fillRect(l - 1, top - 1, w + 2, h + 2);
    ctx.fillRect(cx - 2, top + h, 4, Math.max(2, tail - (top + h) - 1)); // tail (a stalk when lifted)
    ctx.fillRect(cx - 1, tail - 1, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(l, top, w, h);
    ctx.fillRect(cx - 1, top + h, 2, Math.max(1, tail - (top + h) - 2));
    if (icon) ctx.drawImage(icon, l + 3, top + Math.floor((h - icon.height) / 2));
    else {
      ctx.font = BUBBLE_FONT;
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(e.text, l + 3, top + 2);
    }
    ctx.restore();
  }

  /** A rabbit's name, small, over its head, outlined in its scarf colour. */
  private nameTag(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, color: string) {
    ctx.save();
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    const text = name.toUpperCase();
    ctx.strokeText(text, Math.round(x), Math.round(y));
    ctx.fillStyle = color;
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
  }
}
