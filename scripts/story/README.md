# The story log

The Garden in Sound grows in public: a visitor sends a wish from the idea box, and a few days
later it's somewhere in West Seattle. The story log keeps the whole record of that, written
automatically, so the project can tell its own story later. That record is: what was wished
for, in the visitor's words; what was made and why it differs; who made it; and how the place
looked before and after.

**Read it:** at [gardeninsound.website/story/](https://gardeninsound.website/story/) (not linked
from the map yet), which shows the log with growth charts, a before/after wipe for each place (grab the line or press the photo and drag; arrows when it has focus; `wipeAt` / `wipeKey` in `src/story/model.ts`),
and the wishes still waiting. It reads `story.json` straight from the branch, so it's current
without a deploy (`src/story/`). The [`story` branch](https://github.com/gardeninsound/map/tree/story)'s
README holds the same chronicle in plain Markdown.

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
  `discussion`, `opened_at` → `merged_at`, `days_open`, `preview_url`. The chronicle and the page
  name people (`vlandham` → Jim, `exit320-stack` → Mike: `PEOPLE` in `lib.mjs`) and don't show tool
  credits; `made_with` stays in the record only
- **how it looked**: `shots`, one per place, each with `before-N.webp` (the commit before),
  `after-N.webp` (lossless, so the pixels are exact) and `moving-N.webp` (a few seconds of
  the living map, looped), plus any page errors seen while shooting
- **bookkeeping**: `sha`, `parent`, `recorded_at`, `first_recorded_at`, `recorded_by` (the
  Actions run), and `earlier` (previous wordings, if the description changed)

Commits that went to `main` before PRs existed (Oct 18 – Nov 4) are recorded from git alone.

## Where the camera points

0. **Curated** places, for changes recorded before their PR could say (`curated.json`, by PR number or
   the commit's first 7). They win over the rest. Edit it and the next run takes those photos again
   (`--curated`, which the workflow always passes, up to `limit` a run).
1. The PR's `Where:` lines, if any (`47.531, -122.396 — the meadow`, `arcade`, `title`, `none`,
   `open:garden` or `open:arcade:duck-on-the-moon` to go inside a scene or a character's dialog,
   or any query as is: `?open=garden&time=2026-04-15`).
2. Otherwise, West Seattle coordinates the diff adds (a new place's `lat`/`lon`), plus the
   Duck Arcade if arcade files changed.
3. Otherwise, the Junction where everyone starts, if the change touched anything visible.
   Changes to CI, docs, the relay or tools only get no photos.

Every photo pins the game's clock to the moment the change merged and its chance to `seed=1`
(`src/city/clock.ts`), so before and after differ only by the change, and the garden shows the
month it was. Every change after the first is built twice, at its own commit and the one before, and both
builds are photographed through the site's review hooks (`?solo&at=…`). The photos show
what a visitor would have seen at the time. Until early November `?at=` only worked in
development builds, so commits like that are built in development mode, the one way to reach a
place on them (`camera.build` in the record says which). The very first commit had no `?at=`
yet, so it shows its title screen, and the record says so.

**Inside things, on old builds.** `?open=` and `?time=` only exist since #71, but the camera can
still get inside on older builds. An `open` place can say where to stand: `open:scene:rush-hour @ 47.5636, -122.3865`.
On a build without `?open=` links, the camera goes to that spot with `?at=` and presses {A} (Space)
until what the link opens is on screen (the dialog, the scene behind "Let's see it", a ride, Cone
Catch: the first choice each time). `open:arcade…` walks into the Duck Arcade by itself (on a build from
before `?at=arcade`, from the door's coordinates). On a build
without the game clock, a place's `time=` is faked in the browser (Playwright's clock), so the garden
can be photographed in April on the commit that planted it. An old build has no `?seed=`, so the camera seeds its
`Math.random` itself, and walking in gets four tries with a new seed each (a wandering neighbor can stand
in front of the lemon and answer instead). Each shot records `via` (`link` or
`way`) and any `nothing opened` problem (on a *before* photo that usually means it wasn't built yet).

## Tags

Every change gets tags for what kind of change it was, worked out from what it touched
(`tagsOf` in `lib.mjs`), so the log can be sorted: `wish` (answers an idea-box wish), `map`,
`character`, `scene`, `arcade`, `art`, `sound`, `words`, `ui`, `multiplayer`, `idea-box`, `code`
(the engine and the wiring: `src/city/engine`, `actions.ts`, the plugin list, a big `App.tsx`
change), `agent` (how agents build the island: `scripts/ai`, a rewritten or notes-only
`CLAUDE.md`, the guards that tell Claude where things go, a title about Claude or agents),
`story-log`, `infra` (CI, previews) and `docs`. A PR's `Tags:` line adds (`sound`, or a new one like
`festival`) and takes away (`-code`); so do `tags` in `curated.json`. Tags are worked out again for
every change on every run, so changing the rules re-tags the whole log. The /story/ page filters by them.

## The human part

The machine records the facts. The story also needs the parts only people know, and those
belong in the PR's **`## Story`** section (the [template](../../.github/pull_request_template.md)
has it):

```
## Story
Idea: #36
Where: 47.5310, -122.3960 — the meadow
Tags: (optional) sound, -code
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
npm run story -- --out .story --retry-shots --limit 100     # new photos wherever they failed
npm run story -- --out .story --curated --limit 40          # new photos wherever curated.json moved them
npm run story -- --out .story --wishes --chronicle          # wishes + README only, no builds
npm run story -- --out .story --portraits                   # every spot, today
node scripts/story/shoot.mjs --dist dist --at arcade        # just the camera, on your build
node scripts/story/shoot.mjs --old --at 'open:chicken @ 47.5633, -122.3866'  # …walking in by hand
```

Then commit and push `.story` to `story`. In Actions, **Run workflow** on *Story* does the same:
a `limit` of ~100 backfills everything, `redo` takes a PR number or sha, and `retry_shots`
takes new photos wherever they failed or fell back to the title screen.

## Files

| File | What it is |
|---|---|
| `lib.mjs` | the rules, pure and tested (`lib.test.mjs`, run by `npm test`): the Story section, wishes, where to point, the chronicle |
| `record.mjs` | the recorder: asks git and GitHub, builds, photographs, writes |
| `shoot.mjs` | the camera: serves any build and photographs places on it |
| `curated.json` | hand-picked places (and tags) for changes from before their PR could say: inside a scene, a cabinet, a dialog, a season |

Built on top of `story.json`: the /story/ page. Later, perhaps: an in-game notice board of
recent arrivals, a time-lapse of the island growing, a write-up for a show.
