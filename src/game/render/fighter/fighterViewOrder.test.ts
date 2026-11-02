import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { WeaponType } from '../../../types';
import { FighterLook } from './fighterLook';
import { solvePose } from './fighterPose';
import { gripPoints } from './weaponGrips';
import { IDLE_PARTS } from './parts/partMotionFrame';
import { FLAME_PALETTE } from './parts/flamePalette';
import { createFighterView, drawFighter } from './fighterView';

// jsdom has no 2D canvas to bake the glow texture; the order of the body layer does not depend on it
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const TAIL_COLOR = 0x8b5cf6;
const look: FighterLook = {
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x38bdf8, pattern: TAIL_COLOR, build: { ...DEFAULT_BUILD, tail: 'cat' },
};

/** Fill and stroke colours of the body layer in drawing order. */
const paintColors = (instructions: { action: string; data: { style?: { color?: number } } }[]) =>
    instructions.map(i => i.data.style?.color);

describe('fighter body layer order', () => {
    it('draws the jetpack flame over the tail', () => {
        const view = createFighterView();
        drawFighter(view, {
            pose: solvePose({ state: 'fly', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
            look, facing: 1, grip, weaponType: WeaponType.MACHINE_GUN, flame: true, flicker: 1, parts: IDLE_PARTS, muzzleFlash: 0,
        });
        const colors = paintColors(view.body.context.instructions as never);
        const tail = colors.indexOf(TAIL_COLOR);
        const flame = colors.indexOf(FLAME_PALETTE.fire.outer);
        view.root.destroy({ children: true, context: true });
        expect(tail).toBeGreaterThanOrEqual(0);
        expect(flame).toBeGreaterThan(tail);
    });
});
