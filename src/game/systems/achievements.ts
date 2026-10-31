import { WeaponType, GameMode } from '../../types';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  reward?: {
    xp: number;
    title?: string;
  };
}

export interface AchievementProgress {
  [key: string]: {
    progress: number;
    unlocked: boolean;
    unlockedAt?: number;
  };
}

// Achievement definitions
export const ACHIEVEMENTS: Achievement[] = [
  // Combat Achievements
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Get your first kill',
    icon: '🩸',
    rarity: 'common',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    reward: { xp: 10 }
  },
  {
    id: 'killer',
    name: 'Killer',
    description: 'Get 10 kills',
    icon: '🔪',
    rarity: 'common',
    unlocked: false,
    progress: 0,
    maxProgress: 10,
    reward: { xp: 50 }
  },
  {
    id: 'slayer',
    name: 'Slayer',
    description: 'Get 50 kills',
    icon: '⚔️',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 50,
    reward: { xp: 250 }
  },
  {
    id: 'executioner',
    name: 'Executioner',
    description: 'Get 100 kills',
    icon: '🗡️',
    rarity: 'epic',
    unlocked: false,
    progress: 0,
    maxProgress: 100,
    reward: { xp: 500, title: 'Executioner' }
  },

  // Weapon Specific
  {
    id: 'chainsaw_master',
    name: 'Chainsaw Master',
    description: 'Get 25 kills with chainsaw',
    icon: '🪚',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 25,
    reward: { xp: 200 }
  },
  {
    id: 'sniper',
    name: 'Sniper',
    description: 'Get 20 kills with railgun',
    icon: '🎯',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 20,
    reward: { xp: 200 }
  },
  {
    id: 'demolition_expert',
    name: 'Demolition Expert',
    description: 'Get 15 kills with rocket launcher',
    icon: '💥',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 15,
    reward: { xp: 150 }
  },

  // Game Mode Achievements
  {
    id: 'flag_capturer',
    name: 'Flag Capturer',
    description: 'Capture 10 flags in CTF',
    icon: '🏁',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 10,
    reward: { xp: 150 }
  },
  {
    id: 'king_of_hill',
    name: 'King of the Hill',
    description: 'Hold the flag for 500 seconds total',
    icon: '👑',
    rarity: 'epic',
    unlocked: false,
    progress: 0,
    maxProgress: 500,
    reward: { xp: 300, title: 'Hill King' }
  },
  {
    id: 'survivor',
    name: 'Survivor',
    description: 'Win 5 Hunger Games matches',
    icon: '🏆',
    rarity: 'epic',
    unlocked: false,
    progress: 0,
    maxProgress: 5,
    reward: { xp: 400, title: 'Survivor' }
  },

  // Movement Achievements
  {
    id: 'acrobatic',
    name: 'Acrobatic',
    description: 'Perform 100 double jumps',
    icon: '🤸',
    rarity: 'common',
    unlocked: false,
    progress: 0,
    maxProgress: 100,
    reward: { xp: 50 }
  },
  {
    id: 'hook_master',
    name: 'Hook Master',
    description: 'Use grappling hook 500 times',
    icon: '🪝',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 500,
    reward: { xp: 150 }
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Use dash 200 times',
    icon: '💨',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 200,
    reward: { xp: 150 }
  },

  // Collection Achievements
  {
    id: 'collector',
    name: 'Collector',
    description: 'Pick up 100 items',
    icon: '📦',
    rarity: 'common',
    unlocked: false,
    progress: 0,
    maxProgress: 100,
    reward: { xp: 75 }
  },
  {
    id: 'hoarder',
    name: 'Hoarder',
    description: 'Pick up 500 items',
    icon: '🗃️',
    rarity: 'rare',
    unlocked: false,
    progress: 0,
    maxProgress: 500,
    reward: { xp: 250 }
  },

  // Special Achievements
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete all other achievements',
    icon: '💎',
    rarity: 'legendary',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    reward: { xp: 1000, title: 'Perfectionist' }
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Play for 10 hours total',
    icon: '🎖️',
    rarity: 'epic',
    unlocked: false,
    progress: 0,
    maxProgress: 36000, // 10 hours in seconds
    reward: { xp: 500, title: 'Veteran' }
  }
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
