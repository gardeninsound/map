import { SLOTS } from '../experiences/arcade/ArcadeScene';
import { arcadeGames, BEAR_GAME, DEER_GAME } from './duckArcade';

describe('who plays in the Duck Arcade', () => {
  const placed = arcadeGames.slice(0, SLOTS.length).map((g) => g.id);

  it('the bear and the deer each have a cabinet that stands in the room', () => {
    expect(placed).toContain(BEAR_GAME);
    expect(placed).toContain(DEER_GAME);
  });

  it('they play different games', () => {
    expect(DEER_GAME).not.toBe(BEAR_GAME);
  });
});
