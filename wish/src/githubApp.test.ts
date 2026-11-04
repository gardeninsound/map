// @vitest-environment node
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appJwt, forgetToken, installationToken, pemToDer } from './githubApp';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const part = (jwt: string, i: number) => JSON.parse(Buffer.from(jwt.split('.')[i], 'base64url').toString());

describe('GitHub App sign-in', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    forgetToken();
  });

  it('signs an RS256 JWT for the app that GitHub can verify', async () => {
    const jwt = await appJwt('5618995', PEM, 1_800_000_000);
    expect(part(jwt, 0)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(part(jwt, 1)).toEqual({ iss: '5618995', iat: 1_800_000_000 - 60, exp: 1_800_000_000 + 540 });
    const [h, p, sig] = jwt.split('.');
    expect(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, sig, 'base64url')).toBe(true);
  });

  it('reads a key stored on one line with literal \\n, and refuses PKCS#1', () => {
    expect(pemToDer(PEM.replace(/\n/g, '\\n'))).toEqual(pemToDer(PEM));
    expect(() => pemToDer('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----')).toThrow(/PKCS#8/);
  });

  it('trades the JWT for an installation token and reuses it until near expiry', async () => {
    const now = Date.parse('2026-11-04T12:00:00Z');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      expect(String(url)).toBe('https://api.github.test/app/installations/42/access_tokens');
      expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
      return new Response(JSON.stringify({ token: 'ghs_x', expires_at: new Date(now + 3600_000).toISOString() }), { status: 201 });
    });
    const cfg = { api: 'https://api.github.test', appId: '1', installationId: '42', key: PEM };
    expect(await installationToken(cfg, now)).toBe('ghs_x');
    expect(await installationToken(cfg, now + 49 * 60_000)).toBe('ghs_x');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await installationToken(cfg, now + 51 * 60_000); // within 10 min of expiry: fetch a fresh one
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('says why when GitHub refuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad credentials', { status: 401 }));
    await expect(installationToken({ api: 'https://x', appId: '1', installationId: '2', key: PEM })).rejects.toThrow(/401 Bad credentials/);
  });
});
