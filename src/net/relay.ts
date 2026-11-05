/**
 * A client for the island's relay (`relay/` in this repo, copied from the arcade's
 * packages/relay): a Cloudflare Worker that keeps one WebSocket per player and forwards messages to everyone
 * else in the same room. Ported from the arcade's `@arcade/net` relay backend, without
 * host election, which the island doesn't need. Wire protocol (same as the Worker):
 *
 *   connect   wss://<host>/room/<appId>/<roomId>?id=<peerId>
 *   client →  {"t": type, "d": data, "to"?: peerId}   (or the text "ping")
 *   server →  {"k":"peers","ids":[...]} once, then {"k":"join"|"leave","id"} and
 *             {"k":"msg","from","t","d"}
 *
 * Drops reconnect on their own with backoff. While disconnected everyone else appears to
 * have left, and they rejoin when the socket comes back. A socket that stops hearing
 * anything (no "pong" to two pings: a laptop waking from sleep, or the relay dropped us as
 * silent) is replaced rather than trusted.
 */

export const RELAY_URL = 'wss://relay.gardeninsound.website';

export type Json = null | string | number | boolean | Json[] | { [key: string]: Json };

export interface RelayRoom {
  readonly selfId: string;
  send(type: string, data: Json, to?: string): void;
  onMessage: ((type: string, data: Json, from: string) => void) | null;
  onPeerJoin: ((id: string) => void) | null;
  onPeerLeave: ((id: string) => void) | null;
  /** Step out of the room for now (everyone sees you leave), keeping your id… */
  pause(): void;
  /** …and come back in as the same peer. */
  resume(): void;
  readonly paused: boolean;
  leave(): void;
}

type Wire =
  | { k: 'peers'; ids: string[] }
  | { k: 'join'; id: string }
  | { k: 'leave'; id: string }
  | { k: 'msg'; from: string; t: string; d: Json };

const PING_MS = 25_000;
/** nothing heard (not even a pong) for this long → the socket is dead, open a new one */
const DEAD_MS = 2 * PING_MS + 10_000;
const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 15_000;
const CLOSE_FULL = 4001;

const randomId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

export function joinRelay(appId: string, roomId: string, relayUrl = RELAY_URL): RelayRoom {
  const selfId = randomId().replace(/[^a-z0-9]/g, 'x');
  const base = relayUrl.replace(/^http/, 'ws').replace(/\/+$/, '');
  const endpoint = `${base}/room/${encodeURIComponent(appId)}/${encodeURIComponent(roomId)}?id=${selfId}`;
  const peers = new Set<string>();
  let ws: WebSocket | null = null;
  let left = false;
  let paused = false;
  let retries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let heard = Date.now();

  const room: RelayRoom = {
    selfId,
    // Nothing is queued while disconnected: the island only sends state, and the next
    // update (or the hello to each peer on reconnect) supersedes anything missed.
    send(type, data, to) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(to ? { t: type, d: data, to } : { t: type, d: data }));
    },
    onMessage: null,
    onPeerJoin: null,
    onPeerLeave: null,
    get paused() {
      return paused;
    },
    pause() {
      if (paused || left) return;
      paused = true;
      clearTimeout(retryTimer);
      ws?.close(1000, 'away');
      ws = null;
      dropAll();
    },
    resume() {
      if (!paused || left) return;
      paused = false;
      retries = 0;
      connect();
    },
    leave() {
      left = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      window.removeEventListener('pagehide', onHide);
      ws?.close(1000, 'leave');
      dropAll();
    },
  };

  const joined = (id: string) => {
    if (id === selfId || peers.has(id)) return;
    peers.add(id);
    room.onPeerJoin?.(id);
  };
  const gone = (id: string) => {
    if (peers.delete(id)) room.onPeerLeave?.(id);
  };
  const dropAll = () => [...peers].forEach(gone);

  const connect = () => {
    const socket = new WebSocket(endpoint);
    ws = socket;
    socket.onopen = () => {
      retries = 0;
      heard = Date.now();
    };
    socket.onmessage = (e: MessageEvent) => {
      heard = Date.now();
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      let w: Wire;
      try {
        w = JSON.parse(e.data) as Wire;
      } catch {
        return;
      }
      if (w.k === 'peers') w.ids.forEach(joined);
      else if (w.k === 'join') joined(w.id);
      else if (w.k === 'leave') gone(w.id);
      else if (w.k === 'msg') room.onMessage?.(w.t, w.d, w.from);
    };
    socket.onclose = (e: CloseEvent) => {
      if (ws !== socket) return;
      ws = null;
      dropAll();
      if (left || paused) return;
      if (e.code === CLOSE_FULL) console.warn('relay: the island is full right now');
      retryTimer = setTimeout(connect, Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** retries++));
    };
  };

  const pingTimer = setInterval(() => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    if (Date.now() - heard > DEAD_MS) {
      // Gone quiet: don't wait for the old socket to finish closing, start a new one.
      const dead = ws;
      ws = null;
      dead.onclose = null;
      dead.close();
      dropAll();
      if (!left && !paused) connect();
      return;
    }
    ws.send('ping');
  }, PING_MS);
  const onHide = () => ws?.close(1000, 'pagehide');
  window.addEventListener('pagehide', onHide);

  connect();
  return room;
}
