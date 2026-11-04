// Score- and time-limited matches (Deathmatch, CTF, Hold the Flag, Infiltration).
// Shared by offline play and the authoritative room. See docs/plans/2026-11-01-match-end-spec.md.

import { GameMode, GameState, Team } from '../../types';

export const MATCH_TIME_LIMIT = 10 * 60 * 1000;
export const MATCH_RESTART_DELAY = 10000;

export const SCORE_LIMIT: Partial<Record<GameMode, number>> = {
    [GameMode.DEATHMATCH]: 20,
    [GameMode.CTF]: 3,
    [GameMode.HOLD_THE_FLAG]: 60,
    [GameMode.INFILTRATION]: 3,
    [GameMode.DUEL]: 10,
};

export const hasMatchLimits = (mode: GameMode) => SCORE_LIMIT[mode] !== undefined;
export const isTeamMatch = (mode: GameMode) => mode === GameMode.CTF || mode === GameMode.HOLD_THE_FLAG || mode === GameMode.INFILTRATION;

/** Who leads and with what score. `winner` is null on a tie. */
const standings = (state: GameState): { best: number; winner: GameState['matchWinner'] } => {
    if (isTeamMatch(state.mode)) {
        const blue = state.scores[Team.BLUE];
        const red = state.scores[Team.RED];
        return { best: Math.max(blue, red), winner: blue === red ? null : { team: blue > red ? Team.BLUE : Team.RED } };
    }
    const ranked = [...state.players].sort((a, b) => b.score - a.score);
    const [first, second] = ranked;
    if (!first) return { best: 0, winner: null };
    const tie = second !== undefined && second.score === first.score;
    return { best: first.score, winner: tie ? null : { playerId: first.id } };
};

/** End the match on the score limit or when time runs out. Called every tick. */
export const updateMatch = (state: GameState, now: number) => {
    if (!hasMatchLimits(state.mode) || state.matchEndsAt) return;
    if (state.matchStartedAt === undefined) state.matchStartedAt = now; // a new match starts its clock lazily

    const { best, winner } = standings(state);
    // A duel always needs a winner: a tie (also 10:10 after a mutual kill at 9:9) plays on, the next kill decides
    const duelTie = state.mode === GameMode.DUEL && winner === null;
    if (best >= SCORE_LIMIT[state.mode]!) {
        if (duelTie) return;
        state.matchEndReason = 'score';
    } else if (now - state.matchStartedAt >= MATCH_TIME_LIMIT) {
        if (duelTie) return; // sudden death: the next kill decides
        state.matchEndReason = 'time';
    } else {
        return;
    }
    state.matchWinner = winner;
    state.matchEndsAt = now + MATCH_RESTART_DELAY;
};

export const isMatchOver = (state: GameState, now: number) => !!state.matchEndsAt && now >= state.matchEndsAt;

/** Milliseconds left in a running match, or null if it has no clock or already ended. */
export const matchTimeLeft = (state: GameState, now: number): number | null =>
    state.matchStartedAt === undefined || state.matchEndsAt ? null : Math.max(0, state.matchStartedAt + MATCH_TIME_LIMIT - now);
