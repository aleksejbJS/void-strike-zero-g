// The two halves a railgun cuts a fighter into, drawn like the standing fighter.
// Upper: torso top, head and hanging arms around the neck. Legs: torso bottom and both legs around the hip.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { FighterLook, shade } from '../fighter/fighterLook';
import { boot, hand, jointedLimb, plate, shoulderPad } from '../fighter/fighterParts';
import { BELT } from '../fighter/fighterPaint';
import { LIMB_W, TORSO_W } from '../fighter/fighterStyle';
import { drawHead } from '../fighter/parts/helmets';
import { drawEars } from '../fighter/parts/ears';
import { drawBadge } from '../fighter/parts/badges';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { CutLegs, STANDING_POSE } from './corpsePose';
import { tornEdge } from './tornFlesh';

/** Points below are in the hip frame of fighterPose.ts (hip at 0, neck at y = -19, head at (2.2, -27.5)). */
const NECK_Y = -19;
const HEAD = { x: 2.2, y: -27.5 };
/** The cut runs across the waist, halfway up the torso; the torso outline's edges there. */
const CUT_Y = -9.5;
const CUT_LEFT = -6.4;
const CUT_RIGHT = 6.9;
/** A hanging arm, from the shoulder: elbow straight below, hand a little forward. */
const ELBOW_DROP = 10;
const HAND = { x: 3, y: 19 };
const ARM_DARK = 0.72;
const LEG_DARK = 0.72;

type At = (x: number, y: number) => Vector2;

const arm = (g: Graphics, at: At, shoulderX: number, color: number) => {
    const elbow = at(shoulderX, NECK_Y + ELBOW_DROP), end = at(shoulderX + HAND.x, NECK_Y + HAND.y);
    jointedLimb(g, at(shoulderX, NECK_Y), elbow, end, { widths: [4.8 * LIMB_W, 4.4 * LIMB_W], colors: [color, shade(color, 0.92)] });
    hand(g, end);
};

/** The upper half around the neck: back arm, torso top, shoulder pad and badge, head, front arm, red cut. */
export const drawUpperHalf = (g: Graphics, look: FighterLook) => {
    const at: At = (x, y) => ({ x, y: y - NECK_Y });
    const T: At = (x, y) => at(x * TORSO_W, y);
    arm(g, at, -2.5, shade(look.arm, ARM_DARK));
    plate(g, [T(CUT_LEFT, CUT_Y), T(CUT_RIGHT, CUT_Y), T(7.6, -19.5), T(-6.6, -20)], look.torso);
    shoulderPad(g, at, look.torso);
    drawBadge(g, at, look);
    const head = at(HEAD.x, HEAD.y);
    g.save().translateTransform(head.x, head.y);
    drawEars(g, look, IDLE_PARTS); // behind the head, as on the living fighter
    drawHead(g, look);
    g.restore();
    arm(g, at, 2.5, look.arm);
    tornEdge(g, T(CUT_LEFT, CUT_Y), T(CUT_RIGHT, CUT_Y));
};

/**
 * The legs around the hip: back leg, torso bottom with the belt, front leg, red cut. `legs`: where the
 * knees and ankles are now (cutLegsOf); without them the legs stand as the idle fighter's.
 */
export const drawLegsHalf = (g: Graphics, look: FighterLook, legs?: CutLegs) => {
    const hip = STANDING_POSE.hip;
    const rel = (p: Vector2) => ({ x: p.x - hip.x, y: p.y - hip.y });
    const T: At = (x, y) => ({ x: x * TORSO_W, y });
    const top = { x: 0, y: 0 };
    const back = legs ? { joint: legs.knB, end: legs.anB } : { joint: rel(STANDING_POSE.backLeg.joint), end: rel(STANDING_POSE.backLeg.end) };
    const front = legs ? { joint: legs.knF, end: legs.anF } : { joint: rel(STANDING_POSE.frontLeg.joint), end: rel(STANDING_POSE.frontLeg.end) };
    const legDark = shade(look.leg, LEG_DARK);
    jointedLimb(g, top, back.joint, back.end, { widths: [6.2 * LIMB_W, 5.4 * LIMB_W], colors: [legDark, legDark] });
    boot(g, back.end, 0x1b1f25);
    plate(g, [T(-6.2, 0.5), T(6.2, 0.5), T(CUT_RIGHT, CUT_Y), T(CUT_LEFT, CUT_Y)], look.torso);
    plate(g, [T(-6.4, -1.5), T(6.4, -1.5), T(6.3, 1.5), T(-6.3, 1.5)], BELT);
    jointedLimb(g, top, front.joint, front.end, { widths: [6.4 * LIMB_W, 5.6 * LIMB_W], colors: [look.leg, shade(look.leg, 0.9)] });
    boot(g, front.end, 0x252a32);
    tornEdge(g, T(CUT_LEFT, CUT_Y), T(CUT_RIGHT, CUT_Y));
};
