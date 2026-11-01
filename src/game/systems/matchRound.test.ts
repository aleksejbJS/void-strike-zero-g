import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updateMatch, isMatchOver, matchTimeLeft, MATCH_TIME_LIMIT, MATCH_RESTART_DELAY, SCORE_LIMIT } from './matchRound';
import { updatePhysics } from './physics';

const dm = () => {
    const state = createMockState(GameMode.DEATHMATCH);
    state.players.push(createMockPlayer('a', Team.NONE), createMockPlayer('b', Team.NONE));
    return state;
};

describe('match limits', () => {
    it('starts the clock on the first update and keeps going below the limits', () => {
        const state = dm();
        updateMatch(state, 1000);
        expect(state.matchStartedAt).toBe(1000);
        expect(matchTimeLeft(state, 1000)).toBe(MATCH_TIME_LIMIT);
        expect(state.matchEndsAt).toBeUndefined();
    });

    it('Deathmatch ends when a player reaches 20 kills', () => {
        const state = dm();
        state.players[1].score = SCORE_LIMIT[GameMode.DEATHMATCH]!;
        updateMatch(state, 1000);
        expect(state.matchWinner).toEqual({ playerId: 'b' });
        expect(state.matchEndReason).toBe('score');
        expect(isMatchOver(state, 1000 + MATCH_RESTART_DELAY)).toBe(true);
        expect(matchTimeLeft(state, 1000)).toBeNull();
    });

    it('CTF ends on 3 captures with the team as winner', () => {
        const state = createMockState(GameMode.CTF);
        state.scores[Team.RED] = 3;
        updateMatch(state, 0);
        expect(state.matchWinner).toEqual({ team: Team.RED });
    });

    it('on time, the leader wins; a tie is a draw', () => {
        const lead = createMockState(GameMode.HOLD_THE_FLAG);
        lead.scores[Team.BLUE] = 12; lead.scores[Team.RED] = 9;
        updateMatch(lead, 0);
        updateMatch(lead, MATCH_TIME_LIMIT);
        expect(lead.matchEndReason).toBe('time');
        expect(lead.matchWinner).toEqual({ team: Team.BLUE });

        const tie = dm();
        updateMatch(tie, 0);
        updateMatch(tie, MATCH_TIME_LIMIT);
        expect(tie.matchWinner).toBeNull();
    });

    it('leaves Gun Game and Hunger Games alone', () => {
        const state = createMockState(GameMode.GUN_GAME);
        updateMatch(state, 0);
        expect(state.matchStartedAt).toBeUndefined();
    });

    it('freezes scoring once the match is over', () => {
        const state = createMockState(GameMode.HOLD_THE_FLAG);
        const holder = createMockPlayer('h', Team.BLUE);
        holder.hasFlag = Team.BLUE;
        holder.vel = { x: 5, y: 5 };
        state.players.push(holder);
        state.matchEndsAt = Date.now() + 5000;
        state.lastHTFScore = 0;

        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'h');

        expect(state.scores[Team.BLUE]).toBe(0);
        expect(holder.vel).toEqual({ x: 0, y: 0 });
    });
});
