import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { matchWinStats } from './matchWinStats';

const bot = (id: string) => ({ ...createMockPlayer(id, Team.RED), type: 'bot' as const });

const stateOf = (humans: number, bots: number) => {
    const state = createMockState(GameMode.DEATHMATCH);
    for (let i = 0; i < humans; i++) state.players.push(createMockPlayer(`human${i}`, Team.BLUE));
    for (let i = 0; i < bots; i++) state.players.push(bot(`bot${i}`));
    return state;
};

describe('matchWinStats', () => {
    it('counts a bot-match win when one human played against bots', () => {
        expect(matchWinStats(stateOf(1, 3), { key: 'match:1', won: true })).toEqual({ botWins: 1 });
    });

    it('counts a win when two or more humans played', () => {
        expect(matchWinStats(stateOf(2, 0), { key: 'match:1', won: true })).toEqual({ wins: 1 });
        expect(matchWinStats(stateOf(2, 2), { key: 'match:1', won: true })).toEqual({ wins: 1 });
    });

    it('counts nothing for a loss or a draw', () => {
        expect(matchWinStats(stateOf(1, 3), { key: 'match:1', won: false })).toEqual({});
        expect(matchWinStats(stateOf(3, 0), { key: 'hunger:9', won: false })).toEqual({});
    });

    it('adds a Hunger Games win on top of the match win', () => {
        expect(matchWinStats(stateOf(1, 5), { key: 'hunger:9000', won: true })).toEqual({ botWins: 1, hungerWins: 1 });
        expect(matchWinStats(stateOf(2, 4), { key: 'hunger:9000', won: true })).toEqual({ wins: 1, hungerWins: 1 });
    });

    it('does not mistake a Gun Game win for a Hunger Games win', () => {
        expect(matchWinStats(stateOf(1, 2), { key: 'gun:5:me', won: true })).toEqual({ botWins: 1 });
    });
});
