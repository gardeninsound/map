/**
 * What pressing {A} on something does, as data. A plugin that's an `Actor` answers `act(target)`
 * for its own targets with an `Action`; App runs it (`runAction` there turns it into the dialog,
 * ride… overlay). So a new character's conversation lives with the character, not in App.tsx,
 * and a test can walk it: `pick(action, 'Yes!')` follows a choice.
 *
 * Kept small on purpose: what the overlays can show. `do` is the escape hatch for a side effect
 * that isn't an overlay (climbing into the rowboat; petting Ham, then his reply), never for opening
 * a screen. Something new to show (another mini game, a new kind of screen): add it here, plus one
 * case in App's `runAction` (src/game/CLAUDE.md, "Something new on screen").
 */
import type { Target } from '../city';

export type Choice = { label: string; next: Action };

/** what a mini game hands back when you leave it */
export type GameResult = { score: number; best: number };

export type Action =
  /** a dialog: lines, optionally choices (each leads to another action), and what follows the last line */
  | { kind: 'talk'; speaker?: string; portrait?: string; lines: string[]; choices?: Choice[]; then?: Action }
  /** one of Luna Park's rides */
  | { kind: 'ride'; ride: 'figure8' | 'whirl' }
  /** a character's mini game (App's minigame overlay); `then` gets the score, e.g. for a closing line */
  | { kind: 'minigame'; game: 'cone-catch'; then?: (result: GameResult) => Action }
  /** inside the Duck Arcade */
  | { kind: 'arcade' }
  /** an art spot's scene, by the spot's id */
  | { kind: 'scene'; spot: string }
  /** open (or close) the SAY picker, to emote at another rabbit */
  | { kind: 'emotes' }
  /** back to the map */
  | { kind: 'close' }
  /** something to do that isn't an overlay, then optionally another action */
  | { kind: 'do'; run(): void; then?: Action };

/** a plugin that says what {A} does on its targets (null: not mine) */
export interface Actor {
  act(target: Target): Action | null;
}

export const isActor = <T,>(p: T): p is T & Actor => typeof (p as Partial<Actor> | null)?.act === 'function';

/** a dialog, with the fields left out when empty */
export const talk = (speaker: string | undefined, lines: string[], more: Omit<Extract<Action, { kind: 'talk' }>, 'kind' | 'speaker' | 'lines'> = {}): Action => ({
  kind: 'talk',
  ...(speaker ? { speaker } : {}),
  lines,
  ...more,
});

export const close: Action = { kind: 'close' };

/** For tests: the action a choice leads to, by its label. Throws if there's no such choice. */
export function pick(a: Action | null, label: string): Action {
  const c = a?.kind === 'talk' ? a.choices?.find((x) => x.label === label) : undefined;
  if (!c) throw new Error(`no choice "${label}"`);
  return c.next;
}
