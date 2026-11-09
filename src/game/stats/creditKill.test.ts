import { describe, it, expect } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { creditKill } from './creditKill';

const bot = (id: string) => ({ ...createMockPlayer(id, Team.NONE), type: 'bot' as const });

describe('creditKill', () => {
    it('a human killing a bot with the railgun counts a bot kill and a railgun kill', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const killer = createMockPlayer('me', Team.NONE);
        creditKill(state, killer, bot('bot_0'), WeaponType.RAILGUN);
        expect(state.playerStats?.me).toEqual({ botKills: 1, railgunKills: 1 });
    });

    it('a human killing a human counts a kill', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        creditKill(state, createMockPlayer('me', Team.NONE), createMockPlayer('you', Team.NONE), WeaponType.MACHINE_GUN);
        expect(state.playerStats?.me).toEqual({ kills: 1 });
    });

    it('counts chainsaw and rocket kills and adds up over several kills', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const killer = createMockPlayer('me', Team.NONE);
        creditKill(state, killer, createMockPlayer('you', Team.NONE), WeaponType.CHAINSAW);
        creditKill(state, killer, bot('bot_0'), WeaponType.ROCKET_LAUNCHER);
        expect(state.playerStats?.me).toEqual({ kills: 1, botKills: 1, chainsawKills: 1, rocketKills: 1 });
    });

    it('a bot killing a human gives the bot no entry', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        creditKill(state, bot('bot_0'), createMockPlayer('me', Team.NONE), WeaponType.RAILGUN);
        expect(state.playerStats?.bot_0).toBeUndefined();
    });

    it('a barrel kill (no weapon) counts only the kill itself', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const killer = createMockPlayer('me', Team.NONE);
        creditKill(state, killer, bot('bot_0'), undefined);
        creditKill(state, killer, createMockPlayer('you', Team.NONE), undefined);
        expect(state.playerStats?.me).toEqual({ botKills: 1, kills: 1 });
    });
});
