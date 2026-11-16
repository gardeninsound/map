import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorld, type CityGame, type Target } from '../../city';
import { isActor } from '../actions';
import { createIsland, devHooks, pluginById, pluginList, targetsOf } from '.';
import { Crow } from './crow';

// jsdom has no canvas: portraits draw into a context that does nothing
beforeAll(() => {
  const noop = new Proxy({}, { get: () => () => undefined });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(noop as never);
});

describe('the island: every plugin, by id', () => {
  it('lists them in order, without other rabbits when walking alone', () => {
    const island = createIsland({ visitors: null });
    const list = pluginList(island);
    expect(list[0]).toBe(island.garden);
    expect(list).toContain(island.crow);
    expect(list).not.toContain(null);
    expect(list.length).toBe(Object.keys(island).length - 1);
  });

  it('every plugin that has targets says what {A} does on them (convention 7)', () => {
    for (const p of pluginList(createIsland({ visitors: null }))) {
      if (p.targets) expect(isActor(p), p.constructor.name).toBe(true);
    }
  });

  it('finds a plugin by its id in any case (links are lowercased), and nothing else', () => {
    const island = createIsland({ visitors: null });
    expect(pluginById(island, 'crow')).toBe(island.crow);
    expect(pluginById(island, 'arcadedoor')).toBe(island.arcadeDoor);
    expect(pluginById(island, 'visitors')).toBeUndefined(); // ?solo
    expect(pluginById(island, 'toString')).toBeUndefined();
    expect(pluginById(island, 'nobody')).toBeUndefined();
  });

  it('dev hooks are window.__<id>', () => {
    const island = createIsland({ visitors: null });
    expect(devHooks(island)).toMatchObject({ __crow: island.crow, __race: island.race, __maze: island.maze });
  });

  it("a plugin's own targets: the snack crow, not a street crow", () => {
    const world = createWorld();
    const game = { world, npcs: [], portraitOf: () => '', besideRoad: (p: { x: number; y: number }) => p } as unknown as CityGame;
    const crow = new Crow();
    crow.attach(game);
    const asTarget = (npc: Target['npc'], key: string): Target => ({ key, kind: 'npc', x: 0, y: 0, label: { name: npc!.voice.name, verb: 'say hi' }, npc });
    const street = { ...crow.npc, id: 7 };
    const all = [asTarget(street, 'npc:7'), asTarget(crow.npc, `npc:${crow.npc.id}`)];
    expect(targetsOf(crow, { allTargets: () => all })).toEqual([all[1]]);
  });

});
