import { describe, expect, it } from 'vitest';
import { FighterFire, JET_MS } from './fighterFire';
import { FighterAnimator } from './fighterAnimator';
import { createMockPlayer, createMockState } from '../../../test/mocks';
import { GameMode, Team, WeaponType } from '../../../types';
import { FLAME_RANGE } from '../../systems/flameConstants';
import { updateParticles } from '../../systems/particles';

const NOW = 10_000;
const FRAME_MS = 1000 / 60;

const burner = (extra: Partial<ReturnType<typeof createMockPlayer>> = {}) => {
    const p = createMockPlayer('a', Team.BLUE, WeaponType.FLAMETHROWER);
    p.pos = { x: 100, y: 500 };
    return Object.assign(p, extra);
};

describe('FighterFire.body', () => {
    it('spawns nothing when the burn is over', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new FighterFire().body(state, burner({ burnUntil: NOW - 1 }), NOW);
        new FighterFire().body(state, burner(), NOW);
        expect(state.particles).toHaveLength(0);
    });

    it('licks fire over the whole body while burning', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const fire = new FighterFire();
        const p = burner({ burnUntil: NOW + 1000 });
        for (let t = NOW; t < NOW + 1000; t += FRAME_MS) fire.body(state, p, t);
        expect(state.particles.length).toBeGreaterThan(10);
        expect(state.particles.every(q => q.type === 'fire')).toBe(true);
        const ys = state.particles.map(q => q.pos.y);
        // Feet to head: the flames cover most of the 72 px body, not one spot
        expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(40);
        for (const q of state.particles) {
            expect(q.pos.y).toBeLessThanOrEqual(p.pos.y);
            expect(q.pos.y).toBeGreaterThanOrEqual(p.pos.y - p.height);
        }
    });

    it('is rate-limited: a second of calls every frame adds a bounded number of flames', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const fire = new FighterFire();
        const p = burner({ burnUntil: NOW + 5000 });
        for (let t = NOW; t < NOW + 1000; t += 1) fire.body(state, p, t);
        expect(state.particles.length).toBeLessThanOrEqual(80);
    });
});

describe('FighterFire.jet', () => {
    it('throws flames along the aim that reach about the flame range', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new FighterFire().jet(state, 0, 0, 0, NOW);
        expect(state.particles.length).toBeGreaterThan(0);
        let far = 0;
        for (let i = 0; i < 120; i++) {
            updateParticles(state);
            for (const q of state.particles) far = Math.max(far, q.pos.x);
        }
        expect(far).toBeGreaterThan(FLAME_RANGE * 0.8);
        expect(far).toBeLessThan(FLAME_RANGE * 1.2);
    });

    it('a held spray is one stream: flames all the way from the muzzle to the end of the range', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const fire = new FighterFire();
        // Half a second of 60 Hz frames, two physics ticks (120 per second) per frame
        for (let t = NOW; t < NOW + 500; t += FRAME_MS) {
            fire.jet(state, 0, 0, 0, t);
            updateParticles(state);
            updateParticles(state);
        }
        const xs = state.particles.map(q => q.pos.x);
        for (let from = 0; from < FLAME_RANGE; from += FLAME_RANGE / 3) {
            expect(xs.filter(x => x >= from && x < from + FLAME_RANGE / 3).length).toBeGreaterThanOrEqual(5);
        }
    });

    it('is rate-limited per fighter', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const fire = new FighterFire();
        fire.jet(state, 0, 0, 0, NOW);
        const once = state.particles.length;
        fire.jet(state, 0, 0, 0, NOW + 1);
        expect(state.particles).toHaveLength(once);
    });
});

describe('FighterFire.tank', () => {
    it('roars only while the tank is lit, in its own colours, unlike body flames', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new FighterFire().tank(state, burner(), 0, 0, 0, NOW);
        expect(state.particles).toHaveLength(0);

        new FighterFire().tank(state, burner({ tankFuseAt: NOW + 2000 }), 0, 0, 0, NOW);
        const tankColors = new Set(state.particles.map(q => q.color));
        expect(tankColors.size).toBeGreaterThan(0);

        const body = createMockState(GameMode.DEATHMATCH);
        new FighterFire().body(body, burner({ burnUntil: NOW + 2000 }), NOW);
        for (const q of body.particles) expect(tankColors.has(q.color)).toBe(false);
    });
});

describe('the animator and fire', () => {
    const animate = (setup: (p: ReturnType<typeof burner>) => void, frames = 2) => {
        const game = createMockState(GameMode.DEATHMATCH);
        const p = burner();
        const animator = new FighterAnimator();
        for (let i = 0; i < frames; i++) {
            setup(p);
            animator.frame(p, 0, NOW + i * FRAME_MS, {}, game);
            p.lastFired += i === 0 ? 100 : 0; // a new flame tick between the first and second frame
        }
        return game.particles.filter(q => q.type === 'fire');
    };

    it('sprays a jet right after a flamethrower tick, and not with another gun', () => {
        expect(animate(() => {}).length).toBeGreaterThan(0);
        expect(animate(p => { p.weapon.type = WeaponType.MACHINE_GUN; })).toHaveLength(0);
    });

    it('stops spraying once no tick came for a while', () => {
        const game = createMockState(GameMode.DEATHMATCH);
        const p = burner();
        const animator = new FighterAnimator();
        animator.frame(p, 0, NOW, {}, game);
        p.lastFired += 100;
        animator.frame(p, 0, NOW + 10, {}, game);
        game.particles = [];
        animator.frame(p, 0, NOW + 10 + JET_MS + 50, {}, game);
        expect(game.particles.filter(q => q.type === 'fire')).toHaveLength(0);
    });

    it('burns a burning fighter and a lit tank', () => {
        expect(animate(p => { p.lastFired = 0; p.burnUntil = NOW + 5000; }, 1).length).toBeGreaterThan(0);
        expect(animate(p => { p.lastFired = 0; p.tankFuseAt = NOW + 2000; }, 1).length).toBeGreaterThan(0);
    });
});
