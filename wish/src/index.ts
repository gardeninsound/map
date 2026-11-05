/**
 * The map's idea box: "What would you love to add in the Garden in Sound?"
 *
 *   POST /   {"text": "...", "token": "<Turnstile token>", "name"?: "Sam", "street"?: "California Ave SW"}
 *         →  200 {"ok": true, "issue": 12}  |  4xx/5xx {"ok": false, "error": "..."}
 *
 * Checks the page's origin, the Turnstile token (a person filled this in) and a per-address
 * rate limit, then files the idea as a GitHub issue labelled `suggestion`, signed in as the
 * Garden in Sound Wishes GitHub App (so the author is `garden-in-sound-wishes[bot]`; the app can only touch
 * issues). Nothing here runs the text.
 */
import { installationToken } from './githubApp';
import { check, issueFor, previewOf } from './issue';

interface Env {
  ALLOWED_ORIGINS: string;
  GITHUB_REPO: string;
  GITHUB_APP_ID: string;
  GITHUB_INSTALLATION_ID: string;
  /** the app's private key, PKCS#8 PEM (secret) */
  GITHUB_APP_KEY: string;
  TURNSTILE_SECRET: string;
  /** tests point this at a local fake */
  GITHUB_API?: string;
  LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

function originAllowed(origin: string | null, allowed: string): boolean {
  if (!origin) return false;
  return allowed.split(',').map((s) => s.trim()).filter(Boolean).some((p) => {
    const re = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    return re.test(origin);
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    const ok = originAllowed(origin, env.ALLOWED_ORIGINS);
    const cors: Record<string, string> = ok ? { 'Access-Control-Allow-Origin': origin!, Vary: 'Origin' } : {};
    const reply = (status: number, data: object) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: ok ? 204 : 403,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (req.method !== 'POST') return reply(405, { ok: false, error: 'POST only.' });
    if (!ok) return reply(403, { ok: false, error: 'Not from the map.' });

    let body: { token?: unknown };
    try {
      body = await req.json();
    } catch {
      return reply(400, { ok: false, error: 'Something went wrong sending that.' });
    }
    const idea = check(body);
    if (!idea.ok) return reply(400, { ok: false, error: idea.error });

    // Only well-formed ideas count, so fixing a too-short one doesn't use up your tries.
    const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.LIMIT && !(await env.LIMIT.limit({ key: ip })).success) {
      return reply(429, { ok: false, error: 'That was a lot of ideas at once. Try again in a minute.' });
    }

    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: typeof body.token === 'string' ? body.token : '', remoteip: ip }),
    });
    const human = (await verify.json().catch(() => ({}))) as { success?: boolean };
    if (!human.success) return reply(403, { ok: false, error: "We couldn't check you're a person. Try again." });

    const api = env.GITHUB_API ?? 'https://api.github.com';
    let token: string;
    try {
      token = await installationToken({ api, appId: env.GITHUB_APP_ID, installationId: env.GITHUB_INSTALLATION_ID, key: env.GITHUB_APP_KEY });
    } catch (e) {
      console.log('github app', (e as Error).message);
      return reply(502, { ok: false, error: 'The idea box is stuck right now. Try again later.' });
    }
    const res = await fetch(`${api}/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'garden-wish',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issueFor(idea.text, idea.street, idea.name, previewOf(origin))),
    });
    if (!res.ok) {
      console.log('github', res.status, await res.text().catch(() => ''));
      return reply(502, { ok: false, error: "The idea box is stuck right now. Try again later." });
    }
    const issue = (await res.json()) as { number: number };
    return reply(200, { ok: true, issue: issue.number });
  },
};
