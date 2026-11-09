// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WeaponType, type Vector2 } from '../../../types';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { BODY_IDS, type BodyId } from '../../build/bodyTypes';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { solvePose, upperPoint, RIG_SCALE, type FighterPose, type FighterState } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import type { BodyArtDefinition, XY } from './artTypes';
import { illustratedPose, sourceBodyPoint } from './bodyPose';
import { BODY_ART } from './definitions';
import { artScale, partGeometry, placePart } from './placement';
import { expectedFeet } from './footTargetsTestKit';

const states: FighterState[] = ['idle', 'walk', 'run', 'fly', 'fall', 'crouch', 'prone'];
const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23);
const samples = [
    { t: 0, phase: 0, aim: 0, moveDir: 1, recoil: 0 },
    { t: 0.7, phase: Math.PI / 2, aim: -0.85, moveDir: 1, recoil: 0.4 },
    { t: 1.6, phase: Math.PI, aim: 1, moveDir: -1, recoil: 0.8 },
    { t: 2.2, phase: Math.PI * 1.5, aim: -0.3, moveDir: -1, recoil: 0 },
];

function expectPoint(actual: Vector2, expected: Vector2, label: string): void {
    expect(actual.x, `${label}.x`).toBeCloseTo(expected.x, 5);
    expect(actual.y, `${label}.y`).toBeCloseTo(expected.y, 5);
}

// Use the renderer's mesh transform as an independent reference for authored anchors.
function pointOnTorso(definition: BodyArtDefinition, pose: FighterPose, point: XY): Vector2 {
    const triangle: XY[] = [point, [point[0] + 1, point[1]], [point[0], point[1] + 1]];
    const geometry = partGeometry({ ...definition.parts.torso!, polygon: triangle }, definition.size);
    const placement = placePart(definition.parts.torso!, {
        start: pose.hip, end: upperPoint(pose, 0, -19),
    }, artScale(definition));
    const x = geometry.positions[0] * placement.scaleX, y = geometry.positions[1] * placement.scaleY;
    const c = Math.cos(placement.rotation), s = Math.sin(placement.rotation);
    return { x: placement.x + x * c - y * s, y: placement.y + x * s + y * c };
}

function posePoints(pose: FighterPose): Vector2[] {
    return [pose.hip, pose.head, pose.shoulderFront, pose.shoulderBack, pose.gunTopLeft,
        ...[pose.frontArm, pose.backArm, pose.frontLeg, pose.backLeg].flatMap(limb => [limb.joint, limb.end])];
}

describe('illustrated anatomy pose', () => {
    it.each(BODY_IDS)('keeps %s crouched knees above the planted feet', body => {
        const pose = solvePose({ state: 'crouch', body, aim: 0, t: 0, phase: 0, moveDir: 1,
            recoil: 0, grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) });
        for (const leg of [pose.frontLeg, pose.backLeg]) expect(leg.joint.y).toBeLessThanOrEqual(leg.end.y);
    });
    it.each(BODY_IDS)('keeps %s joints finite in every animation state', body => {
        for (const state of states) for (const sample of samples) {
            const pose = solvePose({ state, ...sample, grip, body });
            expect(posePoints(pose).flatMap(point => [point.x, point.y]).every(Number.isFinite), `${body}/${state}`).toBe(true);
            expect([pose.lean, pose.lift, pose.headTilt, pose.gunAngle].every(Number.isFinite), `${body}/${state}`).toBe(true);
        }
    });

    it.each(BODY_IDS)('binds %s shoulder and head anchors to the painted torso frame', body => {
        const definition = BODY_ART[body];
        for (const state of states) for (const sample of samples) {
            const pose = solvePose({ state, ...sample, grip, body });
            for (const [name, actual] of [
                ['upperArmFront', pose.shoulderFront], ['upperArmBack', pose.shoulderBack], ['head', pose.head],
            ] as const) {
                const source = definition.parts[name]!.origin;
                expectPoint(actual, pointOnTorso(definition, pose, source), `${body}/${state}/${name}`);
            }
            expectPoint(sourceBodyPoint(definition, pose, definition.hip), pose.hip, `${body}/hip`);
            expectPoint(sourceBodyPoint(definition, pose, definition.neck), upperPoint(pose, 0, -19), `${body}/neck`);
        }
        const upright = solvePose({ state: 'idle', ...samples[0], grip, body });
        expect(upright.shoulderFront.x, `${body}: near source shoulder stays left`).toBeLessThan(upright.shoulderBack.x);
    });

    it.each(BODY_IDS)('retains %s weapon grips and foot targets when adapting anatomy', body => {
        for (const weapon of Object.values(WeaponType)) for (const state of states) for (const sample of samples) {
            const original = solvePose({ state, ...sample, grip: gripPoints(weapon, 0.23) });
            const adapted = illustratedPose(original, body);
            const label = `${body}/${weapon}/${state}/aim=${sample.aim}`;
            expectPoint(adapted.gunTopLeft, original.gunTopLeft, `${label}/gun`);
            expect(adapted.gunAngle, label).toBe(original.gunAngle);
            for (const limb of ['frontArm', 'backArm'] as const) expectPoint(adapted[limb].end, original[limb].end, `${label}/${limb}`);
            // Feet stay on the floor line but stand under their own painted hips, so the legs never cross
            const feet = expectedFeet(body, original);
            for (const limb of ['frontLeg', 'backLeg'] as const) expectPoint(adapted[limb].end, feet[limb], `${label}/${limb}`);
        }
    });

    it.each(BODY_IDS)('keeps %s source geometry, UVs and approved image bytes unchanged', body => {
        const definition = BODY_ART[body], before = structuredClone(definition);
        const uvs = Object.values(definition.parts).map(part => [...partGeometry(part, definition.size).uvs]);
        const source = resolve(`art/characters/atompunk/base-samples/${body}-base-v1.png`);
        const published = resolve(`public${definition.imagePath}`);
        const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
        const originalHash = hash(source);
        expect(hash(published)).toBe(originalHash);
        for (const state of states) for (const sample of samples) solvePose({ state, ...sample, grip, body });
        expect(definition).toEqual(before);
        expect(Object.values(definition.parts).map(part => [...partGeometry(part, definition.size).uvs])).toEqual(uvs);
        expect(hash(source)).toBe(originalHash);
        expect(hash(published)).toBe(originalHash);
    });
});

describe('illustrated corpse initial anatomy', () => {
    it.each(BODY_IDS)('starts %s at the same idle joints on both facings', (body: BodyId) => {
        const pose = solvePose({ state: 'idle', ...samples[0], grip, body });
        for (const facing of [1, -1] as const) {
            const corpse = createCorpse({
                x: 137, y: 419, facing, kind: 'fall', weapon: WeaponType.MACHINE_GUN,
                parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff', build: { ...DEFAULT_BUILD, body } },
            });
            const expected = {
                shF: pose.shoulderFront, elF: pose.frontArm.joint, haF: pose.frontArm.end,
                shB: pose.shoulderBack, elB: pose.backArm.joint, haB: pose.backArm.end,
                head: pose.head, hip: pose.hip, neck: upperPoint(pose, 0, -19),
                knF: pose.frontLeg.joint, anF: pose.frontLeg.end, knB: pose.backLeg.joint, anB: pose.backLeg.end,
            };
            for (const [name, point] of Object.entries(expected)) {
                const actual = corpse.points[name as keyof typeof expected];
                expectPoint(actual, { x: 137 + facing * RIG_SCALE * point.x, y: 419 + RIG_SCALE * point.y }, `${body}/${facing}/${name}`);
                expect(actual.px).toBe(actual.x);
                expect(actual.py).toBe(actual.y);
            }
        }
    });
});
