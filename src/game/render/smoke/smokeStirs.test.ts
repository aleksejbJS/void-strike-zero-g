import { describe, it, expect } from 'vitest';
import { SmokeStirs } from './smokeStirs';
import type { FlameAir } from './flameAir';
import type { Stir } from './airGrid';
import { Beam, Entity, GameState, Particle, Projectile, WeaponType } from '../../../types';

const projectile = (id: string, x: number, y: number, vx: number, vy: number, type = WeaponType.ROCKET_LAUNCHER): Projectile =>
    ({ id, ownerId: 'a', pos: { x, y }, vel: { x: vx, y: vy }, type, radius: 4, active: true });
const ring = (id: string, x: number, y: number, size = 12): Particle =>
    ({ id, pos: { x, y }, vel: { x: 0, y: 0 }, life: 1, decay: 0.05, color: '#fff', size, type: 'ring' });
const beam = (id: string, sx: number, sy: number, ex: number, ey: number): Beam =>
    ({ id, start: { x: sx, y: sy }, end: { x: ex, y: ey }, color: '#0ff', life: 1, width: 4 });
const fighter = (vx: number, vy: number, dead = false): Entity =>
    ({ id: 'p1', pos: { x: 100, y: 400 }, vel: { x: vx, y: vy }, width: 20, height: 60, dead } as Entity);

/** The parts of a game state the collector reads. */
const frame = (f: Partial<Pick<GameState, 'projectiles' | 'particles' | 'beams' | 'players'>> = {}): GameState =>
    ({ projectiles: [], particles: [], beams: [], players: [], ...f }) as unknown as GameState;

const flameWith = (streams: { x: number; y: number; angle: number; firing: boolean; power: number }[]): FlameAir => ({
    streams: () => streams,
    soot: () => [],
});

const gaps = (out: Stir[]) => out.slice(1).map((s, i) => Math.hypot(s.x - out[i].x, s.y - out[i].y));

describe('SmokeStirs projectiles', () => {
    it('chains stirs from where the shot was to where it is, along its flight and 7 px apart', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 10, 0)] }), null, out);
        out.length = 0;
        stirs.collect(frame({ projectiles: [projectile('r1', 140, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(6);                          // 100 -> 140 in 7 px steps: 0, 7, ..., 35
        expect(out[0].x).toBeCloseTo(100, 6);
        for (const g of gaps(out)) expect(g).toBeCloseTo(7, 6);
        for (const s of out) { expect(s.y).toBeCloseTo(200, 6); expect(s.vx).toBeCloseTo(650, 6); expect(s.vy).toBeCloseTo(0, 6); }
    });

    it('drives the air along the line of flight, whatever its direction', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 0, 0)] }), null, out);
        out.length = 0;
        stirs.collect(frame({ projectiles: [projectile('r1', 130, 240, 0, 0)] }), null, out);   // 3-4-5: 50 px along (0.6, 0.8)
        expect(out.length).toBeGreaterThan(0);
        for (const s of out) { expect(s.vx).toBeCloseTo(0.6 * 650, 6); expect(s.vy).toBeCloseTo(0.8 * 650, 6); }
    });

    it('drives the air leftward and upward when the projectile flies that way', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 130, 240, 0, 0)] }), null, out);
        out.length = 0;
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 0, 0)] }), null, out);   // 50 px along (-0.6, -0.8)
        expect(out.length).toBe(8);                          // 0, 7, ..., 49
        expect(out[0].x).toBeCloseTo(130, 6); expect(out[0].y).toBeCloseTo(240, 6);
        for (let i = 1; i < out.length; i++) { expect(out[i].x).toBeLessThan(out[i - 1].x); expect(out[i].y).toBeLessThan(out[i - 1].y); }
        for (const s of out) { expect(s.vx).toBeCloseTo(-0.6 * 650, 6); expect(s.vy).toBeCloseTo(-0.8 * 650, 6); }
    });

    it('makes no chain for a position that is not a finite number, and recovers on the next frame', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 10, 0)] }), null, out);
        stirs.collect(frame({ projectiles: [projectile('r1', Number.NaN, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(0);
        stirs.collect(frame({ projectiles: [projectile('r1', Infinity, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(0);
        stirs.collect(frame({ projectiles: [projectile('r1', 150, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(0);                          // the last good point was lost with the bad ones: nothing to chain from
        stirs.collect(frame({ projectiles: [projectile('r1', 170, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(3);                          // 150 -> 170: 0, 7, 14
    });

    it('caps a chain at 400 points, whatever the distance', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 0, 0, 0, 0)] }), null, out);
        stirs.collect(frame({ projectiles: [projectile('r1', 1e9, 0, 0, 0)] }), null, out);
        expect(out.length).toBe(400);
        stirs.collect(frame({ beams: [beam('b1', 0, 0, 1e7, 0)] }), null, out);
        expect(out.length).toBe(400);
    });

    it('uses pos - vel as the previous point the first frame a projectile is seen', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 15, 0)] }), null, out);
        expect(out.length).toBe(3);                          // 85 -> 100: 0, 7, 14
        expect(out[0].x).toBeCloseTo(85, 6);
    });

    it('stirs nothing for a projectile that did not move', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 0, 0)] }), null, out);
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 0, 0)] }), null, out);
        expect(out.length).toBe(0);
    });

    it('rockets and grenades are big and hot; bullets are small and cool', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('g', 100, 200, 10, 0, WeaponType.GRENADE_LAUNCHER)] }), null, out);
        expect(out[0]).toMatchObject({ r: 16, rate: 40, heat: 15, carve: 21 });
        expect(Math.hypot(out[0].vx, out[0].vy)).toBeCloseTo(650, 6);
        out.length = 0;
        stirs.collect(frame({ projectiles: [projectile('b', 100, 300, 10, 0, WeaponType.MACHINE_GUN)] }), null, out);
        expect(out[0]).toMatchObject({ r: 10, rate: 40, carve: 15 });
        expect(out[0].heat ?? 0).toBe(0);
        expect(Math.hypot(out[0].vx, out[0].vy)).toBeCloseTo(480, 6);
    });

    it('forgets projectiles that are gone', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('a', 0, 0, 10, 0), projectile('b', 0, 50, 10, 0)] }), null, out);
        expect(stirs.trackedProjectiles).toBe(2);
        stirs.collect(frame({ projectiles: [projectile('b', 10, 50, 10, 0)] }), null, out);
        expect(stirs.trackedProjectiles).toBe(1);
        stirs.collect(frame(), null, out);
        expect(stirs.trackedProjectiles).toBe(0);
    });
});

describe('SmokeStirs blasts and beams', () => {
    it('a fresh ring stirs a radial blast once, not on later frames', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        const state = frame({ particles: [ring('ring_1', 300, 200, 24)] });
        stirs.collect(state, null, out);
        expect(out.length).toBe(1);
        expect(out[0]).toMatchObject({ x: 300, y: 200, r: 140, vx: 950, radial: true, rate: 60, heat: 55, carve: 40 });
        stirs.collect(state, null, out);
        expect(out.length).toBe(0);
        stirs.collect(state, null, out);
        expect(out.length).toBe(0);
    });

    it('a small ring still reaches at least 0.6 of the base 70 px', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ particles: [ring('ring_1', 0, 0, 2)] }), null, out);
        expect(out[0].r).toBeCloseTo(42, 6);
    });

    it('only rings stir: other particles are ignored', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ particles: [{ ...ring('s', 0, 0), type: 'smoke' }, { ...ring('f', 0, 0), type: 'fire' }] }), null, out);
        expect(out.length).toBe(0);
    });

    it('a second ring after the first stirs too', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ particles: [ring('ring_1', 0, 0)] }), null, out);
        stirs.collect(frame({ particles: [ring('ring_1', 0, 0), ring('ring_2', 50, 0)] }), null, out);
        expect(out.length).toBe(1);
        expect(out[0].x).toBe(50);
    });

    it('remembers ring ids from the previous frame only, so the set stays bounded', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ particles: [ring('ring_1', 0, 0)] }), null, out);
        stirs.collect(frame(), null, out);
        expect(stirs.trackedIds).toBe(0);
    });

    it('a fresh beam stirs a chain along it once, not on later frames', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        const state = frame({ beams: [beam('beam_1', 0, 100, 0, 150)] });     // straight down, 50 px
        stirs.collect(state, null, out);
        expect(out.length).toBe(8);                          // 0, 7, ..., 49
        for (const g of gaps(out)) expect(g).toBeCloseTo(7, 6);
        for (const s of out) {
            expect(s).toMatchObject({ r: 13, rate: 45, heat: 12, carve: 33 });
            expect(s.vx).toBeCloseTo(0, 6); expect(s.vy).toBeCloseTo(700, 6);
        }
        stirs.collect(state, null, out);
        expect(out.length).toBe(0);
    });
});

describe('SmokeStirs flame streams', () => {
    it('a firing stream stirs a 260 px chain growing from r 12 to 38', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame(), flameWith([{ x: 100, y: 300, angle: 0, firing: true, power: 1 }]), out);
        expect(out.length).toBe(38);                         // 0, 7, ..., 259
        for (const g of gaps(out)) expect(g).toBeCloseTo(7, 6);
        expect(out[0]).toMatchObject({ x: 100, y: 300, r: 12, rate: 27, heat: 30, soot: 7, carve: 9 });
        expect(out[0].vx).toBeCloseTo(520, 6);
        expect(out[out.length - 1].x).toBeCloseTo(100 + 37 * 7, 6);
        expect(out[out.length - 1].r).toBeGreaterThan(37);
        expect(out[out.length - 1].r).toBeLessThan(38);
        for (let i = 1; i < out.length; i++) expect(out[i].r).toBeGreaterThan(out[i - 1].r);
    });

    it('follows the aim of the stream', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame(), flameWith([{ x: 0, y: 0, angle: Math.PI / 2, firing: true, power: 1 }]), out);
        expect(out[1].x).toBeCloseTo(0, 6);
        expect(out[1].y).toBeCloseTo(7, 6);
    });

    it('a stream that is not firing stirs nothing, even while its power fades out', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame(), flameWith([{ x: 0, y: 0, angle: 0, firing: false, power: 0.8 }]), out);
        expect(out.length).toBe(0);
    });
});

describe('SmokeStirs fighters', () => {
    it('a fighter moving faster than 40 px/s (vel x 60) stirs the air at its middle', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ players: [fighter(5, -2)] }), null, out);
        expect(out.length).toBe(1);
        expect(out[0]).toMatchObject({ x: 100, y: 370, r: 26, vx: 300, vy: -120, rate: 24 });
    });

    it('a fighter under 40 px/s stirs nothing', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ players: [fighter(0.5, 0.2)] }), null, out);        // 32 px/s
        expect(out.length).toBe(0);
    });

    it('a dead fighter stirs nothing', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ players: [fighter(9, 0, true)] }), null, out);
        expect(out.length).toBe(0);
    });
});

describe('SmokeStirs reset', () => {
    it('forgets projectiles and remembered ring and beam ids, so old ones stir again as new', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        const state = frame({ projectiles: [projectile('r1', 100, 200, 10, 0)], particles: [ring('ring_1', 0, 0)], beams: [beam('b1', 0, 0, 0, 20)] });
        stirs.collect(state, null, out);
        stirs.reset();
        expect(stirs.trackedProjectiles).toBe(0);
        expect(stirs.trackedIds).toBe(0);
        // Moved far while nothing was watching: without the memory the chain starts one tick back, not at the old point
        stirs.collect(frame({ projectiles: [projectile('r1', 5000, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(2);                          // 4990 -> 5000: 0, 7
        expect(out[0].x).toBeCloseTo(4990, 6);
    });
});

describe('SmokeStirs output array', () => {
    it('clears and refills the array it is given, without replacing it', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [{ x: 1, y: 1, r: 1, vx: 0, vy: 0, rate: 0 }];
        const same = out;
        stirs.collect(frame({ players: [fighter(5, 0)] }), null, out);
        expect(out).toBe(same);
        expect(out.length).toBe(1);
        expect(out[0].r).toBe(26);                           // the stale stir is gone
    });
});
