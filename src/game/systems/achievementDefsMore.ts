import type { Achievement } from './achievementDefs';

// Movement achievements
export const MOVEMENT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'acrobatic',
    name: 'Acrobatic',
    description: 'Perform 100 double jumps',
    icon: '🤸',
    rarity: 'common',
    category: 'movement',
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
    category: 'movement',
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
    category: 'movement',
    unlocked: false,
    progress: 0,
    maxProgress: 200,
    reward: { xp: 150 }
  }
];

// Collection achievements
export const COLLECTING_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'collector',
    name: 'Collector',
    description: 'Pick up 100 items',
    icon: '📦',
    rarity: 'common',
    category: 'collecting',
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
    category: 'collecting',
    unlocked: false,
    progress: 0,
    maxProgress: 500,
    reward: { xp: 250 }
  }
];

// Special achievements
export const SPECIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete all other achievements',
    icon: '💎',
    rarity: 'legendary',
    category: 'special',
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
    category: 'special',
    unlocked: false,
    progress: 0,
    maxProgress: 36000, // 10 hours in seconds
    reward: { xp: 500, title: 'Veteran' }
  },
  // Tournament achievements: awarded by src/tournament/awardTournament.ts, judged from a bracket
  {
    id: 'tournament_champion',
    name: 'Champion',
    description: 'Win a tournament',
    icon: '🏆',
    rarity: 'legendary',
    category: 'special',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    reward: { xp: 1000 }
  },
  {
    id: 'tournament_finalist',
    name: 'Finalist',
    description: 'Reach a tournament final',
    icon: '🥈',
    rarity: 'epic',
    category: 'special',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    reward: { xp: 400 }
  },
  {
    id: 'tournament_flawless',
    name: 'Flawless',
    description: 'Win a tournament match 10:0',
    icon: '🧊',
    rarity: 'rare',
    category: 'special',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    reward: { xp: 300 }
  }
];
