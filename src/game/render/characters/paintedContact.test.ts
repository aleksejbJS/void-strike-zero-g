// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { BODY_IDS } from '../../build/bodyTypes';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { liveRigTargets } from './rigTargets';
import { paintedBottom } from './paintedSurfaceTestKit';

const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23);
const base = { t: 0, phase: 0, moveDir: 1, recoil: 0, grip };
// One authored pixel of antialias/linear sampling, rather than a visible limb-width allowance.
const TOLERANCE = 0.06;

describe('actual painted surfaces at support', () => {
    it.each(BODY_IDS)('keeps both %s painted soles above the floor while standing, crouched and prone', body => {
        const definition = RUNTIME_BODY_ART[body];
        for (const state of ['idle', 'crouch', 'prone'] as const) for (const aim of [-Math.PI / 6, 0, Math.PI / 6]) {
            const pose = solvePose({ ...base, state, aim, body });
            const targets = liveRigTargets(definition, pose, IDLE_PARTS);
            for (const id of ['footFront', 'footBack'] as const)
                expect(paintedBottom(definition, id, targets[id]), `${body}/${state}/${aim}/${id}`).toBeLessThanOrEqual(TOLERANCE);
        }
    });

    it.each(BODY_IDS)('keeps %s opaque anatomy clear of support throughout prone aiming and crawling with every weapon', body => {
        const definition = RUNTIME_BODY_ART[body];
        for (const weapon of Object.values(WeaponType)) for (const aim of [-Math.PI / 6, 0, Math.PI / 6])
            for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
                const pose = solvePose({ ...base, state: 'prone', aim, phase, body, grip: gripPoints(weapon, 0.23) });
                const targets = liveRigTargets(definition, pose, IDLE_PARTS);
                for (const id of ['upperArmFront', 'upperArmBack', 'forearmFront', 'forearmBack', 'handFront', 'handBack',
                    'thighFront', 'thighBack', 'shinFront', 'shinBack', 'torso', 'pelvis', 'head', 'tail'] as const)
                    expect(paintedBottom(definition, id, targets[id]), `${body}/${weapon}/${aim}/${phase}/${id}`).toBeLessThanOrEqual(TOLERANCE);
            }
    });

    it('keeps a detached foot on its actual point with its full shin angle', () => {
        const definition = RUNTIME_BODY_ART.human;
        const pose = solvePose({ ...base, body: 'human', state: 'idle', aim: 0 });
        pose.frontLeg = { joint: { x: 10, y: 10 }, end: { x: 20, y: 10 } };
        const target = liveRigTargets(definition, pose, IDLE_PARTS, false, 0, true).footFront!;
        expect(target.start).toEqual({ x: 20, y: 10 });
        expect(target.rotation).toBeCloseTo(-Math.PI / 2);
    });
});
