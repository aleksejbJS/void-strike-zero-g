import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updateMatch, MATCH_TIME_LIMIT, SCORE_LIMIT } from './matchRound';

const twoFighters = (mode: GameMode, a: number, b: number) => {
    const state = createMockState(mode);
    state.players.push(createMockPlayer('a', Team.NONE), createMockPlayer('b', Team.NONE));
    state.players[0].score = a;
    state.players[1].score = b;
    return state;
};

describe('duel match limits', () => {
    it('plays to 10', () => {
        expect(SCORE_LIMIT[GameMode.DUEL]).toBe(10);
        const state = twoFighters(GameMode.DUEL, 3, 10);
        updateMatch(state, 0);
        expect(state.matchEndReason).toBe('score');
        expect(state.matchWinner).toEqual({ playerId: 'b' });
    });

    it('does not end below 10 before the time is up', () => {
        const state = twoFighters(GameMode.DUEL, 9, 9);
        updateMatch(state, 0);
        updateMatch(state, MATCH_TIME_LIMIT - 1);
        expect(state.matchEndsAt).toBeUndefined();
    });

    it('goes to sudden death when time runs out on a tie', () => {
        const state = twoFighters(GameMode.DUEL, 4, 4);
        updateMatch(state, 0);
        updateMatch(state, MATCH_TIME_LIMIT);
        expect(state.matchEndsAt).toBeUndefined();
        expect(state.matchEndReason).toBeUndefined();
        updateMatch(state, MATCH_TIME_LIMIT + 5000);
        expect(state.matchEndsAt).toBeUndefined();
    });

    it('ends on the next kill in sudden death, by time, with the leader as winner', () => {
        const state = twoFighters(GameMode.DUEL, 4, 4);
        updateMatch(state, 0);
        updateMatch(state, MATCH_TIME_LIMIT);
        state.players[0].score = 5;
        updateMatch(state, MATCH_TIME_LIMIT + 1000);
        expect(state.matchEndReason).toBe('time');
        expect(state.matchWinner).toEqual({ playerId: 'a' });
        expect(state.matchEndsAt).toBeDefined();
    });

    it('lets the leader win when time runs out without a tie', () => {
        const state = twoFighters(GameMode.DUEL, 3, 6);
        updateMatch(state, 0);
        updateMatch(state, MATCH_TIME_LIMIT);
        expect(state.matchEndReason).toBe('time');
        expect(state.matchWinner).toEqual({ playerId: 'b' });
    });
});

describe('time limit in other modes (regression guard)', () => {
    it('Deathmatch still ends in a draw when time runs out on a tie', () => {
        const state = twoFighters(GameMode.DEATHMATCH, 4, 4);
        updateMatch(state, 0);
        updateMatch(state, MATCH_TIME_LIMIT);
        expect(state.matchEndsAt).toBeDefined();
        expect(state.matchEndReason).toBe('time');
        expect(state.matchWinner).toBeNull();
    });
});
