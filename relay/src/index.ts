import { DurableObject } from 'cloudflare:workers';

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
 * Dead sockets are swept: while anyone is connected, an alarm every SWEEP_MS
 * closes sockets that have sent nothing (not even a "ping") for STALE_MS, and
 * tells everyone they left. That catches a laptop that slept or a phone whose
 * browser was killed, which never send a close. Live pages ping every 25 s.
 */

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Comma-separated allowed page origins, `*` as wildcard. Empty allows any. */
  ALLOWED_ORIGINS?: string;
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
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response('arcade relay\n');
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

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const id = new URL(request.url).searchParams.get('id')!;
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
