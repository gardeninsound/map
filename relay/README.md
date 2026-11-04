# bearisland-relay

The island's multiplayer relay: a Cloudflare Worker with one Durable Object per room. Each
rabbit keeps one WebSocket open to it, and it forwards messages to everyone else in the room.
It stores nothing and knows nothing about the game. The wire protocol is documented at the top
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
