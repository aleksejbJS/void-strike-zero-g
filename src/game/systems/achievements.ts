import { WeaponType, GameMode } from '../../types';
import { COMBAT_ACHIEVEMENTS, MODE_ACHIEVEMENTS } from './achievementDefs';
import type { Achievement, AchievementProgress } from './achievementDefs';
import { MOVEMENT_ACHIEVEMENTS, COLLECTING_ACHIEVEMENTS, SPECIAL_ACHIEVEMENTS } from './achievementDefsMore';

// Callers import these from here; definitions live in achievementDefs*.ts
export type { Achievement, AchievementCategory, AchievementProgress } from './achievementDefs';

// Order matters for the achievements list UI: same order as before the split
export const ACHIEVEMENTS: Achievement[] = [
  ...COMBAT_ACHIEVEMENTS, ...MODE_ACHIEVEMENTS, ...MOVEMENT_ACHIEVEMENTS,
  ...COLLECTING_ACHIEVEMENTS, ...SPECIAL_ACHIEVEMENTS
];

// Safe storage shim for server (Node) where localStorage is not available,
// and for browsers that block storage access (accessing it throws SecurityError)
export let memoryStore: Record<string, string> = {};
const memoryStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = val; },
  removeItem: (key) => { delete memoryStore[key]; }
};
const resolveStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : memoryStorage;
  } catch (err) {
    console.warn('localStorage unavailable, achievements will not persist:', err);
    return memoryStorage;
  }
};
const storageShim = resolveStorage();

export class AchievementManager {
  private progress: AchievementProgress = {};
  private listeners: ((achievement: Achievement) => void)[] = [];

  constructor() {
    this.loadProgress();
  }

  public reset(): void {
    this.progress = {};
    this.saveProgress();
  }

  private loadProgress(): void {
    try {
      const saved = storageShim.getItem('achievementProgress');
      if (saved) {
        this.progress = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load achievement progress:', e);
    }
  }

  private saveProgress(): void {
    try {
      storageShim.setItem('achievementProgress', JSON.stringify(this.progress));
    } catch (e) {
      console.warn('Failed to save achievement progress:', e);
    }
  }

  // Deep copy of the raw progress map, safe for the caller to mutate (cloud sync, merge)
  public exportProgress(): AchievementProgress {
    return JSON.parse(JSON.stringify(this.progress)) as AchievementProgress;
  }

  // Overwrites all progress and persists it. Silent: unlock listeners are NOT called
  // (used when applying cloud progress, so no toasts for already-earned achievements).
  public replaceProgress(p: AchievementProgress): void {
    this.progress = JSON.parse(JSON.stringify(p)) as AchievementProgress;
    this.saveProgress();
  }

  public getAchievements(): Achievement[] {
    return ACHIEVEMENTS.map(achievement => ({
      ...achievement,
      unlocked: this.progress[achievement.id]?.unlocked || false,
      progress: this.progress[achievement.id]?.progress || 0
    }));
  }

  public updateProgress(achievementId: string, increment: number = 1): boolean {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return false;

    if (!this.progress[achievementId]) {
      this.progress[achievementId] = { progress: 0, unlocked: false };
    }

    const currentProgress = this.progress[achievementId];
    if (currentProgress.unlocked) return false;

    currentProgress.progress = Math.min(
      currentProgress.progress + increment,
      achievement.maxProgress
    );

    const wasUnlocked = currentProgress.unlocked;
    currentProgress.unlocked = currentProgress.progress >= achievement.maxProgress;

    if (currentProgress.unlocked && !wasUnlocked) {
      currentProgress.unlockedAt = Date.now();
      this.notifyListeners(achievement);
    }

    this.saveProgress();
    return currentProgress.unlocked && !wasUnlocked;
  }

  // Returns an unsubscribe function — call it on unmount to avoid piling up listeners
  public onAchievementUnlocked(listener: (achievement: Achievement) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(achievement: Achievement): void {
    this.listeners.forEach(listener => listener(achievement));
  }

  public checkSpecialAchievements(): void {
    const allAchievements = this.getAchievements();
    const unlockedCount = allAchievements.filter(a => a.unlocked).length;
    const totalAchievements = ACHIEVEMENTS.length - 1; // Exclude perfectionist itself

    if (unlockedCount >= totalAchievements) {
      this.updateProgress('perfectionist', 1);
    }
  }

  public getTotalXP(): number {
    return this.getAchievements()
      .filter(a => a.unlocked)
      .reduce((total, a) => total + (a.reward?.xp || 0), 0);
  }

  public getCompletionPercentage(): number {
    const achievements = this.getAchievements();
    const totalProgress = achievements.reduce((sum, a) => sum + (a.progress / a.maxProgress), 0);
    return Math.round((totalProgress / achievements.length) * 100);
  }
}

export const achievementManager = new AchievementManager();

// Helper functions for tracking achievements
export const trackKill = (weaponType?: WeaponType): void => {
  achievementManager.updateProgress('first_blood');
  achievementManager.updateProgress('killer');
  achievementManager.updateProgress('slayer');
  achievementManager.updateProgress('executioner');

  if (weaponType === WeaponType.CHAINSAW) {
    achievementManager.updateProgress('chainsaw_master');
  } else if (weaponType === WeaponType.RAILGUN) {
    achievementManager.updateProgress('sniper');
  } else if (weaponType === WeaponType.ROCKET_LAUNCHER) {
    achievementManager.updateProgress('demolition_expert');
  }
};

export const trackFlagCapture = (): void => {
  achievementManager.updateProgress('flag_capturer');
};

export const trackFlagHoldTime = (seconds: number): void => {
  achievementManager.updateProgress('king_of_hill', seconds);
};

export const trackHungerGamesWin = (): void => {
  achievementManager.updateProgress('survivor');
};

export const trackDoubleJump = (): void => {
  achievementManager.updateProgress('acrobatic');
};

export const trackHookUse = (): void => {
  achievementManager.updateProgress('hook_master');
};

export const trackDashUse = (): void => {
  achievementManager.updateProgress('speed_demon');
};

export const trackItemPickup = (): void => {
  achievementManager.updateProgress('collector');
  achievementManager.updateProgress('hoarder');
};

export const trackPlayTime = (seconds: number): void => {
  achievementManager.updateProgress('veteran', seconds);
};
