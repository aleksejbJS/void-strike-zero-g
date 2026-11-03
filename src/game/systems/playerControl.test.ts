import { describe, it, expect } from 'vitest';
import { Team } from '../../types';
import { WALK_INPUT } from '../../constants';
import { createMockPlayer } from '../../test/mocks';
import { readControls } from './playerControl';

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
