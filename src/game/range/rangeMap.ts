// The test range (#range): a small closed room with a cover row on the floor and five dummies on rising ledges.
// Interior is x 0..1500 and y 0..800 with the floor top at y 800; the 1600 x 900 view centred on RANGE_CAMERA shows
// every wall-to-wall target, the floor above the HUD's weapon bar. Platforms are top-left rectangles; spawns, cover and dummy spots use
// pos = (centre x, bottom y).

import type { Platform, Vector2 } from '../../types';
import type { CoverEntry } from '../cover/coverLayouts';

const WIDTH = 1500;
const FLOOR_Y = 800;

const WALL = '#1e293b';
const FLOOR = '#334155';
const LEDGE = '#475569';

type PlatformDef = Omit<Platform, 'id'>;

// Floor, ceiling and both walls, 200 thick (like PIT_WALLS), so the interior is a closed box
const RANGE_WALLS: PlatformDef[] = [
    { x: -200, y: FLOOR_Y, w: WIDTH + 400, h: 300, color: FLOOR },
    { x: -200, y: -200, w: WIDTH + 400, h: 200, color: WALL },
    { x: -200, y: -200, w: 200, h: 1300, color: WALL },
    { x: WIDTH, y: -200, w: 200, h: 1300, color: WALL },
];

/** Where the player stands when the range opens (feet position). */
export const RANGE_SPAWN: Vector2 = { x: 150, y: FLOOR_Y };

/**
 * Where the fixed range camera looks: the room's horizontal centre, and lower than its middle (400) so the floor is drawn
 * above the weapon bar at the bottom of the page. At 1512 x 700 (zoom 0.78) the floor lands at screen y 576, 20 px above
 * the bar's top (596), and the Cat dummy's readout top at about 31; only the empty strip under the ceiling is cut off.
 * rangeMap.test.ts checks both edges at 1512 x 700 and 1920 x 1080.
 */
export const RANGE_CAMERA: Vector2 = { x: WIDTH / 2, y: 510 };

/** One piece of each cover kind in a row on the floor, nearer than the dummies; y is the floor top. */
export const RANGE_COVER: CoverEntry[] = [
    ['wood', 500, FLOOR_Y],
    ['metal', 650, FLOOR_Y],
    ['glass', 800, FLOOR_Y],
    ['barrel', 1000, FLOOR_Y],
];

/**
 * One dummy per body preset, each on its own ledge of a rising staircase (feet positions). A shot from
 * the spawn (150, 750) to a dummy's chest rises gently, so on one shared level every nearer dummy would
 * stand in the line to the farther ones. Each step is 110 px higher than the one before, so the line to
 * every dummy clears every nearer dummy, ledge and cover piece by at least 20 px (rangeMap.test.ts checks
 * 15 px, the dummies' damage boxes included).
 */
export const DUMMY_SPOTS: { skinId: string; pos: Vector2 }[] = [
    { skinId: 'base-human', pos: { x: 1160, y: 680 } },
    { skinId: 'base-female', pos: { x: 1230, y: 570 } },
    { skinId: 'base-robot', pos: { x: 1300, y: 460 } },
    { skinId: 'base-toxic', pos: { x: 1370, y: 350 } },
    { skinId: 'base-cat', pos: { x: 1440, y: 240 } },
];

// Narrow ledges, one under each dummy: nothing but the dummy itself stands in a line of fire
const LEDGE_W = 50;
const LEDGE_H = 30;
const DUMMY_LEDGES: PlatformDef[] = DUMMY_SPOTS.map(({ pos }) => (
    { x: pos.x - LEDGE_W / 2, y: pos.y, w: LEDGE_W, h: LEDGE_H, color: LEDGE }
));

export const RANGE_PLATFORMS: Omit<Platform, 'id'>[] = [...RANGE_WALLS, ...DUMMY_LEDGES];
