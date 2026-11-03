import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { DEFAULT_BUILD, FighterBuild } from '../build/buildParts';
import type { RagdollColors } from '../systems/events';
import type { CorpsePiece } from './ragdoll/corpsePose';
import { drawRagdollShape } from './ragdollView';
import { TORN } from './ragdoll/tornFlesh';

type Part = CorpsePiece['part'];
const PARTS: Part[] = ['head', 'torso', 'upper', 'legs', 'arm-front', 'arm-back', 'leg-front', 'leg-back'];
const LIMBS: Part[] = ['arm-front', 'arm-back', 'leg-front', 'leg-back', 'legs'];

const colorsOf = (build?: FighterBuild): RagdollColors => ({ head: '#aa3322', torso: '#3366aa', arm: '#22aa66', leg: '#475569', build });

/** The recorded drawing as text (fill textures and path ids left out), to compare two drawings. */
const drawing = (part: Part, colors?: RagdollColors) => {
    const g = new Graphics();
    drawRagdollShape(g, part, colors);
    const text = JSON.stringify(g.context.instructions, (key, value) => (key === 'texture' || key === 'uid' ? undefined : value));
    const colorsUsed = (g.context.instructions as { data: { style?: { color?: number } } }[]).map(i => i.data.style?.color);
    const count = g.context.instructions.length;
    g.destroy({ children: true, context: true });
    return { text, count, colorsUsed };
};

describe('drawRagdollShape', () => {
    it('draws every piece with a rich build without throwing', () => {
        const build: FighterBuild = { ...DEFAULT_BUILD, helmet: 'dome', ears: 'ram', pattern: 'camo', badge: 'emblem', jetpack: 'wings' };
        for (const part of PARTS) expect(drawing(part, colorsOf(build)).count).toBeGreaterThan(0);
    });

    it('a piece without a build is drawn with the default build', () => {
        for (const part of PARTS) expect(drawing(part, colorsOf()).text).toBe(drawing(part, colorsOf(DEFAULT_BUILD)).text);
    });

    it('a piece without colours still draws', () => {
        for (const part of PARTS) expect(drawing(part).count).toBeGreaterThan(0);
    });

    it('a head keeps its helmet and ears, and so does the upper half', () => {
        for (const part of ['head', 'upper'] as const) {
            const plain = drawing(part, colorsOf(DEFAULT_BUILD)).text;
            expect(drawing(part, colorsOf({ ...DEFAULT_BUILD, ears: 'cat' })).text).not.toBe(plain);
            expect(drawing(part, colorsOf({ ...DEFAULT_BUILD, helmet: 'angular' })).text).not.toBe(plain);
        }
    });

    it('a torso keeps its pattern and badge; the upper half keeps its badge', () => {
        const plain = drawing('torso', colorsOf(DEFAULT_BUILD)).text;
        expect(drawing('torso', colorsOf({ ...DEFAULT_BUILD, pattern: 'stripes' })).text).not.toBe(plain);
        expect(drawing('torso', colorsOf({ ...DEFAULT_BUILD, badge: 'chevron' })).text).not.toBe(plain);
        const upper = drawing('upper', colorsOf(DEFAULT_BUILD)).text;
        expect(drawing('upper', colorsOf({ ...DEFAULT_BUILD, badge: 'chevron' })).text).not.toBe(upper);
    });

    it('limbs do not depend on the build', () => {
        const rich: FighterBuild = { ...DEFAULT_BUILD, ears: 'cat', pattern: 'camo', badge: 'chevron' };
        for (const part of LIMBS) expect(drawing(part, colorsOf(rich)).text).toBe(drawing(part, colorsOf(DEFAULT_BUILD)).text);
    });

    it('each piece takes its own colour', () => {
        expect(drawing('head', colorsOf()).colorsUsed).toContain(0xaa3322);
        expect(drawing('torso', colorsOf()).colorsUsed).toContain(0x3366aa);
        expect(drawing('arm-front', colorsOf()).colorsUsed).toContain(0x22aa66);
        expect(drawing('leg-back', colorsOf()).colorsUsed).toContain(0x475569);
    });

    it('every piece shows a red end where it was torn off', () => {
        for (const part of PARTS) expect(drawing(part, colorsOf()).colorsUsed, part).toContain(TORN);
    });
});
