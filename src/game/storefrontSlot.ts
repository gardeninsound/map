import { TS, type PlacedLandmark, type World } from '../city';
import { FACES } from '../city/world/storefronts';

/**
 * A tenant's slice of a Junction block face, in tiles: the landmark it's drawn in and the
 * slice's north/south edges. Same layout as render/storefronts.ts, so it follows the shop if
 * the storefront list changes. The street is on the face's east edge for a west-side face
 * (side 'W'), its west edge for an east-side one.
 */
export function storefrontSlot(world: World, faceId: string, tenant: string): { lm: PlacedLandmark; side: 'W' | 'E'; y0: number; y1: number } | null {
  const lm = world.landmarks.find((l) => l.id === faceId);
  const face = FACES[faceId];
  if (!lm || !face) return null;
  const tenants = face.buildings.flatMap((b) => b.tenants);
  const total = tenants.reduce((a, t) => a + (t.weight ?? 1), 0);
  const unit = (lm.h * TS) / total;
  let acc = 0;
  for (const t of tenants) {
    const y0 = Math.round(acc * unit);
    acc += t.weight ?? 1;
    if (t.name === tenant) return { lm, side: face.side, y0: lm.y + y0 / TS, y1: lm.y + Math.round(acc * unit) / TS };
  }
  return null;
}
