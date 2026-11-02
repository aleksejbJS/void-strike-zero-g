import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { DEFAULT_BUILD, FighterBuild } from './buildParts';
import { saveBuild } from './buildStorage';
import { XP_KEY } from './progress';
import { currentBuild } from './currentBuild';

// 'wolf' ears open at level 2 (50 XP), 'dome' helmet at level 10
const wearing: FighterBuild = { ...DEFAULT_BUILD, ears: 'wolf', helmet: 'dome', badgeNumber: 13 };

describe('currentBuild', () => {
    let store: Record<string, string>;
    let warn: Mock;

    beforeEach(() => {
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        store = {};
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key in store ? store[key] : null));
        (localStorage.setItem as Mock).mockImplementation((key: string, value: string) => { store[key] = value; });
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
    });
    afterEach(() => warn.mockRestore());

    it('replaces the parts the level has not opened with the default ones', () => {
        saveBuild(wearing);
        store[XP_KEY] = '50'; // level 2
        expect(currentBuild()).toEqual({ ...wearing, helmet: 'round' });
    });

    it('keeps every saved part once the level has opened them', () => {
        saveBuild(wearing);
        store[XP_KEY] = '450'; // level 10
        expect(currentBuild()).toEqual(wearing);
    });

    it('a new player without saved data wears the default build', () => {
        expect(currentBuild()).toEqual(DEFAULT_BUILD);
    });
});
