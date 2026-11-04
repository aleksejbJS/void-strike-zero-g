// The achievement that just unlocked while a tournament screen is open (Champion on the bracket, say),
// shown for 5 s in the same toast the game HUD uses. Same listener as GameCanvas's.

import { useEffect, useState } from 'react';
import { achievementManager, type Achievement } from '../../game/systems/achievements';

export const ACHIEVEMENT_TOAST_MS = 5000;

export const useAchievementToast = (): Achievement | null => {
    const [recent, setRecent] = useState<Achievement | null>(null);
    useEffect(() => {
        let hideTimer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = achievementManager.onAchievementUnlocked((achievement) => {
            setRecent(achievement);
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setRecent(null), ACHIEVEMENT_TOAST_MS);
        });
        return () => {
            unsubscribe();
            clearTimeout(hideTimer);
        };
    }, []);
    return recent;
};
