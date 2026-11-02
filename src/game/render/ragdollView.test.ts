import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { RagdollPart } from '../../types';
import { DEFAULT_BUILD, FighterBuild } from '../build/buildParts';
import { drawRagdollShape } from './ragdollView';

const TYPES: RagdollPart['type'][] = ['head', 'torso', 'arm-left', 'arm-right', 'leg-left', 'leg-right'];

const partOf = (type: RagdollPart['type'], build?: FighterBuild): RagdollPart => ({
    id: 'rag_1', type, pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, rotation: 0, angularVel: 0,
    color: '#3366aa', life: 5, isGrounded: false, build,
});

/** The recorded drawing as text (fill textures and path ids left out), to compare two drawings. */
const drawing = (part: RagdollPart) => {
    const g = new Graphics();
    drawRagdollShape(g, part);
    const text = JSON.stringify(g.context.instructions, (key, value) => (key === 'texture' || key === 'uid' ? undefined : value));
    const count = g.context.instructions.length;
    g.destroy({ children: true, context: true });
    return { text, count };
};

describe('drawRagdollShape', () => {
    it('draws every part type with a rich build without throwing', () => {
        const build: FighterBuild = { ...DEFAULT_BUILD, helmet: 'dome', ears: 'ram', pattern: 'camo', badge: 'emblem', jetpack: 'wings' };
        for (const type of TYPES) expect(drawing(partOf(type, build)).count).toBeGreaterThan(0);
    });

    it('a part without a build is drawn with the default build', () => {
        for (const type of TYPES) expect(drawing(partOf(type)).text).toBe(drawing(partOf(type, DEFAULT_BUILD)).text);
    });

    it('a head keeps its helmet and ears', () => {
        const plain = drawing(partOf('head', DEFAULT_BUILD)).text;
        expect(drawing(partOf('head', { ...DEFAULT_BUILD, ears: 'cat' })).text).not.toBe(plain);
        expect(drawing(partOf('head', { ...DEFAULT_BUILD, helmet: 'angular' })).text).not.toBe(plain);
    });

    it('a torso keeps its pattern and badge', () => {
        const plain = drawing(partOf('torso', DEFAULT_BUILD)).text;
        expect(drawing(partOf('torso', { ...DEFAULT_BUILD, pattern: 'stripes' })).text).not.toBe(plain);
        expect(drawing(partOf('torso', { ...DEFAULT_BUILD, badge: 'chevron' })).text).not.toBe(plain);
    });

    it('limbs do not depend on the build', () => {
        const rich: FighterBuild = { ...DEFAULT_BUILD, ears: 'cat', pattern: 'camo', badge: 'chevron' };
        for (const type of ['arm-left', 'arm-right', 'leg-left', 'leg-right'] as const) {
            expect(drawing(partOf(type, rich)).text).toBe(drawing(partOf(type, DEFAULT_BUILD)).text);
        }
    });
});
