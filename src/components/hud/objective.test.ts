import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { objectiveFor } from './objective';

const setup = (mode: GameMode, myTeam = Team.BLUE) => {
    const state = createMockState(mode);
    const me = createMockPlayer('me', myTeam);
    const ally = createMockPlayer('ally', myTeam);
    const foe = createMockPlayer('foe', myTeam === Team.BLUE ? Team.RED : Team.BLUE);
    state.players.push(me, ally, foe);
    return { state, me, ally, foe };
};

describe('objectiveFor', () => {
    it('has nothing to say in free-for-all modes', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.players.push(createMockPlayer('me', Team.NONE));
        expect(objectiveFor(state, 'me', 0)).toBeNull();
    });

    it('CTF: grab, carry, defend', () => {
        const { state, me, foe } = setup(GameMode.CTF);
        expect(objectiveFor(state, 'me', 0)).toEqual({ key: 'obj.ctfGrab', team: Team.RED });
        me.hasFlag = Team.RED;
        expect(objectiveFor(state, 'me', 0)).toEqual({ key: 'obj.ctfCarry', team: Team.RED });
        me.hasFlag = Team.NONE;
        foe.hasFlag = Team.BLUE;
        expect(objectiveFor(state, 'me', 0)).toEqual({ key: 'obj.ctfDefend' });
    });

    it('Hold the Flag: who has the golden flag', () => {
        const { state, me, ally, foe } = setup(GameMode.HOLD_THE_FLAG);
        expect(objectiveFor(state, 'me', 0)?.key).toBe('obj.htfFree');
        me.hasFlag = Team.BLUE;
        expect(objectiveFor(state, 'me', 0)?.key).toBe('obj.htfYou');
        me.hasFlag = Team.NONE; ally.hasFlag = Team.BLUE;
        expect(objectiveFor(state, 'me', 0)?.key).toBe('obj.htfTeam');
        ally.hasFlag = Team.NONE; foe.hasFlag = Team.RED;
        expect(objectiveFor(state, 'me', 0)?.key).toBe('obj.htfEnemy');
    });

    it('Infiltration: attackers and defenders see their own goal', () => {
        const blue = setup(GameMode.INFILTRATION, Team.BLUE);
        blue.state.infiltrationEndTime = 60_000;
        expect(objectiveFor(blue.state, 'me', 0)).toEqual({ key: 'obj.infAttack', timeMs: 60_000 });
        blue.me.hasFlag = Team.RED;
        expect(objectiveFor(blue.state, 'me', 0)?.key).toBe('obj.infCarry');

        const red = setup(GameMode.INFILTRATION, Team.RED);
        red.state.infiltrationEndTime = 61_000;
        expect(objectiveFor(red.state, 'me', 1_000)).toEqual({ key: 'obj.infDefend', timeMs: 60_000 });
        red.foe.hasFlag = Team.RED;
        expect(objectiveFor(red.state, 'me', 0)?.key).toBe('obj.infStop');
    });
});
