// Bot weapon choice: which gun suits the distance and which weapon pickup is worth a detour.

import { Entity, GameState, ItemType, Pickup, Weapon, WeaponType } from '../../types';
import { distance } from '../utils/math';
import { insideZone } from './hungerRound';
import { buildNavGraph, HOP_RISE, solidAt, surfaceBelow } from './botNavGraph';
import { routeReaches } from './botPathfinder';
import { FLAME_RANGE } from './flameConstants';
import { isMagazineFed } from './reload';

const scoreWeaponForDistance = (weapon: Weapon, dist: number) => {
    // Higher score = better choice. Rough heuristics by role.
    switch (weapon.type) {
        case WeaponType.CHAINSAW: return dist < 90 ? 120 - dist : -100;
        case WeaponType.FLAMETHROWER: return dist < FLAME_RANGE - 20 ? 115 - dist * 0.1 : -100; // close-range stream
        case WeaponType.SHOTGUN: return 100 - Math.max(0, dist - 60) * 0.6;
        case WeaponType.ROCKET_LAUNCHER: return 90 - Math.max(0, dist - 120) * 0.35;
        case WeaponType.GRENADE_LAUNCHER: return 85 - Math.max(0, dist - 140) * 0.3;
        case WeaponType.PLASMA_GUN: return 70 - Math.max(0, dist - 260) * 0.25;
        case WeaponType.SMOKE_LAUNCHER: return -1000; // bots never fire smoke
        case WeaponType.RAILGUN: return dist > 280 ? 110 - Math.max(0, (dist - 280) * 0.1) : 40 + dist * 0.05;
        default: return 60 - Math.max(0, dist - 240) * 0.2; // Machine gun fallback
    }
};

/** The bot carries a flamethrower with fuel left, in hand or in the pack. */
export const hasFlamethrower = (bot: Entity) =>
    [bot.weapon, ...bot.inventory].some(w => w.type === WeaponType.FLAMETHROWER && w.ammo > 0);

export const pickBestWeapon = (bot: Entity, dist: number) => {
    let best = bot.weapon;
    // An empty weapon in hand never wins: anything with ammo beats it
    let bestScore = best.ammo <= 0 ? -Infinity : scoreWeaponForDistance(best, dist) + (best.ammo / Math.max(1, best.maxAmmo)) * 30;
    bot.inventory.forEach(w => {
        if (w.ammo <= 0 || w.type === WeaponType.SMOKE_LAUNCHER) return; // bots never fire smoke, even from an empty gun
        const s = scoreWeaponForDistance(w, dist) + (w.ammo / Math.max(1, w.maxAmmo)) * 30;
        if (s > bestScore + 5) { // small hysteresis
            best = w; bestScore = s;
        }
    });
    bot.weapon = best;
};

/** A pickup a bot can go for: inside the Hunger Games zone, not inside a platform, and
 *  standing on the surface below it (or hopping up from it) reaches it. Some items hang
 *  in mid-air beside a platform, where a bot would hop under them forever. */
export const pickupReachable = (state: GameState, item: Pickup) => {
    if (!insideZone(state, item.pos) || solidAt(state.platforms, item.pos.x, item.pos.y)) return false;
    const below = surfaceBelow(buildNavGraph(state.platforms).nodes, item.pos.x, item.pos.y - 4);
    return !!below && below.y - item.pos.y <= HOP_RISE;
};

export const findWeaponPickup = (state: GameState, bot: Entity): Pickup | null => {
    const graph = buildNavGraph(state.platforms);
    let best: Pickup | null = null;
    let bestDist = Infinity;
    state.pickups.forEach(item => {
        if (!item.active || item.type !== ItemType.WEAPON || !item.subtype || !pickupReachable(state, item)) return;
        if (!routeReaches(graph, bot.pos, item.pos)) return;
        const existing = bot.inventory.find(w => w.type === item.subtype);
        const needsAmmo = existing ? !isMagazineFed(existing) && existing.ammo < existing.maxAmmo * 0.4 : true;
        if (item.subtype === WeaponType.SMOKE_LAUNCHER) return; // bots never use it
        if (!existing && item.subtype === WeaponType.MACHINE_GUN) return; // skip default gun duplicates
        if (!existing && item.subtype === bot.weapon.type && bot.weapon.ammo > bot.weapon.maxAmmo * 0.5) return;
        if (!needsAmmo) return;
        const d = distance(bot.pos, item.pos);
        if (d < bestDist) { bestDist = d; best = item; }
    });
    return best;
};
