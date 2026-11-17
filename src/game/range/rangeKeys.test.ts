import { describe, it, expect } from 'vitest';
import { createRangeState } from './rangeState';
import { applyRangeKey } from './rangeKeys';

describe('applyRangeKey', () => {
    it('C steps the stance stand, crouch, prone, stand', () => {
        const range = createRangeState();
        const seen = ['KeyC', 'KeyC', 'KeyC', 'KeyC'].map(code => {
            expect(applyRangeKey(code, range)).toBe(true);
            return range.stance;
        });
        expect(seen).toEqual(['crouch', 'prone', 'stand', 'crouch']);
    });

    it('K puts the armour on and takes it off', () => {
        const range = createRangeState();
        expect(applyRangeKey('KeyK', range)).toBe(true);
        expect(range.armored).toBe(true);
        expect(applyRangeKey('KeyK', range)).toBe(true);
        expect(range.armored).toBe(false);
    });

    it('H shows and hides the hit-zone outlines', () => {
        const range = createRangeState();
        expect(applyRangeKey('KeyH', range)).toBe(true);
        expect(range.showHitZones).toBe(true);
        expect(applyRangeKey('KeyH', range)).toBe(true);
        expect(range.showHitZones).toBe(false);
    });

    it('R asks for a reset and leaves the settings alone', () => {
        const range = createRangeState();
        expect(applyRangeKey('KeyR', range)).toBe(true);
        expect(range).toEqual({ ...createRangeState(), resetRequested: true });
    });

    it('does not handle any other key and changes nothing', () => {
        const range = createRangeState();
        for (const code of ['KeyW', 'Escape', 'Space', 'KeyX', 'c', 'Digit1']) {
            expect(applyRangeKey(code, range)).toBe(false);
        }
        expect(range).toEqual(createRangeState());
    });
});
