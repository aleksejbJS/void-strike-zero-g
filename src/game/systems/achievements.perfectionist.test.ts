// Perfectionist keeps the requirement it had before tournaments: every other non-tournament achievement.

import { describe, test, expect, beforeEach, Mock } from 'vitest';
import { achievementManager, ACHIEVEMENTS, memoryStore } from './achievements';
import type { AchievementProgress } from './achievementDefs';

const TOURNAMENT = ['tournament_champion', 'tournament_finalist', 'tournament_flawless'];
const unlocked = (ids: string[]): AchievementProgress =>
    Object.fromEntries(ids.map(id => [id, { progress: 1, unlocked: true }]));
const isPerfectionist = () => achievementManager.getAchievements().find(a => a.id === 'perfectionist')?.unlocked;

describe('perfectionist', () => {
    beforeEach(() => {
        for (const key in memoryStore) delete memoryStore[key];
        (localStorage.getItem as Mock).mockImplementation((key: string) => memoryStore[key] || null);
        (localStorage.setItem as Mock).mockImplementation((key: string, value: string) => { memoryStore[key] = value; });
        achievementManager.reset();
    });

    const classic = ACHIEVEMENTS.map(a => a.id).filter(id => id !== 'perfectionist' && !TOURNAMENT.includes(id));

    test('unlocks with every classic achievement, without any tournament one', () => {
        achievementManager.replaceProgress(unlocked(classic));
        achievementManager.checkSpecialAchievements();
        expect(isPerfectionist()).toBe(true);
    });

    test('tournament achievements cannot stand in for a missing classic one', () => {
        achievementManager.replaceProgress(unlocked([...classic.slice(1), ...TOURNAMENT]));
        achievementManager.checkSpecialAchievements();
        expect(isPerfectionist()).toBe(false);
    });
});
