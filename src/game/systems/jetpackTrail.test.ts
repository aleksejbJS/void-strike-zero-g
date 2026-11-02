import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { DEFAULT_BUILD, FlameId } from '../build/buildParts';
import { jetpackTrail } from './effects';

describe('jetpackTrail', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('uses the particle colour of the flame in the build, fire without a build', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.25);
        const state = createMockState(GameMode.DEATHMATCH);
        const plain = createMockPlayer('a', Team.RED);
        jetpackTrail(state, { ...plain, build: undefined });
        jetpackTrail(state, { ...plain, build: { ...DEFAULT_BUILD, flame: 'blue' } });
        expect(state.particles.map(p => p.color)).toEqual(['#fbbf24', '#60a5fa']);
    });

    it('falls back to the fire colour for a flame id it does not know', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.25);
        const state = createMockState(GameMode.DEATHMATCH);
        const plain = createMockPlayer('a', Team.RED);
        jetpackTrail(state, { ...plain, build: { ...DEFAULT_BUILD, flame: 'plasma' as FlameId } });
        expect(state.particles.map(p => p.color)).toEqual(['#fbbf24']);
    });
});
