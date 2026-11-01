import { buildRabbit, type CityGame, type CityPlugin, type DrawContext, type Walker } from '../../city';
import type { MapMarker } from '../../city';
import { joinRelay, type RelayRoom } from '../../net/relay';
import { decode, easeVisitor, encode, newVisitor, scarfFor, shouldSend, type RabbitWire, type Visitor } from '../visitors';

const APP_ID = 'bearisland';
const ROOM = 'island';

/**
 * Everyone else on the island, live: each player's rabbit, in its own scarf, through the
 * arcade's relay (src/net/relay.ts). One room for the whole map. Your rabbit is sent
 * when it changes (see visitors.ts), and newcomers get a direct hello so they see
 * rabbits that are standing still. Call `join()` once the player is past the title.
 */
export class Visitors implements CityPlugin {
  readonly visitors = new Map<string, Visitor>();
  /** called when the number of other rabbits changes (for the HUD) */
  onCount: ((n: number) => void) | null = null;
  private room: RelayRoom | null = null;
  private game: CityGame | null = null;
  private sprites = new Map<string, Walker>();
  private last: RabbitWire | null = null;
  private sinceSend = 0;

  constructor(
    private readonly relayUrl?: string,
    private readonly roomId = ROOM,
  ) {}

  attach(game: CityGame) {
    this.game = game;
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
      if (this.visitors.delete(id)) this.onCount?.(this.visitors.size);
    };
    room.onMessage = (type, data, from) => {
      if (type !== 'r') return;
      const s = decode(data);
      if (!s) return;
      const v = this.visitors.get(from);
      if (v) v.target = s;
      else {
        this.visitors.set(from, newVisitor(from, s));
        this.onCount?.(this.visitors.size);
      }
    };
  }

  leave() {
    this.room?.leave();
    this.room = null;
    this.visitors.clear();
    this.onCount?.(0);
  }

  stop() {
    this.leave();
  }

  /** Other rabbits for the minimap, in their scarf colors. */
  markers(): MapMarker[] {
    return [...this.visitors.values()].map((v) => ({ x: v.shown.x, y: v.shown.y, color: scarfFor(v.id) }));
  }

  private mine(): RabbitWire | null {
    const g = this.game;
    if (!g) return null;
    const p = g.player;
    return encode({ pos: p.pos, facing: p.facing, moving: p.moving && !g.paused, away: g.paused });
  }

  update(dt: number) {
    for (const v of this.visitors.values()) easeVisitor(v, dt);
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

  draw(d: DrawContext) {
    const { ctx } = d;
    for (const v of this.visitors.values()) {
      const s = d.toScreen(v.shown);
      if (!d.onScreen(s, 16)) continue;
      const frames = this.spriteFor(v.id)[v.target.facing];
      const frame = v.walkT ? Math.floor(v.walkT * 8) % 2 : 0;
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
  }
}
