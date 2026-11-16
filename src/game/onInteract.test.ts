// @vitest-environment node
/**
 * Guard: what {A} does on something belongs in its plugin, as an `act()` returning an Action
 * (src/game/actions.ts), never as a branch in App.tsx's onInteract (which only runs the plugins'
 * actions, and lets the city's plain neighbors say their lines). Fails if a branch comes back.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** branches allowed in App's onInteract: none (all moved into their plugins' act(), #72–#74) */
const STILL_IN_APP: string[] = [];

const HOW = `
  What {A} does goes in the plugin, not in App.tsx:
    1. make the plugin an Actor:  class MyThing implements CityPlugin, Actor
    2. add  act(t: Target): Action | null  — return null for targets that aren't yours, else
       talk(speaker, lines, { portrait, choices: [{ label, next: <another Action> }], then }),
       { kind: 'ride', ride }, { kind: 'minigame', game, then: (r) => … }, close, or { kind: 'do', run() { … } }
    3. test it with pick(action, 'a choice label') (see src/game/actions.test.ts)
  Examples: src/game/plugins/ponies.ts (a simple dialog), lunaPark.ts (choices → a ride),
  chicken.ts (questions, then a mini game), ham.ts (a choice that does something, then a reply).
  Needs something no Action shows yet (a new mini game, a new kind of screen)? Add it to Action in
  src/game/actions.ts and one case to App's runAction (allowed: only onInteract is guarded).
  More in src/game/CLAUDE.md, "What {A} does is data" and "Something new on screen".`;

function branchesInOnInteract(): string[] {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const start = app.indexOf('onInteract: (t) => {');
  expect(start, 'App.tsx should still have onInteract').toBeGreaterThan(0);
  const end = app.indexOf('\n        },', start);
  const body = app.slice(start, end);
  return [...body.matchAll(/t\.(?:kind|key) === ['`]([\w:-]+)['`]|t\.npc === ([a-zA-Z]+)\.npc|t\.data instanceof (\w+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

describe("App's onInteract", () => {
  it('gets no new branches: what {A} does goes in the plugin', () => {
    const added = branchesInOnInteract().filter((b) => !STILL_IN_APP.includes(b));
    expect(added, `New branch(es) in App.tsx's onInteract: ${added.join(', ')}.${HOW}`).toEqual([]);
  });

  it('lists only what is really still there (moved one out? take it off STILL_IN_APP)', () => {
    const found = new Set(branchesInOnInteract());
    const gone = STILL_IN_APP.filter((b) => !found.has(b));
    expect(gone, `No longer in App's onInteract: ${gone.join(', ')}. Remove from STILL_IN_APP in this test.`).toEqual([]);
  });
});

describe('App and the plugins', () => {
  it('App.tsx makes no plugin itself: a new one is a line in createIsland (src/game/plugins/index.ts)', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    const made = [...app.matchAll(/^import \{[^}]*\} from '\.\/game\/plugins\/(\w+)';/gm)].map((m) => m[1]);
    expect(made, `App.tsx imports plugin(s) ${made.join(', ')}: add them to createIsland in src/game/plugins/index.ts instead (an import type is fine)`).toEqual([]);
  });
});
