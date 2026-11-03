import { describe, it, expect } from 'vitest';
import { FighterMotion, HOP_PX, headBob, hopLift } from './fighterMotion';
import { DustBudget } from './fighterDust';
import { createMockState } from '../../../test/mocks';
import { GameMode } from '../../../types';

const FRAME_MS = 1000 / 60;

/** Feed feet heights at 60 fps and return the frame indexes that reported a landing. */
const landings = (ys: number[], frameMs = FRAME_MS) => {
    const m = new FighterMotion();
    const hits: number[] = [];
    ys.forEach((y, i) => { if (m.observe(y, 100, i * frameMs).landed) hits.push(i); });
    return hits;
};

describe('FighterMotion landing', () => {
    it('lands once after a real fall and not after a slow descent', () => {
        expect(landings([0, 4, 8, 12, 16, 20, 20, 20])).toEqual([6]);
        expect(landings([0, 2, 4, 6, 8, 8])).toEqual([]);
    });

    it('needs two fast frames before the stop', () => {
        expect(landings([0, 4, 8, 8])).toEqual([3]);
        expect(landings([0, 4, 4])).toEqual([]);
    });

    it('measures fall speed per 1/60 s, so the display refresh rate does not matter', () => {
        // 4 px per 1/60 s is 2 px per 1/120 s
        // (a stop at 120 Hz is confirmed one frame late, see the no-tick tests below)
        const at120 = [0, 2, 4, 6, 8, 10, 10, 10];
        expect(landings(at120, 1000 / 120)).toEqual([7]);
    });

    it('ignores a teleport and starts counting again afterwards', () => {
        expect(landings([0, 4, 8, 1000, 1000])).toEqual([]);
        expect(landings([0, 4, 8, 1000, 1004, 1008, 1012, 1012])).toEqual([7]);
        expect(landings([1000, 1004, 1008, 0, 0])).toEqual([]);
    });

    it('does not land while still falling at speed', () => {
        expect(landings([0, 4, 8, 12, 16, 20, 24])).toEqual([]);
    });

    it('does not mistake a frame without a physics tick for a landing on a fast display', () => {
        // 144 Hz render against a 120 Hz simulation: the fifth frame shows the same position as the fourth
        const frame = 1000 / 144;
        expect(landings([0, 3, 6, 9, 9, 12, 15], frame)).toEqual([]);
    });

    it('still lands, a frame late, when the stop is on such a frame', () => {
        expect(landings([0, 3, 6, 9, 9, 9, 9], 1000 / 144)).toEqual([5]);
    });

    it('lands when the last step into the floor is short', () => {
        // Real trace at 120 Hz: 4 px per tick, then 0.9 px to the floor, then nothing
        const trace: [number, number][] = [[0, 735.1], [8, 739.1], [16, 743.1], [25, 747.1], [33, 751.1], [40, 752], [49, 752], [58, 752]];
        const m = new FighterMotion();
        const hits = trace.map(([t, y]) => m.observe(y, 100, t).landed);
        expect(hits).toEqual([false, false, false, false, false, false, false, true]);
    });

    it('does not land mid-air when a fall shows a frame without a tick and then a double step', () => {
        // Real trace at 120 Hz while falling: unchanged positions and an 8 px step between 4 px steps
        const trace: [number, number][] = [
            [0, 465.5], [8, 469.5], [17, 473.5], [25, 477.5], [33, 481.5], [40, 481.5], [50, 489.5], [58, 489.5], [66, 493.5], [74, 497.5], [82, 501.5],
        ];
        const m = new FighterMotion();
        expect(trace.some(([t, y]) => m.observe(y, 100, t).landed)).toBe(false);
    });

    it('does not land when a fall is braked gradually', () => {
        expect(landings([0, 8, 15, 21, 25, 28, 30, 31, 31])).toEqual([]);
    });
});

describe('FighterMotion squash', () => {
    it('eases from 1 to 0 over 180 ms', () => {
        const m = new FighterMotion();
        const ys = [0, 4, 8, 8];
        const t0 = (ys.length - 1) * FRAME_MS;
        ys.forEach((y, i) => m.observe(y, 100, i * FRAME_MS));
        expect(m.observe(8, 100, t0).squash).toBe(1);
        expect(m.observe(8, 100, t0 + 90).squash).toBeCloseTo(0.5);
        expect(m.observe(8, 100, t0 + 180).squash).toBe(0);
        expect(m.observe(8, 100, t0 + 400).squash).toBe(0);
    });

    it('never exceeds 1 when the clock steps back after the landing', () => {
        const m = new FighterMotion();
        const ys = [0, 4, 8, 8];
        const t0 = (ys.length - 1) * FRAME_MS;
        ys.forEach((y, i) => m.observe(y, 100, i * FRAME_MS));
        expect(m.observe(8, 100, t0 - 500).squash).toBeLessThanOrEqual(1);
    });

    it('stays 0 without a landing', () => {
        const m = new FighterMotion();
        expect(m.observe(0, 100, 0).squash).toBe(0);
        expect(m.observe(50, 100, 16).squash).toBe(0);
    });
});

describe('FighterMotion hit flash', () => {
    it('flashes for 80 ms after a health drop and not after a gain', () => {
        const m = new FighterMotion();
        expect(m.observe(0, 100, 0).hitFlash).toBe(0);
        expect(m.observe(0, 80, 16).hitFlash).toBe(1);
        expect(m.observe(0, 80, 60).hitFlash).toBe(1);
        expect(m.observe(0, 80, 100).hitFlash).toBe(0);
        expect(m.observe(0, 100, 116).hitFlash).toBe(0);
    });

    it('does not flash for bleeding, however long it lasts', () => {
        const m = new FighterMotion();
        // 120 physics ticks per second: 1/120 HP per frame offline; 1/30 HP per snapshot online
        for (const [step, frameMs] of [[1 / 120, 1000 / 120], [1 / 30, 1000 / 30]]) {
            for (let i = 0; i < 600; i++) expect(m.observe(0, 100 - i * step, i * frameMs).hitFlash).toBe(0);
        }
    });

    it('still flashes for a real hit on a bleeding fighter', () => {
        const m = new FighterMotion();
        m.observe(0, 10, 0);
        expect(m.observe(0, 10 - 1 / 120, 8).hitFlash).toBe(0);
        expect(m.observe(0, 4, 16).hitFlash).toBe(1);
        expect(m.observe(0, 4 - 1 / 120, 24).hitFlash).toBe(1); // bleeding does not cut the flash short
        expect(m.observe(0, 4 - 2 / 120, 100).hitFlash).toBe(0);
    });
});

describe('headBob', () => {
    it('bobs the head only while running', () => {
        expect(headBob('idle', 1)).toBe(0);
        expect(headBob('fly', 1)).toBe(0);
        expect(headBob('run', Math.PI / 4)).toBeCloseTo(0.05);
        expect(headBob('run', 0)).toBeCloseTo(0);
    });
});

describe('DustBudget', () => {
    const live = (state: ReturnType<typeof createMockState>) => state.particles.filter(p => p.type === 'dust' && p.life > 0).length;

    it('puffs once per step against the running direction', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new DustBudget().spawnStep(state, 10, 20, 1);
        expect(state.particles).toHaveLength(1);
        expect(state.particles[0]).toMatchObject({ type: 'dust', pos: { x: 10, y: 20 }, vel: { x: -0.8, y: -0.3 } });
    });

    it('kicks six puffs out to both sides on a landing', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new DustBudget().spawnLanding(state, 0, 0);
        expect(state.particles).toHaveLength(6);
        expect(state.particles.filter(p => p.vel.x === 2.2)).toHaveLength(3);
        expect(state.particles.filter(p => p.vel.x === -2.2)).toHaveLength(3);
        for (const p of state.particles) {
            expect(p.vel.y).toBeLessThanOrEqual(-0.2);
            expect(p.vel.y).toBeGreaterThanOrEqual(-0.8);
        }
    });

    it('spawns at most 12 live dust puffs per fighter', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const budget = new DustBudget();
        for (let i = 0; i < 3; i++) budget.spawnLanding(state, 0, 0);
        expect(state.particles).toHaveLength(12);
    });

    it('frees budget as puffs fade', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const budget = new DustBudget();
        budget.spawnLanding(state, 0, 0);
        budget.spawnLanding(state, 0, 0);
        state.particles.slice(0, 6).forEach(p => { p.life = 0; });
        budget.spawnStep(state, 0, 0, 1);
        expect(live(state)).toBe(7);
        expect(state.particles).toHaveLength(13);
    });

    it('starts fresh when the particle list is replaced by a new match', () => {
        const budget = new DustBudget();
        budget.spawnLanding(createMockState(GameMode.DEATHMATCH), 0, 0);
        budget.spawnLanding(createMockState(GameMode.DEATHMATCH), 0, 0);
        const next = createMockState(GameMode.DEATHMATCH);
        budget.spawnLanding(next, 0, 0);
        expect(next.particles).toHaveLength(6);
    });

    it('counts each fighter separately', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const a = new DustBudget(), b = new DustBudget();
        for (let i = 0; i < 3; i++) a.spawnLanding(state, 0, 0);
        b.spawnLanding(state, 0, 0);
        expect(state.particles).toHaveLength(18);
    });
});

describe('hopLift', () => {
    it('lifts a one-legged fighter in time with the step, up to the full hop', () => {
        expect(hopLift('walk', 0, 1)).toBe(HOP_PX);
        expect(hopLift('walk', Math.PI / 3, 1)).toBeCloseTo(HOP_PX * 0.5);
        expect(hopLift('walk', Math.PI, 1)).toBe(0);
        expect(hopLift('walk', 3 * Math.PI / 2, 1)).toBe(0);
    });

    it('follows the direction of travel like the foot lift', () => {
        expect(hopLift('walk', 0, -1)).toBe(0);
        expect(hopLift('walk', Math.PI, -1)).toBe(HOP_PX);
    });

    it('hops only when walking or running upright', () => {
        for (const state of ['idle', 'crouch', 'prone', 'fly', 'fall'] as const) expect(hopLift(state, 0, 1), state).toBe(0);
        expect(hopLift('run', 0, 1)).toBe(HOP_PX);
    });
});
