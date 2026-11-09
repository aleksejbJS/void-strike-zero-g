import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { fireWeapon } from './combat';
import { canFire, isMagazineFed, reloadProgress, tickReloads } from './reload';
import { gameEvents, GameEvent } from './events';

const T0 = 1_000_000;

const gunner = () => {
    const state = createMockState(GameMode.DEATHMATCH);
    const p = createMockPlayer('p1', Team.NONE);
    p.inventory = [p.weapon];
    state.players.push(p);
    return { state, p };
};

const emptyMagazine = (state: ReturnType<typeof createMockState>, p: ReturnType<typeof createMockPlayer>) => {
    for (let i = 0; i < 50; i++) fireWeapon(state, p, { x: 500, y: 0 });
};

afterEach(() => { vi.useRealTimers(); });

describe('Machine Gun magazine', () => {
    it('is the only magazine-fed weapon: 50 rounds, 1 s reload', () => {
        const fed = Object.values(WEAPONS_DATA).filter(isMagazineFed).map(w => w.type);
        expect(fed).toEqual([WeaponType.MACHINE_GUN]);
        expect(WEAPONS_DATA[WeaponType.MACHINE_GUN]).toMatchObject({ ammo: 50, maxAmmo: 50, reloadMs: 1000 });
    });

    it('fires 50 shots, then the empty magazine starts reloading and the 51st shot does nothing', () => {
        vi.useFakeTimers({ now: T0 });
        const { state, p } = gunner();
        emptyMagazine(state, p);
        expect(state.projectiles).toHaveLength(50);
        expect(p.weapon.ammo).toBe(0);
        expect(p.weapon.reloadEndsAt).toBe(T0 + 1000);

        fireWeapon(state, p, { x: 500, y: 0 });
        expect(state.projectiles).toHaveLength(50);
    });

    it('refills to 50 once the second is up, and not before', () => {
        vi.useFakeTimers({ now: T0 });
        const { state, p } = gunner();
        emptyMagazine(state, p);

        tickReloads(p, T0 + 999);
        expect(p.weapon.ammo).toBe(0);
        expect(canFire(p.weapon)).toBe(false);

        tickReloads(p, T0 + 1000);
        expect(p.weapon.ammo).toBe(50);
        expect(p.weapon.reloadEndsAt).toBeUndefined();
        expect(canFire(p.weapon)).toBe(true);
    });

    it('keeps reloading in the background after switching to another weapon', () => {
        vi.useFakeTimers({ now: T0 });
        const { state, p } = gunner();
        emptyMagazine(state, p);
        const machineGun = p.weapon;
        const shotgun = { ...WEAPONS_DATA[WeaponType.SHOTGUN] };
        p.inventory.push(shotgun);
        p.weapon = shotgun;

        tickReloads(p, T0 + 1000);
        expect(machineGun.ammo).toBe(50);
    });

    it('starts a reload for an empty magazine that did not start one itself', () => {
        const { p } = gunner();
        p.weapon.ammo = 0;
        tickReloads(p, T0);
        expect(p.weapon.reloadEndsAt).toBe(T0 + 1000);
    });

    it('plays the reload sound once, when the reload starts', () => {
        const { state, p } = gunner();
        const sounds: GameEvent[] = [];
        const off = gameEvents.on(e => { if (e.type === 'SOUND' && e.sound === 'reload') sounds.push(e); });
        emptyMagazine(state, p);
        tickReloads(p, Date.now() + 10);
        off();
        expect(sounds).toHaveLength(1);
    });

    it('leaves other weapons alone: an empty shotgun stays empty', () => {
        const { p } = gunner();
        const shotgun = { ...WEAPONS_DATA[WeaponType.SHOTGUN], ammo: 0 };
        p.inventory.push(shotgun);
        tickReloads(p, T0 + 60_000);
        expect(shotgun.ammo).toBe(0);
        expect(shotgun.reloadEndsAt).toBeUndefined();
    });
});

describe('reloadProgress', () => {
    it('is null when not reloading and runs 0 → 1 over the reload', () => {
        const w = { ...WEAPONS_DATA[WeaponType.MACHINE_GUN] };
        expect(reloadProgress(w, T0)).toBeNull();
        w.reloadEndsAt = T0 + 1000;
        expect(reloadProgress(w, T0)).toBe(0);
        expect(reloadProgress(w, T0 + 250)).toBeCloseTo(0.25);
        expect(reloadProgress(w, T0 + 5000)).toBe(1);
    });
});
