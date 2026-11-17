import { afterEach, describe, expect, it, vi } from 'vitest';
import { store, stored, storedFlag, storedNumber } from './stored';

describe('stored', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  it('remembers strings, numbers and flags', () => {
    store('t.best', 12);
    store('t.on', true);
    store('t.name', 'Sundrop');
    expect([storedNumber('t.best'), storedFlag('t.on'), stored('t.name')]).toEqual([12, true, 'Sundrop']);
    store('t.on', false);
    expect(storedFlag('t.on')).toBe(false);
    expect([storedNumber('t.none'), storedFlag('t.none'), stored('t.none')]).toEqual([0, false, null]);
  });
  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => store('t.best', 3)).not.toThrow();
    expect([storedNumber('t.best'), storedFlag('t.on'), stored('t.x')]).toEqual([0, false, null]);
  });
});
