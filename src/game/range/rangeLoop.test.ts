import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { applyDamage } from '../systems/combat';
import { recentDamage } from './rangeReadout';
import { RangeLoop } from './rangeLoop';
import { LOCAL_ID, rangeFixture } from './rangeTestKit';

const T = 1_000_000;

/** A range whose loop has seen one step, so its readout has a baseline. */
const started = () => {
    const fx = rangeFixture();
    const loop = new RangeLoop();
    loop.beforePhysics(fx.state, LOCAL_ID, T);
    loop.afterPhysics(fx.state, T);
    return { ...fx, loop };
};

describe('RangeLoop: the readout across a step', () => {
    it('logs a hit taken during updatePhysics as damage', () => {
        const { state, dummies, loop } = started();
        loop.beforePhysics(state, LOCAL_ID, T + 10);
        applyDamage(state, dummies[0], LOCAL_ID, 30, { x: 0, y: 0 });
        loop.afterPhysics(state, T + 10);
        expect(recentDamage(loop.readout, dummies[0].id, T + 10)).toBe(30);
    });

    it('starts a fresh readout when R is consumed, and the reset itself is no damage', () => {
        const { state, dummies, range, loop } = started();
        loop.beforePhysics(state, LOCAL_ID, T + 10);
        applyDamage(state, dummies[0], LOCAL_ID, 30, { x: 0, y: 0 });
        loop.afterPhysics(state, T + 10);
        const before = loop.readout;

        range.resetRequested = true;
        loop.beforePhysics(state, LOCAL_ID, T + 20);
        loop.afterPhysics(state, T + 20);

        expect(loop.readout).not.toBe(before);
        expect(recentDamage(loop.readout, dummies[0].id, T + 20)).toBe(0);
        expect(dummies[0].health).toBe(100);
    });

    it('keeps the same RangeState object for the whole session', () => {
        const { state, range, loop } = started();
        range.resetRequested = true;
        loop.beforePhysics(state, LOCAL_ID, T + 10);
        loop.afterPhysics(state, T + 10);
        expect(state.range).toBe(range);
    });
});

describe('RangeLoop.key', () => {
    it('changes the settings and returns a copy for the legend', () => {
        const { state, range, loop } = started();
        const copy = loop.key('KeyK', false, state);
        expect(range.armored).toBe(true);
        expect(copy).toEqual(range);
        expect(copy).not.toBe(range);
    });

    it('returns null for other keys and for held-down repeats, which change nothing', () => {
        const { state, range, loop } = started();
        expect(loop.key('KeyW', false, state)).toBeNull();
        expect(loop.key('KeyC', true, state)).toBeNull();
        expect(range.stance).toBe('stand');
    });

    it('does nothing outside the range', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.players.push(createMockPlayer(LOCAL_ID, Team.NONE));
        const loop = new RangeLoop();
        expect(loop.setup(state, LOCAL_ID)).toBeNull();
        expect(loop.key('KeyR', false, state)).toBeNull();
        expect(() => loop.beforePhysics(state, LOCAL_ID, T)).not.toThrow();
        expect(state.range).toBeUndefined();
    });
});
