import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { DEFAULT_BUILD } from '../game/build/buildParts';
import { achievementManager } from '../game/systems/achievements';
import { clearLocalSnapshot, readLocalSnapshot, saveLookIfChanged, writeLocalSnapshot } from './localSnapshot';
import { FighterLook, PlayerSnapshot } from './snapshot';

const colors = { player: '#3b82f6', head: '#111111', torso: '#3b82f6', arms: '#222222', legs: '#475569', jetpack: '#ef4444' };
const look: FighterLook = { build: { ...DEFAULT_BUILD, helmet: 'dome' }, skinId: 'wolf', colors, savedAt: 77 };
const full: PlayerSnapshot = {
    achievements: { killer: { progress: 10, unlocked: true, unlockedAt: 5 }, first_blood: { progress: 1, unlocked: false } },
    xp: 120,
    look,
};

describe('localSnapshot', () => {
    let store: Record<string, string>;
    let warn: Mock;
    const mocks = () => localStorage as unknown as Record<'getItem' | 'setItem' | 'removeItem', Mock>;

    beforeEach(() => {
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        store = {};
        mocks().getItem.mockReset().mockImplementation((key: string) => (key in store ? store[key] : null));
        mocks().setItem.mockReset().mockImplementation((key: string, value: string) => { store[key] = value; });
        mocks().removeItem.mockReset().mockImplementation((key: string) => { delete store[key]; });
        achievementManager.reset();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
    });
    afterEach(() => warn.mockRestore());

    it('reads an empty guest as no progress and no look', () => {
        expect(readLocalSnapshot()).toEqual({ achievements: {}, xp: 0, look: null });
        expect(warn).not.toHaveBeenCalled();
    });

    it('round-trips write then read', () => {
        writeLocalSnapshot(full);
        expect(readLocalSnapshot()).toEqual(full);
        expect(achievementManager.exportProgress()).toEqual(full.achievements);
        expect(warn).not.toHaveBeenCalled();
    });

    it('stores the look under the keys the game already uses', () => {
        writeLocalSnapshot(full);
        expect(store).toMatchObject({
            selectedSkin: 'wolf', playerColor: '#3b82f6', torsoColor: '#3b82f6', headColor: '#111111',
            armColor: '#222222', legColor: '#475569', jetpackColor: '#ef4444', fighterXp: '120', fighterLookSavedAt: '77',
        });
        expect(JSON.parse(store.fighterBuild).helmet).toBe('dome');
    });

    it('writing a snapshot with no look removes the stored look', () => {
        writeLocalSnapshot(full);
        writeLocalSnapshot({ ...full, look: null });
        expect(readLocalSnapshot().look).toBeNull();
        expect(store).not.toHaveProperty('fighterBuild');
    });

    it('sanitizes what it writes', () => {
        writeLocalSnapshot({ achievements: { removed_ach: { progress: 1, unlocked: true } }, xp: -4, look: null });
        expect(readLocalSnapshot()).toEqual({ achievements: {}, xp: 0, look: null });
        expect(achievementManager.exportProgress()).toEqual({});
    });

    it('a guest who never touched colours has no look; defaults fill the gaps once one key exists', () => {
        store.torsoColor = '#abcdef';
        const result = readLocalSnapshot().look;
        expect(result?.colors).toEqual({ player: '#3b82f6', head: '#3b82f6', torso: '#abcdef', arms: '#3b82f6', legs: '#475569', jetpack: '#ef4444' });
        expect(result?.skinId).toBe('classic');
        expect(result?.savedAt).toBe(0);
    });

    it('a stored colour that is not #rrggbb makes the look null', () => {
        store.headColor = 'red';
        expect(readLocalSnapshot().look).toBeNull();
    });

    it('clearLocalSnapshot removes every key and resets the achievements', () => {
        writeLocalSnapshot(full);
        store.playerName = 'Ace';
        clearLocalSnapshot();
        const removed = mocks().removeItem.mock.calls.map(([key]) => key);
        for (const key of ['achievementProgress', 'fighterXp', 'fighterBuild', 'selectedSkin', 'playerColor', 'torsoColor',
            'headColor', 'armColor', 'legColor', 'jetpackColor', 'playerName', 'fighterLookSavedAt']) {
            expect(removed).toContain(key);
        }
        expect(store).toEqual({});
        expect(achievementManager.exportProgress()).toEqual({});
    });

    describe('saveLookIfChanged', () => {
        const next = { build: look.build, skinId: look.skinId, colors };
        let now: Mock;
        beforeEach(() => { now = vi.spyOn(Date, 'now') as unknown as Mock; });
        afterEach(() => now.mockRestore());

        it('writes the look and stamps the time when nothing was stored', () => {
            now.mockReturnValue(1234);
            expect(saveLookIfChanged(next)).toBe(true);
            expect(store.fighterLookSavedAt).toBe('1234');
            expect(readLocalSnapshot().look).toEqual({ ...next, savedAt: 1234 });
        });

        it('returns false and writes nothing for an identical look', () => {
            writeLocalSnapshot(full);
            mocks().setItem.mockClear();
            expect(saveLookIfChanged(next)).toBe(false);
            expect(mocks().setItem).not.toHaveBeenCalled();
            expect(store.fighterLookSavedAt).toBe('77');
        });

        it('bumps the time when the build, a colour or the skin changes', () => {
            writeLocalSnapshot(full);
            now.mockReturnValue(5000);
            expect(saveLookIfChanged({ ...next, build: { ...look.build, ears: 'horns' } })).toBe(true);
            expect(store.fighterLookSavedAt).toBe('5000');
            now.mockReturnValue(6000);
            expect(saveLookIfChanged({ ...next, build: { ...look.build, ears: 'horns' }, colors: { ...colors, legs: '#000000' } })).toBe(true);
            expect(store.fighterLookSavedAt).toBe('6000');
            now.mockReturnValue(7000);
            expect(saveLookIfChanged({ build: { ...look.build, ears: 'horns' }, skinId: 'classic', colors: { ...colors, legs: '#000000' } })).toBe(true);
            expect(store.fighterLookSavedAt).toBe('7000');
        });
    });
});
