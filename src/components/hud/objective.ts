// What the local player should do right now in a team mode — shown under the team score.

import { GameMode, GameState, Team } from '../../types';
import type { TranslationKeys } from '../../i18n/locales';

export interface Objective {
    key: keyof TranslationKeys;
    team?: Team; // fills "{0}" with a team color word
}

export const objectiveFor = (state: GameState, localId: string): Objective | null => {
    const me = state.players.find(p => p.id === localId);
    if (!me || me.team === Team.NONE) return null;
    const enemy = me.team === Team.BLUE ? Team.RED : Team.BLUE;

    switch (state.mode) {
        case GameMode.CTF: {
            if (me.hasFlag === enemy) return { key: 'obj.ctfCarry', team: enemy };
            const flagTaken = state.players.some(p => p.team === enemy && p.hasFlag === me.team);
            return flagTaken ? { key: 'obj.ctfDefend' } : { key: 'obj.ctfGrab', team: enemy };
        }
        case GameMode.HOLD_THE_FLAG: {
            const holder = state.players.find(p => !p.dead && p.team !== Team.NONE && p.hasFlag === p.team);
            if (!holder) return { key: 'obj.htfFree' };
            if (holder.id === me.id) return { key: 'obj.htfYou' };
            return holder.team === me.team ? { key: 'obj.htfTeam' } : { key: 'obj.htfEnemy' };
        }
        case GameMode.INFILTRATION: {
            const carrier = state.players.find(p => !p.dead && p.hasFlag === Team.RED);
            if (me.team === Team.BLUE) return carrier?.id === me.id ? { key: 'obj.infCarry' } : { key: 'obj.infAttack' };
            return carrier ? { key: 'obj.infStop' } : { key: 'obj.infDefend' };
        }
        default:
            return null;
    }
};
