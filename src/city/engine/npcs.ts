import { distanceField, Tile, type World } from '../world/world';
import { facingFor, fits, step, type Facing, type Vec } from './movement';
import { buildPerson, type Walker } from '../render/sprites';

export interface NeighborVoice {
  name: string;
  lines: string[];
}

/** Default small talk; apps pass their own `voices` to CityGame for their world. */
export const cityVoices: NeighborVoice[] = [
  { name: 'A neighbor', lines: ['Nice day for a walk.'] },
  { name: 'A dog walker', lines: ['He insists on the long way round. Every single time.'] },
  { name: 'A commuter', lines: ['Bus is late again. Gives me time to look around, I guess.'] },
  { name: 'A shopkeeper', lines: ['The Junction is where everybody bumps into everybody.'] },
  { name: 'A jogger', lines: ['Down to Alki and back. The view is the reward.'] },
  { name: 'A kid', lines: ['Did you know there are bald eagles at Lincoln Park?'] },
  { name: 'A stranger', lines: ['Hi!'] },
  { name: 'A grandparent', lines: ['When I was your age the bridge was a drawbridge.'] },
];

export const NPC_PALETTES = {
  hair: ['#2b1d0e', '#6b4a2b', '#e8c170', '#c0392b', '#9a9aa8', '#ff7eb6', '#2ec4b6'],
  skin: ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'],
  shirt: ['#ff5d5d', '#2ec4b6', '#ffd166', '#ff7eb6', '#57cc99', '#3a86ff', '#a77bff', '#ffffff'],
  pants: ['#3d5a99', '#2b2350', '#6b6880', '#57cc99', '#a0522d'],
  shoes: ['#2b2350', '#ffffff', '#ff5d5d'],
};

const SPEED = 2.4; // tiles / second — a stroll
const DIRS: Vec[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export interface Npc {
  id: number;
  pos: Vec;
  dir: Vec;
  facing: Facing;
  walkT: number;
  /** seconds until the next decision */
  timer: number;
  /** frozen while chatting */
  talking: boolean;
  /** stays put */
  still?: boolean;
  /** drawn by a plugin, not the city */
  custom?: boolean;
  /** can't be talked to right now (e.g. flying away) */
  inactive?: boolean;
  voice: NeighborVoice;
  sprite: Walker;
}

/** Tiny seeded PRNG so a given seed always produces the same crowd. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One wander tick. Neighbors stroll in straight lines, pause now and then, and at
 * each decision point pick a direction that is open a tile ahead — so they follow
 * streets and turn at corners rather than pacing into curbs.
 */
export function wander(npc: Npc, dt: number, walkable: (x: number, y: number) => boolean, rand: () => number) {
  if (npc.talking || npc.still) return;
  npc.timer -= dt;
  const blocked = (npc.dir.x || npc.dir.y) && !fits(npc.pos.x + npc.dir.x * 0.6, npc.pos.y + npc.dir.y * 0.6, walkable);
  if (npc.timer <= 0 || blocked) {
    if (!blocked && rand() < 0.25) {
      npc.dir = { x: 0, y: 0 }; // stop and look around
      npc.timer = 0.8 + rand() * 1.8;
    } else {
      const open = DIRS.filter((d) => fits(npc.pos.x + d.x, npc.pos.y + d.y, walkable));
      // Prefer not to double back unless it's a dead end.
      const forward = open.filter((d) => d.x !== -npc.dir.x || d.y !== -npc.dir.y);
      const pool = forward.length ? forward : open;
      npc.dir = pool.length ? pool[Math.floor(rand() * pool.length)] : { x: 0, y: 0 };
      npc.timer = 1.5 + rand() * 4;
    }
  }
  const next = step(npc.pos, npc.dir, dt, SPEED, walkable);
  const moved = next.x !== npc.pos.x || next.y !== npc.pos.y;
  npc.pos = next;
  npc.facing = facingFor(npc.dir, npc.facing);
  npc.walkT = moved ? npc.walkT + dt : 0;
}

/** Scatter neighbors over the road network, crowded toward shops (the Junction, Admiral, Morgan). */
export function spawnNpcs(world: World, count: number, voices: NeighborVoice[] = cityVoices, seed = 7): Npc[] {
  const rand = rng(seed);
  const shopDist = distanceField(world.w, world.h, (i) => world.tiles[i] === Tile.Shop);
  const busy: number[] = [];
  const quiet: number[] = [];
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] !== Tile.Road) continue;
    (shopDist[i] <= 6 ? busy : quiet).push(i);
  }
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const npcs: Npc[] = [];
  for (let n = 0; n < count; n++) {
    const pool = rand() < 0.7 && busy.length ? busy : quiet;
    const i = pick(pool);
    const voice = voices[n % voices.length];
    npcs.push({
      id: n,
      pos: { x: (i % world.w) + 0.5, y: Math.floor(i / world.w) + 0.5 },
      dir: { x: 0, y: 0 },
      facing: 'down',
      walkT: 0,
      timer: rand() * 2,
      talking: false,
      voice,
      sprite: buildPerson({
        h: pick(NPC_PALETTES.hair),
        s: pick(NPC_PALETTES.skin),
        c: pick(NPC_PALETTES.shirt),
        j: pick(NPC_PALETTES.pants),
        b: pick(NPC_PALETTES.shoes),
      }),
    });
  }
  return npcs;
}
