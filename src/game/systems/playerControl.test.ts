import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { JUMP_SPEED, WALK_INPUT } from '../../constants';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { applyPlayerMovement, readControls } from './playerControl';

describe('readControls', () => {
    const player = (isGrounded: boolean) => ({ ...createMockPlayer('p', Team.NONE), isGrounded });

    it('runs at full input on the keyboard', () => {
        expect(readControls(player(true), { KeyD: true }).inputX).toBe(1);
    });

    it('walks on the ground when the touch stick is only half pushed', () => {
        expect(readControls(player(true), { KeyA: true, Walk: true }).inputX).toBe(-WALK_INPUT);
    });

    it('keeps full side control in the air', () => {
        expect(readControls(player(false), { KeyD: true, Walk: true }).inputX).toBe(1);
    });
});

describe('readControls: Space jumps, W is the jetpack', () => {
    const player = () => ({ ...createMockPlayer('p', Team.NONE), isGrounded: true });

    it('Space is the jump key and no longer fires the jetpack', () => {
        const c = readControls(player(), { Space: true });
        expect(c.jumpKey).toBe(true);
        expect(c.wantsJump).toBe(false);
        expect(c.isFlying).toBe(false);
    });

    it('W fires the jetpack and does not jump', () => {
        const c = readControls(player(), { KeyW: true });
        expect(c.wantsJump).toBe(true);
        expect(c.isFlying).toBe(true);
        expect(c.jumpKey).toBe(false);
    });

    it('Space while lying down stands up (to jump)', () => {
        expect(readControls(player(), { KeyZ: true, Space: true }).wantsProne).toBe(false);
    });
});

describe('applyPlayerMovement: a jump needs a fresh press', () => {
    const grounded = () => ({ ...createMockPlayer('p', Team.NONE), isGrounded: true });
    const step = (state: ReturnType<typeof createMockState>, p: ReturnType<typeof grounded>, keys: Record<string, boolean>) =>
        applyPlayerMovement(state, p, readControls(p, keys));

    it('holding Space jumps once; a new press after landing jumps again', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = grounded();
        step(state, p, { Space: true });
        expect(p.vel.y).toBeLessThan(-JUMP_SPEED + 1);
        for (let i = 0; i < 2; i++) {
            p.isGrounded = true; p.jumpRise = 0; p.vel.y = 0;
            step(state, p, { Space: true });
            expect(p.vel.y).toBeGreaterThan(-1);
        }
        step(state, p, {});
        p.isGrounded = true; p.jumpRise = 0; p.vel.y = 0;
        step(state, p, { Space: true });
        expect(p.vel.y).toBeLessThan(-JUMP_SPEED + 1);
    });

    it('a crouching flag carrier throws with Space instead of jumping', () => {
        const state = createMockState(GameMode.HOLD_THE_FLAG);
        const p = { ...grounded(), team: Team.RED, hasFlag: Team.RED };
        step(state, p, { KeyS: true, Space: true });
        expect(p.vel.y).toBeGreaterThan(-1);
    });

    it('the double jump flips the way the fighter faces when A/D are not held', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = { ...createMockPlayer('p', Team.NONE), isGrounded: false, aim: Math.PI };
        step(state, p, { Space: true });
        expect(p.airJump).toBe(-1);
    });
});
