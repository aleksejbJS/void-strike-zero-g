// The Pit (tournament duels): the station look in a small closed box, with its own two house posters.
// The posters sit on the wall layer, spread so that both can be seen from the middle of the arena.

import { SceneTheme } from '../sceneTheme';
import { AdPlace, BACKDROP_CONTAINERS, Rect, fit } from '../adPlaces';
import { bakeContainer } from '../stationBackdrop';
import { stationTheme } from './stationTheme';

export const PIT_AD_PLACES: AdPlace[] = [
    { id: 'pit.wall-poster-a', layer: 'wall', kind: 'lightbox', size: '300x250', x: 100, y: 150, ...fit('300x250', 120) },
    { id: 'pit.wall-poster-b', layer: 'wall', kind: 'lightbox', size: '300x250', x: 800, y: 160, ...fit('300x250', 120) },
];

// The station's background cargo stands on a floor at y 800; the Pit's floor is at 1300, so the cargo
// is lowered to stand on it too. That also keeps it below the posters for every camera position.
const CARGO_DROP = 260;
const PIT_CARGO = BACKDROP_CONTAINERS.map(([x, y, w, h, color, label]) => ({ x, y: y + CARGO_DROP, w, h, color, label }));

export const PIT_DECOR_RECTS: Rect[] = PIT_CARGO.map(({ x, y, w, h }) => ({ x, y, w, h }));

export const pitTheme = (): SceneTheme => ({
    ...stationTheme(),
    decor: PIT_CARGO.map(({ x, y, w, h, color, label }) => ({ layer: 'mid' as const, x, y, bake: () => bakeContainer(w, h, color, label) })),
    adPlaces: PIT_AD_PLACES,
});
