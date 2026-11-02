import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { DEFAULT_BUILD, TAILS, TailId } from '../../../build/buildParts';
import { WeaponType } from '../../../../types';
import { FighterLook } from '../fighterLook';
import { solvePose, upperPoint } from '../fighterPose';
import { gripPoints } from '../weaponGrips';
import { IDLE_PARTS, PartMotionFrame } from './partMotionFrame';
import { drawTail, tailPoints } from './tails';

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const POSE = solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip });
const ROOT = upperPoint(POSE, -6, -1);
const SHAPED = TAILS.filter((t): t is Exclude<TailId, 'none'> => t !== 'none');

const lookWith = (tail: TailId): FighterLook => ({
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x38bdf8, pattern: 0x8b5cf6, build: { ...DEFAULT_BUILD, tail },
});

const instructionCount = (draw: (g: Graphics) => void) => {
    const g = new Graphics();
    draw(g);
    const n = g.context.instructions.length;
    g.destroy({ children: true, context: true });
    return n;
};

const lengthOf = (pts: { x: number; y: number }[]) =>
    pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

describe('tails', () => {
    it('none draws nothing', () => {
        expect(tailPoints('none', ROOT, IDLE_PARTS)).toEqual([]);
        expect(instructionCount(g => drawTail(g, POSE, lookWith('none'), IDLE_PARTS))).toBe(0);
    });

    it('cat tail is longer than 20 rig units and ends above its root at rest', () => {
        const pts = tailPoints('cat', ROOT, IDLE_PARTS);
        expect(pts[0]).toEqual(ROOT);
        expect(lengthOf(pts)).toBeGreaterThan(20);
        expect(pts[pts.length - 1].y).toBeLessThan(ROOT.y);
    });

    it('bending back moves the tip further behind', () => {
        for (const tail of SHAPED) {
            const tipX = (tailBend: number) => tailPoints(tail, ROOT, { ...IDLE_PARTS, tailBend }).at(-1)!.x;
            expect(tipX(1), tail).toBeLessThan(tipX(0));
        }
    });

    it('keeps the length of every tail whatever the motion', () => {
        for (const tail of SHAPED) {
            const rest = lengthOf(tailPoints(tail, ROOT, IDLE_PARTS));
            const moved = lengthOf(tailPoints(tail, ROOT, { ...IDLE_PARTS, tailBend: 1, tailLift: -1, tailWave: 2 }));
            expect(moved, tail).toBeCloseTo(rest, 6);
        }
    });

    it('lizard and mech draw without throwing for extreme motion values (±1)', () => {
        const extremes: PartMotionFrame[] = [];
        for (const tailLift of [-1, 1]) {
            for (const tailBend of [-1, 1]) {
                for (const tailWave of [0, Math.PI / 2, Math.PI, 1e4]) extremes.push({ ...IDLE_PARTS, tailLift, tailBend, tailWave });
            }
        }
        for (const tail of SHAPED) {
            for (const m of extremes) {
                expect(instructionCount(g => drawTail(g, POSE, lookWith(tail), m)), `${tail} ${JSON.stringify(m)}`).toBeGreaterThan(0);
                for (const p of tailPoints(tail, ROOT, m)) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
            }
        }
    });
});
