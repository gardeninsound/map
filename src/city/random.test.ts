import { describe, expect, it } from 'vitest';
import { intsHash, lehmer, nameHash, rng, stringHash, tileHash } from './random';

// Values taken from each helper before they moved here. They decide how the island looks:
// if one of these changes, houses, trees, fields or scarves change with it.
describe('random: the same numbers forever', () => {
  it('streams', () => {
    const r = rng(7);
    expect([r(), r(), r()]).toEqual([0.011704753153026104, 0.06195825757458806, 0.97690763277933]);
    const l = lehmer(42);
    expect([l(), l()]).toEqual([0.00032870750889587566, 0.5245871020129822]);
  });
  it('hashes', () => {
    expect([tileHash(3, 9), tileHash(-5, 12, 99)]).toEqual([0.5760071771219373, 0.46226790454238653]);
    expect([intsHash(1, 2, 3), intsHash(77)]).toEqual([0.706535835750401, 0.0948063675314188]);
    expect([stringHash('abc'), stringHash('rabbit-9', 5)]).toEqual([96354, 3752458827]);
    expect([nameHash('cone-catch'), nameHash('')]).toEqual([1328927308, 2166136261]);
  });
});
