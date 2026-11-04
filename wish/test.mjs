// End-to-end check of the idea box: runs the real Worker in `wrangler dev` (local workerd)
// against a fake GitHub API, with Cloudflare's always-pass Turnstile test secret.
// Run with `npm test` in wish/.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8798;
const GH_PORT = 8797;
const here = fileURLToPath(new URL('.', import.meta.url));
const ORIGIN = 'http://localhost:5173';
// Cloudflare's documented Turnstile test values: this secret accepts the dummy token.
const PASS_SECRET = '1x0000000000000000000000000000000AA';
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

// fresh local state each run, so the rate limit starts at zero
const STATE = mkdtempSync(join(tmpdir(), 'garden-wish-test-'));
const assert = (c, m) => { if (!c) throw new Error(m); };

const issues = [];
const github = createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    issues.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(data || '{}') });
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ number: issues.length }));
  });
});
await new Promise((r) => github.listen(GH_PORT, '127.0.0.1', r));

function startWrangler() {
  const bin = fileURLToPath(new URL('./node_modules/.bin/wrangler', import.meta.url));
  const vars = { GITHUB_API: `http://127.0.0.1:${GH_PORT}`, GITHUB_TOKEN: 'test-token', TURNSTILE_SECRET: PASS_SECRET };
  const child = spawn(bin, ['dev', '--port', String(PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false', '--persist-to', STATE,
    ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])], {
    cwd: here, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`wrangler dev didn't start:\n${log}`)), 60_000);
    const onData = (b) => { log += b; if (/Ready on/.test(log)) { clearTimeout(timer); resolve(child); } };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`wrangler dev exited (${code}):\n${log}`)));
  });
}

const send = (body, origin = ORIGIN) =>
  fetch(`http://127.0.0.1:${PORT}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, cors: r.headers.get('access-control-allow-origin'), data: await r.json().catch(() => null) }));

const wrangler = await startWrangler();
try {
  console.log('Verifying the idea box...');

  const pre = await fetch(`http://127.0.0.1:${PORT}/`, { method: 'OPTIONS', headers: { Origin: ORIGIN } });
  assert(pre.status === 204 && pre.headers.get('access-control-allow-origin') === ORIGIN, `preflight: ${pre.status}`);
  const badPre = await fetch(`http://127.0.0.1:${PORT}/`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert(badPre.status === 403 && !badPre.headers.get('access-control-allow-origin'), 'preflight from elsewhere refused');
  console.log(' CORS: the map may send, other sites may not ✓');

  for (const origin of ['https://evil.example', 'https://gardeninsound.website.evil.example', null]) {
    const r = await send({ text: 'A koi pond', token: DUMMY_TOKEN }, origin);
    assert(r.status === 403, `origin ${origin} should be refused, got ${r.status}`);
  }
  console.log(' posts from other origins are refused ✓');

  let r = await send('not json');
  assert(r.status === 400, `bad json → ${r.status}`);
  r = await send({ text: 'hi', token: DUMMY_TOKEN });
  assert(r.status === 400 && r.data.error, `short → ${r.status}`);
  console.log(' malformed and too-short ideas get a 400 with a message ✓');

  r = await send({ text: 'A koi pond by the seal' });
  assert(r.status === 403, `no captcha token → ${r.status}`);
  assert(issues.length === 0, 'nothing reached GitHub yet');
  console.log(' no Turnstile token, no issue ✓');

  r = await send({ text: 'A koi pond, ask @vlandham', token: DUMMY_TOKEN, street: 'California Ave SW' });
  assert(r.status === 200 && r.data.ok && r.data.issue === 1 && r.cors === ORIGIN, `good idea → ${r.status} ${JSON.stringify(r.data)}`);
  const [issue] = issues;
  assert(issue.url === '/repos/gardeninsound/map/issues', `issue url ${issue.url}`);
  assert(issue.auth === 'Bearer test-token', 'uses the Worker token');
  assert(issue.body.labels[0] === 'suggestion', 'labelled suggestion');
  assert(issue.body.body.includes('@​vlandham') && !/@vlandham/.test(issue.body.body), 'mention defused');
  assert(issue.body.body.includes('California Ave SW'), 'street included');
  console.log(' a good idea becomes a labelled issue, mentions defused ✓');

  // 3 well-formed ideas a minute per address: the token-less one and the good one count
  r = await send({ text: 'Another idea here', token: DUMMY_TOKEN });
  assert(r.status === 200, `third idea → ${r.status}`);
  r = await send({ text: 'And one more idea', token: DUMMY_TOKEN });
  assert(r.status === 429 && issues.length === 2, `rate limit → ${r.status}, ${issues.length} issues`);
  console.log(' more than 3 a minute from one address gets a 429 ✓');

  console.log('Idea box OK');
} finally {
  wrangler.kill();
  github.close();
  rmSync(STATE, { recursive: true, force: true });
}
