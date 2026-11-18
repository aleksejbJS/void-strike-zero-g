// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { BODY_IDS } from '../../build/bodyTypes';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { proneWeaponLift } from '../fighter/pronePose';

const phases = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
// These are the playable prone limits imposed by stance.ts, not unrestricted standing aim.
const aims = [-Math.PI / 6, -Math.PI / 12, 0, Math.PI / 12, Math.PI / 6];
const base = { state: 'prone' as const, t: 0, moveDir: 1, recoil: 0 };

describe('painted prone support clearances', () => {
    it('raises the weapon only by the missing painted-fist clearance', () => {
        expect(proneWeaponLift([{ x: 0, y: -8 }, { x: 10, y: -4 }])).toBe(0);
        expect(proneWeaponLift([{ x: 0, y: -2 }, { x: 10, y: -9 }])).toBe(1.5);
    });

    it.each(BODY_IDS)('keeps %s fists and rounded joints clear over every valid prone aim', body => {
        for (const weapon of Object.values(WeaponType)) for (const phase of phases) for (const aim of aims) {
            for (const recoil of [0, 1]) {
                const pose = solvePose({ ...base, phase, aim, recoil, body, grip: gripPoints(weapon, 0.23) });
                const label = `${body}/${weapon}/${phase}/${aim}/${recoil}`;
                for (const limb of ['frontArm', 'backArm'] as const) {
                    expect(pose[limb].end.y, `${label}/${limb}/hand`).toBeLessThanOrEqual(-3.5 + 1e-6);
                    expect(pose[limb].joint.y, `${label}/${limb}/elbow`).toBeLessThanOrEqual(-4);
                }
                for (const limb of ['frontLeg', 'backLeg'] as const) {
                    expect(pose[limb].joint.y, `${label}/${limb}/knee`).toBeLessThanOrEqual(-4);
                }
                expect(pose.gunAngle, label).toBeCloseTo(aim - recoil * 0.16, 8);
            }
        }
    });

    it.each(BODY_IDS)('extends %s legs behind the torso instead of folding knees above it', body => {
        for (const phase of phases) {
            const pose = solvePose({ ...base, phase, aim: 0, body, grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) });
            for (const limb of ['frontLeg', 'backLeg'] as const) {
                expect(pose.hip.x - pose[limb].end.x, `${body}/${phase}/${limb}/reach`).toBeGreaterThanOrEqual(20);
                expect(pose[limb].joint.y, `${body}/${phase}/${limb}/fold`).toBeGreaterThanOrEqual(pose.hip.y - 6.5);
                expect(Object.values(pose[limb].joint).every(Number.isFinite)).toBe(true);
            }
        }
    });
});
