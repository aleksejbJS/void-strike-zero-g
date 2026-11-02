import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { MATCH_XP, WIN_XP, addMatchXp, loadXp } from './progress';

describe('progress', () => {
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

    it('a loss gives 20, a win 50', () => {
        expect(MATCH_XP).toBe(20);
        expect(WIN_XP).toBe(30);
        expect(addMatchXp(false).gained).toBe(20);
        expect(loadXp()).toBe(20);
        expect(addMatchXp(true).gained).toBe(50);
        expect(loadXp()).toBe(70);
        expect(warn).not.toHaveBeenCalled();
    });

    it('reports the parts opened by the level-up', () => {
        store.fighterXp = '40';
        const reward = addMatchXp(true);
        expect(reward.levelBefore).toBe(1);
        expect(reward.levelAfter).toBe(2);
        expect(reward.unlocked.map(i => `${i.slot}:${i.id}`)).toEqual(['ears:wolf']);
    });

    it('reports no parts when the level does not change', () => {
        const reward = addMatchXp(false);
        expect(reward).toMatchObject({ gained: 20, levelBefore: 1, levelAfter: 1, unlocked: [] });
    });

    it('reads 0 XP when nothing is saved, without a warning', () => {
        expect(loadXp()).toBe(0);
        expect(warn).not.toHaveBeenCalled();
    });

    it('reads 0 XP and warns when the saved value is not a number', () => {
        store.fighterXp = 'lots';
        expect(loadXp()).toBe(0);
        expect(warn).toHaveBeenCalled();
    });

    it('reads 0 XP when storage throws', () => {
        (localStorage.getItem as Mock).mockImplementation(() => { throw new Error('denied'); });
        expect(loadXp()).toBe(0);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('fighterXp'), expect.anything());
    });

    it('still reports the reward and warns when storage throws on save', () => {
        (localStorage.setItem as Mock).mockImplementation(() => { throw new Error('full'); });
        const reward = addMatchXp(true);
        expect(reward.gained).toBe(50);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('fighterXp'), expect.anything());
    });
});
