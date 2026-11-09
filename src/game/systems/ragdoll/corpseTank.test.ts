import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../types';
import { createMockState } from '../../../test/mocks';
import type { DeathEvent, RagdollColors } from '../events';
import { addCorpse } from './corpses';
import { corpseTankFire, gibTankCorpse, tankOf } from './corpseTank';
import { TANK_SPOT } from '../../render/fighter/fuelTankBack';
import { RIG_SCALE } from '../../render/fighter/fighterPose';
import { TANK_BLOOD } from '../flameConstants';
import { TANK_JET_RATE } from '../flameParticles';

const PARTS: RagdollColors = { head: '#111111', torso: '#222222', arm: '#333333', leg: '#444444' };

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 100, y: 500, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1, parts: PARTS, ...extra,
});

const withTankCorpse = () => {
    const state = createMockState(GameMode.DEATHMATCH);
    addCorpse(state, death({ tank: 'tank_1' }));
    state.particles = [];
    return state;
};

describe('gibTankCorpse', () => {
    it('leaves the corpses alone and does not throw for a tank no corpse carries', () => {
        const state = withTankCorpse();
        const before = [...state.corpses];
        expect(() => gibTankCorpse(state, 'tank_unknown', { x: 100, y: 480 })).not.toThrow();
        expect(state.corpses).toEqual(before);
        expect(state.particles).toHaveLength(0);
    });

    it('tears the carrying corpse apart: a gib with the same colours takes its place, with blood', () => {
        const state = withTankCorpse();
        const old = state.corpses[0];
        gibTankCorpse(state, 'tank_1', { x: 90, y: 470 });
        expect(state.corpses).toHaveLength(1);
        const gib = state.corpses[0];
        expect(gib.id).not.toBe(old.id);
        expect(gib.kind).toBe('gib');
        expect(gib.colors).toEqual(PARTS);
        expect(gib.tankId).toBeUndefined();
        expect(state.particles.filter(p => p.type === 'blood')).toHaveLength(TANK_BLOOD);
    });

    it('starts the pieces where the body lay', () => {
        const state = withTankCorpse();
        const hip = { ...state.corpses[0].points.hip };
        gibTankCorpse(state, 'tank_1', { x: 90, y: 470 });
        expect(state.corpses[0].points.hip.x).toBeCloseTo(hip.x);
        expect(state.corpses[0].points.hip.y).toBeCloseTo(hip.y);
    });

    it('ignores a blast point that is not a number', () => {
        const state = withTankCorpse();
        expect(() => gibTankCorpse(state, 'tank_1', { x: NaN, y: Infinity })).not.toThrow();
        expect(state.corpses[0].kind).toBe('gib');
        expect(Number.isFinite(state.corpses[0].points.hip.x)).toBe(true);
    });
});

describe('corpseTankFire', () => {
    it('burns only from corpses that carry a lit tank', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        addCorpse(state, death());
        state.particles = [];
        corpseTankFire(state);
        expect(state.particles).toHaveLength(0);

        addCorpse(state, death({ tank: 'tank_2' }));
        state.particles = [];
        corpseTankFire(state);
        expect(state.particles.length).toBeGreaterThan(0);
        // A white-hot jet of glow sprites (and a pulse of light), not the orange licks of a burning body
        expect(state.particles.some(p => p.type === 'flame')).toBe(true);
        expect(state.particles.every(p => p.type === 'flame' || p.type === 'flash')).toBe(true);
    });

    it('a corpse lying with its back to the floor blows the jet up, not into the floor', () => {
        const state = withTankCorpse();
        const c = state.corpses[0];
        // Spine level, facing left: the back (and the tank) points straight down
        c.facing = -1;
        Object.assign(c.points.hip, { x: 100, y: 500, px: 100, py: 500 }); // lying still
        Object.assign(c.points.neck, { x: 130, y: 500, px: 130, py: 500 });
        c.age = 0;
        corpseTankFire(state);
        const jet = state.particles.filter(p => p.type === 'flame');
        expect(jet.length).toBeGreaterThan(0);
        for (const p of jet) expect(p.vel.y).toBeLessThan(0);
    });

    it('is rate-limited by the corpse age, not every tick', () => {
        const state = withTankCorpse();
        const c = state.corpses[0];
        let ticks = 0;
        for (let i = 0; i < 120; i++) { c.age = i; corpseTankFire(state); ticks++; }
        const perTick = state.particles.length / ticks;
        expect(perTick).toBeGreaterThan(0);
        expect(perTick).toBeLessThan(TANK_JET_RATE / 120 + 0.25); // the jet's rate and a few flashes of light
    });
});

describe('the tank on a corpse', () => {
    it('sits where a standing fighter wears it (TANK_SPOT in render/fighter/fuelTankBack.ts)', () => {
        const state = withTankCorpse();
        const c = state.corpses[0];
        for (const facing of [1, -1] as const) {
            c.facing = facing;
            Object.assign(c.points.hip, { x: 100, y: 500 });
            Object.assign(c.points.neck, { x: 100, y: 470 }); // a vertical spine: standing upright
            const { at } = tankOf(c);
            expect(at.x).toBeCloseTo(100 + TANK_SPOT.x * facing * RIG_SCALE, 5);
            expect(at.y).toBeCloseTo(500 + TANK_SPOT.y * RIG_SCALE, 5);
        }
    });
});
