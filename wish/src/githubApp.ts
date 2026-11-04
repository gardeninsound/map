/**
 * Signing in to GitHub as the Garden in Sound Wishes GitHub App (owned by the gardeninsound org),
 * so ideas are filed by `garden-in-sound-wishes[bot]` instead of a person.
 *
 * The app's private key (PKCS#8 PEM, a Worker secret) signs a short JWT; GitHub trades that
 * for an installation token (Issues: write on the map repo, valid an hour), which is cached
 * for 50 minutes. WebCrypto only, so it runs the same in Workers, Node and the tests.
 */

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json64 = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** PKCS#8 PEM → DER. Tolerates a key stored with literal "\n"s (one-line env values). */
export function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (/RSA PRIVATE KEY/.test(pem)) throw new Error('GITHUB_APP_KEY must be PKCS#8 ("BEGIN PRIVATE KEY")');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

/** The app's JWT: RS256, issued a minute ago (clock drift), good for 9 minutes (GitHub caps it at 10). */
export async function appJwt(appId: string, pkcs8Pem: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pkcs8Pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${json64({ alg: 'RS256', typ: 'JWT' })}.${json64({ iat: nowSec - 60, exp: nowSec + 540, iss: appId })}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
}

export interface AppConfig {
  api: string;
  appId: string;
  installationId: string;
  key: string;
}

let cached: { token: string; until: number } | null = null;

/** An installation token for the app, reused until 10 minutes before it expires. */
export async function installationToken(cfg: AppConfig, now = Date.now()): Promise<string> {
  if (cached && now < cached.until) return cached.token;
  const res = await fetch(`${cfg.api}/app/installations/${cfg.installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await appJwt(cfg.appId, cfg.key, Math.floor(now / 1000))}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'garden-wish',
    },
  });
  if (!res.ok) throw new Error(`installation token: ${res.status} ${await res.text().catch(() => '')}`);
  const { token, expires_at } = (await res.json()) as { token: string; expires_at: string };
  cached = { token, until: Date.parse(expires_at) - 10 * 60_000 };
  return token;
}

/** for tests */
export const forgetToken = () => {
  cached = null;
};
