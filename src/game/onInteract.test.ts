// @vitest-environment node
/**
 * Guard: what {A} does on something belongs in its plugin, as an `act()` returning an Action
 * (src/game/actions.ts), not as a new branch in App.tsx's onInteract. The branches still
 * there are listed below and are being moved out one by one; this test fails if one is added.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** still in App's onInteract, to move into their plugins' act() (shrink this list, never grow it) */
const STILL_IN_APP = ['arcade', 'race', 'boat', 'rabbit', 'place', 'crow', 'chicken', 'ham'];

const HOW = `
  What {A} does goes in the plugin, not in App.tsx:
    1. make the plugin an Actor:  class MyThing implements CityPlugin, Actor
    2. add  act(t: Target): Action | null  — return null for targets that aren't yours, else
       talk(speaker, lines, { portrait, choices: [{ label, next: <another Action> }], then }),
       { kind: 'ride', ride }, { kind: 'minigame', game, then: (r) => … }, close, or { kind: 'do', run() { … } }
    3. test it with pick(action, 'a choice label') (see src/game/actions.test.ts)
  Examples: src/game/plugins/ponies.ts (a simple dialog), lunaPark.ts (choices → a ride).
  More in src/game/CLAUDE.md, "What {A} does is data".`;

function branchesInOnInteract(): string[] {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const start = app.indexOf('onInteract: (t) => {');
  expect(start, 'App.tsx should still have onInteract').toBeGreaterThan(0);
  const end = app.indexOf('\n        },', start);
  const body = app.slice(start, end);
  return [...body.matchAll(/t\.kind === '([a-z]+)'|t\.npc === ([a-zA-Z]+)\.npc/g)].map((m) => m[1] ?? m[2]);
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
