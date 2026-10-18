import { describe, expect, it } from 'vitest';
import type { PlacedLocation } from '../game/Game';
import { nearestOpenSpot, octant } from './Compass';

const spot = (id: string, x: number, y: number, experience?: string) => ({ id, x, y, experience }) as PlacedLocation;

describe('compass', () => {
  it('maps bearings to 8 directions (0 = north, clockwise; y grows south)', () => {
    expect(octant(0)).toBe(0);
    expect(octant(Math.PI / 4)).toBe(1);
    expect(octant(Math.PI / 2)).toBe(2);
    expect(octant(Math.PI)).toBe(4);
    expect(octant(-Math.PI / 2)).toBe(6);
    expect(octant(-Math.PI / 4 + 0.1)).toBe(7);
  });

  it('points at the nearest spot that has a scene, ignoring coming-soon ones', () => {
    const places = [spot('soon', 1, 0), spot('far', 0, -50, 'x'), spot('near', 10, 0, 'y')];
    const n = nearestOpenSpot(places, 0, 0)!;
    expect(n.loc.id).toBe('near');
    expect(octant(n.angle)).toBe(2); // due east
    expect(octant(nearestOpenSpot([places[1]], 0, 0)!.angle)).toBe(0); // y = -50 is north
  });
});
