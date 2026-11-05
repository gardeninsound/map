import { buildRabbit, gridToCanvas, INK, tone, type CityGame, type CityPlugin, type DrawContext, type Grid, type Target, type Walker } from '../../city';
import type { MapMarker } from '../../city';
import { EMOTES } from '../../content/emotes';
import { joinRelay, type RelayRoom } from '../../net/relay';
import { drawTiny, TINY_H, tinyWidth } from '../tinyFont';
import {
  decode,
  decodeEmote,
  easeVisitor,
  EMOTE_TIME,
  encode,
  MY_SCARF,
  newVisitor,
  presence,
  PRESENCE,
  rabbitName,
  scarfFor,
  sendLimit,
  shouldSend,
  showLimit,
  stackBubbles,
  type Presence,
  type RabbitWire,
  type RateLimit,
  type Visitor,
} from '../visitors';

const APP_ID = 'bearisland';
const ROOM = 'island';
const HIDE_KEY = 'bearisland-hide-rabbits';
/** Name tags show on rabbits within this many tiles of yours. */
const NAME_RANGE = 3.5;
/** After you emote, nearby rabbits drop their '…' (and {A}) for this long (s); keys 1–9 still work. */
const TALK_QUIET = 6;
/** The '…' over you for another player is lavender (the minimap's other-rabbits purple, lightened); neighbors' stays white. */
const PLAYER_BUBBLE = '#d4c2f7';
/** name tag text: light on the dark tag, unlike the map's coloured place labels */
const TAG_TEXT = '#f3e6cc';

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
 *
 * Presence (visitors.ts `presence`): switch tabs and your rabbit fades for everyone; stay
 * away two minutes and it leaves the room (the count drops). Ten minutes without a key,
 * mouse move, click or tap fades it too, thirty leaves. Coming back rejoins as the same rabbit. The
 * relay also drops connections that go silent (a laptop that slept), see relay/.
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
  /** no '…' targets until this clock time (set when you emote) */
  private quietUntil = 0;
  private icons = { heart: gridToCanvas(HEART, { '#': '#e84a5f' }), note: gridToCanvas(NOTE, { '#': INK }) };
  private state: Presence = 'here';
  private hiddenAt: number | null = null;
  private lastInput = performance.now();
  private presenceTimer = 0;
  private unlisten: (() => void) | null = null;
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
    /** presence timings in seconds (dev can shorten them to test) */
    private readonly timings = PRESENCE,
  ) {}

  /** here, away (faded) or gone (out of the room) — for the HUD and tests */
  get presence(): Presence {
    return this.state;
  }

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
    this.watchPresence();
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
    this.unlisten?.();
    this.unlisten = null;
    this.room?.leave();
    this.room = null;
    this.visitors.clear();
    this.said.clear();
    this.onChange?.();
  }

  stop() {
    this.leave();
  }

  /** Tab visibility and input feed `presence`, checked every second (timers keep running in hidden tabs). */
  private watchPresence() {
    const now = () => performance.now();
    const onVisible = () => {
      if (document.visibilityState === 'hidden') this.hiddenAt ??= now();
      else {
        this.hiddenAt = null;
        this.lastInput = now();
      }
      this.checkPresence();
    };
    const onInput = () => {
      this.lastInput = now();
      if (this.state !== 'here') this.checkPresence();
    };
    const inputs = ['keydown', 'pointerdown', 'pointermove', 'touchstart', 'wheel'] as const;
    document.addEventListener('visibilitychange', onVisible);
    for (const e of inputs) window.addEventListener(e, onInput, { capture: true, passive: true });
    this.presenceTimer = window.setInterval(() => this.checkPresence(), 1000);
    if (document.visibilityState === 'hidden') this.hiddenAt = now();
    this.unlisten = () => {
      document.removeEventListener('visibilitychange', onVisible);
      for (const e of inputs) window.removeEventListener(e, onInput, { capture: true });
      clearInterval(this.presenceTimer);
    };
  }

  private checkPresence() {
    const room = this.room;
    if (!room) return;
    const t = performance.now();
    const next = presence(this.hiddenAt === null ? null : (t - this.hiddenAt) / 1000, (t - this.lastInput) / 1000, this.timings);
    if (next === this.state) return;
    const was = this.state;
    this.state = next;
    if (next === 'gone') {
      room.pause(); // everyone else sees us leave; we stop seeing them
      this.visitors.clear();
      this.said.clear();
      this.shown.clear();
    } else {
      if (was === 'gone') {
        this.last = null; // say where we are again once back in
        room.resume();
      }
      // here ↔ away goes out now: the game loop (and update()) doesn't run in a hidden tab
      const me = this.mine();
      if (me) {
        room.send('r', me);
        this.last = me;
        this.sinceSend = 0;
      }
    }
    this.onChange?.();
  }

  /**
   * Say something from EMOTES. False (and nothing sent) when you've said too much too
   * fast. Works before joining too, so a solo rabbit can still emote to itself.
   */
  emote(i: number): boolean {
    if (decodeEmote(i) === null || !this.sending.take(this.clock)) return false;
    this.said.set(this.room?.selfId ?? '', { emote: i, until: this.clock + EMOTE_TIME });
    this.quietUntil = this.clock + TALK_QUIET;
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

  /** Where to land to visit a rabbit: a tile to its right, side by side (its name tag sits under its feet). */
  where(id: string): { x: number; y: number } | null {
    const v = this.visitors.get(id);
    return v ? { x: v.target.pos.x + 1, y: v.target.pos.y } : null;
  }

  /**
   * A rabbit close by is something to talk to: the city puts its '…' bubble over you and
   * {A} opens the SAY picker (App). Rabbits inside a scene aren't really here, so not them;
   * they lose ties to neighbors and lemons (who have more to say).
   */
  targets(game: CityGame): Target[] {
    // Just said something: let it be heard before offering to talk again.
    if (this._hidden || this.clock < this.quietUntil) return [];
    const me = game.player.pos;
    const out: Target[] = [];
    for (const v of this.visitors.values()) {
      if (v.target.away || Math.abs(v.shown.x - me.x) > 4 || Math.abs(v.shown.y - me.y) > 4) continue;
      out.push({
        key: `rabbit:${v.id}`,
        kind: 'rabbit',
        x: v.shown.x,
        y: v.shown.y,
        label: { name: rabbitName(v.id), verb: 'say something' },
        bubble: '…',
        bubbleColor: PLAYER_BUBBLE,
        weight: 0.7,
        data: v.id,
      });
    }
    return out;
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
    return encode({ pos: p.pos, facing: p.facing, moving: p.moving && !g.paused && this.state === 'here', away: g.paused || this.state !== 'here' });
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
    /** name tags of the rabbits near yours, drawn on top so buildings never hide them */
    const tags: { x: number; y: number; id: string; away: boolean }[] = [];
    const me = game.player.pos;
    for (const v of this._hidden ? [] : this.visitors.values()) {
      const s = d.toScreen(v.shown);
      if (!d.onScreen(s, 40)) continue;
      const frames = this.spriteFor(v.id)[v.target.facing];
      const frame = v.walkT ? Math.floor(v.walkT * 8) % 2 : 0;
      const said = this.said.get(v.id);
      const near = Math.hypot(v.shown.x - me.x, v.shown.y - me.y) < NAME_RANGE;
      if (said) talking.push({ x: s.x, y: s.y - 18, emote: said.emote, left: said.until - this.clock });
      if (near) tags.push({ x: s.x, y: s.y, id: v.id, away: v.target.away });
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
        },
      });
    }
    if (!talking.length && !tags.length) return;
    // Name tags and bubbles go over everything; bubbles are lifted apart where rabbits stand together.
    d.push({
      y: Infinity,
      draw: () => {
        for (const t of tags) this.nameTag(ctx, t.x, t.y, rabbitName(t.id), scarfFor(t.id), t.away);
        if (!talking.length) return;
        const sizes = talking.map((t) => this.bubbleSize(t.emote));
        // the city's own '!' bubble over your rabbit (something to talk to) stays put
        const p = d.toScreen(game.player.pos);
        const fixed = game.nearbyTarget ? [{ x: p.x + 0.5, y: p.y - 16, w: 15, h: 15 }] : [];
        const bottoms = stackBubbles(talking.map((t, i) => ({ x: t.x, y: t.y - 3, ...sizes[i]! })), 2, fixed);
        // highest first, so a lifted bubble's stalk passes behind the ones below it, never over their words
        const order = talking.map((_, i) => i).sort((a, b) => bottoms[a]! - bottoms[b]!);
        for (const i of order) this.bubble(ctx, talking[i]!.x, talking[i]!.y, bottoms[i]!, sizes[i]!, talking[i]!.emote, talking[i]!.left);
      },
    });
  }

  private bubbleSize(i: number) {
    const e = EMOTES[i]!;
    const icon = e.icon && this.icons[e.icon];
    return icon ? { w: icon.width + 6, h: 11 } : { w: tinyWidth(e.text) + 6, h: TINY_H + 4 };
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
    else drawTiny(ctx, e.text, l + 3, top + 2, INK);
    ctx.restore();
  }

  /**
   * A rabbit's name on a small dark tag under its feet, with a swatch of its scarf: a
   * player tag, not a place on the map (those are big coloured letters, no box).
   */
  private nameTag(ctx: CanvasRenderingContext2D, x: number, feet: number, name: string, color: string, away: boolean) {
    const tw = tinyWidth(name);
    const w = 2 + 2 + 2 + tw + 2; // pad, swatch, gap, text, pad
    const h = TINY_H + 4;
    const l = Math.round(x - w / 2);
    const top = Math.round(feet + 4);
    ctx.save();
    if (away) ctx.globalAlpha = 0.6;
    ctx.fillStyle = INK;
    ctx.fillRect(l + 1, top, w - 2, h); // corners nipped off
    ctx.fillRect(l, top + 1, w, h - 2);
    ctx.fillStyle = color;
    ctx.fillRect(l + 2, top + 2, 2, TINY_H);
    drawTiny(ctx, name, l + 6, top + 2, TAG_TEXT);
    ctx.restore();
  }
}
