// Game mode specific logic extracted from physics.ts

import { GameState, Entity, WeaponType, ItemType, Team, GameMode } from '../../types';
import { WEAPONS_DATA, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL } from '../../constants';
import { nextId } from '../utils/id';
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
            state.floatingTexts.push({
                id: nextId('ft_'),
                pos: { x: killer.pos.x, y: killer.pos.y - 50 },
                text: 'UPGRADE!',
                color: '#a855f7',
                life: 1,
                velY: 1
            });
        }
    }
};

export const handleGunGameDeath = (target: Entity) => {
    const level = target.gunLevel || 0;
    const newLevel = Math.max(0, level - 1);
    applyGunGameLoadout(target, newLevel);
};
