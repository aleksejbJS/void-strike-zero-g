// Station theme (default map): hull with windows onto a planet, girders, cargo, warm lamps.

import { SceneTheme } from '../sceneTheme';
import { bakeContainer, bakeMidTile, bakePlanet, bakeStarTile, bakeWallTile } from '../stationBackdrop';
import { bakePlatform } from '../stationPlatforms';
import { BACKDROP_CONTAINERS, STATION_AD_PLACES } from '../adPlaces';

export const stationTheme = (): SceneTheme => ({
    far: () => bakeStarTile(),
    hero: { bake: () => bakePlanet(), at: { x: 520, y: -380 } },
    wall: () => bakeWallTile(),
    mid: () => bakeMidTile(),
    decor: BACKDROP_CONTAINERS.map(([x, y, w, h, color, label]) => ({ layer: 'mid' as const, x, y, bake: () => bakeContainer(w, h, color, label) })),
    platform: bakePlatform,
    lamps: { color: '#ffc470' },
    beacons: [[717, 150], [1837, 150]],
    adPlaces: STATION_AD_PLACES,
    midOccluders: { tileW: 1120, tileH: 960, rects: [{ x: 140, y: 0, w: 40, h: 960 }, { x: 700, y: 0, w: 40, h: 960 }, { x: 0, y: 165, w: 1120, h: 40 }] },
});
