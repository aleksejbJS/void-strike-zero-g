// How to draw a corpse from its points: the fighter pose of a whole body, or where each torn piece lies.
// Pure math, no drawing. Rig space as in fighterPose.ts (facing right, y down, RIG_SCALE smaller than world).

import { Vector2, WeaponType } from '../../../types';
import { Corpse, CorpsePointId } from '../../systems/ragdoll/corpseBody';
import { FighterPose, RIG_SCALE, solvePose, upperPoint } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';

/** The standing fighter every corpse starts from (the head and legs do not depend on the weapon). */
export const STANDING_POSE = solvePose({
    state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip: gripPoints(WeaponType.MACHINE_GUN, 0.23),
});

/** Angle of a vector from straight up, clockwise positive (as Pixi rotates, y down). */
const upAngle = (d: Vector2) => Math.atan2(d.x, -d.y);
const minus = (a: Vector2, b: Vector2) => ({ x: a.x - b.x, y: a.y - b.y });
const middle = (a: Vector2, b: Vector2) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/** An angle brought into (-π, π]. */
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI));

/** Neck → head of the standing fighter, measured from its lean: the head leans forward a little. */
const HEAD_REST = upAngle(minus(STANDING_POSE.head, upperPoint(STANDING_POSE, 0, -19))) - STANDING_POSE.lean;
/** Hip → between the knees of the standing fighter. */
const LEGS_REST = upAngle(minus(middle(STANDING_POSE.frontLeg.joint, STANDING_POSE.backLeg.joint), STANDING_POSE.hip));
/** Straight down: the rest direction of a torn leg's shin. */
const DOWN = Math.PI;

type RigPoints = Record<CorpsePointId, Vector2>;

/** Every point in rig space around the hip: x mirrored for a corpse facing left, divided by RIG_SCALE. */
const rigPoints = (c: Corpse): RigPoints => {
    const hip = c.points.hip;
    const out = {} as RigPoints;
    for (const id of Object.keys(c.points) as CorpsePointId[]) {
        const p = c.points[id];
        out[id] = { x: (p.x - hip.x) * c.facing / RIG_SCALE, y: (p.y - hip.y) / RIG_SCALE };
    }
    return out;
};

const leanOf = (r: RigPoints) => upAngle(minus(r.neck, r.hip));
const headTiltOf = (r: RigPoints) => wrap(upAngle(minus(r.head, r.neck)) - HEAD_REST);

/**
 * A whole corpse as a fighter pose around its hip; `origin` is the world hip. Lift is 0; the gun
 * fields are unused (corpses drop their gun, drawn on its own).
 */
export const poseFromCorpse = (c: Corpse): { pose: FighterPose; origin: Vector2 } => {
    const r = rigPoints(c);
    return {
        origin: { x: c.points.hip.x, y: c.points.hip.y },
        pose: {
            hip: { x: 0, y: 0 }, // the origin
            lean: leanOf(r),
            lift: 0,
            frontLeg: { joint: r.knF, end: r.anF },
            backLeg: { joint: r.knB, end: r.anB },
            frontArm: { joint: r.elF, end: r.haF },
            backArm: { joint: r.elB, end: r.haB },
            shoulderFront: r.shF,
            shoulderBack: r.shB,
            head: r.head,
            headTilt: headTiltOf(r),
            gunTopLeft: r.hip,
            gunAngle: 0,
        },
    };
};

/**
 * A rigid piece of a torn corpse: which shape (ragdollView.ts), where its origin lies in the world and
 * its world rotation. The shape is drawn mirrored for a corpse facing left.
 */
export interface CorpsePiece {
    part: 'head' | 'torso' | 'upper' | 'legs' | 'arm-front' | 'arm-back' | 'leg-front' | 'leg-back';
    at: Vector2;
    rotation: number;
}

const world = (c: Corpse, id: CorpsePointId): Vector2 => ({ x: c.points[id].x, y: c.points[id].y });

/** Rig-space rotation → world rotation: mirroring the shape mirrors its turn too. */
const piece = (c: Corpse, part: CorpsePiece['part'], at: Vector2, rigRotation: number): CorpsePiece =>
    ({ part, at, rotation: c.facing * wrap(rigRotation) });

/**
 * Gib: the joints are torn, so head, torso (hip–neck), each arm and each lower leg move on their own.
 * Back to front, as they are drawn. Arm shapes hang from the elbow with the upper arm straight up;
 * leg shapes stand on the knee.
 */
const gibPieces = (c: Corpse, r: RigPoints): CorpsePiece[] => [
    piece(c, 'arm-back', world(c, 'elB'), upAngle(minus(r.shB, r.elB))),
    piece(c, 'leg-back', world(c, 'knB'), upAngle(minus(r.anB, r.knB)) - DOWN),
    piece(c, 'torso', middle(world(c, 'hip'), world(c, 'neck')), leanOf(r)),
    piece(c, 'leg-front', world(c, 'knF'), upAngle(minus(r.anF, r.knF)) - DOWN),
    piece(c, 'arm-front', world(c, 'elF'), upAngle(minus(r.shF, r.elF))),
    // Right only at death: the head has left its neck, so the corpse view rolls it on its own from there
    piece(c, 'head', world(c, 'head'), headTiltOf(r)),
];

/** Rail cut, back to front: the legs turn with the knees, the upper half (torso top, head, arms) with the neck → head line. */
const cutPieces = (c: Corpse, r: RigPoints): CorpsePiece[] => [
    piece(c, 'legs', world(c, 'hip'), upAngle(minus(middle(r.knF, r.knB), r.hip)) - LEGS_REST),
    piece(c, 'upper', world(c, 'neck'), headTiltOf(r)),
];

/** The torn pieces to draw, back to front; a whole body (fall, thrown) has none. */
export const piecesOf = (c: Corpse): CorpsePiece[] => {
    if (c.kind === 'gib') return gibPieces(c, rigPoints(c));
    if (c.kind === 'cut') return cutPieces(c, rigPoints(c));
    return [];
};
