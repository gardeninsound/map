/**
 * The idea box: visitors say what they'd love to see added, and each idea becomes a GitHub
 * issue (labelled `suggestion`) on the public repo, through the `wish/` Worker. Words here are
 * drafts; Mike's to rewrite.
 */

export const IDEA_PROMPT = 'What would you love to add in the Garden in Sound?';
export const IDEA_HINT = 'A place, a sound, a character, a game, a memory. Anything!';
/** honest about where it goes: the repo is public */
export const IDEA_PUBLIC = 'Ideas are posted publicly on GitHub.';
/** the optional name field */
export const IDEA_NAME_LABEL = 'Your name (optional)';
export const IDEA_NAME_HINT = 'Shown with your idea. Leave it blank to stay anonymous.';
export const IDEA_NAME_PLACEHOLDER = 'e.g. Sam from Delridge';
export const IDEA_PLACEHOLDER = 'I would love…';
/** the first line becomes "Thank you, Sam!" when a name was given */
export const IDEA_THANKS = ['Thank you!', 'Your idea is planted in the garden.'];

/** must match MIN_LENGTH / MAX_LENGTH in wish/src/issue.ts */
export const IDEA_MIN = 5;
export const IDEA_MAX = 1000;
/** must match NAME_MAX in wish/src/issue.ts */
export const IDEA_NAME_MAX = 60;

/** the `wish/` Worker. `?wish=http://127.0.0.1:8791` points at `npm run dev` there. */
export const IDEA_URL = 'https://wish.gardeninsound.website';

/** Cloudflare Turnstile (in the gardeninsound account). Public by design. */
export const TURNSTILE_SITEKEY = '0x4AAAAAAFz_9Sdm6lG7PzrP';
/** Cloudflare's always-pass test key, for a local Worker (whose secret is the test secret) */
export const TURNSTILE_TEST_SITEKEY = '1x00000000000000000000AA';
