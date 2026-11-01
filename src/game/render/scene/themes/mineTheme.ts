// Asteroid mine theme (Tunnels): rock face with timber and bulbs, scaffolding and ducts,
// mine carts with glowing ore, warm lanterns. Ad places: lit boards bolted to the rock,
// a sticker on an ore crate and a hanging LED panel.

import { SceneTheme } from '../sceneTheme';
import { AdPlace, Rect, fit } from '../adPlaces';
import { bakeContainer } from '../stationBackdrop';
import { bakeCaveTile, bakeMineCart, bakeRockWallTile, bakeScaffoldTile } from './mineBackdrop';
import { bakeMinePlatform } from './minePlatforms';

const CRATE = '#5a3d24';

// Same footprint as the station cargo, so the tested ad layout holds here too
const DECOR: (Rect & { kind: 'cart' | 'crate'; label?: string })[] = [
    { x: 430, y: 466, w: 150, h: 74, kind: 'cart' },
    { x: 592, y: 484, w: 112, h: 56, kind: 'crate', label: 'TNT' },
    { x: 1640, y: 466, w: 170, h: 84, kind: 'cart' },
    { x: 1820, y: 486, w: 130, h: 64, kind: 'crate', label: 'ORE-9' },
];

export const MINE_AD_PLACES: AdPlace[] = [
    { id: 'mine.board-a', layer: 'wall', kind: 'lightbox', size: '300x250', x: 180, y: 100, ...fit('300x250', 120) },
    { id: 'mine.board-b', layer: 'wall', kind: 'lightbox', size: '300x250', x: 1180, y: 110, ...fit('300x250', 120) },
    { id: 'mine.crate-decal', layer: 'mid', kind: 'decal', size: '300x100', x: 720, y: 486, ...fit('300x100', 150), carrier: { color: CRATE, label: 'ORE-3' } },
    { id: 'mine.led-panel', layer: 'mid', kind: 'screen', size: '728x90', x: -700, y: 236, ...fit('728x90', 292) },
];

export const MINE_DECOR_RECTS: Rect[] = DECOR;

export const mineTheme = (): SceneTheme => ({
    far: () => bakeCaveTile(),
    wall: () => bakeRockWallTile(),
    mid: () => bakeScaffoldTile(),
    decor: DECOR.map(d => ({
        layer: 'mid' as const, x: d.x, y: d.y,
        bake: () => (d.kind === 'cart' ? bakeMineCart(d.w, d.h) : bakeContainer(d.w, d.h, CRATE, d.label ?? '')),
    })),
    platform: bakeMinePlatform,
    lamps: { color: '#ff9a48' },
    beacons: [[287, 140]],
    adPlaces: MINE_AD_PLACES,
    midOccluders: { tileW: 1120, tileH: 960, rects: [{ x: 280, y: 0, w: 16, h: 960 }, { x: 840, y: 0, w: 16, h: 960 }, { x: 0, y: 144, w: 1120, h: 58 }] },
});
