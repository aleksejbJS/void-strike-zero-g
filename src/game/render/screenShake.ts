// How hard a blast shakes the camera for the local player: strongest on top of them, nothing
// beyond SHAKE_RANGE. The renderer jitters the world by up to this many world units and lets it
// die down by itself (renderer.ts).

import { Vector2 } from '../../types';

export const MAX_SHAKE = 14;      // world units, a blast at your feet
export const SHAKE_RANGE = 900;   // about half the visible width: off-screen blasts barely move it

export const explosionShake = (blast: Vector2, viewer: Vector2 | undefined, scale = 1): number => {
    if (!viewer) return 0;
    const d = Math.hypot(blast.x - viewer.x, blast.y - viewer.y);
    if (d >= SHAKE_RANGE) return 0;
    const near = 1 - d / SHAKE_RANGE;
    return MAX_SHAKE * Math.max(0.3, scale) * near * near; // falls off fast: only close blasts really hit
};

/** A new blast never weakens a shake already running. */
export const addShake = (current: number, blastShake: number) => Math.max(current, blastShake);
