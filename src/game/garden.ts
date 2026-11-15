/**
 * The seasonal garden (idea box #12; pure, tested): which plantings are out on a given date,
 * how far along each is (budding → full → fading across its months), and the layout of the
 * beds. The plugin (plugins/garden.ts) draws it; plantings and words in content/garden.ts.
 */
import { plantings, type Planting } from '../content/garden';

export interface InBloom {
  plant: Planting;
  /** 0 just up … 1 in full flower … fading after its last month's middle */
  stage: number;
  fading: boolean;
}

/** What's out on `date`: each planting in one of its months, with how far along it is. */
export function inBloom(date: Date): InBloom[] {
  const m = date.getMonth() + 1;
  const into = (date.getDate() - 1) / 30;
  const out: InBloom[] = [];
  for (const plant of plantings) {
    const i = plant.months.indexOf(m);
    if (i < 0) continue;
    // grows through its first month, full after; the last month's second half it fades
    const span = plant.months.length;
    const t = (i + into) / span;
    const stage = Math.min(1, span === 1 ? 0.5 + into : t * 2.2);
    const fading = i === span - 1 && into > 0.5 && span > 1;
    out.push({ plant, stage: Math.max(0.25, stage), fading });
  }
  return out;
}

/** The beds: `n` rows across a garden `w`×`h` tiles, each a strip with a path between. */
export function beds(w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  const out = [];
  for (let y = 0.4; y + 1 <= h - 0.2; y += 1.6) out.push({ x: 0.5, y, w: w - 1, h: 1 });
  return out;
}
