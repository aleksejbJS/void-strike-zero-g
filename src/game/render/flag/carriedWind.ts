// How a carried flag reacts to its carrier's motion: hanging behind the back when still,
// streaming against the velocity at full run. The flag is drawn mirrored so that its
// cloth always points to local +x; `side` is that mirror in world terms.

import { Vector2 } from '../../../types';
import { ClothWind } from './flagCloth';

export interface CarriedWind extends ClothWind {
    side: 1 | -1; // world direction the cloth extends to
    lean: number; // pole tilt toward the cloth, rad
}

const FULL_TRAIL_SPEED = 4;  // a full run; `vel` is px per 60 Hz frame (Matter units), so ~240 px/s
const HANG_ANGLE = 1.15;     // below the horizontal when the carrier stands still
const TURN_SPEED = 0.5;      // below this horizontal speed the cloth stays behind the back

export const carriedWind = (vel: Vector2, facing: number): CarriedWind => {
    const s = Math.min(1, Math.hypot(vel.x, vel.y) / FULL_TRAIL_SPEED);
    const side: 1 | -1 = Math.abs(vel.x) > TURN_SPEED ? (vel.x > 0 ? -1 : 1) : (facing > 0 ? -1 : 1);
    // Direction opposite to the velocity, in the mirrored frame (+y down = hanging lower)
    const trail = Math.atan2(-vel.y, Math.abs(vel.x));
    return {
        side,
        angle: HANG_ANGLE + (trail - HANG_ANGLE) * s,
        ampMul: 0.5 + 0.8 * s,
        omegaMul: 0.9 + 1.4 * s,
        lean: 0.12 + 0.28 * s,
    };
};
