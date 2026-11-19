/**
 * The site's traffic from Cloudflare, for the admin page: GET /traffic. Two of Cloudflare's own
 * datasets, read with a read-only API token kept as a relay secret (never in a page):
 *
 * - the zone's requests (every load of gardeninsound.website, through Cloudflare's network):
 *   unique visitors, page views and requests per day (UTC days, Cloudflare's) — `httpRequests1dGroups`
 * - Web Analytics (Cloudflare's cookie-free page beacon): page views and visits per day, and over
 *   the last 7 days the top referring sites, pages, countries and devices — `rumPageloadEventsAdaptiveGroups`
 *
 * Settings (wrangler.jsonc vars + one secret): CF_API_TOKEN (secret: Zone Analytics Read + Account
 * Analytics Read), CF_ZONE_ID, CF_ACCOUNT_ID, CF_SITE_TAG (the Web Analytics site). Either half
 * works without the other. Answers are cached TRAFFIC_TTL seconds. The shaping here is pure and
 * tested (traffic.test.ts); index.ts does the fetch and the cache.
 */

export const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
export const TRAFFIC_TTL = 600;

export type TrafficEnv = {
  CF_API_TOKEN?: string;
  CF_ZONE_ID?: string;
  CF_ACCOUNT_ID?: string;
  CF_SITE_TAG?: string;
  /** tests point this at a fake */
  CF_GRAPHQL_URL?: string;
};

export type Ranked = { name: string; n: number }[];
export type TrafficDay = { day: string; visitors: number; pageViews: number; requests: number };
export type BeaconDay = { day: string; pageViews: number; visits: number };
export type Traffic = {
  generated_at: string;
  /** the zone's numbers, or why not */
  zone: { days: TrafficDay[] } | { error: string };
  /** Web Analytics, or why not */
  web: { days: BeaconDay[]; referrers: Ranked; pages: Ranked; countries: Ranked; devices: Ranked } | { error: string };
};

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const ZONE_QUERY = `query ($zone: String!, $since: Date!, $until: Date!) {
  viewer { zones(filter: { zoneTag: $zone }) {
    httpRequests1dGroups(limit: 31, filter: { date_geq: $since, date_leq: $until }, orderBy: [date_ASC]) {
      dimensions { date }
      sum { requests pageViews }
      uniq { uniques }
    }
  } }
}`;

const rum = (alias: string, dim: string, since: string) =>
  `${alias}: rumPageloadEventsAdaptiveGroups(limit: ${dim === 'date' ? 31 : 10}, filter: { siteTag: $site, datetime_geq: ${since}, datetime_leq: $until }, orderBy: [${dim === 'date' ? 'date_ASC' : 'sum_visits_DESC'}]) { count sum { visits } dimensions { ${dim} } }`;
export const WEB_QUERY = `query ($account: String!, $site: String!, $since: Time!, $week: Time!, $until: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    ${rum('days', 'date', '$since')}
    ${rum('referrers', 'refererHost', '$week')}
    ${rum('pages', 'requestPath', '$week')}
    ${rum('countries', 'countryName', '$week')}
    ${rum('devices', 'deviceType', '$week')}
  } }
}`;

/** the variables for both queries, for the 30 days up to `now` (the last 7 for the rankings) */
export function variables(env: TrafficEnv, now = Date.now()) {
  const since = now - 29 * 86_400_000;
  return {
    zone: { zone: env.CF_ZONE_ID, since: day(since), until: day(now) },
    web: {
      account: env.CF_ACCOUNT_ID,
      site: env.CF_SITE_TAG,
      since: `${day(since)}T00:00:00Z`,
      week: new Date(now - 7 * 86_400_000).toISOString(),
      until: new Date(now).toISOString(),
    },
  };
}

type GqlReply = { data?: { viewer?: { zones?: Record<string, unknown>[]; accounts?: Record<string, unknown>[] } } | null; errors?: { message: string }[] | null };
const why = (r: GqlReply) => r.errors?.map((e) => e.message).join('; ') || null;

/** GraphQL's zone reply → our days (or the error Cloudflare gave) */
export function zoneOf(r: GqlReply): Traffic['zone'] {
  const err = why(r);
  if (err) return { error: err };
  const rows = (r.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []) as { dimensions: { date: string }; sum: { requests: number; pageViews: number }; uniq: { uniques: number } }[];
  return { days: rows.map((g) => ({ day: g.dimensions.date, visitors: g.uniq.uniques, pageViews: g.sum.pageViews, requests: g.sum.requests })) };
}

type RumRow = { count: number; sum: { visits: number }; dimensions: Record<string, string> };
const ranked = (rows: RumRow[] | undefined, dim: string, blank: string): Ranked =>
  (rows ?? []).map((g) => ({ name: g.dimensions[dim] || blank, n: g.sum.visits })).filter((x) => x.n > 0);

/** GraphQL's Web Analytics reply → our days and rankings (or the error Cloudflare gave) */
export function webOf(r: GqlReply): Traffic['web'] {
  const err = why(r);
  if (err) return { error: err };
  const a = (r.data?.viewer?.accounts?.[0] ?? {}) as Record<string, RumRow[] | undefined>;
  return {
    days: (a.days ?? []).map((g) => ({ day: g.dimensions.date!, pageViews: g.count, visits: g.sum.visits })),
    referrers: ranked(a.referrers, 'refererHost', 'direct (typed or no referrer)'),
    pages: ranked(a.pages, 'requestPath', '/'),
    countries: ranked(a.countries, 'countryName', 'unknown'),
    devices: ranked(a.devices, 'deviceType', 'unknown'),
  };
}

/** what's missing to read each half, or null when it can be read */
export function missing(env: TrafficEnv) {
  const token = env.CF_API_TOKEN ? [] : ['the CF_API_TOKEN secret'];
  const zone = [...token, ...(env.CF_ZONE_ID ? [] : ['CF_ZONE_ID'])];
  const web = [...token, ...(env.CF_ACCOUNT_ID ? [] : ['CF_ACCOUNT_ID']), ...(env.CF_SITE_TAG ? [] : ['CF_SITE_TAG'])];
  const say = (m: string[]) => (m.length ? `not set up yet: ${m.join(', ')} (relay/README.md, "Traffic")` : null);
  return { zone: say(zone), web: say(web) };
}

/** ask Cloudflare for both halves (each skipped with a reason when it isn't set up) */
export async function readTraffic(env: TrafficEnv, now = Date.now(), fetcher: typeof fetch = fetch): Promise<Traffic> {
  const v = variables(env, now);
  const gone = missing(env);
  const ask = async (query: string, vars: object): Promise<GqlReply> => {
    try {
      const res = await fetcher(env.CF_GRAPHQL_URL || GRAPHQL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: vars }),
      });
      if (!res.ok) return { errors: [{ message: `Cloudflare said HTTP ${res.status}` }] };
      return (await res.json()) as GqlReply;
    } catch (e) {
      return { errors: [{ message: `couldn't reach Cloudflare (${(e as Error).message})` }] };
    }
  };
  const [zone, web] = await Promise.all([
    gone.zone ? { error: gone.zone } : ask(ZONE_QUERY, v.zone).then(zoneOf),
    gone.web ? { error: gone.web } : ask(WEB_QUERY, v.web).then(webOf),
  ]);
  return { generated_at: new Date(now).toISOString(), zone, web };
}
