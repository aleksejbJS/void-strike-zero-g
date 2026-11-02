import { describe, it, expect } from 'vitest';
import { Platform } from '../../../types';
import type { DeathEvent } from '../events';
import { Corpse, createCorpse } from './corpseBody';
import { MAX_SPEED, speedOf, stepCorpse } from './corpseStep';
import { launchCorpse, pushCorpses } from './corpseLaunch';

const TOP = 500;
const FLOOR: Platform = { id: 'floor', x: -2000, y: TOP, w: 4000, h: 40, color: '#000' };

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 0, y: TOP, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1, ...extra,
});

const run = (c: Corpse, ticks: number, platforms: Platform[] = [FLOOR], each?: () => void) => {
    for (let i = 0; i < ticks; i++) { stepCorpse(c, platforms); each?.(); }
};

/** A corpse launched by `kind`, with no hit origin. */
const launched = (kind: DeathEvent['kind']) => {
    const c = createCorpse(death({ kind }));
    launchCorpse(c, undefined, { x: 0, y: 0 });
    return c;
};

describe('pushCorpses', () => {
    it('a blast right on a body is slowed as a whole to the speed cap, not point by point', () => {
        const c = launched('fall');
        run(c, 480);
        const hip = { ...c.points.hip };
        const before = Object.values(c.points).map(p => ({ x: p.x, y: p.y }));
        pushCorpses([c], hip.x + 5, hip.y, 2);
        const speeds = Object.values(c.points).map(p => Math.hypot(p.x - p.px, p.y - p.py));
        expect(Math.max(...speeds)).toBeCloseTo(MAX_SPEED, 5);
        // Every kick kept its direction and its share of the strongest one
        const kicks = Object.values(c.points).map((p, i) => ({ x: p.x - p.px, y: p.y - p.py, at: before[i] }));
        const nearest = kicks.reduce((a, k) => (Math.hypot(k.at.x - hip.x - 5, k.at.y - hip.y) < Math.hypot(a.at.x - hip.x - 5, a.at.y - hip.y) ? k : a));
        expect(Math.hypot(nearest.x, nearest.y)).toBeCloseTo(MAX_SPEED, 5);
        expect(Math.min(...speeds)).toBeLessThan(MAX_SPEED / 2);
    });

    it('an explosion pushes a lying body', () => {
        const near = launched('fall');
        const far = createCorpse(death({ x: 430 }));
        launchCorpse(far, undefined, { x: 0, y: 0 });
        run(near, 480);
        run(far, 480);
        const farBefore = JSON.stringify(far.points);
        // Lying still before the blast, so the speed afterwards is the blast's doing
        expect(speedOf(near)).toBeLessThan(0.1);
        pushCorpses([near, far], near.points.hip.x + 30, near.points.hip.y);
        expect(speedOf(near)).toBeGreaterThan(1);
        // 400 units away: not touched at all
        expect(Math.abs(far.points.hip.x - near.points.hip.x - 30)).toBeGreaterThan(300);
        expect(JSON.stringify(far.points)).toBe(farBefore);
        // It hops off the floor, not only slides along it
        const top = near.points.hip.y;
        let highest = top;
        run(near, 60, [FLOOR], () => { highest = Math.min(highest, near.points.hip.y); });
        expect(top - highest).toBeGreaterThan(15);
    });
});
