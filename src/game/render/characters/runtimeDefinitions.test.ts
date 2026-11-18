import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { BODY_ART } from './definitions';
import { createRuntimeArt, type AtlasArtData } from './runtimeDefinitions';
import { liveRigTargets } from './rigTargets';
import { corpseRigTargets } from './corpseTargets';
import type { SourcePart } from './artTypes';

const source: SourcePart = { polygon: [[100, 100], [130, 100], [130, 180], [100, 180]],
    origin: [115, 110], axisEnd: [115, 170], pixelScale: 0.2, channel: 'arm' };
const atlas: AtlasArtData = { imagePath: '/complete-parts.png', size: [400, 300], parts: {
    torso: source, pelvis: source, upperArm: source, forearm: source,
    hand: source, thigh: source, shin: source, foot: source,
} };

describe('runtime atlas definitions', () => {
    it('keeps the original definition when no atlas is declared', () => {
        expect(createRuntimeArt(BODY_ART.human)).toBe(BODY_ART.human);
    });

    it('replaces body pixels while retaining original anatomy, head and tail without mutating sources', () => {
        const original = BODY_ART.cat, before = structuredClone(original);
        const runtime = createRuntimeArt(original, atlas);
        expect(runtime.anatomy).toBe(original);
        expect(runtime.hip).toBe(original.hip); expect(runtime.neck).toBe(original.neck);
        expect(runtime.parts.head).toBe(original.parts.head); expect(runtime.parts.tail).toBe(original.parts.tail);
        for (const id of ['upperArmFront', 'upperArmBack', 'thighFront', 'thighBack', 'handFront', 'footBack'] as const) {
            expect(runtime.parts[id]).toMatchObject({ texture: 'atlas', pixelScale: 0.2, origin: [115, 110] });
        }
        expect(runtime.atlas).toEqual({ imagePath: '/complete-parts.png', size: [400, 300] });
        expect(original).toEqual(before); expect(source).not.toHaveProperty('texture');
    });

    it('keeps living thigh attachments in the original anatomical frame instead of atlas UV coordinates', () => {
        const pose = solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0,
            body: 'human', grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) });
        const original = liveRigTargets(BODY_ART.human, pose, IDLE_PARTS);
        const runtime = liveRigTargets(createRuntimeArt(BODY_ART.human, atlas), pose, IDLE_PARTS);
        expect(runtime.thighFront).toEqual(original.thighFront);
        expect(runtime.thighBack).toEqual(original.thighBack);
    });

    it('keeps cut lower-half thigh attachments in the original anatomy while the upper half separates', () => {
        const corpse = createCorpse({ x: 100, y: 500, kind: 'cut', facing: -1 });
        corpse.points.neck.x += 300; corpse.points.head.x += 300;
        const original = corpseRigTargets(BODY_ART.cat, corpse);
        const runtime = corpseRigTargets(createRuntimeArt(BODY_ART.cat, atlas), corpse);
        expect(runtime.thighFront).toEqual(original.thighFront);
        expect(runtime.thighBack).toEqual(original.thighBack);
    });
});
