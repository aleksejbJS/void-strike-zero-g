import { afterEach, describe, expect, it, vi } from 'vitest';
import { Team, WeaponType } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { gameEvents, GameEvent } from '../systems/events';
import { damageCover } from './coverDamage';
import { BARREL_CHAIN_MS, COVER_RETURN_MS } from './coverTypes';
import { tickCover } from './coverTick';
import { piece, stateWithCover, tick } from './coverTestKit';

const NOW = 1_000_000;
const pumpAt = (id: string, x: number, hp = 72) => piece(id, 'fuel-pump', x, 0, hp);
const shot = (type: WeaponType) => ({
    id: 'shot', ownerId: 'shooter', type, pos: { x: 60, y: -50 }, vel: { x: 25, y: 0 },
    active: true, radius: 4, life: 60,
});
const countBlasts = (events: GameEvent[]) => events.filter(e => e.type === 'EFFECT' && e.effect === 'explosion').length;

afterEach(() => vi.restoreAllMocks());

describe('explosive fuel pump', () => {
    it('takes twelve machine-gun hits and removes its collision until it is due back', () => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        const pump = pumpAt('pump', 100);
        const state = stateWithCover(pump);
        const physics = new MatterPhysicsEngine();
        const events: GameEvent[] = [];
        const unsubscribe = gameEvents.on(e => events.push(e));
        try {
            physics.syncFromGameState(state);
            expect(physics.bodies.has(pump.id)).toBe(true);
            for (let i = 0; i < 11; i++) {
                state.projectiles.push(shot(WeaponType.MACHINE_GUN));
                tick(state);
            }
            expect(pump.hp).toBe(6);
            expect(countBlasts(events)).toBe(0);
            state.projectiles.push(shot(WeaponType.MACHINE_GUN));
            tick(state);
            tick(state);
            expect(pump.hp).toBe(0);
            expect(countBlasts(events)).toBe(1);
            physics.syncFromGameState(state);
            expect(physics.bodies.has(pump.id)).toBe(false);

            tickCover(state, NOW + COVER_RETURN_MS - 1);
            expect(pump.hp).toBe(0);
            tickCover(state, NOW + COVER_RETURN_MS);
            expect(pump.hp).toBe(72);
            physics.syncFromGameState(state);
            expect(physics.bodies.has(pump.id)).toBe(true);
        } finally {
            unsubscribe();
            physics.clear();
        }
    });

    it('breaks from one direct rocket and detonates on the shared fuse', () => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        const pump = pumpAt('pump', 100);
        const state = stateWithCover(pump);
        state.projectiles.push(shot(WeaponType.ROCKET_LAUNCHER));
        tick(state);
        expect(pump.hp).toBe(0);
        expect(pump.fuseAt).toBe(NOW + BARREL_CHAIN_MS);
        tickCover(state, NOW + BARREL_CHAIN_MS);
        expect(pump.fuseAt).toBeUndefined();
    });

    it.each([[72, false], [60, true]])('damages a neighboring pump with %i HP (chains: %s)', (hp, chains) => {
        const first = pumpAt('a', 100), next = pumpAt('b', 231, hp);
        const state = stateWithCover(first, next);
        damageCover(state, first, 72, 'shooter', NOW);
        tickCover(state, NOW);
        expect(next.hp).toBeLessThan(hp);
        expect(next.fuseAt).toBe(chains ? NOW + BARREL_CHAIN_MS : undefined);
        if (chains) expect(next.creditId).toBe('shooter');
    });

    it('credits exposed kills as Fuel Pump and shields a fighter behind masonry', () => {
        const pump = pumpAt('pump', 300);
        const state = stateWithCover(pump);
        const shooter = Object.assign(createMockPlayer('shooter', Team.NONE), { pos: { x: 900, y: 0 } });
        const exposed = Object.assign(createMockPlayer('exposed', Team.NONE), { pos: { x: 325, y: 0 }, health: 30 });
        const protectedFighter = Object.assign(createMockPlayer('covered', Team.NONE), { pos: { x: 228, y: 0 }, health: 30 });
        state.players.push(shooter, exposed, protectedFighter);
        state.platforms.push({ id: 'wall', x: 244, y: -110, w: 20, h: 120, color: '#333333' });
        const events: GameEvent[] = [];
        const unsubscribe = gameEvents.on(e => events.push(e));
        try {
            damageCover(state, pump, 72, shooter.id, NOW);
            tickCover(state, NOW);
            expect(exposed.dead).toBe(true);
            expect(protectedFighter.health).toBe(30);
            expect(events).toContainEqual(expect.objectContaining({ type: 'KILL', killer: shooter.id, weapon: 'Fuel Pump' }));
        } finally {
            unsubscribe();
        }
    });
});
