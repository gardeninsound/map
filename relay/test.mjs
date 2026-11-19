// End-to-end check of the relay protocol: starts `wrangler dev` (a real
// local workerd running the Durable Object) and drives it with plain Node
// WebSockets. Run with `npm test (in relay/)`.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// never hang a CI run or a terminal
setTimeout(() => {
  console.error('relay test timed out');
  process.exit(1);
}, 120_000).unref();

const PORT = 8799;
const BASE = `ws://127.0.0.1:${PORT}`;
const here = fileURLToPath(new URL('.', import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Starts wrangler directly (not via npm, which wouldn't pass the kill on to it). */
function startWrangler(port = PORT, vars = {}) {
  const bin = fileURLToPath(new URL('./node_modules/.bin/wrangler', import.meta.url));
  const extra = Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`]);
  const child = spawn(bin, ['dev', '--port', String(port), '--ip', '127.0.0.1', '--show-interactive-dev-session=false', ...extra], {
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

function client(room, id, { app = 'test', origin = ORIGIN, base = BASE } = {}) {
  const headers = origin ? { Origin: origin } : {};
  const ws = new WebSocket(`${base}/room/${app}/${room}?id=${id}`, { headers });
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

/**
 * The sweep, on its own relay with short timings: a socket that goes silent without
 * closing (a laptop that slept) is dropped and everyone hears it leave; one that keeps
 * pinging stays.
 */
async function sweep() {
  const base = `ws://127.0.0.1:${PORT + 1}`;
  const alive = client('SWEEP', 'aaaa1', { base });
  const silent = client('SWEEP', 'bbbb2', { base });
  const watcher = client('SWEEP', 'cccc3', { base });
  await Promise.all([alive.opened, silent.opened, watcher.opened]);
  const keepAlive = setInterval(() => {
    alive.ws.send('ping');
    watcher.ws.send('ping');
  }, 500);
  try {
    const left = await watcher.next((m) => m.k === 'leave', 'the silent one to be swept', 8000);
    assert(left.id === 'bbbb2', `expected bbbb2 swept, got ${left.id}`);
    // (whether the dropped client hears its close depends on the runtime; it may be dead anyway)
    silent.send('hi', 1);
    await sleep(1500);
    assert(!watcher.got.some((m) => m.k === 'msg' && m.from === 'bbbb2'), 'a swept socket is not heard any more');
    assert(alive.ws.readyState === WebSocket.OPEN, 'a pinging socket stays');
    assert(!watcher.got.some((m) => m.k === 'leave' && m.id === 'aaaa1'), 'nobody saw the live one leave');
  } finally {
    clearInterval(keepAlive);
    for (const s of [alive, silent, watcher]) s.ws.close();
  }
  console.log(' silent sockets are swept (everyone hears them leave); pinging ones stay ✓');
}

/** Counts: visits (once per rabbit per day), the peak, opened things, and the guards on /count. */
async function counts() {
  const HTTP = BASE.replace('ws:', 'http:');
  // a fresh app each run: wrangler dev keeps Durable Object storage between runs
  const app = `stats${Date.now().toString(36)}`;
  const get = async () => (await fetch(`${HTTP}/stats/${app}/isle`)).json();
  const count = (key, origin = ORIGIN) => fetch(`${HTTP}/count/${app}`, { method: 'POST', body: key, headers: origin ? { Origin: origin } : {} });

  // a rabbit from dev (or a preview, or a test) is in the room but isn't a visit
  const dev = client('isle', 'visit0', { app });
  await dev.next((m) => m.k === 'peers', 'peer list');
  let s = await get();
  assert(s.now === 1 && s.days.length === 0, `expected a dev rabbit online but no visit, got ${JSON.stringify(s)}`);
  dev.ws.close();
  await sleep(200);
  s = await get();
  assert(s.now === 0 && s.days.length === 0, `expected nothing yet, got ${JSON.stringify(s)}`);
  const live = { app, origin: 'https://gardeninsound.website' };
  const a = client('isle', 'visit1', live);
  await a.next((m) => m.k === 'peers', 'peer list');
  const b = client('isle', 'visit2', live);
  await b.next((m) => m.k === 'peers', 'peer list');
  // b steps out and back in (away, then back): the same rabbit, not a second visit
  b.ws.close();
  await a.next((m) => m.k === 'leave', 'B leaving');
  const b2 = client('isle', 'visit2', live);
  await b2.next((m) => m.k === 'peers', 'peer list');
  s = await get();
  assert(s.now === 2, `expected 2 online, got ${s.now}`);
  assert(s.days.length === 1 && s.days[0].day === s.today, `expected today only, got ${JSON.stringify(s.days)}`);
  assert(s.days[0].visits === 2 && s.days[0].peak === 2, `expected 2 visits and a peak of 2, got ${JSON.stringify(s.days[0])}`);
  console.log(' visits: live-site rabbits only, once per rabbit per day, stepping out and back in included; the peak ✓');

  for (const key of ['scene:gas-station-wall', 'scene:gas-station-wall', 'crow']) assert((await count(key)).status === 204, `count ${key}`);
  assert((await count('Bad Key!')).status === 400, 'a bad key is refused');
  assert((await count('crow', 'https://evil.example')).status === 403, 'another site is refused');
  assert((await count('crow', null)).status === 403, 'no origin is refused');
  assert((await fetch(`${HTTP}/count/${app}`)).status === 405, 'only POST counts');
  const res = await fetch(`${HTTP}/stats/${app}/isle`);
  assert(res.headers.get('access-control-allow-origin') === '*', 'stats are readable from any page');
  s = await res.json();
  assert(JSON.stringify(s.days[0].opened) === JSON.stringify({ 'scene:gas-station-wall': 2, crow: 1 }), `opened: ${JSON.stringify(s.days[0].opened)}`);
  console.log(' opened things counted by key, most first; bad keys, other sites and GETs refused ✓');

  for (const w of [a, b2]) w.ws.close();
  await sleep(200);
  assert((await get()).now === 0, 'nobody online after they leave');
  console.log(' online now drops when they leave ✓');

  // /traffic without a token: says what's missing, readable from any page
  const t = await fetch(`${HTTP}/traffic`);
  assert(t.headers.get('access-control-allow-origin') === '*', 'traffic is readable from any page');
  const tj = await t.json();
  assert(/CF_API_TOKEN/.test(tj.zone.error) && /CF_API_TOKEN/.test(tj.web.error), `expected "not set up yet", got ${JSON.stringify(tj)}`);
  console.log(' /traffic says what is missing until the token is set ✓');
}

let failed = false;
let wrangler = await startWrangler();
try {
  await run();
  await counts();
  wrangler.kill();
  wrangler = await startWrangler(PORT + 1, { STALE_MS: 2000, SWEEP_MS: 1000 });
  await sweep();
  console.log('Relay OK');
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  wrangler.kill();
}
process.exit(failed ? 1 : 0);
