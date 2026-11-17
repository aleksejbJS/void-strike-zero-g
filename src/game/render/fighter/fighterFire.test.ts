import { describe, expect, it } from 'vitest';
import { FighterFire, JET_MS } from './fighterFire';
import { FighterAnimator } from './fighterAnimator';
import { FlameOrders } from '../flame/flameOrders';
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
    it('orders no fire when the burn is over or never started', () => {
        const orders = new FlameOrders();
        new FighterFire().body(orders, burner({ burnUntil: NOW - 1 }), NOW);
        new FighterFire().body(orders, burner(), NOW);
        expect(orders.bodies.size).toBe(0);
    });

    it('orders fire over the whole body while burning, standing on the feet', () => {
        const orders = new FlameOrders();
        const p = burner({ burnUntil: NOW + 1000 });
        new FighterFire().body(orders, p, NOW);
        expect(orders.bodies.get('a')).toEqual({ x: 100, y: 500, w: p.width, h: p.height, prone: false });
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
});

describe('the animator and fire', () => {
    /** Animate one flamethrower fighter for `frames` frames; the orders of the last frame. */
    const animate = (setup: (p: ReturnType<typeof burner>) => void, frames = 2) => {
        const game = createMockState(GameMode.DEATHMATCH);
        const p = burner();
        const animator = new FighterAnimator();
        for (let i = 0; i < frames; i++) {
            animator.flames.clear();
            setup(p);
            animator.frame(p, 0, NOW + i * FRAME_MS, {}, game);
            p.lastFired += i === 0 ? 100 : 0; // a new flame tick between the first and second frame
        }
        return { game, orders: animator.flames };
    };

    it('orders a firing stream right after a flamethrower tick, and nothing with another gun', () => {
        expect(animate(() => {}).orders.streams.get('a')?.firing).toBe(true);
        expect(animate(p => { p.weapon.type = WeaponType.MACHINE_GUN; }).orders.streams.size).toBe(0);
    });

    it('keeps only the pilot light once no tick came for a while', () => {
        const game = createMockState(GameMode.DEATHMATCH);
        const p = burner();
        const animator = new FighterAnimator();
        animator.frame(p, 0, NOW, {}, game);
        p.lastFired += 100;
        animator.frame(p, 0, NOW + 10, {}, game);
        animator.flames.clear();
        animator.frame(p, 0, NOW + 10 + JET_MS + 50, {}, game);
        expect(animator.flames.streams.get('a')?.firing).toBe(false);
    });

    it('the stream leaves from the muzzle, out in front of the fighter', () => {
        const order = animate(() => {}).orders.streams.get('a');
        expect(order).toBeDefined();
        expect(order!.x).toBeGreaterThan(100);
        expect(order!.y).toBeLessThan(500);
        expect(Math.abs(order!.angle)).toBeLessThan(0.5);
    });

    it('burns a burning fighter and a lit tank', () => {
        expect(animate(p => { p.lastFired = 0; p.burnUntil = NOW + 5000; }, 1).orders.bodies.has('a')).toBe(true);
        expect(animate(p => { p.lastFired = 0; p.tankFuseAt = NOW + 2000; }, 1).game.particles.some(q => q.type === 'flame')).toBe(true);
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
