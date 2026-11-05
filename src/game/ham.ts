import { fits, step, type Vec } from '../city';

/**
 * Ham the cat: wanders the streets and the alley around the hidden house on 45th Ave SW,
 * never further than `leash` tiles from home. Now and then sits (a loaf) or grooms; when a
 * rabbit comes close Ham stops, sits and looks at it. Pure, so it's tested.
 */
export const HAM = {
  /** tiles / second: a saunter, slower than the neighbors */
  speed: 1.4,
  /** tiles from home before every turn heads back */
  leash: 8,
  /** tiles: a rabbit this close and Ham sits down to look at it */
  notice: 2.2,
};

export type HamMode = 'walk' | 'sit' | 'groom';

export interface HamState {
  pos: Vec;
  dir: Vec;
  mode: HamMode;
  /** seconds until the next decision */
  timer: number;
  /** which way Ham looks (the sprite is side-on when walking) */
  side: 'left' | 'right';
  walkT: number;
}

const DIRS: Vec[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
const still = { x: 0, y: 0 };

export const newHam = (home: Vec): HamState => ({ pos: { ...home }, dir: still, mode: 'sit', timer: 1, side: 'right', walkT: 0 });

/** Where Ham may go from `pos`: open a tile ahead, and back toward home once past the leash. */
export function hamChoices(pos: Vec, home: Vec, walkable: (x: number, y: number) => boolean): Vec[] {
  const open = DIRS.filter((d) => fits(pos.x + d.x, pos.y + d.y, walkable));
  const away = Math.hypot(pos.x - home.x, pos.y - home.y);
  if (away <= HAM.leash) return open;
  const back = open.filter((d) => d.x * (home.x - pos.x) + d.y * (home.y - pos.y) > 0);
  return back.length ? back : open;
}

export function hamTick(
  s: HamState,
  dt: number,
  home: Vec,
  player: Vec | null,
  walkable: (x: number, y: number) => boolean,
  rand: () => number,
  talking = false,
) {
  const near = player && Math.hypot(player.x - s.pos.x, player.y - s.pos.y) < HAM.notice;
  if (talking || near) {
    // stop, sit, look at the rabbit; stay put a moment after it leaves
    s.mode = 'sit';
    s.dir = still;
    s.walkT = 0;
    s.timer = Math.max(s.timer, 1.5);
    if (player && player.x !== s.pos.x) s.side = player.x > s.pos.x ? 'right' : 'left';
    return;
  }
  s.timer -= dt;
  if (s.mode === 'walk') {
    const ahead = { x: s.pos.x + s.dir.x * 0.6, y: s.pos.y + s.dir.y * 0.6 };
    const blocked = !fits(ahead.x, ahead.y, walkable);
    const pastLeash = Math.hypot(ahead.x - home.x, ahead.y - home.y) > HAM.leash && Math.hypot(ahead.x - home.x, ahead.y - home.y) > Math.hypot(s.pos.x - home.x, s.pos.y - home.y);
    if (blocked || pastLeash) s.timer = 0;
  }
  if (s.timer <= 0) {
    const r = rand();
    if (s.mode === 'walk' && r < 0.3) {
      s.mode = 'sit';
      s.dir = still;
      s.timer = 2 + rand() * 4;
    } else if (s.mode === 'walk' && r < 0.42) {
      s.mode = 'groom';
      s.dir = still;
      s.timer = 2 + rand() * 2;
    } else {
      const options = hamChoices(s.pos, home, walkable);
      // rather not double back, unless it's that or nothing
      const forward = options.filter((d) => d.x !== -s.dir.x || d.y !== -s.dir.y);
      const pool = forward.length ? forward : options;
      s.dir = pool.length ? pool[Math.floor(rand() * pool.length)] : still;
      s.mode = pool.length ? 'walk' : 'sit';
      s.timer = 1 + rand() * 3;
    }
  }
  if (s.mode !== 'walk') {
    s.walkT = 0;
    return;
  }
  const next = step(s.pos, s.dir, dt, HAM.speed, walkable);
  s.walkT = next.x !== s.pos.x || next.y !== s.pos.y ? s.walkT + dt : 0;
  s.pos = next;
  if (s.dir.x) s.side = s.dir.x > 0 ? 'right' : 'left';
}
