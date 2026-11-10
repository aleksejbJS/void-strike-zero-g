// @vitest-environment node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Corpse } from '../../systems/ragdoll/corpseBody';
import { corpseContactRadii } from '../../systems/ragdoll/corpseRadii';
import { RIG_SCALE } from '../fighter/fighterPose';
import type { XY } from './artTypes';
import { ROBOT_KIT } from './data/robotKit';
import { BODY_ART } from './definitions';
import { kitDefinitions } from './kitTypes';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';

const inside = ([x, y]: XY, polygon: readonly XY[]): boolean => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
};

describe('robot 3D kit', () => {
    const { anatomy, runtime } = kitDefinitions(ROBOT_KIT, 'robot');

    it('pins every part pivot inside its own picture, in frame and atlas pixels', () => {
        // The torso pivots at the hip, below the drawn chest, exactly like the painted bases
        for (const [id, part] of Object.entries(ROBOT_KIT.parts).filter(([id]) => id !== 'torso')) {
            expect(inside(part!.origin, part!.polygon), `${id} frame`).toBe(true);
            expect(inside(part!.atlas.origin, part!.atlas.polygon), `${id} atlas`).toBe(true);
        }
    });

    it('carries an untinted torn flange for wound sockets', () => {
        const flange = ROBOT_KIT.extras?.woundFlange;
        expect(flange).toBeDefined();
        expect(inside(flange!.atlas.origin, flange!.atlas.polygon)).toBe(true);
        expect(flange!.paintOffset).toBeUndefined();
        expect(flange!.channel).toBe('none');
    });

    it('gives every bone part a real axis and both feet a sole', () => {
        for (const id of ['torso', 'pelvis', 'thighFront', 'shinFront', 'upperArmBack', 'forearmBack'] as const) {
            const { origin, axisEnd } = ROBOT_KIT.parts[id]!;
            expect(Math.hypot(axisEnd![0] - origin[0], axisEnd![1] - origin[1]), id).toBeGreaterThan(0);
        }
        expect(ROBOT_KIT.parts.footFront!.supportHeight).toBeGreaterThan(0);
        expect(ROBOT_KIT.parts.footBack!.supportHeight).toBeGreaterThan(0);
    });

    it('ships its atlas and is the Robot base everywhere', () => {
        expect(existsSync(resolve(`public${ROBOT_KIT.atlas.imagePath}`))).toBe(true);
        expect(BODY_ART.robot).toEqual(anatomy);
        expect(RUNTIME_BODY_ART.robot).toEqual(runtime);
        expect(runtime.parts.handFrontGrip?.channel).toBe('arm');
        expect(runtime.parts.handFrontGrip?.texture).toBe('atlas');
        expect(runtime.parts.torso?.paintOffset).toEqual(ROBOT_KIT.parts.torso!.paintOffset);
    });

    it('keeps a corpse head radius from its real head outline, not an atlas rectangle', () => {
        // The painted bases measure 14-21 rig units; an atlas-rectangle outline would give far more
        const corpse = { colors: { build: { body: 'robot' } } } as unknown as Corpse;
        const head = corpseContactRadii(corpse)!.head / RIG_SCALE;
        expect(head).toBeGreaterThan(10);
        expect(head).toBeLessThan(22);
    });
});
