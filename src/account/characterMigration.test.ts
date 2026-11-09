import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { presetBuild } from '../game/build/buildPresets';
import { BODY_PRESETS } from '../game/build/characterBases';
import { readLocalSnapshot, saveLookIfChanged, writeLocalSnapshot } from './localSnapshot';
import { mergeSnapshots, PlayerSnapshot } from './snapshot';

const canonical = {
    skinId: 'base-human', build: presetBuild('base-human'),
    colors: { ...BODY_PRESETS[0].palette, player: '#e4d4ab' },
};
let store: Record<string, string>;

beforeEach(() => {
    store = {};
    (localStorage.getItem as Mock).mockImplementation((key: string) => store[key] ?? null);
    (localStorage.setItem as Mock).mockImplementation((key: string, value: string) => { store[key] = value; });
});

describe('illustrated look migration', () => {
    it('saves an untouched canonical default without a new timestamp so a cloud customization wins', () => {
        expect(saveLookIfChanged(canonical)).toBe(false);
        expect(store).not.toHaveProperty('fighterLookSavedAt');
        expect(store.selectedSkin).toBe('base-human');
        expect(JSON.parse(store.fighterBuild)).toMatchObject({ body: 'human', helmet: 'none' });
        const remote: PlayerSnapshot = {
            achievements: {}, xp: 100, stats: {},
            look: { ...canonical, skinId: 'base-cat', build: presetBuild('base-cat'), savedAt: 42 },
        };
        expect(mergeSnapshots(readLocalSnapshot(), remote).look?.skinId).toBe('base-cat');
    });

    it('migrates unchanged legacy defaults while preserving their existing customization timestamp', () => {
        store.selectedSkin = 'classic';
        store.fighterBuild = JSON.stringify(presetBuild('classic'));
        store.fighterLookSavedAt = '123';
        expect(saveLookIfChanged(canonical)).toBe(false);
        expect(store.fighterLookSavedAt).toBe('123');
        expect(readLocalSnapshot().look?.build.body).toBe('human');
    });

    it('keeps a saved custom blue head and its timestamp when only migrating the artwork', () => {
        store.selectedSkin = 'classic';
        store.fighterBuild = JSON.stringify(presetBuild('classic'));
        store.headColor = '#3b82f6';
        store.fighterLookSavedAt = '123';
        const next = { ...canonical, colors: { ...canonical.colors, head: '#3b82f6' } };
        expect(saveLookIfChanged(next)).toBe(false);
        expect(store.headColor).toBe('#3b82f6');
        expect(store.fighterLookSavedAt).toBe('123');
        expect(readLocalSnapshot().look?.build.body).toBe('human');
    });

    it('round trips all five identities and selected gear through an account snapshot', () => {
        for (const preset of BODY_PRESETS) {
            const look = { skinId: preset.id, build: { ...presetBuild(preset.id), helmet: 'box' as const },
                colors: { ...preset.palette, player: preset.color }, savedAt: 50 };
            writeLocalSnapshot({ achievements: {}, xp: 300, look, stats: {} });
            expect(readLocalSnapshot().look).toEqual(look);
            expect(readLocalSnapshot().xp).toBe(300);
        }
    });

    it('stamps a real customization of the new default', () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(456);
        expect(saveLookIfChanged({ ...canonical, build: { ...canonical.build, helmet: 'box' } })).toBe(true);
        expect(store.fighterLookSavedAt).toBe('456');
        now.mockRestore();
    });
});
