import { describe, expect, it } from 'vitest';
import { FighterAnimator } from './fighterAnimator';
import { createMockPlayer, createMockState } from '../../../test/mocks';
import { GameMode, Team } from '../../../types';

describe('fighter pose and injury frame state', () => {
    it('carries crouch/prone state explicitly to the art selector', () => {
        const animator = new FighterAnimator(), p = createMockPlayer('human', Team.BLUE);
        const game = createMockState(GameMode.DEATHMATCH);
        p.isCrouching = true;
        expect(animator.frame(p, 0, 1000, {}, game).pose.state).toBe('crouch');
        p.isCrouching = false; p.isProne = true;
        expect(animator.frame(p, 0, 1016, {}, game).pose.state).toBe('prone');
    });

    it('shows pain for low health, a missing leg and the temporary flash after a hit', () => {
        const animator = new FighterAnimator(), p = createMockPlayer('human', Team.BLUE);
        const game = createMockState(GameMode.DEATHMATCH);
        p.health = 100;
        expect(animator.frame(p, 0, 1000, {}, game).expression).toBe('normal');
        p.health = 80;
        expect(animator.frame(p, 0, 1016, {}, game).expression).toBe('hurt');
        expect(animator.frame(p, 0, 1200, {}, game).expression).toBe('normal');
        p.health = 40;
        expect(animator.frame(p, 0, 1400, {}, game).expression).toBe('hurt');
        expect(animator.frame(p, 0, 1600, {}, game).expression).toBe('hurt');
        p.health = 100; p.wound = { by: 'enemy' };
        expect(animator.frame(p, 0, 1800, {}, game).expression).toBe('hurt');
        delete p.wound;
        expect(animator.frame(p, 0, 2000, {}, game).expression).toBe('normal');
    });
});
