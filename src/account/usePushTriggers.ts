// While someone is logged in, schedules a cloud push whenever the saved progress changes (achievement
// unlocked, match XP, build saved), and retries unsent progress when the browser comes back online.

import { MutableRefObject, useEffect } from 'react';
import { achievementManager } from '../game/systems/achievements';
import { onProgressChanged } from './progressEvents';
import type { Sync } from './sync';

/**
 * `userId` is the logged-in account (null: listen to nothing). `activeUser` is cleared the moment a
 * logout settles its last push, before the state update removes these listeners: from then on nothing
 * may be pushed for that account.
 */
export function usePushTriggers(
    userId: string | null,
    syncRef: MutableRefObject<Sync | null>,
    activeUser: MutableRefObject<string | null>,
): void {
    useEffect(() => {
        if (!userId) return undefined;
        const currentSync = (): Sync | null => (activeUser.current === userId ? syncRef.current : null);

        const push = (): void => { currentSync()?.requestPush(userId); };
        const onOnline = (): void => {
            const sync = currentSync();
            if (sync?.hasPending(userId)) void sync.flush(userId); // flush reports its own failures
        };

        const stopAchievements = achievementManager.onAchievementUnlocked(push);
        const stopProgress = onProgressChanged(push);
        window.addEventListener('online', onOnline);
        return () => {
            stopAchievements();
            stopProgress();
            window.removeEventListener('online', onOnline);
        };
    }, [userId, syncRef, activeUser]);
}
