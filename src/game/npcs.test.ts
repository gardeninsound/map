import { describe, expect, it } from 'vitest';
import { fits } from './movement';
import { rng, wander, type Npc } from './npcs';

const grid = (rows: string[]) => (x: number, y: number) => rows[Math.floor(y)]?.[Math.floor(x)] === '#';

function npcAt(x: number, y: number): Npc {
  return {
    id: 0, pos: { x, y }, dir: { x: 0, y: 0 }, facing: 'down', walkT: 0, timer: 0, talking: false,
    voice: { name: 'test', lines: [] },
    sprite: {} as Npc['sprite'],
  };
}

describe('wander', () => {
  // A plus-shaped intersection.
  const roads = grid([
    '...###...',
    '...###...',
    '#########',
    '#########',
    '...###...',
    '...###...',
  ]);

  it('never leaves the road over a long stroll', () => {
    const npc = npcAt(4.5, 2.5);
    const rand = rng(1);
    for (let i = 0; i < 2000; i++) {
      wander(npc, 1 / 30, roads, rand);
      expect(fits(npc.pos.x, npc.pos.y, roads)).toBe(true);
    }
  });

  it('actually goes somewhere', () => {
    const npc = npcAt(4.5, 2.5);
    const rand = rng(2);
    let far = 0;
    for (let i = 0; i < 600; i++) {
      wander(npc, 1 / 30, roads, rand);
      far = Math.max(far, Math.hypot(npc.pos.x - 4.5, npc.pos.y - 2.5));
    }
    expect(far).toBeGreaterThan(1.5);
  });

  it('stands still while talking', () => {
    const npc = npcAt(4.5, 2.5);
    npc.talking = true;
    npc.dir = { x: 1, y: 0 };
    wander(npc, 1, roads, rng(3));
    expect(npc.pos).toEqual({ x: 4.5, y: 2.5 });
  });
});
