// A dead fighter as a jointed (verlet) body: points, the links between them and joint limits.
// Pure data, no drawing. Built from the idle pose of the fighter rig, so a fresh corpse matches
// the fighter it replaces. Stepped by corpseStep.ts; launched and drawn elsewhere.

import { Vector2, WeaponType } from '../../../types';
import type { DeathEvent, RagdollColors } from '../events';
import type { DeathKind } from '../deathKind';
import type { CorpsePiece } from '../../render/ragdoll/corpsePose';
import { RIG_SCALE, solvePose, upperPoint } from '../../render/fighter/fighterPose';
import { gripPoints } from '../../render/fighter/weaponGrips';
import { nextId } from '../../utils/id';
import type { BodyId } from '../../build/bodyTypes';

export type CorpsePointId = 'hip' | 'neck' | 'head' | 'shF' | 'elF' | 'haF' | 'shB' | 'elB' | 'haB'
    | 'knF' | 'anF' | 'knB' | 'anB' | 'gunA' | 'gunB';

/** A verlet point: current and previous position, so (x - px, y - py) is its velocity per tick. */
export interface CorpsePoint { x: number; y: number; px: number; py: number; supported?: boolean }

/**
 * A distance constraint between two points.
 * `joint`: torn by a gib. `waist`: cut by the railgun. `min`: a joint limit, only pushes apart.
 */
export interface CorpseLink { a: CorpsePointId; b: CorpsePointId; len: number; joint?: boolean; waist?: boolean; min?: boolean }

/** Ages are in ticks (120 per second). */
export interface Corpse {
    id: string;
    kind: DeathKind;
    facing: 1 | -1;
    points: Record<CorpsePointId, CorpsePoint>;
    links: CorpseLink[];
    age: number;
    fadeAt: number;
    removeAt: number;
    colors?: RagdollColors;
    weapon?: WeaponType;
    /** Draw only this torn piece: a leg torn off a fighter who lived (its body is the fighter, not this corpse). */
    only?: CorpsePiece['part'];
    /** It had lost its back leg to a railgun wound: no back leg is drawn. */
    oneLeg?: boolean;
}

/** What a corpse is made from: where and how a body stood, and what it looked like. A DEATH event has all of it. */
export type CorpseSeed = Pick<DeathEvent, 'x' | 'y' | 'facing' | 'kind' | 'weapon' | 'parts' | 'oneLeg'>;

/** A body lies 3.5 s then fades for 1 s; gib pieces lie 2 s then fade for 1 s (120 ticks/s). */
const BODY_FADE_AT = 420;
const BODY_REMOVE_AT = 540;
const GIB_FADE_AT = 240;
const GIB_REMOVE_AT = 360;

/** Weapon picture height / width when the texture is not known (same fallback as the fighter animator). */
const GUN_ASPECT = 0.23;

type Flags = Pick<CorpseLink, 'joint' | 'waist'>;

/** Rigid links: [a, b, flags]. Rest lengths come from the standing pose. */
const LINKS: [CorpsePointId, CorpsePointId, Flags?][] = [
    // Torso triangle hip–neck–shoulders; the shoulders are where the arms attach
    ['hip', 'neck', { waist: true }],
    ['neck', 'shF', { joint: true }], ['neck', 'shB', { joint: true }],
    ['hip', 'shF', { joint: true, waist: true }], ['hip', 'shB', { joint: true, waist: true }],
    ['head', 'neck', { joint: true }],
    ['shF', 'elF'], ['elF', 'haF'], ['shB', 'elB'], ['elB', 'haB'],
    ['hip', 'knF', { joint: true }], ['knF', 'anF'], ['hip', 'knB', { joint: true }], ['knB', 'anB'],
    ['gunA', 'gunB'],
];

/**
 * Joint limits as "keep at least this share of the standing distance apart": knees and elbows
 * never fold flat, legs never fold into the chest, the head never folds onto the hip.
 */
const LIMITS: [CorpsePointId, CorpsePointId, number][] = [
    ['hip', 'anF', 0.62], ['hip', 'anB', 0.62],
    ['shF', 'haF', 0.55], ['shB', 'haB', 0.55],
    ['neck', 'knF', 0.8], ['neck', 'knB', 0.8],
    ['head', 'hip', 0.9],
];

/** Joint positions of the standing fighter in rig space (feet on y = 0, facing right, y down). */
const standingRig = (weapon: WeaponType | undefined, body?: BodyId): Record<CorpsePointId, Vector2> => {
    const grip = gripPoints(weapon ?? WeaponType.MACHINE_GUN, GUN_ASPECT);
    const pose = solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip, body });
    const along = { x: Math.cos(pose.gunAngle), y: Math.sin(pose.gunAngle) };
    return {
        hip: pose.hip,
        neck: upperPoint(pose, 0, -19),
        head: pose.head,
        shF: pose.shoulderFront, elF: pose.frontArm.joint, haF: pose.frontArm.end,
        shB: pose.shoulderBack, elB: pose.backArm.joint, haB: pose.backArm.end,
        knF: pose.frontLeg.joint, anF: pose.frontLeg.end,
        knB: pose.backLeg.joint, anB: pose.backLeg.end,
        // The weapon picture's top-left corner and the same edge one weapon length along the barrel
        gunA: pose.gunTopLeft,
        gunB: { x: pose.gunTopLeft.x + along.x * grip.length, y: pose.gunTopLeft.y + along.y * grip.length },
    };
};

const distance = (p: CorpsePoint, q: CorpsePoint) => Math.hypot(p.x - q.x, p.y - q.y);

/** A corpse standing where the fighter died, at rest; launching it is up to the caller. */
export const createCorpse = (e: CorpseSeed): Corpse => {
    // Older hosts may send a DEATH event without `facing`
    const facing: 1 | -1 = e.facing === -1 ? -1 : 1;
    const kind: DeathKind = e.kind ?? 'fall';
    const rig = standingRig(e.weapon, e.parts?.build?.body);
    const points = {} as Record<CorpsePointId, CorpsePoint>;
    for (const id of Object.keys(rig) as CorpsePointId[]) {
        const x = e.x + facing * RIG_SCALE * rig[id].x;
        const y = e.y + RIG_SCALE * rig[id].y;
        points[id] = { x, y, px: x, py: y };
    }
    const links: CorpseLink[] = [
        ...LINKS.map(([a, b, flags]) => ({ a, b, len: distance(points[a], points[b]), ...flags })),
        ...LIMITS.map(([a, b, share]) => ({ a, b, len: share * distance(points[a], points[b]), min: true })),
    ];
    const gib = kind === 'gib';
    return {
        id: nextId('corpse_'),
        kind,
        facing,
        points,
        links,
        age: 0,
        fadeAt: gib ? GIB_FADE_AT : BODY_FADE_AT,
        removeAt: gib ? GIB_REMOVE_AT : BODY_REMOVE_AT,
        colors: e.parts,
        weapon: e.weapon,
        oneLeg: e.oneLeg,
    };
};
