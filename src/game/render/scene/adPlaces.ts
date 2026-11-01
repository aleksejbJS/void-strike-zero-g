// Ad places of the station theme: where they are and how they are framed.
// Positions are in their parallax layer's coordinates (see themedScene: screen = pos - camera * depth).

import { AdSize } from './houseAds';

export type AdFrameKind = 'lightbox' | 'decal' | 'screen';
export type AdLayer = 'wall' | 'mid';

export interface AdPlace {
    id: string;          // key in ads.json, e.g. "station.wall-poster-a"
    layer: AdLayer;
    kind: AdFrameKind;
    size: AdSize;        // TrafficStars spot size
    x: number;           // the creative's rectangle in layer coordinates
    y: number;
    w: number;
    h: number;
    carrier?: { color: string; label: string }; // decals: the crate/container they are stuck on
}

export const LAYER_DEPTH: Record<AdLayer, number> = { wall: 0.35, mid: 0.6 };

export const fit = (size: AdSize, w: number) => {
    const [bw, bh] = size.split('x').map(Number);
    return { w, h: Math.round((w * bh) / bw) };
};

// Spread along the map so places on different depths never overlap on screen
// (two layers line up only for camera positions outside the playable area).
export const STATION_AD_PLACES: AdPlace[] = [
    { id: 'station.wall-poster-a', layer: 'wall', kind: 'lightbox', size: '300x250', x: 180, y: 110, ...fit('300x250', 120) },
    { id: 'station.wall-poster-b', layer: 'wall', kind: 'lightbox', size: '300x250', x: 1180, y: 120, ...fit('300x250', 120) },
    { id: 'station.container-decal', layer: 'mid', kind: 'decal', size: '300x100', x: 720, y: 486, ...fit('300x100', 150) },
    { id: 'station.led-panel', layer: 'mid', kind: 'screen', size: '728x90', x: -700, y: 236, ...fit('728x90', 292) },
];

/** The container that carries a decal place (drawn by the scene, the decal goes on its side). */
export const DECAL_CONTAINER = { padX: 10, padTop: 14, padBottom: 16, color: '#3a2f1c', label: 'C-12' };

/** Background cargo on the girder layer: [x, y, w, h, colour, label]. */
export const BACKDROP_CONTAINERS: [number, number, number, number, string, string][] = [
    [430, 470, 150, 70, '#3a2b24', 'VSZ-07'],
    [592, 484, 112, 56, '#24323a', 'O₂'],
    [1640, 466, 170, 84, '#2e3a2a', 'H-04'],
    [1820, 486, 130, 64, '#3a2b24', 'VSZ-11'],
];

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Copies of a repeating tile's rectangles (tile drawn from `origin` every tileW × tileH on
 * screen) that touch the target rectangle — e.g. girders standing in front of a wall poster.
 */
export const tiledRectsIn = (tile: { tileW: number; tileH: number; rects: Rect[] }, origin: { x: number; y: number }, target: Rect): Rect[] => {
    const out: Rect[] = [];
    for (const r of tile.rects) {
        const kx0 = Math.ceil((target.x - origin.x - r.x - r.w) / tile.tileW), kx1 = Math.floor((target.x + target.w - origin.x - r.x) / tile.tileW);
        const ky0 = Math.ceil((target.y - origin.y - r.y - r.h) / tile.tileH), ky1 = Math.floor((target.y + target.h - origin.y - r.y) / tile.tileH);
        for (let kx = kx0; kx <= kx1; kx++) for (let ky = ky0; ky <= ky1; ky++) {
            out.push({ x: origin.x + r.x + kx * tile.tileW, y: origin.y + r.y + ky * tile.tileH, w: r.w, h: r.h });
        }
    }
    return out;
};

/** Where a rectangle on a parallax layer is on screen for this camera. */
export const layerToScreen = (r: Rect, layer: AdLayer, camera: { x: number; y: number }, screenW: number, screenH: number): Rect => {
    const k = LAYER_DEPTH[layer];
    return { x: r.x + screenW / 2 - camera.x * k, y: r.y + screenH / 2 - camera.y * k, w: r.w, h: r.h };
};
