// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import type { ArtPartId, BodyArtDefinition } from './artTypes';
import { HUMAN_EXPRESSIONS, HUMAN_PICTURES, HUMAN_POSE_PARTS } from './data/humanPoseVariants';
import { liveRigTargets } from './rigTargets';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { partGeometry } from './placement';
import { paintedBottom, paintedBounds } from './paintedSurfaceTestKit';

const TOLERANCE = 0.06; // Existing allowance: one authored antialias/linear-sampling pixel.
const phases = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const aims = [-Math.PI / 6, 0, Math.PI / 6];
const definitionFor = (state: 'crouch' | 'prone', expression: 'normal' | 'hurt' | 'dead' = 'normal'): BodyArtDefinition => {
    const base = RUNTIME_BODY_ART.human, head = expression === 'normal' ? undefined : HUMAN_EXPRESSIONS[expression];
    return { ...base, anatomy: base.anatomy ?? base,
        parts: { ...base.parts, ...HUMAN_POSE_PARTS[state], ...(head ? { head } : {}) } };
};

describe('real Human pose painted pixels', () => {
    it('normalizes UVs against the actual PNG dimensions', () => {
        const dimensions = new Map(HUMAN_PICTURES.map(picture => {
            const bytes = readFileSync(resolve('public', picture.imagePath.replace(/^\//, '')));
            const actual = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
            expect(picture.size, picture.imagePath).toEqual(actual);
            return [picture.imagePath, actual];
        }));
        for (const parts of [HUMAN_POSE_PARTS.crouch!, HUMAN_POSE_PARTS.prone!, HUMAN_EXPRESSIONS]) {
            for (const part of Object.values(parts)) expect(part.image!.size).toEqual(dimensions.get(part.image!.imagePath));
        }
    });

    it('samples the declared pose picture before the old source and atlas paths', () => {
        const definition = { ...definitionFor('prone'), imagePath: '/missing-old-source.png',
            atlas: { imagePath: '/missing-old-atlas.png', size: [1536, 1024] as const } };
        const bottom = paintedBottom(definition, 'footFront', { start: { x: 0, y: -10 }, rotation: 0 });
        expect(Number.isFinite(bottom)).toBe(true);
    });

    it.each(['crouch', 'prone'] as const)('keeps actual %s paint above support for every weapon and playable aim', state => {
        let worst = { bottom: -Infinity, label: '' };
        for (const expression of ['normal', 'hurt', 'dead'] as const) {
            const definition = definitionFor(state, expression);
            for (const weapon of Object.values(WeaponType)) for (const aim of aims) for (const phase of phases) {
                const pose = solvePose({ state, body: 'human', grip: gripPoints(weapon, 0.23), aim, phase, t: 0, moveDir: 1, recoil: 0 });
                const targets = liveRigTargets(definition, pose, IDLE_PARTS);
                for (const id of Object.keys(definition.parts) as ArtPartId[]) {
                    const bottom = paintedBottom(definition, id, targets[id]);
                    if (bottom > worst.bottom) worst = { bottom, label: `${state}/${expression}/${weapon}/aim=${aim}/phase=${phase}/${id}` };
                }
            }
        }
        expect(worst.bottom, `${worst.label}; opaque maxY=${worst.bottom}`).toBeLessThanOrEqual(TOLERANCE);
    });

    it.each(['crouch', 'prone'] as const)('uses distinct near/far %s texture regions', state => {
        const definition = definitionFor(state);
        for (const limb of ['upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot'] as const) {
            const front = definition.parts[`${limb}Front`]!, back = definition.parts[`${limb}Back`]!;
            expect(front.image?.imagePath).toBe(back.image?.imagePath);
            expect([...partGeometry(front, front.image!.size).uvs]).not.toEqual([...partGeometry(back, back.image!.size).uvs]);
        }
    });

    it('keeps opaque pose and damaged-head pixels inside transparent crop gutters', () => {
        const parts = [...Object.values(HUMAN_POSE_PARTS.crouch!), ...Object.values(HUMAN_POSE_PARTS.prone!),
            ...Object.values(HUMAN_EXPRESSIONS)];
        const missingGutters: string[] = [];
        for (const part of parts) {
            const bounds = paintedBounds(part.image!.imagePath, part.polygon);
            const label = `${part.image!.imagePath}/${part.origin.join(',')}`;
            const gutters = { left: bounds.left - Math.min(...part.polygon.map(point => point[0])),
                right: Math.max(...part.polygon.map(point => point[0])) - bounds.right,
                top: bounds.top - Math.min(...part.polygon.map(point => point[1])),
                bottom: Math.max(...part.polygon.map(point => point[1])) - bounds.bottom };
            for (const [edge, gap] of Object.entries(gutters)) if (gap <= 1) missingGutters.push(`${label}/${edge}: ${gap}px`);
        }
        expect(missingGutters).toEqual([]);
    });

    it('authors prone toes behind the heel rather than reusing an upright right-facing boot', () => {
        for (const id of ['footFront', 'footBack'] as const) {
            const part = HUMAN_POSE_PARTS.prone![id]!;
            const bounds = paintedBounds(part.image!.imagePath, part.polygon);
            expect(part.origin[0] - bounds.left, id).toBeGreaterThan(bounds.right - part.origin[0]);
        }
    });
});
