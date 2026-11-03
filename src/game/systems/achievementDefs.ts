export type AchievementCategory = 'combat' | 'movement' | 'modes' | 'collecting' | 'special';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: AchievementCategory;
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

// Kills and weapon-specific achievements
export const COMBAT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Get your first kill',
    icon: '🩸',
    rarity: 'common',
    category: 'combat',
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
    category: 'combat',
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
    category: 'combat',
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
    category: 'combat',
    unlocked: false,
    progress: 0,
    maxProgress: 100,
    reward: { xp: 500, title: 'Executioner' }
  },
  {
    id: 'chainsaw_master',
    name: 'Chainsaw Master',
    description: 'Get 25 kills with chainsaw',
    icon: '🪚',
    rarity: 'rare',
    category: 'combat',
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
    category: 'combat',
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
    category: 'combat',
    unlocked: false,
    progress: 0,
    maxProgress: 15,
    reward: { xp: 150 }
  }
];

// Game mode achievements
export const MODE_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'flag_capturer',
    name: 'Flag Capturer',
    description: 'Capture 10 flags in CTF',
    icon: '🏁',
    rarity: 'rare',
    category: 'modes',
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
    category: 'modes',
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
    category: 'modes',
    unlocked: false,
    progress: 0,
    maxProgress: 5,
    reward: { xp: 400, title: 'Survivor' }
  }
];
