// Arena theme (Hunger Games): a survival show under a dome — stands full of spectators, truss
// rigging, sweeping spotlights. Ad places: two big screens over the stands and an LED ribbon.

import { SceneTheme } from '../sceneTheme';
import { AdPlace, Rect, fit } from '../adPlaces';
import { bakeDomeTile, bakeStandsTile, bakeTrussTile } from './arenaBackdrop';
import { bakeArenaPlatform } from './arenaPlatforms';

export const ARENA_AD_PLACES: AdPlace[] = [
    { id: 'arena.screen-a', layer: 'wall', kind: 'screen', size: '300x250', x: 140, y: 40, ...fit('300x250', 200) },
    { id: 'arena.screen-b', layer: 'wall', kind: 'screen', size: '300x250', x: 1500, y: 60, ...fit('300x250', 200) },
    { id: 'arena.ribbon', layer: 'mid', kind: 'screen', size: '728x90', x: -1100, y: 236, ...fit('728x90', 440) },
];

export const ARENA_DECOR_RECTS: Rect[] = [];

export const arenaTheme = (): SceneTheme => ({
    far: () => bakeDomeTile(),
    wall: () => bakeStandsTile(),
    mid: () => bakeTrussTile(),
    decor: [],
    platform: bakeArenaPlatform,
    spotlights: [[223, 300], [783, 300], [1903, 300], [3023, 300]],
    adPlaces: ARENA_AD_PLACES,
    midOccluders: { tileW: 1120, tileH: 960, rects: [{ x: 200, y: 0, w: 46, h: 960 }, { x: 760, y: 0, w: 46, h: 960 }, { x: 186, y: 300, w: 74, h: 60 }, { x: 746, y: 300, w: 74, h: 60 }] },
});
