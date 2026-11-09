// Flag time: one `flagHoldTicks` per simulation tick (120/s) for each living human holding a flag.

import { GameMode, Team } from '../../types';
import type { Entity, GameState } from '../../types';
import { bumpStat } from './playerStats';

/** Hold the Flag: the neutral flag carried for the own team. CTF: the enemy flag on its way home. */
const holdsFlag = (mode: GameMode, p: Entity): boolean => {
    if (mode === GameMode.HOLD_THE_FLAG) return p.hasFlag === p.team && p.team !== Team.NONE;
    if (mode === GameMode.CTF) return p.hasFlag !== Team.NONE && p.hasFlag !== p.team;
    return false;
};

export const tickFlagHold = (state: GameState): void => {
    for (const p of state.players) {
        if (p.type === 'player' && !p.dead && holdsFlag(state.mode, p)) bumpStat(state, p.id, 'flagHoldTicks');
    }
};
