// A tab running an older build must never erase cloud data a newer build added: achievements it does
// not know, and fighter parts or slots it does not know. The game itself must never show or count them.

import { describe, it, expect } from 'vitest';
import { DEFAULT_BUILD } from '../game/build/buildParts';
import { BUILD_KEY, loadBuild } from '../game/build/buildStorage';
import { achievementManager } from '../game/systems/achievements';
import { readProfile } from '../components/profile/profileData';
import { LOOK_SAVED_AT_KEY, writeLocalSnapshot } from './localSnapshot';
import { sanitizeSnapshot } from './snapshot';
import { installSyncHarness, look, snap, USER } from '../test/syncHarness';

const futureEntry = { progress: 3, unlocked: true, unlockedAt: 9 };
/** A look saved by a newer build: an unknown helmet and a whole unknown slot. */
const futureLook = { ...look, build: { ...look.build, helmet: 'halo', cape: 'red_cape' }, savedAt: 500 };
/** What fetchSnapshot returns for a cloud row: always the sanitized value. */
const cloudRow = (raw: unknown) => sanitizeSnapshot(raw);

describe('forward compatibility with a newer build', () => {
    const h = installSyncHarness();

    it('a push keeps an achievement id this build does not know', async () => {
        writeLocalSnapshot(snap(10, { achievements: { killer: { progress: 3, unlocked: false } } }));
        h.fetchSnapshot.mockResolvedValue(cloudRow({ achievements: { future_feat: futureEntry }, xp: 5 }));

        await expect(h.sync.flush(USER)).resolves.toBe(true);

        expect(h.saved().achievements).toEqual({ killer: { progress: 3, unlocked: false }, future_feat: futureEntry });
    });

    it('a pulled unknown id is kept in storage but never shown, counted or given XP', async () => {
        h.fetchSnapshot.mockResolvedValue(cloudRow({ achievements: { future_feat: futureEntry }, xp: 0 }));

        await h.sync.pull(USER);

        expect(achievementManager.exportProgress()).toEqual({ future_feat: futureEntry });
        const profile = readProfile();
        expect(profile.achievements.map(a => a.id)).not.toContain('future_feat');
        expect(profile.unlockedCount).toBe(0);
        expect(profile.achievementXp).toBe(0);
        achievementManager.checkSpecialAchievements();
        expect(achievementManager.getAchievements().find(a => a.id === 'perfectionist')?.unlocked).toBe(false);
    });

    it('a pulled look with unknown parts reaches the cloud again unchanged, while the game uses defaults', async () => {
        h.fetchSnapshot.mockResolvedValue(cloudRow({ xp: 0, look: futureLook }));
        await h.sync.pull(USER);
        expect(loadBuild().helmet).toBe(DEFAULT_BUILD.helmet); // the game never sees the unknown part

        h.sync.requestPush(USER);
        await expect(h.sync.flush(USER)).resolves.toBe(true);

        expect(h.saved().look?.build).toMatchObject({ helmet: 'halo', cape: 'red_cape' });
        expect(h.saved().look?.savedAt).toBe(500);
    });

    it('in a savedAt tie a sanitized-down local build never beats the cloud look', async () => {
        writeLocalSnapshot(snap(0, { look: { ...futureLook, build: { ...DEFAULT_BUILD } } }));
        expect(h.store[LOOK_SAVED_AT_KEY]).toBe('500');
        h.fetchSnapshot.mockResolvedValue(cloudRow({ xp: 0, look: futureLook }));

        await expect(h.sync.flush(USER)).resolves.toBe(true);

        expect(h.saved().look?.build).toMatchObject({ helmet: 'halo', cape: 'red_cape' });
    });

    it('a newer look written to shared storage by a newer tab is pushed with its unknown parts', async () => {
        writeLocalSnapshot(snap(0, { look: { ...futureLook, build: { ...DEFAULT_BUILD } } }));
        h.store[BUILD_KEY] = JSON.stringify(futureLook.build); // the newer tab's save, unknown parts and all
        h.fetchSnapshot.mockResolvedValue(cloudRow({ xp: 0, look: { ...look, savedAt: 100 } }));

        await expect(h.sync.flush(USER)).resolves.toBe(true);

        expect(h.saved().look?.build).toMatchObject({ helmet: 'halo', cape: 'red_cape' });
    });
});
