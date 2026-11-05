# Pull request previews

Every pull request gets its own copy of the site, so you can try a change before it goes
live:

**`https://pr-<number>-garden-preview.gardeninsound.workers.dev`**

The [Preview workflow](../.github/workflows/preview.yml) builds the PR and uploads it, then
comments the link on the PR. The PR also gets a **View deployment** button with the same
link. Each push updates the same link. The live site isn't involved:
it still deploys from `main` to GitHub Pages.

## How it works

- `garden-preview` is a Cloudflare Worker in the project's account that only serves files
  (the built `dist/`). It has no code of its own.
- Each PR uploads a new *version* of it with the alias `pr-<number>`
  (`wrangler versions upload --preview-alias`). Versions are never deployed, so the Worker's
  own address, `garden-preview.gardeninsound.workers.dev`, keeps showing whatever was last
  deployed by hand.
- A preview is a full copy of the site. Its rabbits share the real relay, and its idea box
  files real issues, titled `[preview pr-<number>] Idea: …`. Both Workers allow
  `https://*-garden-preview.gardeninsound.workers.dev`, and the Turnstile widget lists
  `gardeninsound.workers.dev`.
- When a PR closes (merged or not), the [Preview cleanup workflow](../.github/workflows/preview-cleanup.yml)
  re-uploads `pr-<number>` with [`closed/index.html`](closed/index.html): a small "this preview
  has closed" page with no game, relay or idea box. It also marks the PR's GitHub deployments
  inactive. Cloudflare can't delete an alias, but uploading over one replaces it, and it keeps
  at most 1,000 aliases per Worker, dropping the oldest.
- Previews are public to anyone who has the link, like the repo.
- PRs from forks don't get a preview: GitHub doesn't give them the Cloudflare token.

## Setup (done once)

- The GitHub Actions secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with only
  **Account → Workers Scripts → Edit** on the project's account. Best as an *account* API
  token (Manage Account → Account API Tokens), which belongs to the account, not a person.
- `garden-preview` was created by one `npx wrangler deploy` here.

## By hand

```sh
npm run build
cd preview && npm ci
npx wrangler versions upload --preview-alias my-test   # → https://my-test-garden-preview.gardeninsound.workers.dev
```
