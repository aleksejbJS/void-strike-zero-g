// What the profile shows, read from this device's saved progress (achievements and fighter XP).

import { loadXp } from '../../game/build/progress';
import { Achievement, achievementManager } from '../../game/systems/achievements';

export interface ProfileData {
    achievements: Achievement[];
    unlockedCount: number;
    /** XP rewards of the unlocked achievements. */
    achievementXp: number;
    /** The fighter's XP: it sets the level. */
    fighterXp: number;
    /** Title of the unlocked achievement with the most XP, if any unlocked one has a title. */
    title: string | null;
}

/** The first of the best wins a tie, so the title does not change between visits. */
export function pickTitle(achievements: readonly Achievement[]): string | null {
    let best: Achievement | null = null;
    for (const a of achievements) {
        if (!a.unlocked || !a.reward?.title) continue;
        if (best === null || a.reward.xp > (best.reward?.xp ?? 0)) best = a;
    }
    return best?.reward?.title ?? null;
}

/** Reads the saved progress now. A login or logout swaps it: the screen reads it again by remounting its body. */
export function readProfile(): ProfileData {
    const achievements = achievementManager.getAchievements();
    return {
        achievements,
        unlockedCount: achievements.filter(a => a.unlocked).length,
        achievementXp: achievementManager.getTotalXP(),
        fighterXp: loadXp(),
        title: pickTitle(achievements),
    };
}
