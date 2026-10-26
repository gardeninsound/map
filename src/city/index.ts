/**
 * The city: Bear Island's own copy of the walkable pixel-art West Seattle, taken from
 * west-seattle-map v0.1.0 and maintained here independently (that project has moved on
 * separately — port anything you want from it by hand).
 *
 *   const world = createWorld();
 *   const game = new CityGame(canvas, world, { start, plugins, events });
 *   game.start();
 *
 * The app adds its own things (art spots, characters, sounds…) as `CityPlugin`s and renders
 * the React HUD pieces from ./ui. Styles: ./ui/ui.css; fonts: "Press Start 2P", "Pixelify Sans".
 */
export { createWorld, distanceField, isBuilding, isWalkableTile, markerSpot, Tile } from './world/world';
export type { DrawnBuilding, MapLabel, ParkFeature, PlacedLandmark, RoadLine, Storefront, TileCode, World } from './world/world';

export { CityGame, zoomFor } from './engine/CityGame';
export type { CityGameEvents, CityGameOptions, CityPlugin, DrawContext, DrawItem, Target } from './engine/CityGame';
export { facingFor, fits, step, FOOT } from './engine/movement';
export type { Facing, Vec } from './engine/movement';
export { cityVoices, NPC_PALETTES, rng, spawnNpcs, wander } from './engine/npcs';
export type { NeighborVoice, Npc } from './engine/npcs';
export { bindKeyboard, buttonLabel, input, isTouch, withButtons } from './engine/input';
export type { Button, Dir } from './engine/input';

export { INK, PAL } from './render/palette';
export { ARROW_N, ARROW_NE, buildArrows, buildPerson, buildSprites, buildWalker, gridToCanvas, hop, noteCanvases } from './render/sprites';
export type { Grid, SpriteSet, Walker } from './render/sprites';
export { CHUNK, TS, hash } from './render/tileArt';
export { drawLandmark, hasLandmarkSprite, pixelText } from './render/landmarks';

export { DialogBox } from './ui/DialogBox';
export { Minimap, NearbyCard, StreetSign } from './ui/Hud';
export type { MapMarker, MapPlace, MinimapLegend } from './ui/Hud';
export { Compass, nearestSpot, octant } from './ui/Compass';
export type { CompassSpot } from './ui/Compass';
export { TouchPad } from './ui/TouchPad';
export { audioContext, sfx, tone } from './ui/sfx';
