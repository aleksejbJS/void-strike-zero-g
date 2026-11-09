// Test helper: where an illustrated fighter's feet should stand for a shared pose. Prone and crouched feet
// keep the shared targets; otherwise each foot follows its own painted hip, and feet that would still pass
// each other stand side by side, one unit apart, in their hips' order.
import type { Vector2 } from '../../../types';
import type { BodyId } from '../../build/bodyTypes';
import type { FighterPose } from '../fighter/fighterPose';
import { sourceBodyPoint } from './bodyPose';
import { BODY_ART } from './definitions';

export const expectedFeet = (body: BodyId, original: FighterPose): { frontLeg: Vector2; backLeg: Vector2 } => {
    const front = original.frontLeg.end, back = original.backLeg.end;
    if (original.state === 'prone' || original.state === 'crouch') return { frontLeg: front, backLeg: back };
    const definition = BODY_ART[body];
    const hipFront = sourceBodyPoint(definition, original, definition.parts.thighFront!.origin);
    const hipBack = sourceBodyPoint(definition, original, definition.parts.thighBack!.origin);
    const frontX = front.x + hipFront.x - original.hip.x, backX = back.x + hipBack.x - original.hip.x;
    const order = Math.sign(hipFront.x - hipBack.x);
    if (Math.sign(frontX - backX) === order) return { frontLeg: { x: frontX, y: front.y }, backLeg: { x: backX, y: back.y } };
    const middle = (frontX + backX) / 2;
    return { frontLeg: { x: middle + 0.5 * order, y: front.y }, backLeg: { x: middle - 0.5 * order, y: back.y } };
};
