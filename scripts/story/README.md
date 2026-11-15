# The story log

The Garden in Sound grows in public: a visitor sends a wish from the idea box, and a few days
later it's somewhere in West Seattle. The story log keeps the whole record of that, written
automatically, so the project can tell its own story later. That record is: what was wished
for, in the visitor's words; what was made and why it differs; who made it and with which
tools; and how the place looked before and after.

**Read it:** the [`story` branch](https://github.com/gardeninsound/map/tree/story). Its README
is the chronicle, newest first, with the pictures.

## What gets recorded

| When | What | Where on the `story` branch |
|---|---|---|
| every commit that reaches `main` (each one is a deploy) | facts from git and the PR, plus before/after photos of the place | `changes/<day>-pr064-<slug>/` |
| a merged PR's description is edited | the same change again, keeping the earlier words and the photos | same folder |
| an idea-box issue opens, changes, gets a comment or closes | the wish, with the words **as first sent** kept forever | `wishes/0036.json` |
| Mondays (nightly run) | a photo of every art spot, the start and the arcade, change or no change | `portraits/<day>/` |
| every run | the readable chronicle, plus an index for anything built on top | `README.md`, `story.json` |

Each change's `entry.json` (schema 1) holds:

- **what**: `title`, `summary`, the full PR `body`, `files` (path, status, +/−), `areas`
  touched, `census` (spots, characters, scenes, arcade cabinets, lines of code and commits at
  that moment, so you can see how the island grew)
- **why**: `ideas` (each wish it answers: the visitor's words, name if they gave one, the street
  their rabbit was on, when they asked), and `story` (the PR's `## Story` section: *Asked vs
  made*, *Mike*, *Note*)
- **who and how**: `authors`, `made_with` (co-authors and tools such as Claude Code, Aider and
  the free-model helper), the PR's own `commits` from before the squash, `reviews`,
  `discussion`, `opened_at` → `merged_at`, `days_open`, `preview_url`
- **how it looked**: `shots`, one per place, each with `before-N.webp` (the commit before),
  `after-N.webp` (lossless, so the pixels are exact) and `moving-N.webp` (a few seconds of
  the living map, looped), plus any page errors seen while shooting
- **bookkeeping**: `sha`, `parent`, `recorded_at`, `first_recorded_at`, `recorded_by` (the
  Actions run), and `earlier` (previous wordings, if the description changed)

Commits that went to `main` before PRs existed (Oct 18 – Nov 4) are recorded from git alone.

## Where the camera points

1. The PR's `Where:` lines, if any (`47.531, -122.396 — the meadow`, `arcade`, `title`, `none`).
2. Otherwise, West Seattle coordinates the diff adds (a new place's `lat`/`lon`), plus the
   Duck Arcade if arcade files changed.
3. Otherwise, the Junction where everyone starts, if the change touched anything visible.
   Changes to CI, docs, the relay or tools only get no photos.

Every change after the first is built twice, at its own commit and the one before, and both
builds are photographed through the site's review hooks (`?solo&at=…`). The photos show
exactly what a visitor would have seen at the time. Builds from before `?at=` existed show
their title screen, and the record says so.

## The human part

The machine records the facts. The story also needs the parts only people know, and those
belong in the PR's **`## Story`** section (the [template](../../.github/pull_request_template.md)
has it):

```
## Story
Idea: #36
Where: 47.5310, -122.3960 — the meadow
Asked vs made: They asked for My Little Pony G1; those are someone else's, so these are our own herd.
Mike: (his words, or empty)
Note: anything worth remembering
```

`Mike:` is only ever Mike's own words. Nobody, Claude included, writes a line for him.

## Running it

It runs itself (`.github/workflows/story.yml`). By hand:

```sh
git worktree add .story origin/story                        # once: the branch, beside your checkout
npm run story -- --out .story --missing --limit 5           # catch up
npm run story -- --out .story --pr 64 --redo [--reshoot]    # one change again
npm run story -- --out .story --wishes --chronicle          # wishes + README only, no builds
npm run story -- --out .story --portraits                   # every spot, today
node scripts/story/shoot.mjs --dist dist --at arcade        # just the camera, on your build
```

Then commit and push `.story` to `story`. In Actions, **Run workflow** on *Story* does the same:
a `limit` of ~100 backfills everything, and `redo` takes a PR number or sha.

## Files

| File | What it is |
|---|---|
| `lib.mjs` | the rules, pure and tested (`lib.test.mjs`, run by `npm test`): the Story section, wishes, where to point, the chronicle |
| `record.mjs` | the recorder: asks git and GitHub, builds, photographs, writes |
| `shoot.mjs` | the camera: serves any build and photographs places on it |

Built on top later, from `story.json`: an in-game notice board of recent arrivals, a
time-lapse of the island growing, a write-up for a show.
