// Game mode specific logic extracted from physics.ts

import { GameState, Entity, WeaponType, ItemType, Team, GameMode } from '../../types';
import { WEAPONS_DATA, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL, HUNGER_SHRINK_STEP, HUNGER_SHRINK_DELAY, HUNGER_MIN_ZONE, HUNGER_QUIET_SHRINK } from '../../constants';
import { emitText } from './effects';
import { baseFlagPos } from '../data/level';

export const resetFlagToBase = (state: GameState, team: Team) => {
    const flag = state.pickups.find(i => i.type === ItemType.FLAG && i.team === team);
    if (flag) {
        flag.active = true;
        flag.respawnTime = 0;
        flag.pos = baseFlagPos(team);
    }
};

export const applyGunGameLoadout = (entity: Entity, level: number) => {
    const clamped = Math.max(0, Math.min(level, GUN_GAME_LADDER.length - 1));
    const weaponType = GUN_GAME_LADDER[clamped] || WeaponType.MACHINE_GUN;
    entity.gunLevel = clamped;
    entity.gunProgress = 0;
    entity.inventory = [{ ...WEAPONS_DATA[weaponType] }];
    entity.weapon = entity.inventory[0];
};

export const handleGunGameKill = (state: GameState, killer: Entity) => {
    killer.gunProgress = (killer.gunProgress || 0) + 1;
    const isFinal = (killer.gunLevel || 0) >= GUN_GAME_LADDER.length - 1;
    if (killer.gunProgress >= GUN_GAME_KILLS_PER_LEVEL) {
        if (isFinal) {
            killer.gunProgress = GUN_GAME_KILLS_PER_LEVEL;
            state.gunGameWinnerId = killer.id;
        } else {
            const nextLevel = (killer.gunLevel || 0) + 1;
            applyGunGameLoadout(killer, nextLevel);
            emitText(killer.pos.x, killer.pos.y - 50, 'UPGRADE!', '#a855f7');
        }
    }
};

export const handleGunGameDeath = (target: Entity) => {
    const level = target.gunLevel || 0;
    const newLevel = Math.max(0, level - 1);
    applyGunGameLoadout(target, newLevel);
};

// Hunger Games: each death queues a shrink that fires HUNGER_SHRINK_DELAY later
export const scheduleHungerZoneShrink = (state: GameState, now: number, steps = 1) => {
    const hz = state.hungerZone;
    if (!hz) return;
    if (!hz.pendingShrink) {
        hz.pendingShrink = true;
        hz.nextShrinkAt = now + HUNGER_SHRINK_DELAY;
        hz.pendingCount = steps;
    } else {
        hz.pendingCount = (hz.pendingCount || 1) + steps;
    }
};

// A quiet shrink closes in as far as two deaths would: a round of nobody dying
// reaches the smallest zone in about 3.5 minutes
const QUIET_SHRINK_STEPS = 2;

type ZoneRect = { x: number; y: number; w: number; h: number; pendingCount?: number };

/**
 * The zone after the queued shrink (also drawn as the warning outline): sides close in
 * around the center, the ceiling comes down, the bottom stays at the arena floor so
 * fighters always have ground to stand on.
 */
export const nextHungerZone = (hz: ZoneRect) => {
    const totalShrink = HUNGER_SHRINK_STEP * Math.max(1, hz.pendingCount || 1);
    const w = Math.max(HUNGER_MIN_ZONE, hz.w - totalShrink * 2);
    const h = Math.max(HUNGER_MIN_ZONE, hz.h - totalShrink);
    return { x: hz.x + hz.w / 2 - w / 2, y: hz.y + hz.h - h, w, h };
};

// Called every tick: fires queued shrinks, and queues one when nobody has died for a while
// so quiet rounds still close in (with the usual warning countdown)
export const tickHungerZoneShrink = (state: GameState, now: number) => {
    const hz = state.hungerZone;
    if (!hz) return;
    const canShrink = hz.w > HUNGER_MIN_ZONE || hz.h > HUNGER_MIN_ZONE;
    if (canShrink && !hz.pendingShrink && now - (hz.lastShrink ?? now) >= HUNGER_QUIET_SHRINK - HUNGER_SHRINK_DELAY) {
        scheduleHungerZoneShrink(state, now, QUIET_SHRINK_STEPS);
    }
    if (!hz.pendingShrink || !hz.nextShrinkAt || now < hz.nextShrinkAt) return;

    Object.assign(hz, nextHungerZone(hz));
    hz.lastShrink = now;
    hz.pendingShrink = false;
    hz.nextShrinkAt = undefined;
    hz.pendingCount = 0;
};
