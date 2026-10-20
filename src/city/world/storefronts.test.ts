import { describe, expect, it } from 'vitest';
import { FACES } from './storefronts';
import landmarks from './landmarksData.json';

describe('Junction storefronts', () => {
  it('every block face is placed as a landmark, and every storefronts landmark has a face', () => {
    const ids = landmarks.filter((l) => l.sprite === 'storefronts').map((l) => l.id);
    expect(ids.sort()).toEqual(Object.keys(FACES).sort());
  });

  it.each(Object.entries(FACES))('%s: signs only use letters the pixel font has', (_, face) => {
    for (const b of face.buildings) for (const t of b.tenants) expect(t.sign).toMatch(/^[A-Z0-9&'.\- ]+$/);
  });
});
