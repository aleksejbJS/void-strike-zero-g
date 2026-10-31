// Game mode specific logic extracted from physics.ts

import { GameState, Entity, WeaponType, ItemType, Team, GameMode } from '../../types';
import { WEAPONS_DATA, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL, HUNGER_SHRINK_STEP, HUNGER_SHRINK_DELAY, HUNGER_MIN_ZONE } from '../../constants';
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
export const scheduleHungerZoneShrink = (state: GameState, now: number) => {
    const hz = state.hungerZone;
    if (!hz) return;
    if (!hz.pendingShrink) {
        hz.pendingShrink = true;
        hz.nextShrinkAt = now + HUNGER_SHRINK_DELAY;
        hz.pendingCount = 1;
    } else {
        hz.pendingCount = (hz.pendingCount || 1) + 1;
    }
};

// Called every tick so the zone shrinks on time even if nobody else dies
export const tickHungerZoneShrink = (state: GameState, now: number) => {
    const hz = state.hungerZone;
    if (!hz || !hz.pendingShrink || !hz.nextShrinkAt || now < hz.nextShrinkAt) return;

    const totalShrink = HUNGER_SHRINK_STEP * Math.max(1, hz.pendingCount || 1);
    hz.x += totalShrink;
    hz.y += totalShrink;
    hz.w = Math.max(HUNGER_MIN_ZONE, hz.w - totalShrink * 2);
    hz.h = Math.max(HUNGER_MIN_ZONE, hz.h - totalShrink * 2);
    hz.lastShrink = now;
    hz.pendingShrink = false;
    hz.nextShrinkAt = undefined;
    hz.pendingCount = 0;
};
