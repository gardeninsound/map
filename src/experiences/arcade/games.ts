import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { MiniGameResult } from '../minigames/ConeCatch';

/** Every arcade game gets this: hand back a result when the player leaves it. */
export interface ArcadeGameProps {
  onExit(result: MiniGameResult): void;
}

/**
 * The Duck Arcade's shell: cabinet id (content/duckArcade.ts) → its game, code-split so a
 * game only loads when its cabinet is played. A ready cabinet with no entry here shows as
 * "coming soon".
 */
export const arcadeComponents: Record<string, LazyExoticComponent<ComponentType<ArcadeGameProps>>> = {
  'cone-catch': lazy(() => import('../minigames/ConeCatch')),
  'duck-scroller': lazy(() => import('./DuckScroller')),
};
