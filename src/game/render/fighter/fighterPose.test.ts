import { describe, it, expect } from 'vitest';
import { solveLimb } from './ik';
import { bodyExtents, FighterState, RIG_SCALE, solvePose, upperPoint } from './fighterPose';
import { HITBOX } from './fighterStyle';
import { HELMETS } from '../../build/buildParts';
import { gripPoints } from './weaponGrips';
import { faceAim, stateOf } from './fighterAnimator';
import { WeaponType } from '../../../types';

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const pose = (state: FighterState, extra: Partial<Parameters<typeof solvePose>[0]> = {}) =>
    solvePose({ state, aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip, ...extra });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('solveLimb', () => {
    it('reaches a target within reach and keeps segment lengths', () => {
        const limb = solveLimb({ x: 0, y: 0 }, { x: 10, y: 10 }, 10, 10, j => j.y);
        expect(dist(limb.end, { x: 10, y: 10 })).toBeLessThan(1e-6);
        expect(dist({ x: 0, y: 0 }, limb.joint)).toBeCloseTo(10);
        expect(dist(limb.joint, limb.end)).toBeCloseTo(10);
    });

    it('stretches straight towards a target out of reach', () => {
        const limb = solveLimb({ x: 0, y: 0 }, { x: 50, y: 0 }, 10, 10, j => j.y);
        expect(limb.end.x).toBeCloseTo(20, 1);
        expect(Math.abs(limb.end.y)).toBeLessThan(0.5);
    });

    it('bends the way the preference asks', () => {
        const kneeForward = solveLimb({ x: 0, y: 0 }, { x: 0, y: 15 }, 10, 10, j => j.x);
        expect(kneeForward.joint.x).toBeGreaterThan(0);
    });
});

describe('solvePose', () => {
    it('stands with both feet on the ground', () => {
        const p = pose('idle');
        expect(p.frontLeg.end.y).toBeCloseTo(-2.5, 1);
        expect(p.backLeg.end.y).toBeCloseTo(-2.5, 1);
    });

    it('keeps the standing fighter as tall as the hitbox (72 px) and the crouch as low as the crouch hitbox (45 px)', () => {
        const headTop = (state: FighterState) => -(pose(state).head.y - 7) * RIG_SCALE;
        expect(headTop('idle')).toBeGreaterThan(64);
        expect(headTop('idle')).toBeLessThan(78);
        expect(headTop('crouch')).toBeLessThan(52);
    });

    it('puts both hands on the weapon for every weapon and aim', () => {
        for (const type of Object.values(WeaponType)) {
            const g = gripPoints(type, 0.25);
            for (const aim of [-1.5, -0.8, -0.4, 0, 0.4, 0.8, 1.1, 1.5]) {
                const p = solvePose({ state: 'idle', aim, t: 0, phase: 0, moveDir: 1, recoil: 0, grip: g });
                const c = Math.cos(p.gunAngle), s = Math.sin(p.gunAngle);
                const local = (pt: { x: number; y: number }) => {
                    const dx = pt.x - p.gunTopLeft.x, dy = pt.y - p.gunTopLeft.y;
                    return { along: dx * c + dy * s, across: -dx * s + dy * c };
                };
                const rear = local(p.frontArm.end);
                expect(Math.abs(rear.along - g.grip.x)).toBeLessThan(0.5);
                expect(Math.abs(rear.across - (g.grip.y - 1))).toBeLessThan(0.5);
                // The front hand holds the foregrip, or the barrel closer in when the foregrip is out of reach
                const front = local(p.backArm.end);
                expect(front.along).toBeGreaterThan(g.grip.x - 0.5);
                expect(front.along).toBeLessThan(g.fore.x + 0.5);
                expect(Math.abs(front.across - (g.fore.y + 0.5))).toBeLessThan(0.5);
            }
        }
    });

    it('kicks the weapon back and up on recoil', () => {
        const still = pose('idle');
        const kicked = pose('idle', { recoil: 1 });
        expect(kicked.gunTopLeft.x).toBeLessThan(still.gunTopLeft.x);
        expect(kicked.gunAngle).toBeLessThan(still.gunAngle);
    });

    it('lifts a foot while running and leans into the run', () => {
        const p = pose('run', { phase: 0 });
        expect(Math.min(p.frontLeg.end.y, p.backLeg.end.y)).toBeLessThan(-6);
        expect(p.lean).toBeGreaterThan(0.1);
    });

    it('maps upper-body points through the lean', () => {
        const p = pose('crouch');
        const top = upperPoint(p, 0, -20);
        expect(top.x).toBeGreaterThan(p.hip.x); // leaning forward
    });
});

describe('stays inside the hitbox', () => {
    const aims = [-1.2, -0.6, 0, 0.6, 1.2];
    const phases = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
    it.each(['idle', 'run', 'fly', 'fall', 'crouch'] as FighterState[])('%s pose stays within 6 px of the hitbox', state => {
        const height = state === 'crouch' ? HITBOX.crouched : HITBOX.standing;
        for (const helmet of HELMETS) for (const aim of aims) for (const phase of phases) {
            const e = bodyExtents(pose(state, { phase, aim }), helmet);
            const where = `${helmet} aim ${aim} phase ${phase.toFixed(2)}`;
            expect(e.right * RIG_SCALE, `right, ${where}`).toBeLessThanOrEqual(HITBOX.halfW + HITBOX.margin);
            expect(-e.left * RIG_SCALE, `left, ${where}`).toBeLessThanOrEqual(HITBOX.halfW + HITBOX.margin);
            expect(-e.top * RIG_SCALE, `top, ${where}`).toBeLessThanOrEqual(height + HITBOX.margin);
        }
    });
});

describe('faceAim', () => {
    it('turns left for aims behind and mirrors the angle', () => {
        expect(faceAim(0.3)).toEqual({ facing: 1, local: 0.3 });
        const left = faceAim(Math.PI - 0.3);
        expect(left.facing).toBe(-1);
        expect(left.local).toBeCloseTo(0.3);
    });
});

describe('walking', () => {
    const reach = (state: FighterState) => Math.max(
        ...Array.from({ length: 16 }, (_, i) => Math.abs(pose(state, { phase: (i / 16) * Math.PI * 2 }).frontLeg.end.x)));

    it('takes shorter steps than running', () => {
        expect(reach('walk')).toBeLessThan(reach('run'));
        expect(reach('walk')).toBeGreaterThan(4);
    });

    it('stays as tall as the hitbox', () => {
        const p = pose('walk', { phase: Math.PI / 2 });
        expect(p.hip.y).toBeGreaterThan(-31.5);
        expect(p.hip.y).toBeLessThan(-29.5);
    });
});

describe('stateOf', () => {
    const fighter = (vx: number, extra = {}) => ({ isCrouching: false, isGrounded: true, jetpackOn: false, vel: { x: vx, y: 0 }, ...extra });

    it('stands, walks or runs by ground speed', () => {
        expect(stateOf(fighter(0.2))).toBe('idle');
        expect(stateOf(fighter(-2))).toBe('walk');
        expect(stateOf(fighter(4))).toBe('run');
    });

    it('flies or falls in the air whatever the speed', () => {
        expect(stateOf(fighter(2, { isGrounded: false, jetpackOn: true }))).toBe('fly');
        expect(stateOf(fighter(2, { isGrounded: false }))).toBe('fall');
    });
});
