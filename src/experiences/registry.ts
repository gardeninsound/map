import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ArtLocation } from '../content/locations';

export interface ExperienceProps {
  location: ArtLocation;
  onExit(): void;
}

/**
 * Each art spot gets its own way to explore the work. Scenes are code-split so the
 * map loads fast; add a new one here and point a location's `experience` at it.
 */
export const experiences: Record<string, LazyExoticComponent<ComponentType<ExperienceProps>>> = {
  'wall-turns': lazy(() => import('./WallTurns')),
  'cup-paint': lazy(() => import('./cup/CupPaint')),
};
