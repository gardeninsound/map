import { DurableObject } from 'cloudflare:workers';
import { Stats, type StatsReply } from './stats';
import { checkAccess, type AccessEnv } from './access';
import { readTraffic, TRAFFIC_TTL, type TrafficEnv } from './traffic';
export { Stats };

/**
 * The arcade's relay: one Durable Object per room, holding a WebSocket per
 * player and forwarding each player's messages to the others. It knows
 * nothing about any game and stores nothing. The wire protocol is shared
 * with `packages/net/src/relay.ts`:
 *
 *   connect   wss://<host>/room/<appId>/<roomId>?id=<peerId>
 *   client →  {"t": type, "d": data, "to"?: peerId}   (or the text "ping")
 *   server →  {"k":"peers","ids":[...]}              once, on connect
 *             {"k":"join","id":...} / {"k":"leave","id":...}
 *             {"k":"msg","from":...,"t":...,"d":...}
 *
 * Sockets use the hibernation API, so a quiet room costs nothing, and
 * "ping" is answered by the runtime itself without waking the object.
 *
 * Counts (src/stats.ts, one Stats object per app), the only thing kept:
 *
 *   POST /count/<appId>            body: a key like `scene:gas-station-wall` (the game's beacon)
 *
 * and for the admin page only, at gardeninsound.website/admin/api/ (a route on the site's zone, behind
 * Cloudflare Access; every request's Access token is checked again here, src/access.ts):
 *
 *   GET  /admin/api/stats/<appId>/<roomId>   → {now, days: [{day, visits, peak, opened: {key: n}}]}, ?days=30
 *   GET  /admin/api/traffic                  → the site's traffic from Cloudflare (src/traffic.ts), cached 10 minutes
 *
 * A room tells its app's Stats about each rabbit that joins from COUNT_ORIGINS (the live site). Numbers per day only; see stats.ts.
 *
 * Dead sockets are swept: while anyone is connected, an alarm every SWEEP_MS
 * closes sockets that have sent nothing (not even a "ping") for STALE_MS, and
 * tells everyone they left. That catches a laptop that slept or a phone whose
 * browser was killed, which never send a close. Live pages ping every 25 s.
 */

export interface Env extends TrafficEnv, AccessEnv {
  /** `open` skips the Access check: only ever `--var ACCESS_DEV:open` on wrangler dev, never in wrangler.jsonc */
  ACCESS_DEV?: string;
  ROOMS: DurableObjectNamespace<Room>;
  STATS: DurableObjectNamespace<Stats>;
  /** Comma-separated allowed page origins, `*` as wildcard. Empty allows any. */
  ALLOWED_ORIGINS?: string;
  /** Comma-separated page origins whose rabbits count as visits (the live site; previews, dev and tests don't). Empty counts none. */
  COUNT_ORIGINS?: string;
  /** Most players in one room (default 64). */
  MAX_PEERS?: string;
  /** a socket silent this long (ms) is dropped (default 90 s) */
  STALE_MS?: string;
  /** how often to look (ms, default 30 s) */
  SWEEP_MS?: string;
}

/** Bigger messages are dropped: games send small state, not files. */
const MAX_MESSAGE = 16 * 1024;
/** Close codes the client understands (4000–4999 are free for apps). */
const CLOSE_REPLACED = 4000;
const CLOSE_FULL = 4001;
const CLOSE_STALE = 4002;

const NAME = /^[A-Za-z0-9_-]{1,64}$/;
const PEER_ID = /^[A-Za-z0-9]{4,32}$/;

function originAllowed(origin: string | null, allowed: string | undefined): boolean {
  const patterns = (allowed ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (patterns.length === 0) return true;
  if (!origin) return false;
  return patterns.some((p) => {
    const re = new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return re.test(origin);
  });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response('arcade relay\n');
    const counted = /^\/count\/([^/]+)$/.exec(url.pathname);
    if (counted) return countRequest(request, env, decodeURIComponent(counted[1]!));
    if (url.pathname.startsWith('/admin/api/')) return adminRequest(request, env, ctx, url);
    const m = /^\/room\/([^/]+)\/([^/]+)$/.exec(url.pathname);
    const appId = m ? decodeURIComponent(m[1]!) : '';
    const roomId = m ? decodeURIComponent(m[2]!) : '';
    if (!NAME.test(appId) || !NAME.test(roomId)) return new Response('not found\n', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected a websocket\n', { status: 426 });
    }
    if (!originAllowed(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
      return new Response('origin not allowed\n', { status: 403 });
    }
    if (!PEER_ID.test(url.searchParams.get('id') ?? '')) return new Response('bad peer id\n', { status: 400 });
    const stub = env.ROOMS.get(env.ROOMS.idFromName(`${appId}/${roomId}`));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;

/** the admin page's numbers: for the signed-in browser only, never kept by anything in between */
const PRIVATE = { 'Cache-Control': 'private, no-store' };
/** `wrangler dev --var ACCESS_DEV:open` (the relay's tests, a local admin page) skips the check; never set it in wrangler.jsonc */
const devOpen = (env: Env) => env.ACCESS_DEV === 'open';

/** /admin/api/*: only for someone Cloudflare Access let in (src/access.ts) */
async function adminRequest(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const dev = devOpen(env);
  const headers = dev ? { ...PRIVATE, 'Access-Control-Allow-Origin': '*' } : PRIVATE;
  if (!dev) {
    const who = await checkAccess(request, env);
    if (!who.ok) return Response.json({ error: who.why }, { status: 401, headers });
  }
  if (url.pathname === '/admin/api/traffic') return trafficRequest(request, env, ctx, headers);
  const asked = /^\/admin\/api\/stats\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (asked) return statsRequest(env, decodeURIComponent(asked[1]!), decodeURIComponent(asked[2]!), url, headers);
  return Response.json({ error: 'not found' }, { status: 404, headers });
}

/** the game's beacon: one key, from an allowed page */
async function countRequest(request: Request, env: Env, appId: string): Promise<Response> {
  if (request.method !== 'POST') return new Response('expected a POST\n', { status: 405 });
  if (!NAME.test(appId)) return new Response('not found\n', { status: 404 });
  if (!originAllowed(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) return new Response('origin not allowed\n', { status: 403 });
  const key = (await request.text()).trim().slice(0, 80);
  const ok = await env.STATS.get(env.STATS.idFromName(appId)).count(key);
  return new Response(null, { status: ok ? 204 : 400 });
}

/** Cloudflare's numbers for the site, asked at most every TRAFFIC_TTL seconds (the Workers cache) */
async function trafficRequest(request: Request, env: Env, ctx: ExecutionContext, headers: Record<string, string>): Promise<Response> {
  // the Workers cache, keyed on a URL nobody can ask for directly; only reached after the Access check
  const key = new Request(new URL('/__traffic-cache', request.url).toString());
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers: { ...headers, 'Content-Type': 'application/json' } });
  const body = await readTraffic(env);
  // an answer with a problem in it is kept only a minute, so a fix (the token set) shows soon
  const ttl = 'error' in body.zone || 'error' in body.web ? 60 : TRAFFIC_TTL;
  ctx.waitUntil(cache.put(key, Response.json(body, { headers: { 'Cache-Control': `public, max-age=${ttl}` } })));
  return Response.json(body, { headers });
}

async function statsRequest(env: Env, appId: string, roomId: string, url: URL, headers: Record<string, string>): Promise<Response> {
  if (!NAME.test(appId) || !NAME.test(roomId)) return Response.json({ error: 'not found' }, { status: 404, headers });
  const days = Number(url.searchParams.get('days')) || 30;
  const [now, counts] = await Promise.all([
    env.ROOMS.get(env.ROOMS.idFromName(`${appId}/${roomId}`)).online(),
    env.STATS.get(env.STATS.idFromName(appId)).stats(days),
  ]);
  const body: StatsReply & { now: number } = { ...counts, now };
  return Response.json(body, { headers });
}

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /** how many rabbits are in the room now (for /stats) */
  online(): number {
    return this.peerIds().length;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')!;
    const appId = decodeURIComponent(url.pathname.split('/')[2] ?? '');
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [id]);

    // The same peer reconnecting (after a network blip) replaces its old
    // socket. Everyone sees it leave and rejoin, which re-runs the hello
    // handshake that host election depends on.
    const stale = this.ctx.getWebSockets(id).filter((ws) => ws !== server);
    if (stale.length > 0) {
      for (const ws of stale) this.close(ws, CLOSE_REPLACED, 'replaced');
      this.broadcast({ k: 'leave', id }, server);
    }

    server.serializeAttachment({ seen: Date.now() });
    await this.sweepLater();

    const others = this.peerIds().filter((p) => p !== id);
    const max = Number(this.env.MAX_PEERS) || 64;
    if (others.length >= max) {
      this.close(server, CLOSE_FULL, 'room full');
    } else {
      server.send(JSON.stringify({ k: 'peers', ids: others }));
      this.broadcast({ k: 'join', id }, server);
      // counted for the day (stats.ts); a count that fails never stops a rabbit joining
      const live = !!this.env.COUNT_ORIGINS && originAllowed(request.headers.get('Origin'), this.env.COUNT_ORIGINS);
      if (stale.length === 0 && appId && live) {
        try {
          await this.env.STATS.get(this.env.STATS.idFromName(appId)).visit(id, others.length + 1);
        } catch {
          // best effort
        }
      }
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // a socket the sweep already dropped (its owner may not have noticed yet) is ignored
    if (ws.readyState !== WebSocket.OPEN || typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    let msg: { t?: unknown; d?: unknown; to?: unknown };
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (typeof msg !== 'object' || msg === null || typeof msg.t !== 'string') return;
    ws.serializeAttachment({ seen: Date.now() });
    const out = JSON.stringify({ k: 'msg', from: this.idOf(ws), t: msg.t, d: msg.d ?? null });
    const targets = typeof msg.to === 'string' ? this.ctx.getWebSockets(msg.to) : this.ctx.getWebSockets();
    for (const s of targets) if (s !== ws) this.sendRaw(s, out);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.close(ws, code === 1005 || code === 1006 ? 1000 : code, reason);
    this.dropped(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.dropped(ws);
  }

  /** Start the sweep if it isn't running. */
  private async sweepLater(): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + (Number(this.env.SWEEP_MS) || 30_000));
    }
  }

  /** The sweep: drop sockets that have gone silent, and keep sweeping while anyone's here. */
  async alarm(): Promise<void> {
    const now = Date.now();
    const stale = Number(this.env.STALE_MS) || 90_000;
    let open = 0;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const msg = (ws.deserializeAttachment() as { seen?: number } | null)?.seen ?? 0;
      const ping = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(msg, ping) > stale) {
        this.close(ws, CLOSE_STALE, 'silent too long');
        this.dropped(ws);
      } else open++;
    }
    if (open > 0) await this.ctx.storage.setAlarm(now + (Number(this.env.SWEEP_MS) || 30_000));
  }

  /** A socket is gone: tell the others, unless the same peer is still connected on a newer one. */
  private dropped(ws: WebSocket): void {
    const id = this.idOf(ws);
    const stillHere = this.ctx.getWebSockets(id).some((s) => s !== ws && s.readyState === WebSocket.OPEN);
    if (!stillHere) this.broadcast({ k: 'leave', id }, ws);
  }

  private idOf(ws: WebSocket): string {
    return this.ctx.getTags(ws)[0] ?? '';
  }

  private peerIds(): string[] {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) if (ws.readyState === WebSocket.OPEN) ids.add(this.idOf(ws));
    return [...ids];
  }

  private broadcast(msg: object, except: WebSocket): void {
    const out = JSON.stringify(msg);
    for (const s of this.ctx.getWebSockets()) if (s !== except) this.sendRaw(s, out);
  }

  private sendRaw(ws: WebSocket, out: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(out);
    } catch {
      // Best effort: a socket closing underneath us is fine to skip.
    }
  }

  private close(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed (or the runtime auto-replied to the close).
    }
  }
}
