// Preserve the painted anatomy's shoulder/hip spacing while sharing pose and corpse joints.
import type { Vector2 } from '../../../types';
import type { BodyId } from '../../build/bodyTypes';
import type { FighterPose, FighterState } from '../fighter/fighterPose';
import { solveLimb } from '../fighter/ik';
import { PRONE_SUPPORT } from '../fighter/pronePose';
import type { BodyArtDefinition, SourcePart, XY } from './artTypes';
import { artScale } from './placement';
import { BODY_ART } from './definitions';

const fittedLimb = (start: Vector2, end: Vector2, upper: number, lower: number,
    pick: (point: Vector2) => number) => {
    // solveLimb reserves 0.01 units at full reach; leave enough slack to retain the authored target.
    const stretch = Math.max(1, (Math.hypot(end.x - start.x, end.y - start.y) + 0.02) / (upper + lower));
    return solveLimb(start, end, upper * stretch, lower * stretch, pick);
};

const fittedArm = (start: Vector2, end: Vector2, supported: boolean) => {
    // Rig-space support is y = 0; leave room for the painted elbow's rounded joint end.
    const clearance = -PRONE_SUPPORT.joint;
    const preference = (p: Vector2) => p.y - (supported ? Math.max(0, p.y - clearance) * 1000 : 0);
    const arm = fittedLimb(start, end, 11.5, 11.5, preference);
    // A downward weapon grip can put both fixed-length bends below support. The art can stretch
    // slightly at that joint while the grip and weapon stay exactly on their existing targets.
    if (supported && arm.joint.y > clearance) arm.joint.y = clearance;
    return arm;
};

export const sourceBodyPoint = (definition: BodyArtDefinition, pose: FighterPose, point: XY): Vector2 => {
    const dx = definition.neck[0] - definition.hip[0], dy = definition.neck[1] - definition.hip[1];
    const length = Math.hypot(dx, dy);
    if (length <= 0) throw new Error(`Character ${definition.id} has no body frame`);
    const px = point[0] - definition.hip[0], py = point[1] - definition.hip[1];
    const x = (px * dy - py * dx) / length * (19 / length);
    const y = (px * dx + py * dy) / length * ((19 + pose.lift) / length);
    const angle = pose.lean - Math.PI, c = Math.cos(angle), s = Math.sin(angle);
    return { x: pose.hip.x + x * c - y * s, y: pose.hip.y + x * s + y * c };
};

/** A painted bone's length in rig units, so the picture is drawn at its own proportions. */
const paintedLength = (definition: BodyArtDefinition, part: SourcePart | undefined, fallback: number): number => {
    if (!part?.axisEnd) return fallback;
    return Math.hypot(part.axisEnd[0] - part.origin[0], part.axisEnd[1] - part.origin[1]) * (part.pixelScale ?? artScale(definition));
};

/**
 * Tucked airborne feet can still land a hair past each other after following their hips; set them side by
 * side then, in their hips' order, so the shins do not cross at the ankles.
 */
const uncrossed = (front: Vector2, back: Vector2, hipFront: Vector2, hipBack: Vector2, keep: boolean): [Vector2, Vector2] => {
    const hipOrder = Math.sign(hipFront.x - hipBack.x);
    if (keep || hipOrder === 0 || Math.sign(front.x - back.x) === hipOrder) return [front, back];
    const middle = (front.x + back.x) / 2, gap = 0.5 * hipOrder;
    return [{ x: middle + gap, y: front.y }, { x: middle - gap, y: back.y }];
};

export const illustratedPose = (pose: FighterPose, body: BodyId, state?: FighterState): FighterPose => {
    const definition = BODY_ART[body];
    const front = definition.parts.upperArmFront, back = definition.parts.upperArmBack;
    if (!front || !back) throw new Error(`Character ${body} has incomplete shoulders`);
    const shoulderFront = sourceBodyPoint(definition, pose, front.origin);
    const shoulderBack = sourceBodyPoint(definition, pose, back.origin);
    const hipFront = sourceBodyPoint(definition, pose, definition.parts.thighFront?.origin ?? definition.hip);
    const hipBack = sourceBodyPoint(definition, pose, definition.parts.thighBack?.origin ?? definition.hip);
    const prone = state === 'prone' || (!state && pose.lean > 1);
    // A wide painted hip can put the forward IK bend beneath a planted foot.
    const fittedLeg = (start: Vector2, end: Vector2, upper = 14.5, lower = 14.5) => {
        const clearance = Math.min(Math.max(start.y, end.y), prone ? -PRONE_SUPPORT.joint : Infinity);
        const leg = fittedLimb(start, end, upper, lower, p => p.x - Math.max(0, p.y - clearance) * 1000);
        if (prone && leg.joint.y > clearance) leg.joint.y = clearance;
        return leg;
    };
    // The shared pose hangs both legs from one centre hip and plants the near foot forward, but the painted
    // near leg hangs from the hip behind the centre. Carry each foot along with its own hip so the legs keep
    // the shared stance without crossing in an X. Prone and crouched legs keep their authored ground contact
    // (a wide crouch reads as one knee forward, and the Human kneels on its own projection).
    const crouched = (state ?? pose.state) === 'crouch';
    const shared = prone || crouched;
    const underHip = (foot: Vector2, hip: Vector2): Vector2 => shared ? foot : { x: foot.x + hip.x - pose.hip.x, y: foot.y };
    const [footFront, footBack] = uncrossed(underHip(pose.frontLeg.end, hipFront), underHip(pose.backLeg.end, hipBack), hipFront, hipBack, shared);
    const supported = state ? state !== 'fly' && state !== 'fall' : pose.lean > 1;
    // The far thigh is foreshortened in the Human kneeling projection, rather than bent backward.
    const kneelingHuman = body === 'human' && crouched;
    // Standing, running and airborne legs use the painted thigh and shin proportions: the shared 14.5 + 14.5
    // bones are longer than the drawn legs, which stretched the thighs and forced a deep knee bend at rest.
    const paintedLeg = (side: 'Front' | 'Back', start: Vector2, end: Vector2) => fittedLeg(start, end,
        paintedLength(definition, definition.parts[`thigh${side}`], 14.5), paintedLength(definition, definition.parts[`shin${side}`], 14.5));
    return {
        ...pose, shoulderFront, shoulderBack,
        head: sourceBodyPoint(definition, pose, definition.parts.head?.origin ?? definition.neck),
        frontArm: fittedArm(shoulderFront, pose.frontArm.end, supported),
        backArm: fittedArm(shoulderBack, pose.backArm.end, supported),
        frontLeg: shared ? fittedLeg(hipFront, footFront) : paintedLeg('Front', hipFront, footFront),
        backLeg: kneelingHuman ? fittedLeg(hipBack, pose.backLeg.end, 6.5, 13)
            : shared ? fittedLeg(hipBack, footBack) : paintedLeg('Back', hipBack, footBack),
    };
};
