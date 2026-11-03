// The stump where a one-legged fighter lost the back leg: a short stub of the thigh ending in a bloody cut.
// Rig space, like the rest of the fighter drawing.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { FighterPose } from './fighterPose';
import { FighterLook, shade } from './fighterLook';
import { OUTLINE, OUTLINE_W, flat, outlinedPoly } from './fighterPaint';
import { LIMB_W } from './fighterStyle';
import { TORN, TORN_CORE } from '../ragdoll/tornFlesh';

const STUMP_LEN = 12;                // under half of the thigh
const STUMP_BACK = 1.1;              // swings the stub backwards (rig -x) so it shows from behind the front leg
const STUMP_W = { hip: 6.2 * LIMB_W, tip: 5.4 * LIMB_W }; // the back thigh's widths
const CUT_DEPTH = 3;                 // how far up the stub the blood reaches
const STUMP_DARK = 0.72;             // the back leg's shade

/** Where the stump ends: from the hip towards the knee the back leg would have, swung a little backwards. */
export const stumpTip = (pose: Pick<FighterPose, 'hip' | 'backLeg'>): Vector2 => {
    const toKnee = { x: pose.backLeg.joint.x - pose.hip.x, y: pose.backLeg.joint.y - pose.hip.y };
    const dir = { x: toKnee.x - STUMP_BACK * Math.hypot(toKnee.x, toKnee.y), y: toKnee.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    return { x: pose.hip.x + (dir.x / len) * STUMP_LEN, y: pose.hip.y + (dir.y / len) * STUMP_LEN };
};

/** The stub in the back leg's colour, a flat bloody cut across its end with a dark middle. */
export const drawStump = (g: Graphics, pose: FighterPose, look: FighterLook) => {
    const { hip } = pose, tip = stumpTip(pose);
    const dx = (tip.x - hip.x) / STUMP_LEN, dy = (tip.y - hip.y) / STUMP_LEN; // along the stub
    const across = (at: Vector2, half: number, along = 0): Vector2 => ({ x: at.x - dy * half - dx * along, y: at.y + dx * half - dy * along });
    const [hw, tw] = [STUMP_W.hip / 2, STUMP_W.tip / 2];
    outlinedPoly(g, [across(hip, hw), across(tip, tw), across(tip, -tw), across(hip, -hw)], shade(look.leg, STUMP_DARK));
    // Blood soaks the end, and the cut face shows a dark middle
    g.poly(flat([across(tip, tw), across(tip, -tw), across(tip, -tw, CUT_DEPTH), across(tip, tw, CUT_DEPTH)])).fill(TORN);
    const [a, b] = [across(tip, tw), across(tip, -tw)];
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: OUTLINE_W, color: OUTLINE });
    const core = across(tip, 0, 0.6);
    g.circle(core.x, core.y, tw * 0.4).fill(TORN_CORE);
};
