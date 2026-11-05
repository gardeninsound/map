# Ideas → changes, with free models

An experiment: can a **free** AI model turn a visitor's idea from the idea box (an issue
labelled `suggestion`) into a small, correct change? For now you run it by hand, on your
own machine. Nothing here is automated, and nothing is committed or pushed for you.

It only uses free tiers: Google's Gemini API with billing turned off (so it can only stop,
never charge), then Cloudflare Workers AI's free daily allowance. No paid models.

## How it makes weak models do well

Free models are weaker coders, so they never get an open-ended task:

1. **Spec first.** `spec` asks the model to sort the idea: does exactly one *recipe* cover
   it? If so, it writes a short, exact plan. If not, it answers `needs-person` and says
   why. A person reads the plan before anything is built.
2. **Recipes.** Each file in [`recipes/`](recipes) is one kind of small change, such as a
   neighbor's line, a crow stop or a busker song. Each one names the single file it may
   edit, its rules, a worked example, and the test that proves it worked.
3. **Handed the files.** Aider gets exactly the recipe's files and no map of the repo, so it
   can't wander.
4. **Tests talk back.** Aider runs the recipe's test after each edit and fixes what fails.
5. **Checks that don't trust the model** ([`lib.mjs`](lib.mjs), tested). The idea is quoted
   as data, never as instructions. A plan must name a real recipe. After a build, it fails if
   any file outside the recipe changed, if anything in `.github/`, `relay/`, `wish/`,
   `src/city/`, `scripts/` or `public/` was touched, if more than 80 lines changed, or if
   the tests or the type check fail.

## Set up (once)

1. **Aider:** `uv tool install --python 3.12 aider-chat` (or `brew install uv` first). It's
   installed on your machine, not in the repo.
2. **A free Gemini key:** at [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
   create a key in a Google Cloud project that has **no billing account**. Keep it in your
   shell, never in the repo:
   `export GEMINI_API_KEY=…`
3. *(Optional, the fallback)* **Workers AI:** in the project's Cloudflare account, create an
   API token with only **Workers AI: Read**, then `export CLOUDFLARE_API_TOKEN=…`. On the
   free plan it stops at the daily allowance and is never billed.

## Try it

```sh
node scripts/ai/run.mjs spec 12                     # plan issue #12, or say it needs a person
node scripts/ai/run.mjs spec --idea "more birds"    # try any idea without an issue
node scripts/ai/run.mjs build 12                    # Aider makes the planned change; the checks run
git diff                                            # look; npm run dev to see it
git checkout -- src/content/crow.ts                 # or throw it away
```

Options: `--provider gemini|workers`, `--model <name>`, `--architect` (Aider plans, then
edits; often better for weak models), and `--dry-run` (prints the prompts or the Aider
command and calls nothing). `spec` moves on to the next provider when one is out of free
quota. Working files (plans, prompts, the shop list) go in `.ai/`, which is gitignored.

The default model names (`gemini-3.8-flash`, `@cf/qwen/qwen2.5-coder-32b-instruct`) change
over time. When one is retired, the runner says so (often with the replacement's name); pass
`--model <name>`, and update the default in `run.mjs`.

## Adding a recipe

A recipe is worth adding when ideas keep asking for the same kind of change, and a test can
tell a good one from a bad one. Copy one in `recipes/`. Its header lists `edit:` (the only
files it may change: content data, never engine code), `read:` (files it can see but not
change), and `test:`. `lib.test.mjs` checks every recipe's files exist. Before relying on a
recipe, check that its own example passes its test.

Not recipes on purpose: emotes (the picker has keys 1–9 and all nine are used), new art,
new places on the map, new scenes or games.

## Files

| File | What it is |
|---|---|
| `spec-prompt.md` | the sorting prompt: idea → plan JSON, or `needs-person` |
| `build-prompt.md` | the build prompt: the plan, the recipe and the quoted idea go in |
| `recipes/*.md` | one kind of small change each |
| `lib.mjs` | the checks, pure and tested (`lib.test.mjs`, run by `npm test`) |
| `run.mjs` | the runner: calls the models and Aider, then runs the checks |
