import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { WeaponType } from '../../../types';
import { FighterLook } from './fighterLook';
import { solvePose } from './fighterPose';
import { gripPoints } from './weaponGrips';
import { IDLE_PARTS } from './parts/partMotionFrame';
import { createFighterView, drawFighter } from './fighterView';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const look: FighterLook = {
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x38bdf8, pattern: 0x8b5cf6, build: { ...DEFAULT_BUILD, tail: 'none' },
};

describe('gun layer', () => {
    it('holds the muzzle flash and the fallback gun, so a flip keeps them on the gun', () => {
        const view = createFighterView();
        drawFighter(view, {
            pose: solvePose({ state: 'fly', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
            look, facing: 1, grip, weaponType: WeaponType.MACHINE_GUN, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 1,
        });
        const gunFront = view.gunFront;
        const drawn = gunFront.context.instructions.length;
        const parent = gunFront.parent;
        view.root.destroy({ children: true, context: true });
        expect(parent).toBe(view.gunLayer);
        expect(drawn).toBeGreaterThan(1); // fallback gun + flash
    });
});
