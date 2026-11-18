// Torn anatomy follows the same physics points as the legacy corpse, in its hip frame.
import type { Vector2 } from '../../../types';
import type { Corpse } from '../../systems/ragdoll/corpseBody';
import { RIG_SCALE, THIGH } from '../fighter/fighterPose';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { piecesOf, poseFromCorpse, CorpsePiece } from '../ragdoll/corpsePose';
import type { ArtPartId, BodyArtDefinition } from './artTypes';
import { liveRigTargets, RigTargets } from './rigTargets';
import { sourceBodyPoint } from './bodyPose';

const shifted = (at: Vector2, dy: number, turn: number): Vector2 =>
    ({ x: at.x - Math.sin(turn) * dy, y: at.y + Math.cos(turn) * dy });

const PIECE_PARTS: Record<CorpsePiece['part'], readonly ArtPartId[]> = {
    head: ['head'], torso: ['torso', 'pelvis', 'tail'],
    upper: ['torso', 'head', 'upperArmFront', 'forearmFront', 'handFront', 'upperArmBack', 'forearmBack', 'handBack'],
    legs: ['pelvis', 'tail', 'thighFront', 'shinFront', 'footFront', 'thighBack', 'shinBack', 'footBack'],
    'arm-front': ['upperArmFront', 'forearmFront', 'handFront'],
    'arm-back': ['upperArmBack', 'forearmBack', 'handBack'],
    'leg-front': ['thighFront', 'shinFront', 'footFront'],
    'leg-back': ['thighBack', 'shinBack', 'footBack'],
};

export const corpseRigTargets = (definition: BodyArtDefinition, c: Corpse, headTurn?: number): RigTargets => {
    const { pose, origin } = poseFromCorpse(c);
    const targets = liveRigTargets(definition, pose, IDLE_PARTS, c.oneLeg && !c.only, 0, true);
    const neck = { x: (c.points.neck.x - origin.x) * c.facing / RIG_SCALE,
        y: (c.points.neck.y - origin.y) / RIG_SCALE };
    const pieces = piecesOf(c);
    if (c.kind === 'gib') {
        targets.torso = targets.pelvis = { start: pose.hip, end: neck };
        targets.head!.rotation = (headTurn ?? (pieces.find(p => p.part === 'head')?.rotation ?? 0)) * c.facing;
        targets.tail!.rotation = c.points.hip.supported || c.points.neck.supported ? Math.PI / 2 : pose.lean;
        for (const side of ['Front', 'Back'] as const) {
            const leg = side === 'Front' ? pose.frontLeg : pose.backLeg;
            const dx = leg.end.x - leg.joint.x, dy = leg.end.y - leg.joint.y, length = Math.hypot(dx, dy);
            const freeHip = { x: leg.joint.x - (length > 1e-7 ? dx / length : 0) * THIGH,
                y: leg.joint.y - (length > 1e-7 ? dy / length : 1) * THIGH };
            targets[`thigh${side}`] = { start: freeHip, end: leg.joint };
        }
    } else if (c.kind === 'cut') {
        // The severed waist must never use a bone spanning both halves.
        const upperTurn = (pieces.find(p => p.part === 'upper')?.rotation ?? 0) * c.facing;
        const lowerTurn = (pieces.find(p => p.part === 'legs')?.rotation ?? 0) * c.facing;
        targets.torso = { start: shifted(neck, 19, upperTurn), end: neck };
        targets.pelvis = { start: pose.hip, end: shifted(pose.hip, -19, lowerTurn) };
        targets.head!.rotation = upperTurn;
        const lowerSupported = (['hip', 'knF', 'anF', 'knB', 'anB'] as const).some(id => c.points[id].supported);
        targets.tail = { start: pose.hip, rotation: lowerSupported ? Math.PI / 2 : lowerTurn };
        const lowerPose = { ...pose, lean: lowerTurn };
        const anatomy = definition.anatomy ?? definition;
        for (const side of ['Front', 'Back'] as const) {
            const thigh = anatomy.parts[`thigh${side}`];
            targets[`thigh${side}`]!.start = sourceBodyPoint(anatomy, lowerPose, thigh?.origin ?? anatomy.hip);
        }
    }
    const allowed = new Set(pieces.flatMap(p => PIECE_PARTS[p.part]));
    for (const id of Object.keys(targets) as ArtPartId[]) {
        if (!allowed.has(id) || (c.oneLeg && !c.only && ['thighBack', 'shinBack', 'footBack'].includes(id))) delete targets[id];
    }
    return targets;
};
