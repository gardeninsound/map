/**
 * The pure parts of the idea → pull request helper (scripts/ai/run.mjs), kept here so they're
 * tested: reading recipes, quoting a visitor's idea safely, checking the model's spec, and
 * checking that a build only touched what its recipe allows.
 */

/** Never edited by a bot, whatever a recipe or a model says. */
export const FORBIDDEN = [
  '.github/',
  'relay/',
  'wish/',
  'scripts/',
  'src/city/',
  'public/',
  'package.json',
  'package-lock.json',
  'CLAUDE.md',
  'index.html',
  'vite.config.ts',
];

/** A build that changes more lines than this goes to a person instead. */
export const MAX_CHANGED_LINES = 80;

export const NEEDS_PERSON = 'needs-person';

/**
 * A recipe is Markdown with a small header:
 *
 *   ---
 *   name: crow-stop
 *   use: a new place for the snack crow to perch, with its lines
 *   edit: src/content/crow.ts
 *   read: src/game/crow.test.ts, .ai/shops.txt
 *   test: src/game/crow.test.ts
 *   ---
 *   …instructions…
 */
export function parseRecipe(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'));
  if (!m) throw new Error('recipe needs a --- header ---');
  const head = Object.fromEntries(
    m[1]
      .split('\n')
      .map((l) => /^(\w+):\s*(.*)$/.exec(l.trim()))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.trim()]),
  );
  const list = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const k of ['name', 'use', 'edit']) if (!head[k]) throw new Error(`recipe is missing "${k}:"`);
  const edit = list(head.edit);
  for (const f of edit) if (forbidden(f)) throw new Error(`recipe ${head.name} may not edit ${f}`);
  return { name: head.name, use: head.use, edit, read: list(head.read), test: list(head.test), body: m[2].trim() };
}

export const forbidden = (file) => FORBIDDEN.some((f) => (f.endsWith('/') ? file.startsWith(f) : file === f));

/** One line per recipe, for the spec prompt. */
export const recipeIndex = (recipes) => recipes.map((r) => `- ${r.name}: ${r.use}`).join('\n');

/** Every recipe in full, so the plan uses the real files, tests and format. */
export const recipesInFull = (recipes) =>
  recipes
    .map((r) => `### ${r.name}\nEdits: ${r.edit.join(', ')}. Test: npx vitest run ${r.test.join(' ')}.${r.read.length ? ` Can read: ${r.read.join(', ')}.` : ''}\n\n${r.body}`)
    .join('\n\n');

/**
 * A visitor's idea, from the issue the idea box filed, ready to put in a prompt as data.
 * Drops the issue's own wrapping (the "> " quote and the "Sent from…" footer), and anything
 * that could pass for the end of the quote.
 */
export function quoteIdea(issueBody) {
  const body = issueBody.replace(/\r\n/g, '\n').split(/\n---\n/)[0];
  const text = body
    .split('\n')
    .map((l) => l.replace(/^>\s?/, ''))
    .join('\n')
    .replace(/<\/?idea>/gi, '')
    .trim()
    .slice(0, 1200);
  return `<idea>\n${text}\n</idea>`;
}

/**
 * The model's spec, checked. It must pick a known recipe (or say a person is needed) and
 * may only name files that recipe edits.
 */
export function checkSpec(raw, recipes) {
  let s;
  try {
    s = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) : raw;
  } catch {
    return { ok: false, problems: ['the spec is not JSON'] };
  }
  const problems = [];
  if (!s || typeof s !== 'object') return { ok: false, problems: ['the spec is not an object'] };
  const recipe = recipes.find((r) => r.name === s.recipe);
  if (s.recipe !== NEEDS_PERSON && !recipe) problems.push(`unknown recipe "${s.recipe}"`);
  if (typeof s.summary !== 'string' || !s.summary.trim()) problems.push('no summary');
  if (s.recipe === NEEDS_PERSON) {
    if (typeof s.why !== 'string' || !s.why.trim()) problems.push('needs-person without a why');
  } else {
    if (!Array.isArray(s.steps) || s.steps.length === 0) problems.push('no steps');
    if (!Array.isArray(s.done_when) || s.done_when.length === 0) problems.push('no done_when');
    // weak models invent helper files and tests: every path the plan names must be the recipe's
    if (recipe) {
      const known = new Set([...recipe.edit, ...recipe.read, ...recipe.test]);
      const named = JSON.stringify([s.steps, s.done_when, s.draft ?? '']).match(/[\w.-]+(?:\/[\w.-]+)+\.(?:tsx?|mjs|js|json|txt|md|csv)\b/g) ?? [];
      const strange = [...new Set(named)].filter((f) => !known.has(f));
      if (strange.length) problems.push(`it names files the ${recipe.name} recipe doesn't use: ${strange.join(', ')} (use only ${[...known].join(', ')})`);
    }
  }
  return { ok: problems.length === 0, problems, spec: s, recipe };
}

/**
 * After a build: only the recipe's files changed, nothing forbidden, and not too much.
 * `numstat` is `git diff --numstat` output.
 */
export function checkDiff(numstat, recipe, max = MAX_CHANGED_LINES) {
  const rows = numstat
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [add, del, file] = l.split('\t');
      return { file, lines: (Number(add) || 0) + (Number(del) || 0) };
    });
  const problems = [];
  if (rows.length === 0) problems.push('nothing changed');
  for (const { file } of rows) {
    if (forbidden(file)) problems.push(`touched ${file}, which bots never edit`);
    else if (!recipe.edit.includes(file)) problems.push(`touched ${file}, outside the recipe (${recipe.edit.join(', ')})`);
  }
  const total = rows.reduce((a, r) => a + r.lines, 0);
  if (total > max) problems.push(`changed ${total} lines (most allowed: ${max})`);
  return { ok: problems.length === 0, problems, files: rows.map((r) => r.file), lines: total };
}
