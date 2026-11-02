import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { DEFAULT_BUILD, FLAMES, FlameId, JETPACKS, JetpackId } from '../../../build/buildParts';
import { WeaponType } from '../../../../types';
import { FighterLook } from '../fighterLook';
import { FighterPose, solvePose } from '../fighterPose';
import { gripPoints } from '../weaponGrips';
import { IDLE_PARTS } from './partMotionFrame';
import { FLAME_PALETTE } from './flamePalette';
import { drawFlame, drawJetpack, jetpackNozzles } from './jetpacks';

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const POSE = solvePose({ state: 'fly', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip });
// Hip at the origin and no lean: drawing space equals the upper-body frame
const UPRIGHT: FighterPose = { ...POSE, hip: { x: 0, y: 0 }, lean: 0, lift: 0 };

const lookWith = (jetpack: JetpackId, flame: FlameId = 'fire'): FighterLook => ({
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x38bdf8, pattern: 0x8b5cf6, build: { ...DEFAULT_BUILD, jetpack, flame },
});

const measure = (draw: (g: Graphics) => void) => {
    const g = new Graphics();
    draw(g);
    const n = g.context.instructions.length;
    const { minX, maxX } = g.bounds;
    g.destroy({ children: true, context: true });
    return { n, minX, maxX };
};

describe('flame palette', () => {
    it("fire keeps today's colours", () => {
        expect(FLAME_PALETTE.fire).toEqual({
            outer: 0xff8a1e, mid: 0xffe27a, core: 0xffffff, glow: 0xff9a3c, particle: '#fbbf24', nozzle: 0xffb347,
        });
    });

    it('every flame has a #rrggbb particle colour', () => {
        for (const flame of FLAMES) expect(FLAME_PALETTE[flame].particle, flame).toMatch(/^#[0-9a-f]{6}$/i);
    });
});

describe('jetpacks', () => {
    it('tanks and scrap have two nozzles, the rest one', () => {
        for (const jetpack of JETPACKS) {
            expect(jetpackNozzles(jetpack), jetpack).toHaveLength(jetpack === 'tanks' || jetpack === 'scrap' ? 2 : 1);
        }
        expect(jetpackNozzles('pack')).toEqual([{ x: -8.75, y: -1 }]);
    });

    it('every jetpack × flame draws without throwing, wings with wingsOpen 0 and 1', () => {
        for (const jetpack of JETPACKS) for (const flame of FLAMES) for (const wingsOpen of [0, 1]) {
            const look = lookWith(jetpack, flame), m = { ...IDLE_PARTS, wingsOpen };
            expect(measure(g => drawJetpack(g, POSE, look, true, m)).n, `${jetpack} ${flame}`).toBeGreaterThan(0);
            expect(measure(g => drawJetpack(g, POSE, look, false, m)).n).toBeGreaterThan(0);
            expect(measure(g => drawFlame(g, POSE, look, 0.5)).n).toBeGreaterThan(0);
        }
    });

    it("every body except wings stays inside today's x range (-12.5..-5, plus the outline)", () => {
        const pad = 1.2;
        for (const jetpack of JETPACKS.filter(j => j !== 'wings')) {
            const { minX, maxX } = measure(g => drawJetpack(g, UPRIGHT, lookWith(jetpack), true, IDLE_PARTS));
            expect(minX, jetpack).toBeGreaterThanOrEqual(-12.5 - pad);
            expect(maxX, jetpack).toBeLessThanOrEqual(-5 + pad);
        }
    });

    it('wings reach further back open than folded', () => {
        const left = (wingsOpen: number) =>
            measure(g => drawJetpack(g, UPRIGHT, lookWith('wings'), false, { ...IDLE_PARTS, wingsOpen })).minX;
        expect(left(1)).toBeLessThan(left(0) - 5);
    });
});
