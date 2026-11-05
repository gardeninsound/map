/**
 * The bear in the Duck Arcade (pure, tested): where it stands and walks. After the first game
 * of a visit it's right beside you with a licorice, then it walks off (round the cabinets and
 * the big duck) to play Avocado Drop. Floor coordinates in metres, as in ArcadeScene: x across,
 * z toward the doors. The three.js side (experiences/arcade/ArcadeBear.ts) draws it.
 */

export interface Spot {
  x: number;
  z: number;
}
/** something round on the floor to walk around */
export interface Obstacle extends Spot {
  r: number;
}
export interface Room {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** metres a second, an easy amble */
export const BEAR_SPEED = 1.4;
/** how far to your side it stops to talk */
export const BESIDE = 1.9;
/** the bear's own width, for keeping clear of things */
export const BEAR_R = 0.4;

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);

/** Can the bear walk straight from a to b without bumping into anything? */
export function clearLine(a: Spot, b: Spot, obstacles: Obstacle[]): boolean {
  const n = Math.max(1, Math.ceil(dist(a, b) / 0.1));
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n };
    if (obstacles.some((o) => dist(p, o) < o.r + BEAR_R)) return false;
  }
  return true;
}

/**
 * A path from `from` to `to`: straight if nothing's in the way, else through whichever open
 * spot (`via`, the aisles) makes the shortest clear walk; straight as a last resort.
 */
export function route(from: Spot, to: Spot, obstacles: Obstacle[], via: Spot[]): Spot[] {
  if (clearLine(from, to, obstacles)) return [from, to];
  let best: Spot[] | null = null;
  let bestLen = Infinity;
  const consider = (path: Spot[]) => {
    for (let i = 1; i < path.length; i++) if (!clearLine(path[i - 1]!, path[i]!, obstacles)) return;
    const len = path.slice(1).reduce((s, p, i) => s + dist(path[i]!, p), 0);
    if (len < bestLen) [best, bestLen] = [path, len];
  };
  for (const v of via) consider([from, v, to]);
  if (!best) for (const v of via) for (const w of via) if (v !== w) consider([from, v, w, to]);
  return best ?? [from, to];
}

/** Total length of a path. */
export const pathLength = (path: Spot[]) => path.slice(1).reduce((s, p, i) => s + dist(path[i]!, p), 0);

/** Where the bear is `d` metres along a path, and which way it faces (a yaw: 0 faces +z). */
export function along(path: Spot[], d: number): { pos: Spot; yaw: number; done: boolean } {
  let left = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = dist(a, b);
    if (left <= len && len > 0) {
      const k = left / len;
      return { pos: { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }, yaw: yawTo(a, b), done: false };
    }
    left -= len;
  }
  const end = path[path.length - 1]!;
  const prev = path[path.length - 2] ?? end;
  return { pos: { ...end }, yaw: yawTo(prev, end), done: true };
}

/** The yaw that faces from a toward b (three.js rotation.y, so local +z points at b). */
export const yawTo = (a: Spot, b: Spot) => Math.atan2(b.x - a.x, b.z - a.z);

/**
 * A spot beside you to stand and talk, for a camera at `you` looking along `yaw` (the
 * arcade's: 0 looks toward −z). Your right first, then your left; a little in front, so
 * it's in view as you turn. Kept in the room and clear of everything.
 */
export function besideYou(you: Spot, yaw: number, room: Room, obstacles: Obstacle[]): Spot {
  const look = { x: Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: Math.sin(yaw) };
  const inRoom = (p: Spot) =>
    p.x > room.minX + BEAR_R && p.x < room.maxX - BEAR_R && p.z > room.minZ + BEAR_R && p.z < room.maxZ - BEAR_R;
  const free = (p: Spot) => inRoom(p) && obstacles.every((o) => dist(p, o) >= o.r + BEAR_R);
  for (const side of [1, -1])
    for (const ahead of [0.4, 0, 0.9])
      for (const out of [BESIDE, BESIDE + 0.4]) {
        const p = { x: you.x + right.x * side * out + look.x * ahead, z: you.z + right.z * side * out + look.z * ahead };
        if (free(p)) return p;
      }
  // nowhere tidy: just behind you, in the room
  const back = { x: you.x - look.x * BESIDE, z: you.z - look.z * BESIDE };
  return {
    x: Math.min(room.maxX - BEAR_R, Math.max(room.minX + BEAR_R, back.x)),
    z: Math.min(room.maxZ - BEAR_R, Math.max(room.minZ + BEAR_R, back.z)),
  };
}

/** The camera yaw (arcade convention) that looks from `you` at `at`. */
export const lookYaw = (you: Spot, at: Spot) => Math.atan2(at.x - you.x, -(at.z - you.z));

/** Ease an angle toward a target the short way round, by up to `k` (0..1) of the gap. */
export function easeAngle(from: number, to: number, k: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, Math.max(0, k));
}
