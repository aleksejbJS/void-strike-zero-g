import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import type { Entity, GameState } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { toLocalClock } from '../net/clock';
import { gameEvents, GameEvent } from './events';
import { applyDamage } from './combat';
import { tickBurning } from './burning';
import { ignitionChance, rollTankIgnition } from './fuelTank';
import { TANK_BLAST_CHANCE, TANK_FUSE_MS } from './flameConstants';
import type { DamageSource } from './deathKind';
import { NOW } from './flameTestKit';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // applyDamage reads Date.now() itself
    vi.setSystemTime(NOW);
    events = [];
    unsubscribe = gameEvents.on(e => events.push(e));
});
afterEach(() => { unsubscribe(); vi.restoreAllMocks(); vi.useRealTimers(); });

const hit = (weapon: WeaponType, extra: DamageSource = {}): DamageSource => ({ weapon, direct: true, ...extra });
const carrier = (): Entity => createMockPlayer('carrier', Team.NONE, WeaponType.FLAMETHROWER);

describe('ignitionChance', () => {
    it('is the per-weapon chance for a plain hit', () => {
        expect(ignitionChance(hit(WeaponType.PLASMA_GUN))).toBe(0.05);
        expect(ignitionChance(hit(WeaponType.SHOTGUN))).toBe(0.01);
        expect(ignitionChance(hit(WeaponType.FLAMETHROWER))).toBe(0.015);
        expect(ignitionChance(hit(WeaponType.SMOKE_LAUNCHER))).toBe(0);
    });

    it('is the blast chance for a barrel, a tank, a rocket or a grenade (direct or splash)', () => {
        expect(ignitionChance({ barrel: true })).toBe(TANK_BLAST_CHANCE);
        expect(ignitionChance({ tank: true })).toBe(TANK_BLAST_CHANCE);
        expect(ignitionChance(hit(WeaponType.ROCKET_LAUNCHER))).toBe(TANK_BLAST_CHANCE);
        expect(ignitionChance({ weapon: WeaponType.GRENADE_LAUNCHER })).toBe(TANK_BLAST_CHANCE);
    });

    it('is zero for bleeding, burning, a hit with no weapon (zone, fall) and a tank killing its own carrier', () => {
        expect(ignitionChance({ weapon: WeaponType.RAILGUN, bleed: true })).toBe(0);
        expect(ignitionChance({ weapon: WeaponType.FLAMETHROWER, burn: true })).toBe(0);
        expect(ignitionChance({})).toBe(0);
        expect(ignitionChance({ tank: true, direct: true })).toBe(0);
    });
});

describe('rollTankIgnition', () => {
    it('lights the tank when the roll is under the chance, and not above it', () => {
        const lit = carrier();
        expect(rollTankIgnition(lit, 'foe', hit(WeaponType.PLASMA_GUN), NOW, () => 0.01)).toBe(true);
        expect(lit).toMatchObject({ tankFuseAt: NOW + TANK_FUSE_MS, tankBy: 'foe' });
        const safe = carrier();
        expect(rollTankIgnition(safe, 'foe', hit(WeaponType.PLASMA_GUN), NOW, () => 0.06)).toBe(false);
        expect(safe.tankFuseAt).toBeUndefined();
        expect(safe.tankBy).toBeUndefined();
    });

    it('gives a shotgun pellet 1%', () => {
        expect(rollTankIgnition(carrier(), 'foe', hit(WeaponType.SHOTGUN), NOW, () => 0.009)).toBe(true);
        expect(rollTankIgnition(carrier(), 'foe', hit(WeaponType.SHOTGUN), NOW, () => 0.011)).toBe(false);
    });

    it('announces the ignition with a sound event only when it lights', () => {
        rollTankIgnition(carrier(), 'foe', hit(WeaponType.PLASMA_GUN), NOW, () => 0.99);
        expect(events).toEqual([]);
        rollTankIgnition(carrier(), 'foe', hit(WeaponType.PLASMA_GUN), NOW, () => 0.01);
        expect(events).toEqual([{ type: 'SOUND', sound: 'flame', subtype: 'ignite' }]);
    });

    it('never lights the tank of a fighter who only carries a flamethrower in the inventory', () => {
        const holder = createMockPlayer('holder', Team.NONE, WeaponType.SHOTGUN);
        holder.inventory.push(createMockPlayer('x', Team.NONE, WeaponType.FLAMETHROWER).weapon);
        expect(rollTankIgnition(holder, 'foe', hit(WeaponType.PLASMA_GUN), NOW, () => 0)).toBe(false);
        expect(holder.tankFuseAt).toBeUndefined();
    });

    it('never lights from the carrier\'s own rocket splash', () => {
        const self = carrier();
        expect(rollTankIgnition(self, 'carrier', { weapon: WeaponType.ROCKET_LAUNCHER }, NOW, () => 0)).toBe(false);
        expect(self.tankFuseAt).toBeUndefined();
    });

    it('lights from a barrel the carrier broke themselves, and from their own tank blast source', () => {
        const self = carrier();
        expect(rollTankIgnition(self, 'carrier', { barrel: true }, NOW, () => 0.14)).toBe(true);
        const other = carrier();
        expect(rollTankIgnition(other, 'carrier', { tank: true }, NOW, () => 0.14)).toBe(true);
    });

    it('a barrel blast lights at 0.14 and not at 0.16', () => {
        expect(rollTankIgnition(carrier(), 'foe', { barrel: true }, NOW, () => 0.14)).toBe(true);
        expect(rollTankIgnition(carrier(), 'foe', { barrel: true }, NOW, () => 0.16)).toBe(false);
    });

    it('a tank that already burns keeps its first fuse and arsonist', () => {
        const lit = carrier();
        rollTankIgnition(lit, 'first', hit(WeaponType.PLASMA_GUN), NOW, () => 0);
        expect(rollTankIgnition(lit, 'second', hit(WeaponType.PLASMA_GUN), NOW + 1000, () => 0)).toBe(false);
        expect(lit).toMatchObject({ tankFuseAt: NOW + TANK_FUSE_MS, tankBy: 'first' });
        expect(events).toHaveLength(1);
    });

    it('burning and bleeding never light a tank', () => {
        const foe = carrier();
        const burn = { weapon: WeaponType.FLAMETHROWER, burn: true };
        const bleed = { weapon: WeaponType.RAILGUN, bleed: true };
        expect(rollTankIgnition(foe, 'foe', burn, NOW, () => 0)).toBe(false);
        expect(rollTankIgnition(foe, 'foe', bleed, NOW, () => 0)).toBe(false);
        expect(foe.tankFuseAt).toBeUndefined();
    });

    it('does not light a tank for a tank blast that kills its own carrier (direct)', () => {
        const foe = carrier();
        expect(rollTankIgnition(foe, 'carrier', { tank: true, direct: true }, NOW, () => 0)).toBe(false);
        expect(foe.tankFuseAt).toBeUndefined();
    });
});

describe('the applyDamage hook', () => {
    const scene = (health = 100, armor = 0): { state: GameState; foe: Entity } => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.players.push(createMockPlayer('shooter', Team.NONE));
        const foe = Object.assign(carrier(), { health, armor });
        state.players.push(foe);
        return { state, foe };
    };
    const shot = (state: GameState, foe: Entity, weapon: WeaponType, amount: number, source: DamageSource = {}): void =>
        applyDamage(state, foe, 'shooter', amount, { x: 1, y: 0 }, 0, { weapon, direct: true, ...source });

    it('a hit on a carrier can light the tank', () => {
        const { state, foe } = scene();
        vi.spyOn(Math, 'random').mockReturnValue(0.01);
        shot(state, foe, WeaponType.PLASMA_GUN, 10);
        expect(foe).toMatchObject({ tankFuseAt: NOW + TANK_FUSE_MS, tankBy: 'shooter' });
        expect(foe.health).toBe(90);
    });

    it('a hit that misses the roll leaves the tank alone', () => {
        const { state, foe } = scene();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        shot(state, foe, WeaponType.PLASMA_GUN, 10);
        expect(foe.tankFuseAt).toBeUndefined();
    });

    it('the killing hit can light the tank', () => {
        const { state, foe } = scene(5);
        vi.spyOn(Math, 'random').mockReturnValue(0.01);
        shot(state, foe, WeaponType.PLASMA_GUN, 10);
        expect(foe.dead).toBe(true);
        // The lit tank stays behind at the death spot (fuelTankBlast.ts), off the fighter who will respawn
        expect(state.litTanks).toEqual([expect.objectContaining({ fuseAt: NOW + TANK_FUSE_MS })]);
        expect(foe.tankFuseAt).toBeUndefined();
    });

    it('a railgun beam through armor wounds (no death) and still rolls', () => {
        const { state, foe } = scene(100, 50);
        vi.spyOn(Math, 'random').mockReturnValue(0.04);
        shot(state, foe, WeaponType.RAILGUN, 100);
        expect(foe.dead).toBe(false);
        expect(foe.wound).toBeDefined();
        expect(foe.tankFuseAt).toBe(NOW + TANK_FUSE_MS);
    });

    it('a spawn shield blocks the hit and the roll', () => {
        const { state, foe } = scene();
        foe.spawnShieldUntil = NOW + 1000;
        vi.spyOn(Math, 'random').mockReturnValue(0);
        shot(state, foe, WeaponType.PLASMA_GUN, 10);
        expect(foe.tankFuseAt).toBeUndefined();
    });

    it('burn ticks never light the tank', () => {
        const { state, foe } = scene();
        foe.burnUntil = NOW + 5000;
        foe.burnTickAt = NOW + 500;
        foe.burnBy = 'shooter';
        vi.spyOn(Math, 'random').mockReturnValue(0);
        tickBurning(state, NOW + 5000);
        expect(foe.health).toBeLessThan(100);
        expect(foe.tankFuseAt).toBeUndefined();
    });
});

describe('the fuse on the network', () => {
    it('a snapshot shifts the fuse to the local clock, leaving a calm fighter alone', () => {
        const lit = carrier();
        const calm = createMockPlayer('calm', Team.NONE);
        rollTankIgnition(lit, 'foe', hit(WeaponType.PLASMA_GUN), 1000, () => 0);
        const snap: any = { serverTime: 1000, players: [lit, calm] };
        toLocalClock(snap, 300);
        expect(lit.tankFuseAt).toBe(1000 + TANK_FUSE_MS + 300);
        expect(calm.tankFuseAt).toBeUndefined();
    });
});
