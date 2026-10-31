import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updateHungerRound, isHungerRoundOver, HUNGER_RESTART_DELAY } from './hungerRound';
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
