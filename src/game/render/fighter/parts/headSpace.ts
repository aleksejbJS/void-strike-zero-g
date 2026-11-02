// Where head parts sit. Ears and visors are drawn in design units (a head of radius 7, like the first
// fighter drawing) and mapped to rig units: the full head, or for a visor in a dome the small face inside.

import { Vector2 } from '../../../../types';
import { HelmetId } from '../../../build/buildParts';
import { HEAD_K, HEAD_R } from '../fighterStyle';

/** The glass dome in rig units around the head origin. The bubble top touches -HEAD_R, like the round head. */
export const DOME = {
    bubble: { x: 0, y: -0.7, r: HEAD_R - 0.7 },
    collar: { x: -6.2, y: 5, w: 12.4, h: 3 },
    face: { x: 0.4, y: 1.9, r: 4.6 },
    glass: 0x7dd3fc,
};

/** The faceted trooper helmet (convex, clockwise), kept inside the HEAD_R box so it stays inside the hitbox. */
export const ANGULAR: Vector2[] = [
    { x: -6.21, y: -6.69 }, { x: 2.39, y: -8.6 }, { x: 8.12, y: -4.3 }, { x: 8.6, y: 3.82 },
    { x: 3.34, y: 7.64 }, { x: -5.26, y: 6.69 }, { x: -8.12, y: 0.96 },
];

export interface HeadSpace {
    at: (x: number, y: number) => Vector2; // design units to rig units
    k: number;                             // rig units per design unit
    u: number;                             // 1 on a full head, smaller on the dome face (for line widths)
}

/** The full head: ears, horns and antennae sit here on every helmet (on a dome they stand on the glass). */
export const HEAD_SPACE: HeadSpace = { at: (x, y) => ({ x: x * HEAD_K, y: y * HEAD_K }), k: HEAD_K, u: 1 };

/** Where a helmet's visor sits: inside a dome it belongs to the small face, elsewhere to the full head. */
export const visorSpace = (helmet: HelmetId): HeadSpace => {
    if (helmet !== 'dome') return HEAD_SPACE;
    const u = DOME.face.r / HEAD_R, k = HEAD_K * u;
    return { at: (x, y) => ({ x: DOME.face.x + x * k, y: DOME.face.y + y * k }), k, u };
};
