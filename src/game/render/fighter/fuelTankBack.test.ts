import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { WeaponType } from '../../../types';
import { FighterLook } from './fighterLook';
import { solvePose } from './fighterPose';
import { gripPoints } from './weaponGrips';
import { IDLE_PARTS } from './parts/partMotionFrame';
import { createFighterView, drawFighter } from './fighterView';
import { HOSE_COLOR, TANK_BOX, TANK_COLOR, TANK_SPOT } from './fuelTankBack';

// jsdom has no 2D canvas to bake the glow texture; the body layer does not depend on it
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const JET_COLOR = 0x22c55e;
const look: FighterLook = {
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: JET_COLOR,
    visor: 0x38bdf8, pattern: 0x8b5cf6, build: { ...DEFAULT_BUILD, jetpack: 'pack' },
};

/** Fill and stroke colours of the body layer, in drawing order, for a fighter holding `weaponType`. */
const bodyColors = (weaponType: WeaponType, weaponless = false): (number | undefined)[] => {
    const grip = gripPoints(weaponType, 65 / 240);
    const view = createFighterView();
    drawFighter(view, {
        pose: solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
        look, facing: 1, grip, weaponType, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0, weaponless,
    });
    const instructions = view.body.context.instructions as unknown as { data: { style?: { color?: number } } }[];
    const colors = instructions.map(i => i.data.style?.color);
    view.root.destroy({ children: true, context: true });
    return colors;
};

describe('fuel tank on the back', () => {
    it('a fighter holding the flamethrower wears the tank under the jetpack, with a hose to the gun', () => {
        const colors = bodyColors(WeaponType.FLAMETHROWER);
        const tank = colors.indexOf(TANK_COLOR);
        expect(tank).toBeGreaterThanOrEqual(0);
        expect(colors.indexOf(JET_COLOR)).toBeGreaterThan(tank); // the jetpack is drawn over it and stays visible
        expect(colors).toContain(HOSE_COLOR);
    });

    it('no tank with any other weapon in hand', () => {
        const colors = bodyColors(WeaponType.MACHINE_GUN);
        expect(colors).not.toContain(TANK_COLOR);
        expect(colors).not.toContain(HOSE_COLOR);
    });

    it('a corpse keeps the tank on its back but has no gun for the hose', () => {
        const colors = bodyColors(WeaponType.FLAMETHROWER, true);
        expect(colors).toContain(TANK_COLOR);
        expect(colors).not.toContain(HOSE_COLOR);
    });

    it('the lit tank jet starts inside the drawn tank', () => {
        expect(TANK_SPOT.x).toBeGreaterThan(TANK_BOX.x0);
        expect(TANK_SPOT.x).toBeLessThan(TANK_BOX.x0 + TANK_BOX.w);
        expect(TANK_SPOT.y).toBeGreaterThan(TANK_BOX.top);
        expect(TANK_SPOT.y).toBeLessThan(TANK_BOX.bottom);
    });
});
