import { describe, expect, it } from 'vitest';
import { FighterAnimator } from './fighterAnimator';
import { createMockPlayer, createMockState } from '../../../test/mocks';
import { GameMode, Team } from '../../../types';

const frameOf = (setup: (p: ReturnType<typeof createMockPlayer>) => void) => {
    const game = createMockState(GameMode.DEATHMATCH);
    const p = createMockPlayer('a', Team.BLUE);
    p.pos = { x: 100, y: 500 };
    setup(p);
    const frame = new FighterAnimator().frame(p, 0, 1000, {}, game);
    return { frame, game };
};

const hopping = (p: ReturnType<typeof createMockPlayer>) => { p.wound = { by: 'x' }; p.isGrounded = true; p.vel.x = 1; };

describe('the animator and a wounded fighter', () => {
    it('marks a wounded fighter one-legged and a whole one not', () => {
        expect(frameOf(p => { p.wound = { by: 'x' }; }).frame.oneLeg).toBe(true);
        expect(frameOf(() => {}).frame.oneLeg).toBeFalsy();
    });

    it('hops on one leg while moving on the ground', () => {
        expect(frameOf(hopping).frame.hop).toBeGreaterThan(0);
    });

    it('does not hop standing still, in the air or on two legs', () => {
        expect(frameOf(p => { hopping(p); p.vel.x = 0; }).frame.hop ?? 0).toBe(0);
        expect(frameOf(p => { hopping(p); p.isGrounded = false; }).frame.hop ?? 0).toBe(0);
        expect(frameOf(p => { hopping(p); delete p.wound; }).frame.hop ?? 0).toBe(0);
        expect(frameOf(p => { hopping(p); p.isCrouching = true; }).frame.hop ?? 0).toBe(0);
    });

    it('drips blood from the stump of a wounded fighter, and only of a wounded one', () => {
        const wounded = frameOf(p => { p.wound = { by: 'x' }; }).game;
        expect(wounded.particles.filter(p => p.type === 'blood')).toHaveLength(1);
        expect(frameOf(() => {}).game.particles.filter(p => p.type === 'blood')).toHaveLength(0);
    });

    it('drips near the hip, which is above the feet', () => {
        const [drop] = frameOf(p => { p.wound = { by: 'x' }; }).game.particles;
        expect(Math.abs(drop.pos.x - 100)).toBeLessThan(30);
        expect(drop.pos.y).toBeLessThan(500 - 15);
        expect(drop.pos.y).toBeGreaterThan(500 - 60);
    });
});
