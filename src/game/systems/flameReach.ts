// Where the flame stream stops: the first platform or intact piece of cover on its way. Shared by the
// simulation (flamethrower.ts: who and what it burns) and the display (the drawn stream ends at the same wall).

import type { GameState, Vector2 } from '../../types';
import { segmentRectEntry } from '../utils/math';
import type { Cover } from '../cover/coverTypes';
import { firstCoverOnSegment } from '../cover/coverGeometry';

/** Where a ray stops: `t` is the fraction of its length, `cover` the piece that stopped it (none for a platform or open air). */
export interface RayStop {
    t: number;
    cover: Cover | null;
}

/** The ray origin → end ends at the first platform or intact piece of cover; a tie goes to the platform. */
export const rayStop = (state: Pick<GameState, 'platforms' | 'cover'>, origin: Vector2, end: Vector2): RayStop => {
    let t = 1;
    for (const plat of state.platforms) {
        const platT = segmentRectEntry(origin, end, plat);
        if (platT !== null && platT < t) t = platT;
    }
    const hit = firstCoverOnSegment(state, origin, end);
    if (hit && hit.t < t) return { t: hit.t, cover: hit.cover };
    return { t, cover: null };
};

/** How far (px, at most `range`) a flame from `origin` along `angle` (radians) gets before a wall or a piece of cover. */
export const flameReach = (state: Pick<GameState, 'platforms' | 'cover'>, origin: Vector2, angle: number, range: number): number =>
    rayStop(state, origin, { x: origin.x + Math.cos(angle) * range, y: origin.y + Math.sin(angle) * range }).t * range;
