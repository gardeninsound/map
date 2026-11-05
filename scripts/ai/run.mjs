#!/usr/bin/env node
/**
 * Try the idea → change helper by hand, with free models only (see scripts/ai/README.md).
 *
 *   node scripts/ai/run.mjs spec 12                 plan issue #12 (or "needs a person")
 *   node scripts/ai/run.mjs spec --idea "more birds"   plan an idea typed here
 *   node scripts/ai/run.mjs build 12                Aider makes the planned change, then the checks run
 *   node scripts/ai/run.mjs build --idea            the same, for the last spec --idea
 *   node scripts/ai/run.mjs models                  the models your keys can use (for --model)
 *
 * Options: --provider gemini|workers  (default: the first with a key, in that order)
 *          --model <name>             (default per provider, below)
 *          --architect                Aider plans, then edits (two calls per step)
 *          --dry-run                  print the prompts / the Aider command; call nothing
 *
 * Keys come from the environment, never from files in the repo:
 *   GEMINI_API_KEY                         Google AI Studio key, on a project with billing OFF
 *   CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID)  a token with "Workers AI: Read" only
 *
 * Nothing is committed or pushed. A build leaves its change in the working tree for you to
 * look at; `git checkout -- <file>` throws it away.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDiff, checkSpec, NEEDS_PERSON, parseRecipe, quoteIdea, recipeIndex } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, '.ai'); // gitignored: specs, prompts, the shop list
/** The project's Cloudflare account (public; it's in both wrangler.jsonc files). */
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || '7de05f51e1fe91fd717fe174fcfba85d';

/** Free providers, in the order they're tried. Model names change: check them against the docs. */
const PROVIDERS = {
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    model: 'gemini-3.8-flash',
    api: 'https://generativelanguage.googleapis.com/v1beta/openai',
    aider: (model) => ({ args: ['--model', `gemini/${model}`], env: {} }),
  },
  workers: {
    key: () => process.env.CLOUDFLARE_API_TOKEN,
    model: '@cf/qwen/qwen2.5-coder-32b-instruct',
    api: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/v1`,
    aider: (model, p) => ({
      args: ['--model', `openai/${model}`, '--openai-api-base', p.api],
      env: { OPENAI_API_KEY: p.key() },
    }),
  },
};

// ---- arguments ----

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  argv.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};
const dryRun = !!flag('--dry-run');
const architect = !!flag('--architect');
const providerName = flag('--provider');
const modelName = flag('--model');
const typedIdea = flag('--idea');
const [command, issueArg] = argv;

function die(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}
if (command !== 'models' && (!['spec', 'build'].includes(command) || (!issueArg && typeof typedIdea !== 'string' && !(command === 'build' && typedIdea)))) {
  die('usage: node scripts/ai/run.mjs spec|build <issue number>   (or: spec --idea "…", or: models)');
}
const key = typedIdea ? 'idea' : String(Number(issueArg));
if (command !== 'models' && key === 'NaN') die(`"${issueArg}" isn't an issue number`);

/** Providers to try, best first: one named with --provider, else every one with a key. */
function providers() {
  const names = providerName ? [providerName] : Object.keys(PROVIDERS);
  const list = names.map((n) => {
    const p = PROVIDERS[n];
    if (!p) die(`unknown provider "${n}" (gemini or workers)`);
    return { name: n, ...p, model: modelName || p.model };
  });
  const ready = list.filter((p) => p.key());
  if (!ready.length && !dryRun) die('no key: set GEMINI_API_KEY, or CLOUDFLARE_API_TOKEN for Workers AI (see scripts/ai/README.md)');
  return ready.length ? ready : list;
}

// ---- the pieces ----

const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');
const recipes = readdirSync(join(HERE, 'recipes'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => parseRecipe(readFileSync(join(HERE, 'recipes', f), 'utf8')));

function idea(saved) {
  if (saved) return saved; // build --idea: the idea that spec --idea sorted
  if (typedIdea) return quoteIdea(String(typedIdea));
  let body;
  try {
    body = execFileSync('gh', ['issue', 'view', key, '--json', 'body', '-q', '.body'], { cwd: ROOT, encoding: 'utf8' });
  } catch {
    die(`couldn't read issue #${key} with gh (is it logged in?)`);
  }
  return quoteIdea(body);
}

/** Every shop on the map with a lat/lon, for recipes that pick a real one. */
function writeShops() {
  const w = JSON.parse(read('src/city/world/worldData.json'));
  const { west, north, mPerLon, mPerLat } = w.projection;
  const lines = w.shops.map((s) => {
    const lon = west + (s.x * w.tileMeters) / mPerLon;
    const lat = north - (s.y * w.tileMeters) / mPerLat;
    return `${s.name} | ${s.kind} | lat ${lat.toFixed(4)}, lon ${lon.toFixed(4)}`;
  });
  writeFileSync(join(OUT, 'shops.txt'), lines.join('\n') + '\n');
}

/** One chat call to an OpenAI-compatible endpoint. Throws { quota: true } on a rate limit. */
const BUSY = [500, 502, 503, 504];
const WAITS = [3, 10, 30]; // seconds between tries when a free server is busy

async function chat(p, system, user) {
  for (let i = 0; ; i++) {
    try {
      return await chatOnce(p, system, user);
    } catch (e) {
      if (!e.busy || i >= WAITS.length) throw e;
      console.log(`  ${p.name} is busy (HTTP ${e.status}); trying again in ${WAITS[i]} s`);
      await new Promise((r) => setTimeout(r, WAITS[i] * 1000));
    }
  }
}

async function chatOnce(p, system, user) {
  const res = await fetch(`${p.api}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: p.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const text = await res.text();
  if (res.status === 429 || /quota|rate.?limit|exhausted|neurons/i.test(res.ok ? '' : text)) {
    throw Object.assign(new Error(`${p.name}: out of free quota for now`), { quota: true });
  }
  if (res.status === 404 && /model/i.test(text)) {
    // models get retired; the error usually names the replacement
    const hint = /use (?:models\/)?([\w.@/-]+)/i.exec(text)?.[1];
    throw Object.assign(new Error(`${p.name}: model "${p.model}" isn't available${hint ? ` (it suggests ${hint})` : ''}. Try --model <name>`), { skip: true });
  }
  if (BUSY.includes(res.status)) {
    throw Object.assign(new Error(`${p.name}: still busy after ${WAITS.length + 1} tries`), { busy: true, skip: true, status: res.status });
  }
  if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status} ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content ?? '';
}

// ---- spec: idea → plan ----

async function spec() {
  const system = read('scripts/ai/spec-prompt.md').replace('{{RECIPES}}', recipeIndex(recipes));
  const user = idea();
  if (dryRun) {
    console.log(`--- system ---\n${system}\n--- user ---\n${user}\n--- would ask: ${providers().map((p) => `${p.name} (${p.model})`).join(', then ')}`);
    return;
  }
  const reasons = [];
  for (const p of providers()) {
    // a weak model sometimes answers in the wrong shape: one retry, told what was wrong
    let ask = user;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let raw;
      try {
        console.log(`… asking ${p.name} (${p.model})${attempt > 1 ? ', again' : ''}`);
        raw = await chat(p, system, ask);
      } catch (e) {
        if (e.quota || e.skip) {
          console.log(`  ${e.message}; trying the next provider`);
          reasons.push(e.busy ? `${p.name} busy` : e.quota ? `${p.name} out of quota` : `${p.name} model unavailable`);
          break;
        }
        die(e.message);
      }
      const checked = checkSpec(raw, recipes);
      if (checked.ok) {
        const file = join(OUT, `${key}.spec.json`);
        writeFileSync(file, JSON.stringify({ ...checked.spec, provider: p.name, model: p.model, idea: user }, null, 2) + '\n');
        console.log(`\n${JSON.stringify(checked.spec, null, 2)}\n\n✓ saved ${file}`);
        if (checked.spec.recipe === NEEDS_PERSON) console.log('  → needs a person; nothing to build.');
        else console.log(`  → next: node scripts/ai/run.mjs build ${key === 'idea' ? '--idea' : key}`);
        return;
      }
      console.log(`  the answer didn't fit: ${checked.problems.join('; ')}`);
      ask = `${user}\n\nYour last answer was not usable (${checked.problems.join('; ')}). Answer again with one JSON object in the format described, and nothing else.`;
    }
  }
  const tips = [];
  if (reasons.some((r) => r.endsWith('busy'))) tips.push('busy: try again in a few minutes, or a less popular model (node scripts/ai/run.mjs models, then --model <name>)');
  if (reasons.some((r) => r.endsWith('quota'))) tips.push('out of quota: the free allowance resets at midnight UTC');
  if (reasons.some((r) => r.endsWith('unavailable'))) tips.push('model unavailable: pick one from node scripts/ai/run.mjs models');
  if (!process.env.CLOUDFLARE_API_TOKEN) tips.push('a fallback helps: set CLOUDFLARE_API_TOKEN for Workers AI (see the README)');
  die(`no usable plan (${reasons.join(', ') || 'answers in the wrong shape'}).\n  ${tips.join('\n  ')}`);
}

// ---- build: plan → change ----

function build() {
  let s;
  try {
    s = JSON.parse(readFileSync(join(OUT, `${key}.spec.json`), 'utf8'));
  } catch {
    die(key === 'idea' ? 'no plan yet: run  node scripts/ai/run.mjs spec --idea "…"  first' : `no plan for #${key} yet: run  node scripts/ai/run.mjs spec ${key}`);
  }
  if (s.recipe === NEEDS_PERSON) die(`#${key} needs a person: ${s.why}`);
  const recipe = recipes.find((r) => r.name === s.recipe);
  if (!recipe) die(`the plan names an unknown recipe "${s.recipe}"`);

  // start from a clean tree, so the check afterwards sees only the bot's change
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty && !dryRun) die(`commit or stash your changes first:\n${dirty}`);

  writeShops();
  const plan = [
    s.summary,
    '',
    'Steps:',
    ...s.steps.map((x, i) => `${i + 1}. ${x}`),
    '',
    'Done when:',
    ...s.done_when.map((x) => `- ${x}`),
    ...(s.draft ? ['', 'Draft of what to add (use it, fix it if it breaks a rule):', s.draft] : []),
  ].join('\n');
  const message = read('scripts/ai/build-prompt.md')
    .replace('{{SPEC}}', plan)
    .replace('{{RECIPE}}', recipe.body)
    .replace('{{IDEA}}', idea(key === 'idea' ? s.idea : undefined));
  const messageFile = join(OUT, `${key}.build.md`);
  writeFileSync(messageFile, message);

  const p = providers()[0];
  const model = p.aider(p.model, p);
  const test = `npx vitest run ${recipe.test.join(' ')}`;
  const args = [
    ...model.args,
    '--message-file', messageFile,
    ...recipe.edit.flatMap((f) => ['--file', f]),
    ...recipe.read.flatMap((f) => ['--read', f]),
    '--test-cmd', test,
    '--auto-test',
    '--map-tokens', '0', // it's handed the files; no need to map the repo
    '--no-auto-commits',
    '--no-gitignore',
    '--yes-always',
    '--no-check-update',
    '--analytics-disable',
    '--no-show-model-warnings',
    '--no-pretty',
    ...(architect ? ['--architect'] : []),
  ];
  console.log(`aider ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
  if (dryRun) {
    console.log(`\n--- message (${messageFile}) ---\n${message}`);
    return;
  }

  const run = spawnSync('aider', args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...model.env } });
  if (run.error) die(`couldn't start aider (${run.error.message}). Install it: uv tool install --python 3.12 aider-chat`);

  // the checks that don't trust the model
  console.log('\n--- checking the change ---');
  const numstat = execFileSync('git', ['diff', '--numstat'], { cwd: ROOT, encoding: 'utf8' });
  const diff = checkDiff(numstat, recipe);
  const tests = spawnSync('npx', ['vitest', 'run', ...recipe.test], { cwd: ROOT, stdio: 'inherit' });
  const types = spawnSync('npx', ['tsc', '-b'], { cwd: ROOT, stdio: 'inherit' });
  const problems = [
    ...diff.problems,
    ...(tests.status ? ['the recipe test fails'] : []),
    ...(types.status ? ['the type check fails'] : []),
  ];
  if (problems.length) {
    console.log(`\n✗ not good enough:\n${problems.map((x) => `  - ${x}`).join('\n')}\n  Look with  git diff ; throw it away with  git checkout -- ${diff.files.join(' ') || '.'}`);
    process.exit(1);
  }
  console.log(`\n✓ ${diff.files.join(', ')}: ${diff.lines} lines changed, tests and types pass.\n  Look with  git diff  (and npm run dev). Nothing was committed.`);
}

mkdirSync(OUT, { recursive: true });
/** The models each provider's key can use (names to pass to --model). */
async function models() {
  for (const p of providers()) {
    if (!p.key()) continue;
    const res = await fetch(`${p.api}/models`, { headers: { Authorization: `Bearer ${p.key()}` } });
    if (!res.ok) {
      console.log(`${p.name}: HTTP ${res.status} (${(await res.text()).slice(0, 200)})`);
      continue;
    }
    const ids = ((await res.json()).data ?? []).map((m) => String(m.id).replace(/^models\//, '')).sort();
    console.log(`${p.name} (default ${p.model}):\n${ids.map((id) => `  ${id}`).join('\n')}`);
  }
}

if (command === 'models') await models();
else if (command === 'spec') await spec();
else build();
