import { describe, it, expect } from 'vitest';
import { createRangeState, nextStance, DUMMY_RETURN_MS, DummyStance } from './rangeState';

describe('range state', () => {
    it('starts with a standing, unarmored dummy and nothing pending', () => {
        expect(createRangeState()).toEqual({
            stance: 'stand', armored: false, showHitZones: false, resetRequested: false, diedAt: {},
        });
    });

    it('gives every call its own state object', () => {
        const a = createRangeState();
        const b = createRangeState();
        a.diedAt['dummy-1'] = 5;
        expect(b.diedAt).toEqual({});
    });

    it('cycles the stance stand, crouch, prone, stand', () => {
        const seen: DummyStance[] = [];
        let stance: DummyStance = 'stand';
        for (let i = 0; i < 4; i++) {
            stance = nextStance(stance);
            seen.push(stance);
        }
        expect(seen).toEqual(['crouch', 'prone', 'stand', 'crouch']);
    });

    it('sets the dummy return delay to 3000 ms', () => {
        expect(DUMMY_RETURN_MS).toBe(3000);
    });
});
