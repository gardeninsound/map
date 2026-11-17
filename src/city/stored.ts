/**
 * What this browser remembers (localStorage), never throwing: a private window, blocked site data
 * or a full disk just means it isn't remembered. Best scores, the mute switch, your rabbit's look…
 */

/** the saved string, or null (nothing saved, or storage unavailable) */
export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** save it if the browser lets us; otherwise it lasts this visit only */
export function store(key: string, value: string | number | boolean): void {
  try {
    localStorage.setItem(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  } catch {
    /* private mode: forgotten next visit */
  }
}

/** a saved number (a best score, a count), 0 if none */
export const storedNumber = (key: string): number => Number(stored(key)) || 0;

/** a saved yes/no (stored as '1' / '0') */
export const storedFlag = (key: string): boolean => stored(key) === '1';
