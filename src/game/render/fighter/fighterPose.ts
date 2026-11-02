// Where every joint of a fighter is for one frame. Pure math, no drawing.
// Rig space: feet on y = 0, facing right, y grows downward; the view scales it by RIG_SCALE.

import { Vector2 } from '../../../types';
import { solveLimb, Limb } from './ik';
import { GripPoints } from './weaponGrips';
import { BOOT, HEAD_R, ROBOT_HEAD_K, TORSO_W } from './fighterStyle';
import { FighterStyle } from './fighterLook';

export const RIG_SCALE = 1.12;
export const THIGH = 14.5;
export const SHIN = 14.5;
export const UPPER_ARM = 11.5;
export const FOREARM = 11.5;
const STRIDE = 11;     // how far a foot travels forward/back from the hip while running
const STEP_LIFT = 7;
const ANKLE_Y = -2.5;
const CROUCH_TILT = 0.1; // largest head tilt while crouched (radians)
const GRIP_REACH = 3;  // the rear hand sits this far down the barrel from the chest

export type FighterState = 'idle' | 'run' | 'fly' | 'fall' | 'crouch';

export interface PoseInput {
    state: FighterState;
    aim: number;       // aim angle with the fighter facing right (radians, 0 = forward, negative = up)
    t: number;         // seconds, drives breathing and sway
    phase: number;     // run cycle phase (radians)
    moveDir: number;   // 1 running forward, -1 backpedalling
    recoil: number;    // 0..1, kicks the weapon back
    grip: GripPoints;
}

export interface FighterPose {
    hip: Vector2;
    lean: number;
    lift: number;
    frontLeg: Limb;
    backLeg: Limb;
    frontArm: Limb;
    backArm: Limb;
    shoulderFront: Vector2;
    shoulderBack: Vector2;
    head: Vector2;
    headTilt: number;
    gunTopLeft: Vector2; // where the weapon picture's top-left corner goes
    gunAngle: number;
}

/** Point in the upper-body frame (relative to the hip, before lean) → rig space. */
export const upperPoint = (pose: Pick<FighterPose, 'hip' | 'lean' | 'lift'>, x: number, y: number): Vector2 => {
    const yy = y - pose.lift;
    const c = Math.cos(pose.lean), s = Math.sin(pose.lean);
    return { x: pose.hip.x + x * c - yy * s, y: pose.hip.y + x * s + yy * c };
};

const lowerBody = (input: PoseInput) => {
    const breath = Math.sin(input.t * 2.2);
    switch (input.state) {
        case 'run': {
            const foot = (ph: number) => ({ x: STRIDE * Math.sin(ph), y: ANKLE_Y - Math.max(0, Math.cos(ph) * input.moveDir) * STEP_LIFT });
            return {
                hip: { x: 0, y: -30.5 + Math.abs(Math.cos(input.phase)) * 1.6 - 0.8 },
                lean: input.moveDir >= 0 ? 0.16 : -0.06,
                feet: [foot(input.phase), foot(input.phase + Math.PI)],
                lift: 0,
            };
        }
        case 'fly':
        case 'fall': {
            const sway = Math.sin(input.t * 3) * 1.2;
            const tuck = input.state === 'fly' ? 0 : 2;
            return {
                hip: { x: 0, y: -30.5 },
                lean: input.state === 'fly' ? 0.1 : 0.04,
                feet: [{ x: -1 + sway + tuck, y: -8 + tuck }, { x: -8 + sway, y: -5 + tuck }],
                lift: 0,
            };
        }
        case 'crouch':
            return { hip: { x: -3, y: -12 }, lean: 0.4, feet: [{ x: 8, y: ANKLE_Y }, { x: -7, y: ANKLE_Y }], lift: 0 };
        default:
            return {
                hip: { x: 0, y: -30.5 + breath * 0.25 },
                lean: 0.03,
                feet: [{ x: 4, y: ANKLE_Y }, { x: -3.5, y: ANKLE_Y }],
                lift: breath * 0.35,
            };
    }
};

export const solvePose = (input: PoseInput): FighterPose => {
    const { hip, lean, feet, lift } = lowerBody(input);
    const frame = { hip, lean, lift };
    const forward = (j: Vector2) => j.x;
    const lower = (j: Vector2) => j.y;

    // Weapon: barrel along the aim, kicked back and up by recoil
    const gunAngle = input.aim - input.recoil * 0.16;
    const d = { x: Math.cos(gunAngle), y: Math.sin(gunAngle) };
    const n = { x: -d.y, y: d.x };
    const chest = upperPoint(frame, 5, -13.5);
    const slide = GRIP_REACH - input.recoil * 3.5 - input.grip.grip.x; // picture's left edge along the barrel
    const onGun = (gx: number, gy: number) => ({
        x: chest.x + d.x * (gx + slide) + n.x * (gy - input.grip.axisY),
        y: chest.y + d.y * (gx + slide) + n.y * (gy - input.grip.axisY),
    });

    // A crouched head stays nearly level so the head box does not swing out of the crouch hitbox
    const aimTilt = Math.max(-0.45, Math.min(0.45, input.aim * 0.45)) + lean * 0.5;
    const tilt = input.state === 'crouch' ? Math.max(-CROUCH_TILT, Math.min(CROUCH_TILT, aimTilt)) : aimTilt;

    const shoulderFront = upperPoint(frame, 2.5, -19);
    const shoulderBack = upperPoint(frame, -2.5, -19);
    const g = input.grip;

    // Long weapons: when the foregrip is out of reach, the front hand holds the barrel closer in
    const reach = UPPER_ARM + FOREARM - 0.2;
    let foreX = g.fore.x;
    while (foreX > g.grip.x && Math.hypot(onGun(foreX, g.fore.y).x - shoulderBack.x, onGun(foreX, g.fore.y).y - shoulderBack.y) > reach) foreX -= 0.5;
    return {
        hip, lean, lift,
        frontLeg: solveLimb(hip, feet[0], THIGH, SHIN, forward),
        backLeg: solveLimb(hip, feet[1], THIGH, SHIN, forward),
        frontArm: solveLimb(shoulderFront, onGun(g.grip.x, g.grip.y - 1), UPPER_ARM, FOREARM, lower),
        backArm: solveLimb(shoulderBack, onGun(foreX, g.fore.y + 0.5), UPPER_ARM, FOREARM, lower),
        shoulderFront,
        shoulderBack,
        head: upperPoint(frame, 2.2, -27.5),
        headTilt: tilt,
        gunTopLeft: onGun(0, 0),
        gunAngle,
    };
};

/** The corners of the head shape (the robot's box, rotated by the head tilt; a circle's extreme points otherwise). */
const headOutline = (pose: FighterPose, style: FighterStyle): Vector2[] => {
    const { head, headTilt } = pose;
    if (style !== 'robot') {
        return [{ x: head.x - HEAD_R, y: head.y - HEAD_R }, { x: head.x + HEAD_R, y: head.y + HEAD_R }];
    }
    const k = ROBOT_HEAD_K, c = Math.cos(headTilt), s = Math.sin(headTilt);
    const corner = (x: number, y: number) => ({ x: head.x + x * k * c - y * k * s, y: head.y + x * k * s + y * k * c });
    return [corner(-6, -6.5), corner(7, -6.5), corner(7, 5.5), corner(-6, 5.5)];
};

/**
 * How far the body reaches from the feet line and the centre line, in rig units.
 * `left` and `top` are negative. The weapon is left out on purpose: it may leave the hitbox.
 */
export const bodyExtents = (pose: FighterPose, style: FighterStyle = 'human'): { left: number; right: number; top: number } => {
    const shoulderReach = 7.6 * TORSO_W;
    const jetpack = [upperPoint(pose, -12.5, -17), upperPoint(pose, -12.5, -3)];
    const boots = [pose.frontLeg.end, pose.backLeg.end];
    const head = headOutline(pose, style);
    const xs = [
        ...head.map(p => p.x),
        pose.shoulderFront.x - shoulderReach, pose.shoulderFront.x + shoulderReach,
        pose.shoulderBack.x - shoulderReach, pose.shoulderBack.x + shoulderReach,
        ...boots.flatMap(b => [b.x - BOOT.heel, b.x + BOOT.w - BOOT.heel]),
        ...jetpack.map(p => p.x),
    ];
    const ys = [...head.map(p => p.y), pose.shoulderFront.y, pose.shoulderBack.y, ...jetpack.map(p => p.y)];
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys) };
};
