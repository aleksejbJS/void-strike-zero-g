import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { DEFAULT_BUILD, FighterBuild } from './buildParts';
import { presetBuild } from './buildPresets';
import { loadBuild, saveBuild } from './buildStorage';

const custom: FighterBuild = { ...DEFAULT_BUILD, helmet: 'angular', ears: 'horns', badgeNumber: 13 };

describe('buildStorage', () => {
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

    it('saves and loads a build', () => {
        saveBuild(custom);
        expect(loadBuild()).toEqual(custom);
        expect(warn).not.toHaveBeenCalled();
    });

    it('round trips illustrated identity and uncovered faces', () => {
        const illustrated = { ...custom, body: 'human-female', helmet: 'none', visor: 'none' } as FighterBuild;
        saveBuild(illustrated);
        expect(loadBuild()).toEqual(illustrated);
    });

    it('migrates a saved skin into its preset build', () => {
        store.selectedSkin = 'wolf';
        expect(loadBuild()).toEqual(presetBuild('wolf'));
    });

    it('uses the classic preset when nothing is saved', () => {
        expect(loadBuild()).toEqual(presetBuild('classic'));
        expect(warn).not.toHaveBeenCalled();
    });

    it('falls back to the default build on bad JSON', () => {
        store.fighterBuild = '{oops';
        expect(loadBuild()).toEqual(DEFAULT_BUILD);
        expect(warn).toHaveBeenCalled();
    });

    it('sanitises a saved build with unknown ids', () => {
        store.fighterBuild = JSON.stringify({ ...custom, ears: 'laser' });
        expect(loadBuild()).toEqual({ ...custom, ears: DEFAULT_BUILD.ears });
    });

    it('warns and falls back when storage throws on read', () => {
        (localStorage.getItem as Mock).mockImplementation(() => { throw new Error('denied'); });
        expect(loadBuild()).toEqual(DEFAULT_BUILD);
        expect(warn).toHaveBeenCalled();
    });

    it('warns instead of throwing when storage throws on write', () => {
        (localStorage.setItem as Mock).mockImplementation(() => { throw new Error('quota'); });
        expect(() => saveBuild(custom)).not.toThrow();
        expect(warn).toHaveBeenCalled();
    });
});
