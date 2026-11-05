import { along, BEAR_R, besideYou, clearLine, easeAngle, lookYaw, pathLength, route, yawTo, type Obstacle } from './arcadeBear';

const room = { minX: -7, maxX: 7, minZ: -6.5, maxZ: 4.5 };
const duck: Obstacle = { x: 0, z: 0, r: 1.4 };
const aisles = [{ x: 0, z: -3 }, { x: 0, z: 3 }, { x: -3, z: 0 }, { x: 3, z: 0 }];

describe('the arcade bear', () => {
  it('walks straight when nothing is in the way', () => {
    expect(route({ x: -5, z: 3 }, { x: 5, z: 3 }, [duck], aisles)).toHaveLength(2);
  });

  it('goes round the big duck instead of through it', () => {
    const path = route({ x: -5, z: 0 }, { x: 5, z: 0 }, [duck], aisles);
    expect(path.length).toBeGreaterThan(2);
    for (let i = 1; i < path.length; i++) expect(clearLine(path[i - 1]!, path[i]!, [duck])).toBe(true);
  });

  it('follows its path at the given distance, facing the way it walks', () => {
    const path = [{ x: 0, z: 0 }, { x: 0, z: 2 }, { x: 2, z: 2 }];
    expect(pathLength(path)).toBe(4);
    const mid = along(path, 1);
    expect(mid.pos).toEqual({ x: 0, z: 1 });
    expect(mid.yaw).toBeCloseTo(0); // toward +z
    const turn = along(path, 3);
    expect(turn.pos).toEqual({ x: 1, z: 2 });
    expect(turn.yaw).toBeCloseTo(Math.PI / 2); // toward +x
    expect(along(path, 9)).toMatchObject({ pos: { x: 2, z: 2 }, done: true });
  });

  it('stops beside you, clear of the cabinet you were playing', () => {
    // standing 1.7 m in front of a back-wall cabinet, looking at it (yaw 0 looks toward −z)
    const cabinet: Obstacle = { x: -1.5, z: -5.9, r: 0.8 };
    const you = { x: -1.5, z: -4.2 };
    const p = besideYou(you, 0, room, [cabinet]);
    expect(Math.hypot(p.x - cabinet.x, p.z - cabinet.z)).toBeGreaterThanOrEqual(cabinet.r + BEAR_R);
    expect(Math.hypot(p.x - you.x, p.z - you.z)).toBeLessThan(2.6);
    expect(p.x).toBeGreaterThan(you.x); // your right first
  });

  it('tries your left when your right is the wall', () => {
    const you = { x: 6, z: 0 };
    const p = besideYou(you, 0, room, []);
    expect(p.x).toBeLessThan(you.x);
    expect(p.x).toBeGreaterThan(room.minX);
  });

  it('turns your head toward it the short way round', () => {
    expect(lookYaw({ x: 0, z: 0 }, { x: 0, z: -1 })).toBeCloseTo(0);
    expect(lookYaw({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(easeAngle(3, -3, 1)).toBeCloseTo(-3 + Math.PI * 2);
    expect(Math.abs(easeAngle(3, -3, 0.5) - 3)).toBeLessThan(0.3);
    expect(yawTo({ x: 0, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(0);
  });
});
