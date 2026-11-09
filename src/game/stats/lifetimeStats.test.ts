import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { achievementManager } from '../systems/achievements';
import { STATS_KEY, loadStats, addStats, exportStats, replaceStats, clearStats } from './lifetimeStats';

const progressOf = (id: string): number =>
    achievementManager.getAchievements().find(a => a.id === id)?.progress ?? -1;

describe('lifetime stats', () => {
    let store: Record<string, string>;
    let warn: Mock;

    beforeEach(() => {
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        store = {};
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key in store ? store[key] : null));
        (localStorage.setItem as Mock).mockImplementation((key: string, value: string) => { store[key] = value; });
        (localStorage.removeItem as Mock).mockImplementation((key: string) => { delete store[key]; });
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
        achievementManager.reset();
    });
    afterEach(() => warn.mockRestore());

    it('adds counters across calls and advances the matching achievements', () => {
        addStats({ kills: 3 });
        addStats({ kills: 3 });
        expect(exportStats().kills).toBe(6);
        expect(progressOf('killer')).toBe(6);
    });

    it('keeps counting past an achievement target', () => {
        addStats({ kills: 150 });
        expect(exportStats().kills).toBe(150);
        expect(progressOf('executioner')).toBe(100);
    });

    it('ignores non-positive and non-finite values', () => {
        addStats({ kills: 2 });
        addStats({ kills: -5, botKills: 0, hookUses: NaN, itemPickups: Infinity });
        const stats = exportStats();
        expect(stats.kills).toBe(2);
        expect(stats.botKills).toBe(0);
        expect(stats.hookUses).toBe(0);
        expect(stats.itemPickups).toBe(0);
        expect(progressOf('hook_master')).toBe(0);
    });

    it('saves once per call, however many counters changed', () => {
        loadStats();
        (localStorage.setItem as Mock).mockClear();
        addStats({ kills: 1, hookUses: 2, playMs: 5000 });
        const statsWrites = (localStorage.setItem as Mock).mock.calls.filter(([key]) => key === STATS_KEY);
        expect(statsWrites).toHaveLength(1);
    });

    it('turns play time and flag ticks into whole seconds of achievement progress', () => {
        addStats({ playMs: 1500 });
        addStats({ playMs: 1500, flagHoldTicks: 240 });
        expect(progressOf('veteran')).toBe(3);
        expect(progressOf('king_of_hill')).toBe(2);
    });

    it('replaceStats overwrites the counters without touching achievements', () => {
        replaceStats({ kills: 9, hookUses: 4 });
        expect(exportStats().kills).toBe(9);
        expect(progressOf('killer')).toBe(0);
        expect(progressOf('hook_master')).toBe(0);
    });

    it('seeds from stored achievement progress on the first load and saves the seed', () => {
        achievementManager.replaceProgress({ executioner: { progress: 40, unlocked: false } });
        const stats = loadStats();
        expect(stats.botKills).toBe(40);
        expect(JSON.parse(store[STATS_KEY]).botKills).toBe(40);
        expect(warn).not.toHaveBeenCalled();
    });

    it('does not re-seed once counters are stored', () => {
        replaceStats({ kills: 1 });
        achievementManager.replaceProgress({ executioner: { progress: 40, unlocked: false } });
        expect(loadStats().botKills).toBeUndefined();
    });

    it('warns and re-seeds when the stored JSON is corrupt', () => {
        store[STATS_KEY] = '{not json';
        achievementManager.replaceProgress({ sniper: { progress: 5, unlocked: false } });
        const stats = loadStats();
        expect(warn).toHaveBeenCalled();
        expect(stats.railgunKills).toBe(5);
        expect(JSON.parse(store[STATS_KEY]).railgunKills).toBe(5);
    });

    it('warns and re-seeds when the stored value is not an object', () => {
        store[STATS_KEY] = '42';
        expect(loadStats().kills).toBe(0);
        expect(warn).toHaveBeenCalled();
    });

    it('drops unknown keys and bad values from the stored object', () => {
        store[STATS_KEY] = JSON.stringify({ kills: 5, wins: -1, botWins: 'x', bogus: 7 });
        expect(loadStats()).toEqual({ kills: 5 });
    });

    it('clearStats removes the stored counters so the next load seeds again', () => {
        addStats({ kills: 4 });
        clearStats();
        expect(store[STATS_KEY]).toBeUndefined();
        achievementManager.reset();
        expect(loadStats().kills).toBe(0);
    });
});
