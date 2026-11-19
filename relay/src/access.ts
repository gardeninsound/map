/**
 * The admin page's data is for Mike and Jim only. Cloudflare Access stands in front of
 * gardeninsound.website/admin/ (a login: an email on the list, a one-time code), and every request it
 * lets through carries a signed token in `Cf-Access-Jwt-Assertion`. This checks that token too, so the
 * numbers stay locked even if the Access policy is ever loosened by mistake:
 * signed (RS256) by one of the team's keys (`https://<team>/cdn-cgi/access/certs`), for this
 * application (ACCESS_AUD), from this team (ACCESS_TEAM), not expired. Pure + tested (access.test.ts).
 */

export type AccessEnv = {
  /** the Zero Trust team domain, e.g. gardeninsound.cloudflareaccess.com */
  ACCESS_TEAM?: string;
  /** the Access application's audience tag (its Overview page) */
  ACCESS_AUD?: string;
};

type Jwk = JsonWebKey & { kid?: string };
type Claims = { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string };
export type AccessResult = { ok: true; email: string | null } | { ok: false; why: string };

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const json = <T>(s: string): T => JSON.parse(new TextDecoder().decode(b64url(s))) as T;

let certs: { team: string; keys: Jwk[]; at: number } | null = null;
/** the team's signing keys, kept an hour */
async function keysFor(team: string, fetcher: typeof fetch, now: number): Promise<Jwk[]> {
  if (certs && certs.team === team && now - certs.at < 3_600_000) return certs.keys;
  const res = await fetcher(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs: HTTP ${res.status}`);
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  certs = { team, keys, at: now };
  return keys;
}
/** forget the cached keys (tests) */
export const forgetKeys = () => {
  certs = null;
};

/** Is this request from someone Access let in? */
export async function checkAccess(request: Request, env: AccessEnv, fetcher: typeof fetch = fetch, now = Date.now()): Promise<AccessResult> {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return { ok: false, why: 'locked: Cloudflare Access is not set up yet (relay/README.md, "Admin access")' };
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, why: 'not signed in' };
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) return { ok: false, why: 'bad token' };
  try {
    const h = json<{ alg?: string; kid?: string }>(head);
    if (h.alg !== 'RS256') return { ok: false, why: 'bad token' };
    const jwk = (await keysFor(env.ACCESS_TEAM, fetcher, now)).find((k) => k.kid === h.kid);
    if (!jwk) return { ok: false, why: 'unknown key' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const good = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), new TextEncoder().encode(`${head}.${body}`));
    if (!good) return { ok: false, why: 'bad signature' };
    const c = json<Claims>(body);
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!aud.includes(env.ACCESS_AUD)) return { ok: false, why: 'wrong application' };
    if (c.iss !== `https://${env.ACCESS_TEAM}`) return { ok: false, why: 'wrong team' };
    const t = now / 1000;
    if (!c.exp || c.exp < t || (c.nbf && c.nbf > t + 60)) return { ok: false, why: 'expired' };
    return { ok: true, email: c.email ?? null };
  } catch {
    return { ok: false, why: 'bad token' };
  }
}
