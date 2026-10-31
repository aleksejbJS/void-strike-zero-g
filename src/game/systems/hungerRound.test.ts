import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updateHungerRound, isHungerRoundOver, HUNGER_RESTART_DELAY, HUNGER_ROUND_TIME } from './hungerRound';
import { pickCameraTarget } from './camera';

const roundWith = (aliveIds: string[], deadIds: string[] = []) => {
    const state = createMockState(GameMode.HUNGER_GAMES);
    aliveIds.forEach(id => state.players.push(createMockPlayer(id, Team.NONE)));
    deadIds.forEach(id => state.players.push({ ...createMockPlayer(id, Team.NONE), dead: true }));
    return state;
};

describe('Hunger Games round', () => {
    it('keeps going while two or more fighters are alive', () => {
        const state = roundWith(['a', 'b'], ['c']);
        updateHungerRound(state, 1000);
        expect(state.hungerRoundEndsAt).toBeUndefined();
    });

    it('declares the last survivor and schedules the restart', () => {
        const state = roundWith(['a'], ['b', 'c']);
        updateHungerRound(state, 1000);
        expect(state.hungerWinnerId).toBe('a');
        expect(state.hungerRoundEndsAt).toBe(1000 + HUNGER_RESTART_DELAY);
        expect(isHungerRoundOver(state, 1000 + HUNGER_RESTART_DELAY - 1)).toBe(false);
        expect(isHungerRoundOver(state, 1000 + HUNGER_RESTART_DELAY)).toBe(true);
    });

    it('ends with no winner when the last two die together (no endless round)', () => {
        const state = roundWith([], ['a', 'b']);
        updateHungerRound(state, 1000);
        expect(state.hungerWinnerId).toBeNull();
        expect(state.hungerRoundEndsAt).toBe(1000 + HUNGER_RESTART_DELAY);
    });

    it('does not move the restart time once the round is over', () => {
        const state = roundWith(['a'], ['b']);
        updateHungerRound(state, 1000);
        updateHungerRound(state, 5000);
        expect(state.hungerRoundEndsAt).toBe(1000 + HUNGER_RESTART_DELAY);
    });
});

describe('Hunger Games round time limit', () => {
    const timed = () => {
        const state = roundWith(['a', 'b', 'c']);
        state.hungerRoundStartedAt = 0;
        return state;
    };

    it('keeps going before time runs out', () => {
        const state = timed();
        updateHungerRound(state, HUNGER_ROUND_TIME - 1);
        expect(state.hungerRoundEndsAt).toBeUndefined();
    });

    it('when time is up, the survivor with most kills wins', () => {
        const state = timed();
        state.players[1].score = 3;
        state.players[2].score = 1;
        updateHungerRound(state, HUNGER_ROUND_TIME);
        expect(state.hungerWinnerId).toBe('b');
        expect(state.hungerEndReason).toBe('time');
        expect(state.hungerRoundEndsAt).toBe(HUNGER_ROUND_TIME + HUNGER_RESTART_DELAY);
    });

    it('breaks a kill tie by remaining health, ignoring the dead', () => {
        const state = timed();
        state.players.forEach(p => { p.score = 2; });
        state.players[0].health = 40;
        state.players[1].health = 90;
        state.players[2].health = 10;
        state.players.push({ ...createMockPlayer('dead', Team.NONE), dead: true, score: 9 });
        updateHungerRound(state, HUNGER_ROUND_TIME);
        expect(state.hungerWinnerId).toBe('b');
    });

    it('a last survivor ends the round the usual way', () => {
        const state = roundWith(['a'], ['b']);
        state.hungerRoundStartedAt = 0;
        updateHungerRound(state, 10);
        expect(state.hungerEndReason).toBe('last-standing');
    });
});

describe('spectator camera', () => {
    it('follows the bet target, else the winner, else someone alive', () => {
        const state = roundWith(['a', 'b'], ['me']);
        expect(pickCameraTarget(state, 'me')!.id).toBe('a');
        state.betSpectateId = 'b';
        expect(pickCameraTarget(state, 'me')!.id).toBe('b');
        state.betSpectateId = null;
        state.hungerWinnerId = 'b';
        expect(pickCameraTarget(state, 'me')!.id).toBe('b');
    });

    it('follows our own player while alive (other modes always)', () => {
        const state = roundWith(['a', 'me']);
        expect(pickCameraTarget(state, 'me')!.id).toBe('me');
        state.mode = GameMode.DEATHMATCH;
        state.players[1].dead = true;
        expect(pickCameraTarget(state, 'me')!.id).toBe('me');
    });
});
