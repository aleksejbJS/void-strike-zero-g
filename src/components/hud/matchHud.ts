// Turns the match state into what the HUD shows: clock, goal line and the results screen.

import { GameMode, GameState, Team } from '../../types';
import { SCORE_LIMIT, hasMatchLimits, isTeamMatch, matchTimeLeft } from '../../game/systems/matchRound';
import type { Translate } from '../menu/types';

export interface MatchHud {
    timeLeftSec: number | null;
    /** A duel tied at the time limit: the next kill decides, the clock shows "Sudden death" instead of 0:00. */
    suddenDeath?: boolean;
    goal: string;
    result: null | {
        title: string;
        reason: string;
        restartSec: number;
        teams: { blue: number; red: number } | null; // team modes show the final team score
    };
}

const goalKey = (mode: GameMode) =>
    mode === GameMode.DEATHMATCH ? 'match.goal.dm' : mode === GameMode.CTF ? 'match.goal.ctf' : 'match.goal.points';

export const buildMatchHud = (state: GameState, now: number, t: Translate): MatchHud | null => {
    if (!hasMatchLimits(state.mode)) return null;
    const left = matchTimeLeft(state, now);
    const hud: MatchHud = {
        timeLeftSec: left === null ? null : Math.ceil(left / 1000),
        goal: t(goalKey(state.mode), SCORE_LIMIT[state.mode]),
        result: null,
    };
    if (state.mode === GameMode.DUEL && left === 0) hud.suddenDeath = true;
    if (!state.matchEndsAt) return hud;

    const w = state.matchWinner;
    const title = !w ? t('match.draw')
        : w.team ? t('match.teamWins', t(w.team === Team.BLUE ? 'pv.blue' : 'pv.red'))
            : t('match.playerWins', state.players.find(p => p.id === w.playerId)?.name ?? '?');
    hud.result = {
        title,
        reason: t(state.matchEndReason === 'time' ? 'match.byTime' : 'match.byScore'),
        restartSec: Math.max(0, Math.ceil((state.matchEndsAt - now) / 1000)),
        teams: isTeamMatch(state.mode) ? { blue: state.scores[Team.BLUE], red: state.scores[Team.RED] } : null,
    };
    return hud;
};
