# bearisland-relay

The island's multiplayer relay: a Cloudflare Worker with one Durable Object per room. Each
rabbit keeps one WebSocket open to it, and it forwards messages to everyone else in the room.
It knows nothing about the game, and the rooms store nothing. The one thing kept is counts
(`src/stats.ts`, below). The wire protocol is documented at the top
of `src/net/relay.ts`.

Copied from the arcade's relay (github.com/vlandham/arcade `packages/relay`) in November 2026
and maintained here on its own, like `src/city/`. It runs in the gardeninsound Cloudflare
account (the one that holds gardeninsound.website), not the arcade's.

```
cd relay
npm install
npm run dev        # ws://127.0.0.1:8790 — open the site with ?relay=ws://127.0.0.1:8790
npm test           # protocol + origin checks against a real local workerd
npm run typecheck
npm run deploy     # to the account pinned by account_id in wrangler.jsonc
```

`ALLOWED_ORIGINS` in `wrangler.jsonc` lists the pages that may connect, so other sites can't
spend the free quota (the browser sets `Origin`; scripts can fake it, so it's a quota guard, not
authentication). On the free plan the limit that matters is Durable Object requests, about
100,000 a day; each incoming message counts 1/20. Rabbits send at most 5×/s and only while
moving, so that's roughly 100+ rabbit-hours of walking a day.

## Counts

A `Stats` Durable Object per app (`src/stats.ts`) keeps numbers per Seattle day, for the admin page:

- **visits**: rabbits from the live site (`COUNT_ORIGINS`; previews, dev and tests share the room but don't count)
  that joined the room that day, each once (a rabbit that steps out and back in,
  or reconnects, is the same visit). The random peer ids are held for the current day only, to
  tell them apart, and deleted when the day turns.
- **peak**: the most rabbits in the room at once that day.
- **opened**: how often each thing was opened, by key (`scene:gas-station-wall`, `crow`,
  `arcade:duck-scroller`), from the game's beacon (`src/net/counts.ts`: the live site only, once
  per thing per page load, never from a scripted browser).

```
POST /count/<appId>            body: the key; allowed origins only; 204, or 400 for a bad key / a full day
GET  /stats/<appId>/<roomId>   → { now, today, days: [{ day, visits, peak, opened: { key: n } }] }  (?days=30, any origin)
```

No names, no ids, no addresses are kept: a key and a count per day. Keys are `[a-z0-9:_-]{1,64}` and a
day holds at most `MAX_KEYS`, so made-up keys can't grow it. Counts older than `KEEP_DAYS` are dropped.
`npm test` checks visits, the peak, opened counts and the guards against a local workerd.

## Traffic

`GET /traffic` returns Cloudflare's own numbers for the whole site, for the admin page: everyone who loads
gardeninsound.website (it goes through Cloudflare), including people who never press start. `src/traffic.ts`
asks Cloudflare's GraphQL Analytics API for two datasets:

- **the zone**: unique visitors, page views and requests per day for 30 days (Cloudflare's UTC days).
- **Web Analytics** (Cloudflare's cookie-free page beacon): over the last 7 days, the top referring sites,
  pages, countries and devices, by visits.

The answer is cached 10 minutes (1 minute while something's wrong), so Cloudflare gets asked a few times an
hour at most. Until it's set up, each half says what's missing. To set it up:

1. **Turn on Web Analytics**: Cloudflare dashboard → Web Analytics → Add a site → gardeninsound.website.
   Since the site goes through Cloudflare, pick the automatic setup; no code change. Copy its **site tag**.
2. Put the site tag in `wrangler.jsonc` as `CF_SITE_TAG` (`CF_ACCOUNT_ID` and `CF_ZONE_ID` are already there; the
   zone ID is on the dashboard's gardeninsound.website → Overview page).
3. **Make a token**: My Profile → API Tokens → Create Token → Custom, with **Account › Account Analytics › Read**
   and **Zone › Analytics › Read** (the gardeninsound account and zone only). Then, in `relay/`:
   `npx wrangler secret put CF_API_TOKEN` and paste it. It lives in Cloudflare only, never in git.
4. `npm run deploy`, then open https://relay.gardeninsound.website/traffic.
