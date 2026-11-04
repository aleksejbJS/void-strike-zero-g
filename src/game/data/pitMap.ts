// The Pit: the small, mirrored, closed arena of the 1v1 duel mode (tournament matches).
// Interior is x 0..2600 and y 0..1400 with the floor top at y 1300; the mirror axis is x = 1300.
// Platforms are top-left rectangles, spawns are feet positions (pos = centre x, bottom y).

import { ItemType, Pickup, Platform, Vector2 } from '../../types';

const WIDTH = 2600;
const FLOOR_Y = 1300;

const WALL = '#1e293b';
const FLOOR = '#334155';
const LEDGE = '#475569';
const CENTRE = '#64748b';

type PlatformDef = Omit<Platform, 'id'>;

/** The twin of a platform on the other side of the mirror axis. */
const mirrored = (p: PlatformDef): PlatformDef => ({ ...p, x: WIDTH - p.x - p.w });

// Floor, ceiling and both walls, 200 thick, so the interior is a closed box
const PIT_WALLS: PlatformDef[] = [
    { x: -200, y: FLOOR_Y, w: 3000, h: 300, color: FLOOR },
    { x: -200, y: -200, w: 3000, h: 200, color: WALL },
    { x: -200, y: -200, w: 200, h: 1800, color: WALL },
    { x: WIDTH, y: -200, w: 200, h: 1800, color: WALL },
];

// Left tower of ledges and the high ledge beside the centre stack; the right side is their mirror
const LEFT_SIDE: PlatformDef[] = [
    { x: 100, y: 1050, w: 460, h: 30, color: LEDGE },
    { x: 100, y: 750, w: 360, h: 30, color: LEDGE },
    { x: 760, y: 400, w: 260, h: 30, color: LEDGE },
];

// Stacked centre platforms, each centred on the mirror axis
const CENTRE_STACK: PlatformDef[] = [
    { x: 930, y: 1100, w: 740, h: 40, color: CENTRE },
    { x: 1090, y: 850, w: 420, h: 35, color: CENTRE },
    { x: 1170, y: 600, w: 260, h: 30, color: CENTRE },
];

const PIT_LEDGES: PlatformDef[] = [...LEFT_SIDE, ...LEFT_SIDE.map(mirrored), ...CENTRE_STACK];

export const PIT_PLATFORMS: Omit<Platform, 'id'>[] = [...PIT_WALLS, ...PIT_LEDGES];

/** Left and right fighter spawns on the floor (feet position). */
export const PIT_SPAWNS: readonly [Vector2, Vector2] = [{ x: 300, y: FLOOR_Y }, { x: WIDTH - 300, y: FLOOR_Y }];

// Health, armor and ammo on the centre stack: no weapon pickups, everyone has the full loadout.
// Pickups sit 40 px above the platform top, like on the other maps.
export const PIT_PICKUPS: Pickup[] = [
    { id: 'pit_ammo_left', type: ItemType.AMMO, pos: { x: 1120, y: 1060 }, active: true, respawnTime: 0, value: 30 },
    { id: 'pit_ammo_right', type: ItemType.AMMO, pos: { x: 1480, y: 1060 }, active: true, respawnTime: 0, value: 30 },
    { id: 'pit_hp_mid', type: ItemType.HEALTH, pos: { x: 1300, y: 810 }, active: true, respawnTime: 0, value: 25 },
    { id: 'pit_armor_top', type: ItemType.ARMOR, pos: { x: 1300, y: 560 }, active: true, respawnTime: 0, value: 50 },
];

// Top centre of every ledge (the box itself has no waypoints inside its walls), plus the floor every 300 px
const FLOOR_STEP = 300;
const floorPoints: Vector2[] = [];
for (let x = 100; x < WIDTH; x += FLOOR_STEP) floorPoints.push({ x, y: FLOOR_Y - 20 });

export const PIT_WAYPOINTS: Vector2[] = [
    ...PIT_LEDGES.map(p => ({ x: p.x + p.w / 2, y: p.y - 20 })),
    ...floorPoints,
];
