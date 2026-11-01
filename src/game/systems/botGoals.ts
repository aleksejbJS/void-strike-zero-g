// Where a bot wants to go and whom it fights, per game mode.

import { Entity, GameMode, GameState, ItemType, Pickup, Team, Vector2, WeaponType } from '../../types';
import { distance } from '../utils/math';
import { EXTRACTION_ZONE, getWaypoints } from '../data/level';
import { BotMemory } from './botMemory';
import { findWeaponPickup } from './botWeapons';
import { insideZone } from './hungerRound';

export interface BotGoal {
    moveTarget: Vector2;
    target: Entity | null; // whom to aim at
}

const LOW_HEALTH = 60;
const CTF_BASES = { [Team.BLUE]: { x: -350, y: 450 }, [Team.RED]: { x: 2350, y: 450 } };

const nearestPickup = (state: GameState, bot: Entity, type: ItemType): Pickup | null => {
    let best: Pickup | null = null;
    let bestDist = Infinity;
    state.pickups.forEach(item => {
        if (!item.active || item.type !== type || !insideZone(state, item.pos)) return;
        const d = distance(bot.pos, item.pos);
        if (d < bestDist) { bestDist = d; best = item; }
    });
    return best;
};

const holdTheFlagGoal = (state: GameState, bot: Entity, mem: BotMemory, target: Entity | null): BotGoal | null => {
    const neutralFlag = state.pickups.find(i => i.type === ItemType.FLAG && i.team === Team.NONE && i.active);
    const enemyHolder = state.players.find(p => p.team !== bot.team && p.hasFlag === p.team && !p.dead);
    if (bot.hasFlag === bot.team) {
        mem.state = 'defend';
        if (enemyHolder) return { moveTarget: enemyHolder.pos, target: enemyHolder };
        if (!target) return { moveTarget: bot.pos, target };
        // Keep moving away from the nearest enemy to avoid being an easy target
        const away = Math.sign(bot.pos.x - target.pos.x) || 1;
        return { moveTarget: { x: bot.pos.x + away * 100, y: bot.pos.y }, target };
    }
    if (neutralFlag) { mem.state = 'flag-run'; return { moveTarget: neutralFlag.pos, target }; }
    if (enemyHolder) { mem.state = 'hunt'; return { moveTarget: enemyHolder.pos, target: enemyHolder }; }
    return null;
};

const infiltrationGoal = (state: GameState, bot: Entity, mem: BotMemory, target: Entity | null): BotGoal | null => {
    const intel = state.pickups.find(i => i.type === ItemType.INTEL);
    const carrier = state.players.find(p => p.hasFlag === Team.RED && !p.dead);
    if (bot.team === Team.BLUE) {
        const extraction = { x: EXTRACTION_ZONE.x + EXTRACTION_ZONE.w / 2, y: EXTRACTION_ZONE.y + EXTRACTION_ZONE.h / 2 };
        if (carrier) { mem.state = 'flag-run'; return { moveTarget: carrier.id === bot.id ? extraction : carrier.pos, target }; }
        if (intel) { mem.state = 'hunt'; return { moveTarget: intel.pos, target }; }
        return null;
    }
    if (carrier) { mem.state = 'hunt'; return { moveTarget: carrier.pos, target: carrier }; }
    if (intel) {
        mem.state = 'defend';
        return { moveTarget: distance(bot.pos, intel.pos) > 400 ? intel.pos : bot.pos, target };
    }
    return null;
};

const ctfGoal = (state: GameState, bot: Entity, mem: BotMemory, target: Entity | null): BotGoal | null => {
    if (bot.hasFlag !== Team.NONE) {
        mem.state = 'flag-run';
        return { moveTarget: CTF_BASES[bot.team === Team.BLUE ? Team.BLUE : Team.RED], target };
    }
    const enemyCarrier = state.players.find(p => p.hasFlag === bot.team);
    if (enemyCarrier) { mem.state = 'defend'; return { moveTarget: enemyCarrier.pos, target: enemyCarrier }; }
    const enemyFlag = state.pickups.find(i => i.type === ItemType.FLAG && i.team !== bot.team && i.active);
    if (enemyFlag) { mem.state = 'flag-run'; return { moveTarget: enemyFlag.pos, target }; }
    return null;
};

const fightOrRoam = (bot: Entity, mem: BotMemory, target: Entity | null, mode?: GameMode): BotGoal => {
    if (target) {
        mem.state = 'hunt';
        // An enemy behind a wall: go and find it instead of holding distance
        if (!mem.targetVisible) return { moveTarget: target.pos, target };
        const dist = distance(bot.pos, target.pos);
        const close = bot.weapon.type === WeaponType.SHOTGUN || bot.weapon.type === WeaponType.CHAINSAW;
        const preferredDist = close ? 120 : 320;
        if (dist > preferredDist) return { moveTarget: target.pos, target };
        if (dist < preferredDist - 120) return { moveTarget: { x: bot.pos.x - (target.pos.x - bot.pos.x), y: bot.pos.y }, target };
        return { moveTarget: bot.pos, target };
    }
    mem.state = 'roam';
    const waypoints = getWaypoints(mode);
    const wp = waypoints[mem.roamIndex % waypoints.length];
    if (distance(bot.pos, wp) < 50) mem.roamIndex = (mem.roamIndex + 1) % waypoints.length;
    return { moveTarget: wp, target };
};

const OBJECTIVES: Partial<Record<GameMode, typeof ctfGoal>> = {
    [GameMode.HOLD_THE_FLAG]: holdTheFlagGoal,
    [GameMode.INFILTRATION]: infiltrationGoal,
    [GameMode.CTF]: ctfGoal,
};

export const chooseGoal = (state: GameState, bot: Entity, mem: BotMemory, target: Entity | null, mode?: GameMode): BotGoal => {
    // Hunger Games: get back inside the zone before anything else
    const hz = state.mode === GameMode.HUNGER_GAMES ? state.hungerZone : undefined;
    if (hz && !insideZone(state, bot.pos)) {
        mem.state = 'retreat';
        return { moveTarget: { x: hz.x + hz.w / 2, y: hz.y + hz.h / 2 }, target };
    }

    // Low on health: go for a medkit, still shooting back on the way
    const medkit = bot.health < LOW_HEALTH ? nearestPickup(state, bot, ItemType.HEALTH) : null;
    if (medkit) {
        mem.state = 'retreat';
        return { moveTarget: medkit.pos, target };
    }

    const goal = OBJECTIVES[state.mode]?.(state, bot, mem, target) ?? fightOrRoam(bot, mem, target, mode);

    // Detour for a weapon when low on ammo, still on the starter gun, or idle in free-for-all modes
    if (bot.hasFlag === Team.NONE) {
        const weaponPickup = findWeaponPickup(state, bot);
        const lowAmmo = bot.weapon.ammo < bot.weapon.maxAmmo * 0.25;
        const hasOnlyStarter = bot.inventory.length <= 1;
        const idleFreeForAll = !target && (state.mode === GameMode.DEATHMATCH || state.mode === GameMode.HUNGER_GAMES);
        if (weaponPickup && (lowAmmo || hasOnlyStarter || idleFreeForAll)) {
            mem.state = 'hunt';
            return { moveTarget: weaponPickup.pos, target: goal.target };
        }
    }
    return goal;
};
