// Particle kinds: spawn values, per-kind motion and the particle budget.

import { describe, it, expect, beforeEach } from 'vitest';
import { GameMode, Particle, Platform } from '../../types';
import { createMockState } from '../../test/mocks';
import { createParticles, PARTICLE_BUDGET } from './effectSpawn';
import { updateParticles } from './particles';

let state: ReturnType<typeof createMockState>;

beforeEach(() => {
    state = createMockState(GameMode.DEATHMATCH);
});

// A long-lived particle so motion tests are not cut short by fading
const makeParticle = (over: Partial<Particle>): Particle => ({
    id: 'p', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
    life: 1, decay: 0.0001, color: '#fff', size: 2, ...over
});

const platform = (x: number, y: number, w: number, h: number): Platform => ({ id: 'plat', x, y, w, h, color: '#444' });

// Runs one particle through n physics ticks
const run = (p: Particle, n: number) => { state.particles = [p]; for (let i = 0; i < n; i++) updateParticles(state); };

describe('particle motion', () => {
    it.each(['spark', 'ember'] as const)('%s falls and loses speed', type => {
        const p = makeParticle({ type, vel: { x: 4, y: 0 } });
        run(p, 10);
        expect(p.vel.y).toBeGreaterThan(1);
        expect(p.vel.x).toBeLessThan(4);
        expect(p.pos.y).toBeGreaterThan(0);
    });

    it('smoke rises slowly and never falls', () => {
        const p = makeParticle({ type: 'smoke' });
        run(p, 30);
        expect(p.pos.y).toBeLessThan(0);
        expect(p.vel.y).toBeLessThanOrEqual(0);
    });

    it('smoke launched downwards stops sinking after one tick', () => {
        const p = makeParticle({ type: 'smoke', vel: { x: 0, y: 2 } });
        run(p, 1);
        expect(p.vel.y).toBeLessThanOrEqual(0);
    });

    it('blood droplets fall and stop on a platform', () => {
        state.platforms = [platform(0, 100, 200, 50)];
        const p = makeParticle({ type: 'blood', pos: { x: 50, y: 0 }, vel: { x: 1, y: 0 } });
        run(p, 60);
        expect(p.pos.y).toBe(100);
        expect(p.vel.y).toBe(0);
        expect(p.vel.x).toBe(0);
    });

    it('blood droplets keep falling past the edge of a platform', () => {
        state.platforms = [platform(0, 100, 200, 50)];
        const p = makeParticle({ type: 'blood', pos: { x: 300, y: 0 } });
        run(p, 60);
        expect(p.pos.y).toBeGreaterThan(150);
    });

    it('blood spawned a hair inside the platform top still lands on it', () => {
        // A fighter standing on a platform overlaps it by a sub-pixel slop
        state.platforms = [platform(0, 100, 200, 50)];
        const p = makeParticle({ type: 'blood', pos: { x: 50, y: 100.1 }, vel: { x: 1, y: 1 } });
        run(p, 60);
        expect(p.pos.y).toBe(100);
        expect(p.vel.y).toBe(0);
    });

    it('blood spawned well inside a platform is not snapped to its top', () => {
        state.platforms = [platform(0, 100, 200, 50)];
        const p = makeParticle({ type: 'blood', pos: { x: 50, y: 120 }, vel: { x: 0, y: 1 } });
        run(p, 5);
        expect(p.pos.y).toBeGreaterThan(120);
    });

    it('a fast blood droplet does not tunnel through a thin platform', () => {
        state.platforms = [platform(0, 100, 200, 4)];
        const p = makeParticle({ type: 'blood', pos: { x: 50, y: 90 }, vel: { x: 0, y: 20 } });
        run(p, 1);
        expect(p.pos.y).toBe(100);
        expect(p.vel.y).toBe(0);
    });

    it.each(['flash', 'fireball', 'ring', 'puff'] as const)('%s only fades, in place', type => {
        const p = makeParticle({ type, pos: { x: 7, y: 9 }, vel: { x: 3, y: -2 }, decay: 0.05 });
        run(p, 5);
        expect(p.pos).toEqual({ x: 7, y: 9 });
        expect(p.life).toBeCloseTo(1 - 5 * 0.05, 10);
    });

    it('dust drifts with its velocity and fades', () => {
        const p = makeParticle({ type: 'dust', vel: { x: 4, y: -2 }, decay: 0.014 });
        run(p, 1);
        expect(p.pos).toEqual({ x: 4, y: -2 });
        expect(p.vel.x).toBeCloseTo(4 * 0.94, 10);
        expect(p.vel.y).toBeCloseTo(-2 * 0.94, 10);
        run(p, 19);
        expect(p.pos.x).toBeGreaterThan(4);
        expect(p.pos.y).toBeLessThan(-2);
        expect(p.life).toBeCloseTo(1 - 20 * 0.014, 10);
    });

    it('removes particles whose life ran out', () => {
        run(makeParticle({ type: 'flash', decay: 0.5 }), 2);
        expect(state.particles).toHaveLength(0);
    });
});

describe('particle spawn values', () => {
    const range = (type: Particle['type'], key: 'decay' | 'size') => {
        createParticles(state, 0, 0, 200, '#fff', type);
        const values = state.particles.map(p => p[key]);
        return { min: Math.min(...values), max: Math.max(...values) };
    };

    it.each([
        ['flash', 0.1, 0.1],
        ['fireball', 0.015, 0.015],
        ['ring', 0.017, 0.017],
        ['smoke', 0.009, 0.009],
        ['puff', 0.024, 0.024],
        ['dust', 0.014, 0.014],
        ['ember', 0.010, 0.017],
        ['spark', 0.014, 0.028],
        ['blood', 0.012, 0.021],
    ] as const)('%s decays per tick within %f..%f', (type, lo, hi) => {
        const { min, max } = range(type, 'decay');
        expect(min).toBeGreaterThanOrEqual(lo);
        expect(max).toBeLessThanOrEqual(hi);
    });

    it.each([
        ['ember', 2, 4],
        ['dust', 2, 3.5],
        ['blood', 1.5, 2.5],
    ] as const)('%s size is within %f..%f', (type, lo, hi) => {
        const { min, max } = range(type, 'size');
        expect(min).toBeGreaterThanOrEqual(lo);
        expect(max).toBeLessThanOrEqual(hi);
    });

    it('records the requested kind on every particle', () => {
        createParticles(state, 0, 0, 3, '#fff', 'puff');
        expect(state.particles.map(p => p.type)).toEqual(['puff', 'puff', 'puff']);
    });

    it('lets the caller pin decay, size and velocity', () => {
        const vel = { x: 1.5, y: -2 };
        createParticles(state, 5, 6, 2, '#fff', 'smoke', { decay: 0.07, size: 40, vel });
        for (const p of state.particles) {
            expect(p.decay).toBe(0.07);
            expect(p.size).toBe(40);
            expect(p.vel).toEqual({ x: 1.5, y: -2 });
        }
        // Each particle owns its velocity: moving one must not move the other
        state.particles[0].vel.x = 99;
        expect(state.particles[1].vel.x).toBe(1.5);
        expect(vel.x).toBe(1.5);
    });
});

describe('particle budget', () => {
    const fill = (n: number) => Array.from({ length: n }, (_, i): Particle => ({
        id: `p${i}`, pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, life: 1, decay: 0.01, color: '#fff', size: 2, type: 'spark'
    }));

    it('over the budget, smoke/puff/dust are skipped but sparks still spawn', () => {
        state.particles = fill(501);
        createParticles(state, 0, 0, 3, '#fff', 'smoke');
        createParticles(state, 0, 0, 3, '#fff', 'puff');
        createParticles(state, 0, 0, 3, '#fff', 'dust');
        expect(state.particles).toHaveLength(501);
        createParticles(state, 0, 0, 3, '#fff', 'spark');
        expect(state.particles).toHaveLength(504);
        createParticles(state, 0, 0, 2, '#fff', 'ember');
        createParticles(state, 0, 0, 2, '#fff', 'blood');
        expect(state.particles).toHaveLength(508);
    });

    it('exactly at the budget, smoke still spawns', () => {
        state.particles = fill(PARTICLE_BUDGET);
        createParticles(state, 0, 0, 3, '#fff', 'smoke');
        expect(state.particles).toHaveLength(PARTICLE_BUDGET + 3);
    });

    it('the budget is 500', () => {
        expect(PARTICLE_BUDGET).toBe(500);
    });
});
