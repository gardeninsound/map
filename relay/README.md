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

- **visits**: rabbits that joined the room that day, each once (a rabbit that steps out and back in,
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
