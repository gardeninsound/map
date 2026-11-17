/**
 * Dates as the story log tells them, in West Seattle's time zone: shared by the /story/ page
 * (model.ts) and the recorder (scripts/story/lib.mjs, plain Node), so both say the same day.
 * Types: dates.d.mts.
 */
const TZ = 'America/Los_Angeles';

/** the West Seattle calendar day, YYYY-MM-DD */
export const seattleDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
/** "Nov 14, 2026" */
export const dateLabel = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ });
/** "Sat, Nov 14" */
export const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });
/** whole days from a to b (negative if b is earlier) */
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
/** whole days from a wish to the change that answered it (never negative) */
export const waitDays = (asked, live) => Math.max(0, daysBetween(asked, live));
