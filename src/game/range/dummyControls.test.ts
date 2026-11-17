import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team, Platform } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updatePhysics } from '../systems/physics';
import { PRONE_HEIGHT, CROUCH_HEIGHT, STANDING_HEIGHT } from '../systems/stance';
import { clearBotMemory } from '../systems/botMemory';
import { createDummies } from './rangeSetup';
import { createRangeState } from './rangeState';
import { dummyControls } from './dummyControls';

const NOW = 1_000_000;
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); clearBotMemory(); });
afterEach(() => { vi.useRealTimers(); });

const DUMMY = createDummies()[0];

describe('dummyControls', () => {
    it('stands still: no run, no jump, no jetpack', () => {
        const controls = dummyControls(DUMMY, createRangeState());
        expect(controls).toEqual({ inputX: 0, wantsJump: false, wantsDown: false, wantsProne: false, isFlying: false });
    });

    it('crouches and lies down by the range stance', () => {
        const range = createRangeState();
        range.stance = 'crouch';
        expect(dummyControls(DUMMY, range)).toMatchObject({ wantsDown: true, wantsProne: false });
        range.stance = 'prone';
        expect(dummyControls(DUMMY, range)).toMatchObject({ wantsDown: false, wantsProne: true });
        range.stance = 'stand';
        expect(dummyControls(DUMMY, range)).toMatchObject({ wantsDown: false, wantsProne: false });
    });

    it('stands when there is no range state at all', () => {
        expect(dummyControls(DUMMY, undefined)).toMatchObject({ wantsDown: false, wantsProne: false });
    });
});

// A dummy on its own ledge, a live enemy in plain sight 200 px away: a bot brain would shoot or run
const setup = () => {
    const state = createMockState(GameMode.RANGE);
    state.range = createRangeState();
    const dummy = createDummies()[0];
    const ledge = (x: number): Platform => ({ id: `ledge${x}`, x: x - 25, y: dummy.pos.y, w: 50, h: 30, color: '#000' });
    state.platforms.push(ledge(dummy.pos.x), ledge(dummy.pos.x - 200));
    const shooter = createMockPlayer('shooter', Team.NONE);
    shooter.pos = { x: dummy.pos.x - 200, y: dummy.pos.y };
    state.players.push(dummy, shooter);
    return { state, dummy };
};

const tick = (state: ReturnType<typeof setup>['state']) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');

describe('a dummy in updatePhysics', () => {
    it('fires nothing and holds its place for 120 ticks', () => {
        const { state, dummy } = setup();
        const startX = dummy.pos.x;
        for (let i = 0; i < 120; i++) {
            vi.setSystemTime(NOW + i * 8);
            tick(state);
            expect(state.projectiles).toHaveLength(0);
        }
        expect(Math.abs(dummy.pos.x - startX)).toBeLessThanOrEqual(1);
        expect(dummy.grapple.active).toBe(false);
        expect(dummy.dead).toBe(false);
    });

    it('lies down after one tick when the range stance is prone', () => {
        const { state, dummy } = setup();
        state.range!.stance = 'prone';
        tick(state);
        expect(dummy.isProne).toBe(true);
        expect(dummy.height).toBe(PRONE_HEIGHT);
    });

    it('crouches by the stance and stands up again', () => {
        const { state, dummy } = setup();
        state.range!.stance = 'crouch';
        tick(state);
        expect(dummy.isCrouching).toBe(true);
        expect(dummy.height).toBe(CROUCH_HEIGHT);
        state.range!.stance = 'stand';
        tick(state);
        expect(dummy.isCrouching).toBe(false);
        expect(dummy.isProne).toBe(false);
        expect(dummy.height).toBe(STANDING_HEIGHT);
    });
});
