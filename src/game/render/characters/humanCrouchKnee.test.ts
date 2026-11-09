// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { BODY_ART } from './definitions';
import { sourceBodyPoint } from './bodyPose';

const input = { state: 'crouch' as const, t: 0, phase: 0, aim: 0, moveDir: 1, recoil: 0,
    grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) };

describe('Human crouched far-leg projection', () => {
    it('keeps the foreshortened far knee forward of its hip and above its painted joint radius', () => {
        const legacy = solvePose(input), pose = solvePose({ ...input, body: 'human' });
        const definition = BODY_ART.human;
        const hip = sourceBodyPoint(definition, pose, definition.parts.thighBack!.origin);
        expect(pose.backLeg.joint.x).toBeGreaterThan(hip.x);
        expect(pose.backLeg.joint.y).toBeLessThanOrEqual(-4.5);
        expect(pose.backLeg.end.x).toBeCloseTo(legacy.backLeg.end.x, 5);
        expect(pose.backLeg.end.y).toBeCloseTo(legacy.backLeg.end.y, 5);
    });

    it.each(['human-female', 'robot', 'toxic', 'cat'] as const)('keeps %s original crouch bone lengths', body => {
        const pose = solvePose({ ...input, body }), definition = BODY_ART[body];
        const hip = sourceBodyPoint(definition, pose, definition.parts.thighBack!.origin);
        expect(Math.hypot(pose.backLeg.joint.x - hip.x, pose.backLeg.joint.y - hip.y)).toBeCloseTo(14.5, 5);
        expect(Math.hypot(pose.backLeg.end.x - pose.backLeg.joint.x, pose.backLeg.end.y - pose.backLeg.joint.y)).toBeCloseTo(14.5, 5);
    });
});
