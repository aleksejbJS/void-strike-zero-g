import { describe, it, expect } from 'vitest';
import { WEAPONS_DATA } from '../../constants';
import { WeaponType } from '../../types';
import {
    FLAME_RANGE, FLAME_HALF_ANGLE, BURN_MS, BURN_TICK_MS, BURN_DAMAGE,
    TANK_FUSE_MS, TANK_RADIUS, TANK_DAMAGE, TANK_KILL_NAME,
    TANK_IGNITE_CHANCE, TANK_BLAST_CHANCE, FLAME_COVER_MULT,
} from './flameConstants';

describe('flamethrower weapon data', () => {
    it('is a short-range stream weapon with no recoil or knockback', () => {
        expect(WEAPONS_DATA[WeaponType.FLAMETHROWER]).toEqual({
            type: WeaponType.FLAMETHROWER,
            name: 'Flamethrower',
            damage: 5,
            fireRate: 100,
            speed: 0,
            color: '#f97316',
            ammo: 100,
            maxAmmo: 200,
            recoil: 0,
            knockbackForce: 0,
        });
    });
});

describe('flame tuning constants', () => {
    it('describes the flame stream and the burning status', () => {
        expect(FLAME_RANGE).toBe(300);
        expect(FLAME_HALF_ANGLE).toBeCloseTo((8 * Math.PI) / 180, 10);
        expect(BURN_MS).toBe(5000);
        expect(BURN_TICK_MS).toBe(500);
        expect(BURN_DAMAGE).toBe(1);
    });

    it('describes the fuel tank', () => {
        expect(TANK_FUSE_MS).toBe(3000);
        expect(TANK_RADIUS).toBe(170);
        expect(TANK_DAMAGE).toBe(90);
        expect(TANK_KILL_NAME).toBe('Fuel Tank');
        expect(TANK_BLAST_CHANCE).toBe(0.15);
    });

    it('gives every weapon its own chance to light a fuel tank', () => {
        expect(TANK_IGNITE_CHANCE).toEqual({
            [WeaponType.MACHINE_GUN]: 0.02,
            [WeaponType.SHOTGUN]: 0.01,
            [WeaponType.PLASMA_GUN]: 0.05,
            [WeaponType.RAILGUN]: 0.05,
            [WeaponType.CHAINSAW]: 0.02,
            [WeaponType.FLAMETHROWER]: 0.015,
            [WeaponType.SMOKE_LAUNCHER]: 0,
            [WeaponType.ROCKET_LAUNCHER]: 0.15,
            [WeaponType.GRENADE_LAUNCHER]: 0.15,
        });
    });

    it('scales flame damage to each kind of cover', () => {
        expect(FLAME_COVER_MULT).toEqual({ wood: 2, glass: 1, barrel: 1, metal: 0.25 });
    });
});
