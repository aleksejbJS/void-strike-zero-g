import { describe, it, expect } from 'vitest';
import { Platform } from '../../../types';
import type { DeathEvent } from '../events';
import { Corpse, CorpsePointId, createCorpse } from './corpseBody';
import { speedOf, stepCorpse } from './corpseStep';

const TOP = 500;
const floor = (x = 0, w = 1000): Platform => ({ id: 'floor', x, y: TOP, w, h: 40, color: '#000' });

const death = (x: number, y: number, extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x, y, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1, ...extra,
});

const dist = (c: Corpse, a: CorpsePointId, b: CorpsePointId) =>
    Math.hypot(c.points[a].x - c.points[b].x, c.points[a].y - c.points[b].y);

/** Give every point the same velocity (units per tick). */
const launch = (c: Corpse, vx: number, vy: number) => {
    for (const p of Object.values(c.points)) { p.px = p.x - vx; p.py = p.y - vy; }
};

const inside = (p: { x: number; y: number }, r: Platform) =>
    p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;

describe('createCorpse', () => {
    it('a fresh corpse matches the standing fighter', () => {
        const c = createCorpse(death(100, 500));
        const { head, hip, anF, anB } = c.points;
        expect(hip.y - head.y).toBeGreaterThanOrEqual(25);
        expect(hip.y - head.y).toBeLessThanOrEqual(35);
        expect(Math.abs(anF.y - 500)).toBeLessThanOrEqual(3);
        expect(Math.abs(anB.y - 500)).toBeLessThanOrEqual(3);
        expect(speedOf(c)).toBe(0);
    });

    it('mirrors the body when facing left', () => {
        const right = createCorpse(death(100, 500));
        const left = createCorpse(death(100, 500, { facing: -1 }));
        expect(right.points.anF.x).toBeGreaterThan(100);
        expect(left.points.anF.x).toBeCloseTo(200 - right.points.anF.x, 6);
        expect(left.points.gunB.x).toBeLessThan(left.points.gunA.x);
    });

    it('defaults a missing facing to 1 and a missing kind to fall (older hosts)', () => {
        const e = death(100, 500) as Partial<DeathEvent>;
        delete e.facing;
        delete e.vel;
        const c = createCorpse(e as DeathEvent);
        expect(c.facing).toBe(1);
        expect(c.kind).toBe('fall');
        for (const p of Object.values(c.points)) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
    });

    it('lies longer as a body than as gib pieces', () => {
        const body = createCorpse(death(0, 0));
        const gib = createCorpse(death(0, 0, { kind: 'gib' }));
        expect([body.fadeAt, body.removeAt]).toEqual([420, 540]);
        expect([gib.fadeAt, gib.removeAt]).toEqual([240, 360]);
    });

    it('marks the waist links that join the upper half to the hip', () => {
        const c = createCorpse(death(0, 0));
        const waist = c.links.filter(l => l.waist).map(l => [l.a, l.b].sort().join('-')).sort();
        expect(waist).toEqual(['hip-neck', 'hip-shB', 'hip-shF']);
        for (const l of c.links) expect(l.len).toBeGreaterThan(0);
    });
});

describe('stepCorpse', () => {
    it('joint limits hold', () => {
        const c = createCorpse(death(300, TOP - 200));
        const rest = { legF: dist(c, 'hip', 'anF'), legB: dist(c, 'hip', 'anB'), armF: dist(c, 'shF', 'haF'), armB: dist(c, 'shB', 'haB') };
        for (let t = 1; t <= 600; t++) {
            stepCorpse(c, [floor()]);
            if (t % 10 !== 0) continue;
            expect(dist(c, 'hip', 'anF')).toBeGreaterThanOrEqual(0.6 * rest.legF);
            expect(dist(c, 'hip', 'anB')).toBeGreaterThanOrEqual(0.6 * rest.legB);
            expect(dist(c, 'shF', 'haF')).toBeGreaterThanOrEqual(0.5 * rest.armF);
            expect(dist(c, 'shB', 'haB')).toBeGreaterThanOrEqual(0.5 * rest.armB);
        }
        expect(c.age).toBe(600);
    });

    it('a body comes to rest on a platform', () => {
        const c = createCorpse(death(300, TOP - 60));
        launch(c, 1, 0);
        for (let t = 0; t < 480; t++) stepCorpse(c, [floor()]);
        for (const p of Object.values(c.points)) expect(p.y).toBeLessThanOrEqual(TOP + 0.5);
        expect(speedOf(c)).toBeLessThan(0.05);
    });

    it('a body slides off an edge', () => {
        const ledge = floor(0, 300);
        const c = createCorpse(death(290, TOP));
        launch(c, 2, 0);
        for (let t = 0; t < 240; t++) stepCorpse(c, [ledge]);
        expect(c.points.hip.y).toBeGreaterThan(TOP);
    });

    it('corpse born inside a platform is pushed out calmly', () => {
        const wall: Platform = { id: 'wall', x: 100, y: 300, w: 60, h: 300, color: '#000' };
        const c = createCorpse(death(110, TOP, { facing: -1 }));
        expect(inside(c.points.hip, wall)).toBe(true);
        for (let t = 0; t < 60; t++) stepCorpse(c, [floor(0, 400), wall]);
        for (const p of Object.values(c.points)) expect(inside(p, wall)).toBe(false);
        expect(speedOf(c)).toBeLessThan(8);
    });
});
