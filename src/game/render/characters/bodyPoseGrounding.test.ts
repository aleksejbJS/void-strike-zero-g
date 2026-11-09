// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { BODY_IDS } from '../../build/bodyTypes';
import { solvePose, type FighterState } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { illustratedPose } from './bodyPose';

const phases = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const aims = [-0.9, -0.3, 0, 0.3, 0.9];
const states: FighterState[] = ['idle', 'walk', 'run', 'fly', 'fall', 'crouch', 'prone'];
const base = { t: 0, phase: 0, aim: 0, moveDir: 1, recoil: 0 };
const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23);

describe('illustrated arms at the floor', () => {
    it.each(BODY_IDS)('keeps both %s prone elbows above support throughout aiming and crawling', body => {
        for (const weapon of Object.values(WeaponType)) for (const phase of phases) for (const aim of aims) {
            const pose = solvePose({ ...base, state: 'prone', phase, aim, body, grip: gripPoints(weapon, 0.23) });
            expect(pose.frontArm.joint.y, `${body}/${weapon}/${phase}/${aim}/front`).toBeLessThanOrEqual(0);
            expect(pose.backArm.joint.y, `${body}/${weapon}/${phase}/${aim}/back`).toBeLessThanOrEqual(0);
        }
    });

    it.each(BODY_IDS)('keeps %s standing and aerial elbows in their natural lower bend', body => {
        for (const state of ['idle', 'walk', 'run', 'fly', 'fall'] as const) for (const aim of aims) {
            const pose = solvePose({ ...base, state, aim, body, grip });
            expect(pose.frontArm.joint.y, `${body}/${state}/${aim}/front`).toBeGreaterThanOrEqual(
                (pose.shoulderFront.y + pose.frontArm.end.y) / 2 - 1e-6);
            expect(pose.backArm.joint.y, `${body}/${state}/${aim}/back`).toBeGreaterThanOrEqual(
                (pose.shoulderBack.y + pose.backArm.end.y) / 2 - 1e-6);
        }
    });

    it.each(BODY_IDS)('lets %s airborne arm bends follow their frame without a floor constraint', body => {
        const original = solvePose({ ...base, state: 'fly', grip });
        const translated = {
            ...original, hip: { x: original.hip.x, y: original.hip.y + 60 },
            frontArm: { ...original.frontArm, end: { x: original.frontArm.end.x, y: original.frontArm.end.y + 60 } },
            backArm: { ...original.backArm, end: { x: original.backArm.end.x, y: original.backArm.end.y + 60 } },
        };
        const normal = illustratedPose(original, body, 'fly'), aerial = illustratedPose(translated, body, 'fly');
        expect(aerial.frontArm.joint.y).toBeCloseTo(normal.frontArm.joint.y + 60, 5);
        expect(aerial.backArm.joint.y).toBeCloseTo(normal.backArm.joint.y + 60, 5);
        expect(aerial.frontArm.joint.y).toBeGreaterThan(0);
        expect(aerial.backArm.joint.y).toBeGreaterThan(0);
    });

    it.each(BODY_IDS)('retains %s hands, weapon and foot targets with finite joints in every state', body => {
        for (const state of states) for (const phase of phases) for (const aim of aims) {
            const input = { ...base, state, phase, aim, grip };
            const original = solvePose(input), adapted = solvePose({ ...input, body });
            expect(adapted.gunTopLeft).toEqual(original.gunTopLeft);
            expect(adapted.gunAngle).toBe(original.gunAngle);
            for (const limb of ['frontArm', 'backArm', 'frontLeg', 'backLeg'] as const) {
                expect(adapted[limb].end.x, `${body}/${state}/${limb}/x`).toBeCloseTo(original[limb].end.x, 5);
                expect(adapted[limb].end.y, `${body}/${state}/${limb}/y`).toBeCloseTo(original[limb].end.y, 5);
                expect(Object.values(adapted[limb].joint).every(Number.isFinite), `${body}/${state}/${limb}`).toBe(true);
            }
        }
    });
});
