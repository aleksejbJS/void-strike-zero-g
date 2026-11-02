import { describe, expect, it } from 'vitest';
import { JETPACKS, TAILS, TailId } from '../../../build/buildParts';
import { Vector2, WeaponType } from '../../../../types';
import { solvePose, upperPoint } from '../fighterPose';
import { gripPoints } from '../weaponGrips';
import { PartMotion, localVelocity } from './partMotion';
import { PartMotionFrame } from './partMotionFrame';
import { flameOutlines } from './jetpackFlame';
import { TAIL_ROOT, tailPoints } from './tails';

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const POSE = solvePose({ state: 'fly', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip });
const ROOT = upperPoint(POSE, TAIL_ROOT.x, TAIL_ROOT.y);
const SHAPED = TAILS.filter((t): t is Exclude<TailId, 'none'> => t !== 'none');
// The top rig unit of a flame sits under the nozzle dot, right where the tail leaves the body
const NOZZLE_SLACK = 1;
const SAMPLES_PER_SEGMENT = 10;

/** Steady flight: the springs settled after two seconds at this px/s velocity. */
const settledFlight = (vel: Vector2): PartMotionFrame => {
    const pm = new PartMotion();
    let frame = pm.update(1 / 120, vel, 'fly', Infinity);
    for (let i = 0; i < 240; i++) frame = pm.update(1 / 120, vel, 'fly', Infinity);
    return frame;
};

const cross = (o: Vector2, a: Vector2, b: Vector2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const inTriangle = (p: Vector2, [a, b, c]: Vector2[]) => {
    const d = [cross(a, b, p), cross(b, c, p), cross(c, a, p)];
    return d.every(v => v >= 0) || d.every(v => v <= 0);
};

/** Points along the tail's centre line, every segment sampled, so a segment crossing the flame is caught. */
const alongTail = (pts: Vector2[]) => pts.slice(1).flatMap((p, i) => Array.from({ length: SAMPLES_PER_SEGMENT + 1 }, (_, k) => {
    const s = k / SAMPLES_PER_SEGMENT, a = pts[i];
    return { x: a.x + (p.x - a.x) * s, y: a.y + (p.y - a.y) * s };
}));

const FLIGHTS: [string, Vector2][] = [
    ['hovering', { x: 0, y: 0 }],
    ['rising', { x: 0, y: -400 }],
    ['flying forward', localVelocity({ x: 300, y: -100 }, 1)],
    ['flying backwards', localVelocity({ x: -300, y: -100 }, 1)],
];

describe('tails stay out of the jetpack flame in flight', () => {
    it.each(FLIGHTS)('%s: no tail crosses any flame', (_, vel) => {
        const settled = settledFlight(vel);
        for (const tail of SHAPED) {
            for (let wave = 0; wave < 2 * Math.PI; wave += 0.1) {
                const line = alongTail(tailPoints(tail, ROOT, { ...settled, tailWave: wave }));
                for (const jetpack of JETPACKS) {
                    for (const flame of flameOutlines(POSE, jetpack, 1)) {
                        const nozzleY = flame[0].y;
                        const inside = line.filter(p => p.y > nozzleY + NOZZLE_SLACK && inTriangle(p, flame));
                        expect(inside, `${tail} with ${jetpack}, wave ${wave.toFixed(1)}`).toEqual([]);
                    }
                }
            }
        }
    });
});
