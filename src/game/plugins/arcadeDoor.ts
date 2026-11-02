import { TS, type CityGame, type CityPlugin, type Target } from '../../city';
import { FACES } from '../../city/world/storefronts';
import { ARCADE_NAME } from '../../content/duckArcade';

/** The block face the arcade stands in, and its tenant there (content: city/world/storefronts.ts). */
const FACE = 'junction-e-south';
const TENANT = 'Duck Arcade';
/** px from the top of the arcade's slice to the middle of its doors (render/facades.ts: ey 30, to h − 13) */
const doorY = (sliceH: number) => 30 + (sliceH - 13 - 30) / 2;

/**
 * The Duck Arcade's front door, on the California side of its building: walk up and press
 * {A} to go inside (the app opens the arcade interior). Found from the block face's layout,
 * so it follows the arcade if the storefront list changes.
 */
export class ArcadeDoor implements CityPlugin {
  door: { x: number; y: number } | null = null;

  attach(game: CityGame) {
    const lm = game.world.landmarks.find((l) => l.id === FACE);
    const face = FACES[FACE];
    if (!lm || !face) return;
    const tenants = face.buildings.flatMap((b) => b.tenants);
    const total = tenants.reduce((a, t) => a + (t.weight ?? 1), 0);
    const unit = (lm.h * TS) / total;
    let acc = 0;
    for (const t of tenants) {
      const y0 = Math.round(acc * unit);
      acc += t.weight ?? 1;
      if (t.name !== TENANT) continue;
      const y1 = Math.round(acc * unit);
      const y = lm.y + (y0 + doorY(y1 - y0)) / TS;
      // on the sidewalk just outside the doors (the face's street side is its west edge)
      this.door = game.world.nearestWalkable(lm.x - 0.2, y);
      return;
    }
  }

  targets(): Target[] {
    if (!this.door) return [];
    return [
      {
        key: 'arcade:door',
        kind: 'arcade',
        x: this.door.x,
        y: this.door.y,
        label: { name: ARCADE_NAME, where: 'duck games inside', verb: 'go in' },
      },
    ];
  }
}
