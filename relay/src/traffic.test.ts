import { describe, expect, it } from 'vitest';
import { missing, readTraffic, variables, webOf, zoneOf, WEB_QUERY, ZONE_QUERY } from './traffic';

const env = { CF_API_TOKEN: 't', CF_ZONE_ID: 'z', CF_ACCOUNT_ID: 'a', CF_SITE_TAG: 's' };
const now = Date.parse('2026-11-19T20:00:00Z');

describe("the site's traffic from Cloudflare", () => {
  it('asks for the last 30 days, and the last 7 for the rankings', () => {
    const v = variables(env, now);
    expect(v.zone).toEqual({ zone: 'z', since: '2026-10-21', until: '2026-11-19' });
    expect(v.web).toMatchObject({ account: 'a', site: 's', since: '2026-10-21T00:00:00Z', week: '2026-11-12T20:00:00.000Z', until: '2026-11-19T20:00:00.000Z' });
  });

  it('says what is missing for each half', () => {
    expect(missing(env)).toEqual({ zone: null, web: null });
    const m = missing({ CF_ZONE_ID: 'z' });
    expect(m.zone).toContain('CF_API_TOKEN');
    expect(m.web).toContain('CF_SITE_TAG');
    expect(missing({ ...env, CF_SITE_TAG: undefined }).zone).toBeNull();
  });

  it("reads the zone's days", () => {
    const r = { data: { viewer: { zones: [{ httpRequests1dGroups: [{ dimensions: { date: '2026-11-18' }, sum: { requests: 900, pageViews: 120 }, uniq: { uniques: 40 } }] }] } } };
    expect(zoneOf(r)).toEqual({ days: [{ day: '2026-11-18', visitors: 40, pageViews: 120, requests: 900 }] });
    expect(zoneOf({ data: null, errors: [{ message: 'not authorized' }] })).toEqual({ error: 'not authorized' });
  });

  it('reads Web Analytics: days, and referrers, pages, countries, devices by visits', () => {
    const row = (dim: string, v: string, visits: number, count = visits * 2) => ({ count, sum: { visits }, dimensions: { [dim]: v } });
    const r = {
      data: {
        viewer: {
          accounts: [
            {
              days: [row('date', '2026-11-18', 30)],
              referrers: [row('refererHost', 'l.instagram.com', 12), row('refererHost', '', 9), row('refererHost', 'x.com', 0)],
              pages: [row('requestPath', '/', 25), row('requestPath', '/story/', 2)],
              countries: [row('countryName', 'US', 28)],
              devices: [row('deviceType', 'mobile', 20), row('deviceType', 'desktop', 10)],
            },
          ],
        },
      },
    };
    const w = webOf(r);
    expect(w).toEqual({
      days: [{ day: '2026-11-18', pageViews: 60, visits: 30 }],
      referrers: [
        { name: 'l.instagram.com', n: 12 },
        { name: 'direct (typed or no referrer)', n: 9 },
      ],
      pages: [
        { name: '/', n: 25 },
        { name: '/story/', n: 2 },
      ],
      countries: [{ name: 'US', n: 28 }],
      devices: [
        { name: 'mobile', n: 20 },
        { name: 'desktop', n: 10 },
      ],
    });
  });

  it('asks Cloudflare with the token, and passes on what goes wrong', async () => {
    const asked: { auth: string | null; query: string }[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      asked.push({ auth: new Headers(init.headers).get('Authorization'), query: body.query });
      if (body.query === ZONE_QUERY) return Response.json({ data: { viewer: { zones: [{ httpRequests1dGroups: [] }] } } });
      return new Response('nope', { status: 500 });
    }) as typeof fetch;
    const t = await readTraffic(env, now, fake);
    expect(asked.map((a) => a.auth)).toEqual(['Bearer t', 'Bearer t']);
    expect(asked.map((a) => a.query)).toEqual([ZONE_QUERY, WEB_QUERY]);
    expect(t.zone).toEqual({ days: [] });
    expect(t.web).toEqual({ error: 'Cloudflare said HTTP 500' });
    // nothing set up: nothing asked
    asked.length = 0;
    const none = await readTraffic({}, now, fake);
    expect(asked).toEqual([]);
    expect('error' in none.zone && 'error' in none.web).toBe(true);
  });
});
