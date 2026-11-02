// Strings for the XP panel on the end-of-match screens. Merged into the main translation table in locales.ts.
// Part names come from builderStrings (cs.part.<slot>.<id>).

import { Language } from '../types';

export interface RewardKeys {
    'rw.gained': string;
    'rw.level': string;
    'rw.unlocked': string;
}

export const rewardStrings: Record<Language, RewardKeys> = {
    en: {
        'rw.gained': '+{0} XP',
        'rw.level': 'Level {0}!',
        'rw.unlocked': 'New part: {0}',
    },
    ru: {
        'rw.gained': '+{0} XP',
        'rw.level': 'Уровень {0}!',
        'rw.unlocked': 'Новая деталь: {0}',
    },
};
