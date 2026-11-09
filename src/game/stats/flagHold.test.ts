import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { tickFlagHold } from './flagHold';

const holdState = (mode: GameMode, hasFlag: Team, extra: Partial<ReturnType<typeof createMockPlayer>> = {}) => {
    const state = createMockState(mode);
    state.players.push({ ...createMockPlayer('me', Team.BLUE), hasFlag, ...extra });
    return state;
};

describe('tickFlagHold', () => {
    it('Hold the Flag: the holder gets one tick per call', () => {
        const state = holdState(GameMode.HOLD_THE_FLAG, Team.BLUE);
        for (let i = 0; i < 3; i++) tickFlagHold(state);
        expect(state.playerStats?.me).toEqual({ flagHoldTicks: 3 });
    });

    it('a dead holder gets nothing', () => {
        const state = holdState(GameMode.HOLD_THE_FLAG, Team.BLUE, { dead: true });
        tickFlagHold(state);
        expect(state.playerStats?.me).toBeUndefined();
    });

    it('CTF: carrying the enemy flag counts', () => {
        const state = holdState(GameMode.CTF, Team.RED);
        tickFlagHold(state);
        expect(state.playerStats?.me).toEqual({ flagHoldTicks: 1 });
    });

    it("CTF: carrying the own team's flag counts nothing", () => {
        const state = holdState(GameMode.CTF, Team.BLUE);
        tickFlagHold(state);
        expect(state.playerStats?.me).toBeUndefined();
    });

    it('a bot holder gets nothing', () => {
        const state = holdState(GameMode.HOLD_THE_FLAG, Team.BLUE, { type: 'bot' });
        tickFlagHold(state);
        expect(state.playerStats?.me).toBeUndefined();
    });

    it('nobody holding a flag counts nothing', () => {
        const state = holdState(GameMode.HOLD_THE_FLAG, Team.NONE);
        tickFlagHold(state);
        expect(state.playerStats).toBeUndefined();
    });
});
