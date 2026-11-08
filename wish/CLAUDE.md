# wish/ — the idea box's Worker

The site's ✿ IDEA box (`src/ui/IdeaBox.tsx`) posts here
(wish.gardeninsound.website, gardeninsound Cloudflare account). The Worker checks origin + a
Cloudflare Turnstile token + 3 ideas/min per address, then files a GitHub issue labelled
`suggestion` on the public repo (mentions defused; formatting pure + tested in
`wish/src/issue.ts`, run by the root `npm test`; `cd wish && npm test` runs the Worker against a
fake GitHub). Issues are filed by the org's **Garden in Sound Wishes GitHub App**
(github.com/apps/garden-in-sound-wishes, Issues: write only) so they show as `garden-in-sound-wishes[bot]`:
`wish/src/githubApp.ts` signs a JWT with the app key and caches an installation token. App and
installation ids are vars in `wish/wrangler.jsonc`; secrets: `TURNSTILE_SECRET`, `GITHUB_APP_KEY`
(PKCS#8 PEM). `?wish=http://127.0.0.1:8791` points the site at `npm run dev` in wish/ (Turnstile's
test key is used for a local Worker).
