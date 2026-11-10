// Bind the original picture regions to the same joints used by the procedural fighter.
import type { Vector2 } from '../../../types';
import { upperPoint, FighterPose } from '../fighter/fighterPose';
import type { PartMotionFrame } from '../fighter/parts/partMotionFrame';
import type { ArtPartId, BodyArtDefinition } from './artTypes';
import type { ArtTarget } from './placement';
import { sourceBodyPoint } from './bodyPose';

export type RigTargets = Partial<Record<ArtPartId, ArtTarget>>;
const angle = (a: Vector2, b: Vector2) => Math.atan2(b.y - a.y, b.x - a.x);

const handTurn = (definition: BodyArtDefinition, side: 'Front' | 'Back', joint: Vector2, end: Vector2) => {
    const source = definition.parts[`forearm${side}`];
    const from = source?.origin, to = source?.axisEnd;
    return angle(joint, end) - (from && to ? Math.atan2(to[1] - from[1], to[0] - from[0]) : 0);
};

export const liveRigTargets = (definition: BodyArtDefinition, pose: FighterPose,
    motion: PartMotionFrame, oneLeg = false, headBob = 0, looseFeet = false): RigTargets => {
    const targets: RigTargets = {
        torso: { start: pose.hip, end: upperPoint(pose, 0, -19) },
        pelvis: { start: pose.hip, end: upperPoint(pose, 0, -19) },
        head: { start: pose.head, rotation: pose.headTilt + headBob },
        tail: { start: pose.hip, rotation: looseFeet && pose.supported ? Math.PI / 2
            : pose.lean - motion.tailLift * 0.18 + Math.sin(motion.tailWave) * 0.035 },
    };
    for (const side of ['Front', 'Back'] as const) {
        const arm = side === 'Front' ? pose.frontArm : pose.backArm;
        const leg = side === 'Front' ? pose.frontLeg : pose.backLeg;
        const shoulder = side === 'Front' ? pose.shoulderFront : pose.shoulderBack;
        const legVisible = side === 'Front' || !oneLeg;
        targets[`upperArm${side}`] = { start: shoulder, end: arm.joint };
        targets[`forearm${side}`] = { start: arm.joint, end: arm.end };
        if (definition.parts[`hand${side}Grip`] && !looseFeet) {
            // 3D kits hold the weapon: palm under it, fingers over it, both turning with the gun
            targets[`palm${side}`] = { start: arm.end, rotation: pose.gunAngle };
            targets[`hand${side}Grip`] = { start: arm.end, rotation: pose.gunAngle };
        } else {
            targets[`hand${side}`] = { start: arm.end, rotation: handTurn(definition, side, arm.joint, arm.end) };
        }
        const anatomy = definition.anatomy ?? definition;
        const thigh = anatomy.parts[`thigh${side}`];
        targets[`thigh${side}`] = { start: sourceBodyPoint(anatomy, pose, thigh?.origin ?? anatomy.hip), end: leg.joint, visible: legVisible };
        // Pose-specific boots can place the ankle higher than the original painted sole.
        const planted = !looseFeet && leg.end.y > -6;
        const contactHeight = definition.parts[`foot${side}`]?.supportHeight ?? 2.5;
        const renderedAnkle = planted ? { x: leg.end.x, y: Math.min(-contactHeight, leg.end.y) } : leg.end;
        targets[`shin${side}`] = { start: leg.joint, end: renderedAnkle, visible: legVisible };
        const turn = angle(leg.joint, leg.end) - Math.PI / 2;
        const contact = looseFeet && (side === 'Front' ? pose.footContacts?.front : pose.footContacts?.back);
        targets[`foot${side}`] = { start: renderedAnkle, rotation: planted || contact ? 0 : looseFeet ? turn : Math.max(-0.3, Math.min(0.3, turn)), visible: legVisible };
    }
    return targets;
};
