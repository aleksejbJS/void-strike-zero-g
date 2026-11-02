import { describe, expect, it } from 'vitest';
import { Vector2 } from '../../../../types';
import { FighterState } from '../fighterPose';
import { PartMotion, localVelocity } from './partMotion';
import { PartMotionFrame } from './partMotionFrame';

const DT = 1 / 120;
const STILL: Vector2 = { x: 0, y: 0 };
const NEVER = Infinity;

/** Feed `frames` identical frames and return the last one. */
const run = (pm: PartMotion, frames: number, vel: Vector2, state: FighterState, firedAgoMs = NEVER): PartMotionFrame => {
    let frame = pm.update(DT, vel, state, firedAgoMs);
    for (let i = 1; i < frames; i++) frame = pm.update(DT, vel, state, firedAgoMs);
    return frame;
};

describe('localVelocity', () => {
    it('makes forward +x for both facings', () => {
        expect(localVelocity({ x: -5, y: 0 }, -1)).toEqual(localVelocity({ x: 5, y: 0 }, 1));
        expect(localVelocity({ x: -5, y: 3 }, -1)).toEqual({ x: 5, y: 3 });
    });

    it('turns running backwards into negative x', () => {
        expect(localVelocity({ x: -5, y: 0 }, 1).x).toBeLessThan(0);
        expect(localVelocity({ x: 5, y: 0 }, -1).x).toBeLessThan(0);
    });
});

describe('PartMotion tail', () => {
    it('idle settles to a resting tail', () => {
        const fresh = run(new PartMotion(), 100, STILL, 'idle');
        expect(Math.abs(fresh.tailLift)).toBeLessThan(0.02);
        expect(Math.abs(fresh.tailBend)).toBeLessThan(0.02);

        // and it comes back to rest after being pushed away
        const pm = new PartMotion();
        expect(run(pm, 60, { x: 300, y: 0 }, 'run').tailBend).toBeGreaterThan(0.3);
        const settled = run(pm, 100, STILL, 'idle');
        expect(Math.abs(settled.tailLift)).toBeLessThan(0.02);
        expect(Math.abs(settled.tailBend)).toBeLessThan(0.02);
    });

    it('running forward bends the tail back', () => {
        expect(run(new PartMotion(), 120, { x: 300, y: 0 }, 'run').tailBend).toBeGreaterThan(0.3);
    });

    it('running backwards bends the tail forward', () => {
        const vel = localVelocity({ x: -5 * 60, y: 0 }, 1);
        expect(vel.x).toBeLessThan(0);
        expect(run(new PartMotion(), 120, vel, 'run').tailBend).toBeLessThan(0);
    });

    it('bends the same way when facing left', () => {
        const right = run(new PartMotion(), 120, localVelocity({ x: 300, y: 0 }, 1), 'run');
        const left = run(new PartMotion(), 120, localVelocity({ x: -300, y: 0 }, -1), 'run');
        expect(left.tailBend).toBeCloseTo(right.tailBend, 10);
        expect(left.tailBend).toBeGreaterThan(0.3);
    });

    it('falling lifts the tail, and so does the jetpack blast in flight', () => {
        expect(run(new PartMotion(), 120, { x: 0, y: 400 }, 'fall').tailLift).toBeGreaterThan(0.1);
        expect(run(new PartMotion(), 120, { x: 0, y: 0 }, 'fly').tailLift).toBeGreaterThan(0.5);
        expect(run(new PartMotion(), 120, { x: 0, y: -200 }, 'fly').tailLift).toBeGreaterThan(0.5);
    });

    it('flying backwards does not tuck the tail forward', () => {
        expect(run(new PartMotion(), 120, { x: -300, y: 0 }, 'fly').tailBend).toBeGreaterThan(-0.02);
    });

    it('wriggles faster while running', () => {
        const idle = run(new PartMotion(), 120, STILL, 'idle').tailWave;
        const running = run(new PartMotion(), 120, { x: 300, y: 0 }, 'run').tailWave;
        expect(idle).toBeGreaterThan(0);
        expect(running).toBeGreaterThan(idle * 1.5);
    });
});

describe('PartMotion ears, lamp and wings', () => {
    it('blows floppy ears back when moving forward, not when standing or backing up', () => {
        expect(run(new PartMotion(), 120, { x: 300, y: 0 }, 'run').earFlop).toBeGreaterThan(0.5);
        expect(run(new PartMotion(), 120, STILL, 'idle').earFlop).toBeCloseTo(0, 2);
        expect(run(new PartMotion(), 120, { x: -300, y: 0 }, 'run').earFlop).toBeGreaterThanOrEqual(0);
        for (const vel of [{ x: 900, y: 900 }, { x: -900, y: -900 }]) {
            const flop = run(new PartMotion(), 240, vel, 'fall').earFlop;
            expect(flop).toBeGreaterThanOrEqual(0);
            expect(flop).toBeLessThanOrEqual(1);
        }
    });

    it('the lamp is on for 120 ms after a shot', () => {
        const pm = new PartMotion();
        expect(pm.update(DT, STILL, 'idle', NEVER).lampOn).toBe(false);
        expect(pm.update(DT, STILL, 'idle', 0).lampOn).toBe(true);
        expect(pm.update(DT, STILL, 'idle', 119).lampOn).toBe(true);
        expect(pm.update(DT, STILL, 'idle', 121).lampOn).toBe(false);
        expect(pm.update(DT, STILL, 'idle', 5000).lampOn).toBe(false);
    });

    it('wings open in flight and fold on the ground', () => {
        const pm = new PartMotion();
        expect(run(pm, 1, STILL, 'idle').wingsOpen).toBeCloseTo(0, 2);
        expect(run(pm, 60, STILL, 'fly').wingsOpen).toBeGreaterThan(0.95);
        expect(run(pm, 60, STILL, 'idle').wingsOpen).toBeLessThan(0.05);
    });
});

describe('PartMotion stability', () => {
    it('no value jumps more than 0.2 between two 1/120 s frames', () => {
        const pm = new PartMotion();
        const scenes: [Vector2, FighterState, number][] = [
            [STILL, 'idle', 30], [{ x: 300, y: 0 }, 'run', 60], [{ x: -300, y: 0 }, 'run', 60],
            [{ x: 0, y: 900 }, 'fall', 60], [{ x: 0, y: -400 }, 'fly', 60], [STILL, 'crouch', 60], [STILL, 'idle', 60],
        ];
        let prev = pm.update(DT, STILL, 'idle', NEVER);
        for (const [vel, state, frames] of scenes) {
            for (let i = 0; i < frames; i++) {
                const next = pm.update(DT, vel, state, NEVER);
                for (const key of ['tailLift', 'tailBend', 'tailWave', 'earFlop', 'wingsOpen'] as const) {
                    expect(Math.abs(next[key] - prev[key])).toBeLessThan(0.2);
                }
                prev = next;
            }
        }
    });

    it('stays calm after a long frame hitch', () => {
        const pm = new PartMotion();
        const frame = pm.update(0.1, { x: 300, y: 0 }, 'run', NEVER);
        for (const v of [frame.tailLift, frame.tailBend, frame.earFlop, frame.wingsOpen]) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });
});
