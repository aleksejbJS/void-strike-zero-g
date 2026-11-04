import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { absorbArmor, hasArmor } from './armor';
import { applyDamage } from './combat';

const withArmor = (armor: number) => Object.assign(createMockPlayer('p', Team.NONE), { armor });

describe('hasArmor', () => {
    it('counts armor below 1 as none', () => {
        expect(hasArmor(withArmor(0))).toBe(false);
        expect(hasArmor(withArmor(0.3))).toBe(false);
        expect(hasArmor(withArmor(0.999))).toBe(false);
        expect(hasArmor(withArmor(1))).toBe(true);
        expect(hasArmor(withArmor(50))).toBe(true);
    });
});

describe('absorbArmor', () => {
    it('absorbs two thirds of the damage and returns the rest', () => {
        const p = withArmor(100);
        const left = absorbArmor(p, 30);
        expect(left).toBeCloseTo(30 - 19.8, 10);
        expect(p.armor).toBeCloseTo(100 - 19.8, 10);
    });

    it('never absorbs more than the armor left', () => {
        const p = withArmor(5);
        expect(absorbArmor(p, 30)).toBeCloseTo(25, 10);
        expect(p.armor).toBe(0);
    });

    it('drops a leftover below 1 to zero', () => {
        const p = withArmor(10);
        absorbArmor(p, 9.6 / 0.66); // absorbs 9.6, would leave 0.4
        expect(p.armor).toBe(0);
    });

    it('a sliver below 1 absorbs nothing and is cleared', () => {
        const p = withArmor(0.5);
        expect(absorbArmor(p, 20)).toBe(20);
        expect(p.armor).toBe(0);
    });
});

describe('applyDamage armor leftovers', () => {
    it('armor that would drop to 0.4 becomes 0', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = withArmor(10);
        state.players.push(p);
        applyDamage(state, p, 'shooter', 9.6 / 0.66, { x: 1, y: 0 });
        expect(p.armor).toBe(0);
        expect(p.dead).toBe(false);
    });
});
