// Where and how a flag stands on the map. Pickup `pos` is not the floor (CTF bases sit
// 30 px above their platform, the Hold the Flag spot 10 px above its pedestal, a drop
// exactly on the carrier's feet), so the foot snaps to the platform just below.

import { Pickup, Platform, Team, Vector2 } from '../../../types';
import { HTF_FLAG_POS } from '../../data/level';

export type GroundFlagKind = 'base' | 'spot' | 'dropped' | 'midair';

export interface GroundFlagPlacement {
    kind: GroundFlagKind;
    foot: Vector2;
    side: 1 | -1; // which way a dropped flag leans, stable per pickup
}

const SNAP_ABOVE = 4;
const SNAP_BELOW = 40;
const SPOT_TOLERANCE = 4;

/** Top of the nearest platform within reach below `pos`, or null in mid-air. */
export const surfaceBelow = (pos: Vector2, platforms: Platform[]): number | null => {
    let best: number | null = null;
    for (const p of platforms) {
        if (pos.x < p.x || pos.x > p.x + p.w) continue;
        if (p.y < pos.y - SNAP_ABOVE || p.y > pos.y + SNAP_BELOW) continue;
        if (best === null || p.y < best) best = p.y;
    }
    return best;
};

const sideFromId = (id: string): 1 | -1 => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return (h & 1) === 0 ? 1 : -1;
};

const atSpot = (pos: Vector2) =>
    Math.abs(pos.x - HTF_FLAG_POS.x) <= SPOT_TOLERANCE && Math.abs(pos.y - HTF_FLAG_POS.y) <= SPOT_TOLERANCE;

export const placeGroundFlag = (item: Pickup, platforms: Platform[]): GroundFlagPlacement => {
    const side = sideFromId(item.id);
    const surface = surfaceBelow(item.pos, platforms);
    if (surface === null) return { kind: 'midair', foot: { x: item.pos.x, y: item.pos.y }, side };
    const foot = { x: item.pos.x, y: surface };
    // Team flags are only ever active at their own base
    if (item.team === Team.BLUE || item.team === Team.RED) return { kind: 'base', foot, side };
    return { kind: atSpot(item.pos) ? 'spot' : 'dropped', foot, side };
};
