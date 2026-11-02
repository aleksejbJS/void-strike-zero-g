import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { DEFAULT_BUILD, FighterBuild } from '../../build/buildParts';
import { WeaponType } from '../../../types';
import { FighterLook } from './fighterLook';
import { solvePose, upperPoint } from './fighterPose';
import { gripPoints } from './weaponGrips';
import { drawShoulderBadge, drawTorso, shoulderPad } from './fighterParts';

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const POSE = solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip });

const lookWith = (parts: Partial<FighterBuild>): FighterLook => ({
    head: 0x9ca3af, torso: 0x6b7280, arm: 0x6b7280, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x7fd3ff, pattern: 0x22c55e, build: { ...DEFAULT_BUILD, ...parts },
});

const count = (draw: (g: Graphics) => void) => {
    const g = new Graphics();
    draw(g);
    const n = g.context.instructions.length;
    g.destroy({ children: true, context: true });
    return n;
};

const PAD = count(g => shoulderPad(g, (x, y) => upperPoint(POSE, x, y), 0x6b7280));

describe('front shoulder pad', () => {
    it('without a badge the pad stays in the torso, under the front arm', () => {
        const look = lookWith({ badge: 'none' });
        expect(count(g => drawShoulderBadge(g, POSE, look))).toBe(0);
        expect(count(g => drawTorso(g, POSE, look))).toBe(count(g => drawTorso(g, POSE, lookWith({ badge: 'chevron' }))) + PAD);
    });

    it('with a badge the pad and badge are drawn over the front arm instead', () => {
        for (const badge of ['chevron', 'number', 'emblem'] as const) {
            const look = lookWith({ badge });
            const front = count(g => drawShoulderBadge(g, POSE, look));
            expect(front, badge).toBeGreaterThan(PAD); // the pad and the badge on top of it
            expect(count(g => drawTorso(g, POSE, look)), badge).toBe(count(g => drawTorso(g, POSE, lookWith({ badge: 'none' }))) - PAD);
        }
    });

    it('a mirrored fighter gets a badge flipped back', () => {
        const instructions = (facing: number) => {
            const g = new Graphics();
            drawShoulderBadge(g, POSE, lookWith({ badge: 'number', badgeNumber: 7 }), facing);
            const text = JSON.stringify(g.context.instructions, (key, value) => (key === 'texture' || key === 'uid' ? undefined : value));
            g.destroy({ children: true, context: true });
            return text;
        };
        expect(instructions(-1)).not.toBe(instructions(1));
    });
});
