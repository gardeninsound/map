import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { checkAccess, forgetKeys } from './access';

const env = { ACCESS_TEAM: 'garden.cloudflareaccess.com', ACCESS_AUD: 'aud123' };
const now = Date.parse('2026-11-19T20:00:00Z');
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o: object) => b64(new TextEncoder().encode(JSON.stringify(o)));

async function keyPair() {
  const k = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  return { ...k, jwk: { ...(await crypto.subtle.exportKey('jwk', k.publicKey)), kid: 'k1' } };
}
async function sign(priv: CryptoKey, claims: object, kid = 'k1') {
  const head = enc({ alg: 'RS256', kid });
  const body = enc(claims);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64(sig)}`;
}
const req = (token?: string) => new Request('https://gardeninsound.website/admin/api/stats', { headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {} });
const good = { aud: ['aud123'], iss: 'https://garden.cloudflareaccess.com', exp: now / 1000 + 3600, email: 'mike@example.com' };

describe('only Mike and Jim (Cloudflare Access)', () => {
  beforeEach(forgetKeys);

  it("lets in a signed-in person, and checks the token's signature, application, team and time", async () => {
    const k = await keyPair();
    const certs = (async () => Response.json({ keys: [k.jwk] })) as unknown as typeof fetch;
    expect(await checkAccess(req(await sign(k.privateKey, good)), env, certs, now)).toEqual({ ok: true, email: 'mike@example.com' });
    expect(await checkAccess(req(await sign(k.privateKey, { ...good, aud: 'other' })), env, certs, now)).toEqual({ ok: false, why: 'wrong application' });
    expect(await checkAccess(req(await sign(k.privateKey, { ...good, iss: 'https://evil.cloudflareaccess.com' })), env, certs, now)).toEqual({ ok: false, why: 'wrong team' });
    expect(await checkAccess(req(await sign(k.privateKey, { ...good, exp: now / 1000 - 1 })), env, certs, now)).toEqual({ ok: false, why: 'expired' });
    expect(await checkAccess(req(await sign(k.privateKey, good, 'k9')), env, certs, now)).toEqual({ ok: false, why: 'unknown key' });
    // signed by someone else's key
    const other = await keyPair();
    expect(await checkAccess(req(await sign(other.privateKey, good)), env, certs, now)).toEqual({ ok: false, why: 'bad signature' });
  });

  it('turns away no token, junk, and everything until Access is set up', async () => {
    const none = (async () => Response.json({ keys: [] })) as unknown as typeof fetch;
    expect(await checkAccess(req(), env, none, now)).toEqual({ ok: false, why: 'not signed in' });
    expect(await checkAccess(req('a.b'), env, none, now)).toEqual({ ok: false, why: 'bad token' });
    expect(await checkAccess(req('x.y.z'), env, none, now)).toEqual({ ok: false, why: 'bad token' });
    const r = await checkAccess(req('x.y.z'), {}, none, now);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.why).toContain('not set up');
  });
});

it('never deploys with the check switched off', () => {
  expect(readFileSync('relay/wrangler.jsonc', 'utf8')).not.toMatch(/ACCESS_DEV/);
});
