import { describe, expect, it } from 'vitest';
import { FighterFire, JET_MS } from './fighterFire';
import { FighterAnimator } from './fighterAnimator';
import { createMockPlayer, createMockState } from '../../../test/mocks';
import { GameMode, Team, WeaponType } from '../../../types';
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
    it('sprays the hot glow stream of flameJet.ts (its own tests cover the stream)', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new FighterFire().jet(state, 0, 0, 0, NOW);
        expect(state.particles.length).toBeGreaterThan(0);
        expect(state.particles.every(q => q.type === 'flame')).toBe(true);
    });
});

describe('FighterFire.tank', () => {
    /** Half a second of a lit tank at `hz`, with the 120 Hz particle ticks in between. */
    const roar = (hz: number) => {
        const state = createMockState(GameMode.DEATHMATCH);
        const fire = new FighterFire();
        const p = burner({ tankFuseAt: NOW + 2000 });
        let made = 0, far = 0, ticks = 0;
        for (let t = 0; t < 500; t += 1000 / hz) {
            const before = state.particles.length;
            fire.tank(state, p, 0, 0, Math.PI, NOW + t);
            made += state.particles.slice(before).filter(q => q.type === 'flame').length;
            for (; ticks < ((t + 1000 / hz) * 120) / 1000; ticks++) {
                updateParticles(state);
                for (const q of state.particles) if (q.type === 'flame') far = Math.max(far, -q.pos.x);
            }
        }
        return { state, made, far };
    };

    it('roars only while the tank is lit', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new FighterFire().tank(state, burner(), 0, 0, 0, NOW);
        expect(state.particles).toHaveLength(0);
    });

    it('is a long, dense jet of big hot glow sprites with pulses of light', () => {
        const { state, made, far } = roar(60);
        expect(made).toBeGreaterThan(60); // well over 100 flames a second
        expect(far).toBeGreaterThan(55); // a long tongue of fire, not dots at the back
        expect(state.particles.some(q => q.type === 'flash')).toBe(true);
        const flames = state.particles.filter(q => q.type === 'flame');
        expect(Math.max(...flames.map(q => q.size))).toBeGreaterThanOrEqual(10);
    });

    it('looks the same at 60 and 144 Hz', () => {
        const a = roar(60).made, b = roar(144).made;
        expect(Math.abs(a - b) / a).toBeLessThan(0.08);
    });

    it('in its own colours and kind, unlike body flames', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new FighterFire().tank(state, burner({ tankFuseAt: NOW + 2000 }), 0, 0, 0, NOW);
        const tankColors = new Set(state.particles.filter(q => q.type === 'flame').map(q => q.color));
        expect(tankColors.size).toBeGreaterThan(0);

        const body = createMockState(GameMode.DEATHMATCH);
        new FighterFire().body(body, burner({ burnUntil: NOW + 2000 }), NOW);
        for (const q of body.particles) {
            expect(q.type).toBe('fire');
            expect(tankColors.has(q.color)).toBe(false);
        }
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
        return game.particles.filter(q => q.type === 'fire' || q.type === 'flame');
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
        expect(game.particles.filter(q => q.type === 'flame')).toHaveLength(0);
    });

    it('burns a burning fighter and a lit tank', () => {
        expect(animate(p => { p.lastFired = 0; p.burnUntil = NOW + 5000; }, 1).length).toBeGreaterThan(0);
        expect(animate(p => { p.lastFired = 0; p.tankFuseAt = NOW + 2000; }, 1).length).toBeGreaterThan(0);
    });

    it('a lit tank stays drawn on the back after a switch to another gun', () => {
        const p = burner({ tankFuseAt: NOW + 2000 });
        p.weapon.type = WeaponType.MACHINE_GUN;
        const animator = new FighterAnimator();
        expect(animator.frame(p, 0, NOW, {}, createMockState(GameMode.DEATHMATCH)).tankLit).toBe(true);
        p.tankFuseAt = undefined;
        expect(animator.frame(p, 0, NOW + FRAME_MS, {}, createMockState(GameMode.DEATHMATCH)).tankLit).toBe(false);
    });
});
