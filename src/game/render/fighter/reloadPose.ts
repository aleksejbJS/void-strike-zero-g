// How a reload moves the gun: the barrel dips down-forward and is pulled to the chest,
// held low, then raised back to the aim. Pure math for solvePose.

import type { FighterState } from './fighterPose';

const RELOAD_ANGLE = 0.95;        // lowest barrel angle while reloading (radians, positive = down)
const RELOAD_ANGLE_PRONE = 0.15;  // lying on the deck the barrel would dig into it: barely lowered
export const RELOAD_PULL = 3;     // how much closer to the chest the gun comes (rig units)
const DOWN_END = 0.25;            // the gun is all the way down at 25 % of the reload...
const UP_START = 0.75;            // ...and starts coming back up at 75 %

/** 0 = aiming as usual, 1 = fully lowered; `progress` is the reload's 0..1, unset when not reloading. */
export const reloadDip = (progress: number | undefined): number => {
    if (progress === undefined) return 0;
    const ramp = progress < DOWN_END ? progress / DOWN_END
        : progress > UP_START ? (1 - progress) / (1 - UP_START)
            : 1;
    const k = Math.max(0, Math.min(1, ramp));
    return k * k * (3 - 2 * k); // smoothstep: no snap at either end
};

/** The barrel angle a fully lowered gun takes in this stance. */
export const reloadAngle = (state: FighterState): number => (state === 'prone' ? RELOAD_ANGLE_PRONE : RELOAD_ANGLE);
