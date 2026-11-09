import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import type { BodyArtDefinition } from './artTypes';
import { BODY_ART } from './definitions';
import { liveRigTargets } from './rigTargets';

const poseAt = (frontY = 0, backY = -2.5) => {
    const pose = solvePose({ state: 'prone', body: 'human', aim: 0, t: 0, phase: 0, moveDir: 1,
        recoil: 0, grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) });
    return { ...pose, frontLeg: { ...pose.frontLeg, end: { x: -35, y: frontY } },
        backLeg: { ...pose.backLeg, end: { x: -31, y: backY } } };
};
const supportedArt = {
    ...BODY_ART.human, parts: { ...BODY_ART.human.parts,
        footFront: { ...BODY_ART.human.parts.footFront!, supportHeight: 4.408 },
        footBack: { ...BODY_ART.human.parts.footBack!, supportHeight: 4.902 },
    },
} as BodyArtDefinition;

describe('painted foot support anchors', () => {
    it('connects each shin and boot at its authored supported ankle without moving the input pose', () => {
        const pose = poseAt(), before = structuredClone(pose);
        const targets = liveRigTargets(supportedArt, pose, IDLE_PARTS);
        expect(targets.footFront!.start).toEqual({ x: -35, y: -4.408 });
        expect(targets.footBack!.start).toEqual({ x: -31, y: -4.902 });
        expect(targets.shinFront!.end).toBe(targets.footFront!.start);
        expect(targets.shinBack!.end).toBe(targets.footBack!.start);
        expect(targets.footFront!.rotation).toBe(0); expect(targets.footBack!.rotation).toBe(0);
        expect(pose).toEqual(before);
    });

    it('retains the default 2.5-unit support height and connects an ankle that was below support', () => {
        const targets = liveRigTargets(BODY_ART.human, poseAt(), IDLE_PARTS);
        expect(targets.footFront!.start).toEqual({ x: -35, y: -2.5 });
        expect(targets.footBack!.start).toEqual({ x: -31, y: -2.5 });
        expect(targets.shinFront!.end).toBe(targets.footFront!.start);
    });

    it('leaves an airborne ankle at its actual pose point', () => {
        const pose = poseAt(-10, -12), targets = liveRigTargets(supportedArt, pose, IDLE_PARTS);
        expect(targets.shinFront!.end).toBe(pose.frontLeg.end);
        expect(targets.footFront!.start).toBe(pose.frontLeg.end);
        expect(targets.footBack!.start).toBe(pose.backLeg.end);
    });

    it('keeps loose corpse ankles at actual contact points and retains their support-aware rotation', () => {
        const pose = { ...poseAt(), footContacts: { front: true, back: false } };
        const targets = liveRigTargets(supportedArt, pose, IDLE_PARTS, false, 0, true);
        expect(targets.shinFront!.end).toBe(pose.frontLeg.end);
        expect(targets.footFront!.start).toBe(pose.frontLeg.end);
        expect(targets.footBack!.start).toBe(pose.backLeg.end);
        expect(targets.footFront!.rotation).toBe(0);
        const leg = pose.backLeg;
        expect(targets.footBack!.rotation).toBeCloseTo(Math.atan2(leg.end.y - leg.joint.y, leg.end.x - leg.joint.x) - Math.PI / 2);
    });
});
