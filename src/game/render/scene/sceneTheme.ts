// What a map theme provides to the shared scene builder: backdrop tiles for each parallax
// depth, one-off decor, how platforms are drawn, lighting, and its in-world ad places.

import { Platform, Vector2 } from '../../../types';
import { AdLayer, AdPlace } from './adPlaces';
import { PlatformPiece } from './stationPlatforms';

export interface DecorPiece {
    layer: AdLayer;
    x: number;
    y: number;
    bake: () => HTMLCanvasElement;
}

export interface SceneTheme {
    far: () => HTMLCanvasElement;                          // repeating, barely moves (stars, deep cave)
    hero?: { bake: () => HTMLCanvasElement; at: Vector2 }; // one big far object (a planet)
    wall: () => HTMLCanvasElement;                         // repeating back wall
    mid: () => HTMLCanvasElement;                          // repeating girders / scaffolding
    decor: DecorPiece[];
    platform: (p: Platform, seed: number, res: number) => PlatformPiece[];
    lamps?: { color: string };                             // hanging lamps over the widest decks
    beacons?: [number, number][];                          // rotating warning lights (mid layer)
    spotlights?: [number, number][];                       // sweeping show lights (mid layer)
    adPlaces: AdPlace[];
    /** Solid parts of the repeating mid tile (girders, pipes) in tile coordinates: they stand
     *  in front of wall ad places, so they are cut out of real banners there. */
    midOccluders?: { tileW: number; tileH: number; rects: { x: number; y: number; w: number; h: number }[] };
}
