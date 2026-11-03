import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { WeaponType } from '../../../types';
import { FighterLook } from './fighterLook';
import { solvePose } from './fighterPose';
import { gripPoints } from './weaponGrips';
import { IDLE_PARTS } from './parts/partMotionFrame';
import { TORN } from '../ragdoll/tornFlesh';
import { createFighterView, drawFighter, FighterFrame } from './fighterView';
import { stumpTip } from './fighterStump';

// jsdom has no 2D canvas to bake the glow texture; the body layer does not depend on it
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const BACK_BOOT = 0x1b1f25;
const FRONT_BOOT = 0x252a32;
const look: FighterLook = {
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x38bdf8, pattern: 0x8b5cf6, build: { ...DEFAULT_BUILD },
};

const frameOf = (extra: Partial<FighterFrame> = {}): FighterFrame => ({
    pose: solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
    look, facing: 1, grip, weaponType: WeaponType.MACHINE_GUN, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0,
    ...extra,
});

/** Draws one frame and returns the colours of the body layer. */
const draw = (extra: Partial<FighterFrame> = {}) => {
    const view = createFighterView();
    drawFighter(view, frameOf(extra));
    const instructions = view.body.context.instructions as unknown as { data: { style?: { color?: number } } }[];
    const colors = instructions.map(i => i.data.style?.color);
    view.root.destroy({ children: true, context: true });
    return { colors };
};

describe('a one-legged fighter', () => {
    it('a whole fighter has both boots and no torn flesh', () => {
        const { colors } = draw();
        expect(colors).toContain(BACK_BOOT);
        expect(colors).toContain(FRONT_BOOT);
        expect(colors).not.toContain(TORN);
    });

    it('draws no back leg and a bloody stump instead', () => {
        const { colors } = draw({ oneLeg: true });
        expect(colors).not.toContain(BACK_BOOT);
        expect(colors).toContain(FRONT_BOOT);
        expect(colors).toContain(TORN);
    });

    it('leaves the root where its owner put it, so a corpse keeps its place', () => {
        const view = createFighterView();
        view.root.position.set(30, 40);
        drawFighter(view, frameOf({ oneLeg: true, hop: 4 }));
        const at = { x: view.root.position.x, y: view.root.position.y };
        view.root.destroy({ children: true, context: true });
        expect(at).toEqual({ x: 30, y: 40 });
    });
});

describe('stumpTip', () => {
    it('lies a short way from the hip, down and behind, so the stump pokes out behind the front leg', () => {
        const { hip, backLeg } = frameOf().pose;
        const tip = stumpTip({ hip, backLeg });
        expect(Math.hypot(tip.x - hip.x, tip.y - hip.y)).toBeGreaterThan(5);
        expect(Math.hypot(tip.x - hip.x, tip.y - hip.y)).toBeLessThan(backLeg.joint.y - hip.y);
        expect(tip.x).toBeLessThan(hip.x);
        expect(tip.y).toBeGreaterThan(hip.y);
    });
});
