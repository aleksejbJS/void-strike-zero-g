// Kill counters for a human killer (bots keep no stats).

import { WeaponType } from '../../types';
import type { Entity, GameState } from '../../types';
import type { StatKey } from './statKeys';
import { bumpStat } from './playerStats';

const WEAPON_KILL_STAT: Partial<Record<WeaponType, StatKey>> = {
    [WeaponType.CHAINSAW]: 'chainsawKills',
    [WeaponType.RAILGUN]: 'railgunKills',
    [WeaponType.ROCKET_LAUNCHER]: 'rocketKills',
};

/**
 * Count a kill for `killer`. Call only for a real kill (not a suicide, not a teammate).
 * `weapon` is undefined for a kill with no weapon (a barrel): it then counts only as a kill.
 */
export const creditKill = (state: GameState, killer: Entity, target: Entity, weapon: WeaponType | undefined): void => {
    if (killer.type !== 'player') return;
    bumpStat(state, killer.id, target.type === 'bot' ? 'botKills' : 'kills');
    const weaponStat = weapon === undefined ? undefined : WEAPON_KILL_STAT[weapon];
    if (weaponStat) bumpStat(state, killer.id, weaponStat);
};
