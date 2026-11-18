// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { BODY_IDS } from '../../build/bodyTypes';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { sourceBodyPoint } from './bodyPose';
import { BODY_ART } from './definitions';

const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23);
const base = { t: 0, phase: 0, aim: 0, moveDir: 1, recoil: 0, grip };

// The painted near leg hangs from the hip behind the body centre; a foot planted on the far side
// of the other leg's foot makes the two legs cross in an X.
describe('illustrated legs do not cross', () => {
    it.each(BODY_IDS)('keeps %s feet in the same order as their hips while standing and airborne', body => {
        const definition = BODY_ART[body];
        for (const state of ['idle', 'fly', 'fall'] as const) {
            const plain = solvePose({ ...base, state });
            const hipFront = sourceBodyPoint(definition, plain, definition.parts.thighFront!.origin);
            const hipBack = sourceBodyPoint(definition, plain, definition.parts.thighBack!.origin);
            const pose = solvePose({ ...base, state, body });
            const hipOrder = Math.sign(hipFront.x - hipBack.x);
            const footOrder = Math.sign(pose.frontLeg.end.x - pose.backLeg.end.x);
            expect(footOrder, `${body}/${state}`).toBe(hipOrder);
        }
    });
});
