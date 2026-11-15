import { describe, expect, it } from 'vitest';
import { findTarget, openFromSearch } from './openLink';

describe('?open= links', () => {
  it('reads each kind of link', () => {
    expect(openFromSearch('')).toBeNull();
    expect(openFromSearch('?open=')).toBeNull();
    expect(openFromSearch('?open=Garden')).toEqual({ kind: 'target', name: 'garden' });
    expect(openFromSearch('?open=scene:rush-hour')).toEqual({ kind: 'scene', id: 'rush-hour' });
    expect(openFromSearch('?open=arcade')).toEqual({ kind: 'arcade', game: null });
    expect(openFromSearch('?open=arcade:quack-hero')).toEqual({ kind: 'arcade', game: 'quack-hero' });
    expect(openFromSearch('?open=ride:whirl')).toEqual({ kind: 'ride', ride: 'whirl' });
    expect(openFromSearch('?open=ride:loop')).toBeNull();
    expect(openFromSearch('?open=minigame:cone-catch')).toEqual({ kind: 'minigame', id: 'cone-catch' });
    expect(openFromSearch('?open=idea')).toEqual({ kind: 'panel', panel: 'idea' });
    expect(openFromSearch('?open=npc:3')).toEqual({ kind: 'target', name: 'npc:3' });
  });

  const t = (key: string, kind: string, name: string) => ({ key, kind, label: { name } });
  const targets = [
    t('garden', 'garden', 'Dragonfly Garden'),
    t('luna:figure8', 'luna', 'The Great Figure Eight'),
    t('luna:whirl', 'luna', 'Giant Whirl'),
    t('npc:4', 'npc', 'The snack crow'),
    t('pony:1', 'pony', 'Buttercup'),
    t('pony:2', 'pony', 'Moonpie'),
  ];

  it('finds a target by key, by its only kind, or by name', () => {
    expect(findTarget(targets, 'luna:whirl')?.key).toBe('luna:whirl');
    expect(findTarget(targets, 'garden')?.key).toBe('garden');
    expect(findTarget(targets, 'crow')?.key).toBe('npc:4');
    expect(findTarget(targets, 'the-great-figure-eight')?.key).toBe('luna:figure8');
    expect(findTarget(targets, 'moonpie')?.key).toBe('pony:2');
    // several of a kind and no name match: the first of them
    expect(findTarget(targets, 'pony')?.key).toBe('pony:1');
    expect(findTarget(targets, 'ferry')).toBeNull();
  });
});
