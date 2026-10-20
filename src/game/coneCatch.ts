/**
 * Cone Catch, the chicken's mini game (pure rules, tested). The chicken runs left and right
 * along the grass catching ice cream cones that fall from the sky; a cone that gets past her
 * hits the ground and bursts into flames. Running into a burning fire costs a life — jump
 * over it ({A}). Rocks on the head cost one too; three lives and it's over. A round lasts
 * ROUND seconds, and it all gets faster as it goes.
 * src/experiences/minigames/ConeCatch.tsx draws it and feeds it input.
 */
export const FIELD = { w: 160, h: 120, ground: 104 };
export const ROUND = 30; // seconds
export const FIRE_LIFE = 1.6; // seconds a dropped cone burns
export const FIRE_HOT = 1.25; // seconds of that it can still burn you
export const FIRE_REACH = 6; // px either side of a fire's centre that burns
export const CLEAR = 7; // px off the ground: high enough to clear the flames
export const FLAVORS = 4; // strawberry, mint, vanilla, chocolate
const SPEED = 90; // px / s, the chicken
const CATCH = 9; // px either side of the chicken's centre
const JUMP = 165; // px / s, take-off speed
const GRAVITY = 560; // px / s²  → about 0.6 s in the air, 24 px up
const GRACE = 1; // seconds of blinking after losing a life
const BODY = 14; // px, the chicken's height (for catching mid-jump)

export interface Drop {
  x: number;
  /** the cone's tip (its lowest point) */
  y: number;
  kind: 'cone' | 'rock';
  vy: number;
  flavor: number;
}

export interface Fire {
  x: number;
  /** seconds since it hit the ground */
  age: number;
  flavor: number;
  /** it already took a life (a fire burns you once) */
  burned?: boolean;
}

export interface ConeCatchState {
  x: number;
  /** height off the ground (px) and vertical speed, for jumping */
  z: number;
  vz: number;
  drops: Drop[];
  fires: Fire[];
  score: number;
  lives: number;
  /** seconds of invulnerability left after a hit */
  grace: number;
  /** seconds played */
  t: number;
  /** seconds until the next drop */
  next: number;
  over: boolean;
  /** what happened this tick, for sounds */
  caught: number;
  hit: number;
  burst: number;
  scorched: number;
}

export function newRound(): ConeCatchState {
  return {
    x: FIELD.w / 2, z: 0, vz: 0, drops: [], fires: [], score: 0, lives: 3, grace: 0, t: 0, next: 0.6, over: false,
    caught: 0, hit: 0, burst: 0, scorched: 0,
  };
}

/** Jump, if she's on the ground. Returns whether she took off. */
export function jump(s: ConeCatchState): boolean {
  if (s.over || s.z > 0 || s.vz > 0) return false;
  s.vz = JUMP;
  return true;
}

const hurt = (s: ConeCatchState) => {
  s.lives--;
  s.grace = GRACE;
};

/** Advance the round by `dt` seconds with the chicken pushed `dir` (-1 left, 0, 1 right). */
export function step(s: ConeCatchState, dt: number, dir: number, rand: () => number): ConeCatchState {
  // fires keep burning down even once the round is over
  for (const f of s.fires) f.age += dt;
  s.fires = s.fires.filter((f) => f.age < FIRE_LIFE);
  if (s.over) return s;
  s.caught = 0;
  s.hit = 0;
  s.burst = 0;
  s.scorched = 0;
  s.t += dt;
  s.grace = Math.max(0, s.grace - dt);
  s.x = Math.max(8, Math.min(FIELD.w - 8, s.x + dir * SPEED * dt));
  // jumping
  if (s.z > 0 || s.vz > 0) {
    s.vz -= GRAVITY * dt;
    s.z = Math.max(0, s.z + s.vz * dt);
    if (s.z === 0) s.vz = 0;
  }
  const ramp = Math.min(1, s.t / ROUND); // 0 → 1 over the round
  // new drops come faster and fall faster as the round goes on; rocks start after a few seconds
  s.next -= dt;
  if (s.next <= 0) {
    const rock = s.t > 4 && rand() < 0.18 + ramp * 0.12;
    s.drops.push({
      x: 8 + rand() * (FIELD.w - 16),
      y: -4,
      kind: rock ? 'rock' : 'cone',
      vy: 38 + ramp * 45 + rand() * 15,
      flavor: Math.floor(rand() * FLAVORS),
    });
    s.next = 0.55 - ramp * 0.3;
  }
  // catching: anything that reaches the chicken's body, wherever she is in her jump
  const feet = FIELD.ground - s.z;
  const keep: Drop[] = [];
  for (const d of s.drops) {
    d.y += d.vy * dt;
    if (d.y >= feet - BODY + 4 && d.y <= feet && Math.abs(d.x - s.x) <= CATCH) {
      if (d.kind === 'cone') { s.score++; s.caught++; continue; }
      if (s.grace <= 0) { hurt(s); s.hit++; }
      continue;
    }
    if (d.y >= FIELD.ground + 2) {
      // it hit the grass: a cone goes up in flames, a rock just lands
      if (d.kind === 'cone') { s.fires.push({ x: d.x, age: 0, flavor: d.flavor }); s.burst++; }
      continue;
    }
    keep.push(d);
  }
  s.drops = keep;
  // fires: on the ground in one that's still hot, she's burned (each fire only once)
  if (s.z < CLEAR && s.grace <= 0) {
    for (const f of s.fires) {
      if (!f.burned && f.age < FIRE_HOT && Math.abs(f.x - s.x) <= FIRE_REACH) {
        f.burned = true;
        hurt(s);
        s.scorched++;
        break;
      }
    }
  }
  if (s.lives <= 0 || s.t >= ROUND) s.over = true;
  return s;
}
