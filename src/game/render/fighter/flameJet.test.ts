import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../types';
import type { GameState, Particle } from '../../../types';
import { createMockState } from '../../../test/mocks';
import { FLAME_RANGE } from '../../systems/flameConstants';
import { updateParticles } from '../../systems/particles';
import { FIRE_CAP } from '../../systems/flameParticles';
import { piece } from '../../cover/coverTestKit';
import { FlameJet, JET_RATE } from './flameJet';

const NOW = 10_000;
const flames = (state: GameState) => state.particles.filter(q => q.type === 'flame');

/** Spray to the right from (0, 0) for `ms` at `hz` frames per second, with the 120 Hz particle ticks in between. */
const spray = (state: GameState, hz: number, ms: number, jet = new FlameJet()): number => {
    let made = 0;
    let ticks = 0;
    for (let t = 0; t < ms; t += 1000 / hz) {
        const before = state.particles.length;
        jet.spray(state, 0, 0, 0, NOW + t);
        made += state.particles.length - before;
        for (; ticks < ((t + 1000 / hz) * 120) / 1000; ticks++) updateParticles(state);
    }
    return made;
};

describe('the drawn flame stream', () => {
    it('is made of glow sprites: hot flames that grow and fade', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        spray(state, 60, 100);
        expect(state.particles.length).toBeGreaterThan(0);
        expect(state.particles.every(q => q.type === 'flame')).toBe(true);
    });

    it('looks the same at 60, 120 and 144 Hz: flames per second follow the clock, not the frames', () => {
        const counts = [60, 120, 144].map(hz => spray(createMockState(GameMode.DEATHMATCH), hz, 1000));
        for (const n of counts) expect(Math.abs(n - JET_RATE) / JET_RATE).toBeLessThan(0.05);
    });

    it('a held spray is one stream: flames all the way from the muzzle to the end of the range', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        spray(state, 60, 500);
        const xs = flames(state).map(q => q.pos.x);
        for (let from = 0; from < FLAME_RANGE; from += FLAME_RANGE / 3) {
            expect(xs.filter(x => x >= from && x < from + FLAME_RANGE / 3).length).toBeGreaterThanOrEqual(8);
        }
        expect(Math.max(...xs)).toBeLessThan(FLAME_RANGE * 1.15);
    });

    it('stops at a wall: no flame is drawn past the first platform on the way', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.platforms = [{ id: 'wall', x: 150, y: -100, w: 40, h: 200, color: '#000' }];
        spray(state, 60, 500);
        const xs = flames(state).map(q => q.pos.x);
        expect(Math.max(...xs)).toBeLessThanOrEqual(150);
        expect(xs.filter(x => x > 100).length).toBeGreaterThan(10); // it still reaches the wall and licks it
    });

    it('stops at intact cover, not at broken cover', () => {
        const farthest = (hp?: number) => {
            const state = createMockState(GameMode.DEATHMATCH);
            const crate = piece('crate', 'wood', 120, 40); // 50 x 46: its rect is x 95..145, y -6..40
            state.cover = [hp === undefined ? crate : { ...crate, hp }];
            spray(state, 60, 500);
            return Math.max(...flames(state).map(q => q.pos.x));
        };
        expect(farthest()).toBeLessThanOrEqual(95);
        expect(farthest(0)).toBeGreaterThan(FLAME_RANGE * 0.8);
    });

    it('is not starved when big blasts have filled the scene with particles', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const sparks: Particle[] = Array.from({ length: FIRE_CAP + 300 }, (_, i) => ({
            id: `s${i}`, pos: { x: 5000, y: 5000 }, vel: { x: 0, y: 0 }, life: 1, decay: 0, color: '#fff', size: 2, type: 'spark',
        }));
        state.particles.push(...sparks);
        new FlameJet().spray(state, 0, 0, 0, NOW);
        expect(flames(state).length).toBeGreaterThan(0);
    });

    it('keeps the cost bounded: six fighters spraying for two seconds', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const jets = Array.from({ length: 6 }, () => new FlameJet());
        let ticks = 0;
        for (let t = 0; t < 2000; t += 1000 / 144) {
            jets.forEach((jet, i) => jet.spray(state, 0, i * 100, 0, NOW + t));
            for (; ticks < ((t + 1000 / 144) * 120) / 1000; ticks++) updateParticles(state);
        }
        expect(state.particles.length).toBeLessThan(6 * JET_RATE * 0.3);
    });

    it('a frame after a long pause does not dump a burst of flames', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const jet = new FlameJet();
        jet.spray(state, 0, 0, 0, NOW);
        const before = state.particles.length;
        jet.spray(state, 0, 0, 0, NOW + 5000);
        expect(state.particles.length - before).toBeLessThan(JET_RATE * 0.05);
    });
});
