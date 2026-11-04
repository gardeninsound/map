// End-to-end check of the relay protocol: starts `wrangler dev` (a real
// local workerd running the Durable Object) and drives it with plain Node
// WebSockets. Run with `npm test (in relay/)`.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 8799;
const BASE = `ws://127.0.0.1:${PORT}`;
const here = fileURLToPath(new URL('.', import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Starts wrangler directly (not via npm, which wouldn't pass the kill on to it). */
function startWrangler() {
  const bin = fileURLToPath(new URL('./node_modules/.bin/wrangler', import.meta.url));
  const child = spawn(bin, ['dev', '--port', String(PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false'], {
    cwd: here,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`wrangler dev didn't start:\n${log}`)), 60_000);
    const onData = (buf) => {
      log += buf;
      if (/Ready on/.test(log)) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`wrangler dev exited (${code}):\n${log}`)));
  });
}

/** A test client: a socket plus every message it has received, and a way to wait for one. */
// Browsers always send an Origin, and the relay refuses sockets from origins
// outside ALLOWED_ORIGINS (wrangler.jsonc), so the test sends one too.
const ORIGIN = 'http://localhost:5173';

function client(room, id, { app = 'test', origin = ORIGIN } = {}) {
  const headers = origin ? { Origin: origin } : {};
  const ws = new WebSocket(`${BASE}/room/${app}/${room}?id=${id}`, { headers });
  const got = [];
  const waiters = [];
  ws.onmessage = (e) => {
    const msg = e.data === 'pong' ? { k: 'pong' } : JSON.parse(e.data);
    got.push(msg);
    for (const w of [...waiters]) if (w.match(msg)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg); }
  };
  const closed = new Promise((resolve) => (ws.onclose = (e) => resolve(e.code)));
  return {
    id,
    ws,
    got,
    closed,
    opened: new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; }),
    send: (t, d, to) => ws.send(JSON.stringify(to ? { t, d, to } : { t, d })),
    /** Resolves with the first message (already received or future) matching `match`. */
    next(match, label = 'message', timeoutMs = 3000) {
      const seen = got.find(match);
      if (seen) { got.splice(got.indexOf(seen), 1); return Promise.resolve(seen); }
      return new Promise((resolve, reject) => {
        const w = { match, resolve: (m) => { clearTimeout(t); got.splice(got.indexOf(m), 1); resolve(m); } };
        const t = setTimeout(() => reject(new Error(`${id}: timed out waiting for ${label}; got ${JSON.stringify(got)}`)), timeoutMs);
        waiters.push(w);
      });
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('Verifying relay...');

  // Origins: allowed ones connect (the test's own sockets below); others are refused.
  for (const origin of ['https://evil.example', 'https://gardeninsound.website.evil.example', 'https://vallandingham.me', null]) {
    const r = client('ROOM', 'zzzz9', { origin });
    const refused = await r.opened.then(() => false, () => true);
    if (!refused) r.ws.close();
    assert(refused, `expected origin ${origin} to be refused`);
  }
  for (const origin of ['https://gardeninsound.website', 'https://www.gardeninsound.website']) {
    const r = client('ORIGINS', 'yyyy8', { origin });
    await r.opened;
    r.ws.close();
  }
  console.log(' sockets from origins outside the allowlist are refused ✓');

  const a = client('ROOM', 'aaaa1');
  await a.opened;
  const first = await a.next((m) => m.k === 'peers', 'peer list');
  assert(first.ids.length === 0, `expected an empty room, got ${first.ids}`);
  const b = client('ROOM', 'bbbb2');
  const bPeers = await b.next((m) => m.k === 'peers', 'peer list');
  assert(bPeers.ids.join() === 'aaaa1', `expected B to see A already there, got ${bPeers.ids}`);
  await a.next((m) => m.k === 'join' && m.id === 'bbbb2', 'B joining');
  console.log(' joining: newcomer gets the peer list, others get a join ✓');

  a.send('pos', [1, 2]);
  const pos = await b.next((m) => m.k === 'msg', 'broadcast');
  assert(pos.from === 'aaaa1' && pos.t === 'pos' && JSON.stringify(pos.d) === '[1,2]', `bad broadcast ${JSON.stringify(pos)}`);
  await sleep(150);
  assert(!a.got.some((m) => m.k === 'msg'), 'sender should not get its own broadcast back');
  console.log(' broadcast reaches others, not the sender ✓');

  const c = client('ROOM', 'cccc3');
  await c.next((m) => m.k === 'peers', 'peer list');
  await a.next((m) => m.k === 'join' && m.id === 'cccc3', 'C joining');
  await b.next((m) => m.k === 'join' && m.id === 'cccc3', 'C joining');
  a.send('dm', 'hi b', 'bbbb2');
  const dm = await b.next((m) => m.k === 'msg' && m.t === 'dm', 'direct message');
  assert(dm.d === 'hi b', `bad dm ${JSON.stringify(dm)}`);
  await sleep(150);
  assert(!c.got.some((m) => m.k === 'msg'), 'a direct message should reach only its target');
  console.log(' direct messages reach only their target ✓');

  const other = client('OTHER', 'dddd4');
  await other.next((m) => m.k === 'peers', 'peer list');
  a.send('pos', [3, 4]);
  await b.next((m) => m.k === 'msg' && m.d[0] === 3, 'second broadcast');
  await sleep(150);
  assert(!other.got.some((m) => m.k === 'msg' || m.k === 'join'), 'rooms should be isolated');
  console.log(' rooms are isolated from each other ✓');

  b.ws.send('x'.repeat(20_000));
  b.ws.send('not json');
  b.ws.send(JSON.stringify({ nope: 1 }));
  b.ws.send('ping');
  await b.next((m) => m.k === 'pong', 'pong');
  await sleep(150);
  assert(!a.got.some((m) => m.k === 'msg'), 'oversize/garbage messages should be dropped');
  console.log(' ping answered; oversize and malformed messages dropped ✓');

  // C reconnects with the same id (a network blip): the old socket is
  // replaced and everyone sees C leave and come back.
  const c2 = client('ROOM', 'cccc3');
  const c2Peers = await c2.next((m) => m.k === 'peers', 'peer list');
  assert(c2Peers.ids.sort().join() === 'aaaa1,bbbb2', `expected the rejoining C to see A and B, got ${c2Peers.ids}`);
  assert((await c.closed) === 4000, 'expected the stale socket to close as replaced');
  await a.next((m) => m.k === 'leave' && m.id === 'cccc3', 'C leaving (replaced)');
  await a.next((m) => m.k === 'join' && m.id === 'cccc3', 'C rejoining');
  await sleep(200);
  assert(!a.got.some((m) => m.k === 'leave' && m.id === 'cccc3'), 'the replaced socket closing should not announce a second leave');
  console.log(' reconnecting with the same id replaces the old socket ✓');

  c2.ws.close();
  await a.next((m) => m.k === 'leave' && m.id === 'cccc3', 'C leaving');
  await b.next((m) => m.k === 'leave' && m.id === 'cccc3', 'C leaving');
  console.log(' closing announces a leave to everyone ✓');

  for (const s of [a, b, other]) s.ws.close();
}

const wrangler = await startWrangler();
let failed = false;
try {
  await run();
  console.log('Relay OK');
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  wrangler.kill();
}
process.exit(failed ? 1 : 0);
