import { GameMode, MapId, Platform, Vector2 } from '../../../types';

export const LAST_STOP_WIDTH = 4800;
export const LAST_STOP_HEIGHT = 1800;
export const LAST_STOP_ART_HEIGHT = 2048;
export const LAST_STOP_PLAYER_COUNT = 8;

export const isLastStop = (mode: GameMode | undefined, map: MapId | undefined) =>
    mode === GameMode.DEATHMATCH && map === MapId.LAST_STOP;

// Preserve the original prototype grid for established pickup and spawn positions.
const SCALE_X = LAST_STOP_WIDTH / 1774;
const SCALE_Y = LAST_STOP_HEIGHT / 780;

export const mapPoint = (x: number, y: number): Vector2 => ({
    x: Math.round(x * SCALE_X),
    y: Math.round(y * SCALE_Y),
});

export const LAST_STOP_MATERIALS = {
    earth: '#432d26',
    masonry: '#733a2d',
    steel: '#62522d',
    roof: '#794430',
    boundary: '#281f1c',
    pump: '#a6503d',
    cabinet: '#b08340',
};

type Material = keyof typeof LAST_STOP_MATERIALS;
type Slab = [left: number, top: number, right: number, bottom: number, material: Material];

const slabs: Slab[] = [
    // Street and tunnel ceiling. Gaps between these groups form the three shafts.
    [0, 491, 107, 825, 'earth'],
    [220, 491, 404, 584, 'earth'],
    [404, 521, 544, 584, 'earth'],
    [544, 521, 735, 608, 'earth'],
    [735, 515, 832, 633, 'earth'],
    [958, 515, 1060, 633, 'earth'],
    [1060, 525, 1248, 611, 'earth'],
    [1248, 525, 1396, 578, 'earth'],
    [1396, 501, 1544, 578, 'earth'],
    [1669, 491, 1774, 825, 'earth'],

    // Underground floor steps and permanent obstacles.
    [107, 765, 530, 825, 'earth'],
    [530, 780, 1190, 825, 'earth'],
    [1190, 769, 1211, 825, 'masonry'],
    [1211, 752, 1234, 825, 'masonry'],
    [1234, 736, 1258, 825, 'masonry'],
    [1258, 738, 1391, 825, 'earth'],
    [1391, 755, 1669, 825, 'earth'],
    [530, 690, 560, 780, 'masonry'],
    [1088, 629, 1253, 679, 'steel'],
    [1405, 697, 1475, 755, 'masonry'],

    // Ledges leave free vertical space on the other side of each shaft.
    [107, 610, 158, 623, 'steel'],
    [171, 680, 220, 693, 'steel'],
    [832, 588, 876, 602, 'steel'],
    [914, 682, 958, 695, 'steel'],
    [1617, 610, 1669, 623, 'steel'],
    [1544, 682, 1592, 695, 'steel'],

    // Ground-level walls, plinths and intermediate approaches.
    [223, 421, 256, 491, 'masonry'],
    [402, 486, 442, 521, 'masonry'],
    [442, 464, 484, 521, 'masonry'],
    [484, 450, 544, 521, 'masonry'],
    [512, 394, 547, 407, 'steel'],
    [547, 310, 704, 521, 'masonry'],
    [729, 455, 812, 515, 'steel'],
    [1018, 479, 1093, 525, 'masonry'],
    [1093, 453, 1135, 525, 'masonry'],
    [1126, 329, 1320, 525, 'steel'],
    [1378, 415, 1423, 501, 'masonry'],
    [1690, 432, 1748, 491, 'steel'],

    // Short roofs and vents provide ways around the taller structures.
    [0, 246, 527, 273, 'roof'],
    [333, 215, 370, 246, 'steel'],
    [651, 280, 1017, 304, 'roof'],
    [846, 212, 965, 280, 'steel'],
    [1029, 364, 1108, 381, 'roof'],
    [1337, 267, 1392, 283, 'steel'],
    [1351, 215, 1461, 237, 'roof'],
    [1461, 164, 1566, 187, 'roof'],
    [1566, 120, 1683, 144, 'roof'],
    [1683, 87, 1774, 111, 'roof'],
];

export const LAST_STOP_PLATFORMS: Omit<Platform, 'id'>[] = [
    { x: -100, y: -100, w: LAST_STOP_WIDTH + 200, h: 100, color: LAST_STOP_MATERIALS.boundary },
    { x: -100, y: 0, w: 100, h: LAST_STOP_HEIGHT + 120, color: LAST_STOP_MATERIALS.boundary },
    { x: LAST_STOP_WIDTH, y: 0, w: 100, h: LAST_STOP_HEIGHT + 120, color: LAST_STOP_MATERIALS.boundary },
    { x: 878, y: 1041, w: 48, h: 92, color: LAST_STOP_MATERIALS.pump },
    { x: 1009, y: 1041, w: 48, h: 92, color: LAST_STOP_MATERIALS.pump },
    { x: 1154, y: 1689, w: 90, h: 76, color: LAST_STOP_MATERIALS.cabinet },
    ...slabs.map(([left, top, right, bottom, material]) => {
        const start = mapPoint(left, top);
        const end = mapPoint(right, bottom);
        return { ...start, w: end.x - start.x, h: end.y - start.y, color: LAST_STOP_MATERIALS[material] };
    }),
];
