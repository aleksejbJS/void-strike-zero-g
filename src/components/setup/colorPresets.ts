// Preset swatches per body part (same colors the old setup screen offered)

import { Language } from '../../types';

export type BodyPart = 'torso' | 'head' | 'arms' | 'legs' | 'jetpack';

export const PRESETS: Record<BodyPart, string[]> = {
    torso: ['#3b82f6', '#ef4444', '#22c55e', '#eab308'],
    head: ['#eab308', '#f97316', '#22c55e', '#38bdf8'],
    arms: ['#3b82f6', '#ef4444', '#f59e0b', '#a855f7'],
    legs: ['#475569', '#334155', '#0ea5e9', '#15803d'],
    jetpack: ['#ef4444', '#f97316', '#eab308', '#64748b'],
};

// Spoken names for screen readers
const NAMES: Record<Language, Record<string, string>> = {
    en: {
        '#3b82f6': 'Blue', '#ef4444': 'Red', '#22c55e': 'Green', '#eab308': 'Gold', '#f97316': 'Orange', '#38bdf8': 'Sky',
        '#f59e0b': 'Amber', '#a855f7': 'Purple', '#475569': 'Slate', '#334155': 'Dark slate', '#0ea5e9': 'Cyan', '#15803d': 'Forest', '#64748b': 'Gray',
    },
    ru: {
        '#3b82f6': 'Синий', '#ef4444': 'Красный', '#22c55e': 'Зелёный', '#eab308': 'Золотой', '#f97316': 'Оранжевый', '#38bdf8': 'Голубой',
        '#f59e0b': 'Янтарный', '#a855f7': 'Фиолетовый', '#475569': 'Сланцевый', '#334155': 'Тёмный сланец', '#0ea5e9': 'Бирюзовый', '#15803d': 'Лесной', '#64748b': 'Серый',
    },
};

export const presetsFor = (part: BodyPart, language: Language) =>
    PRESETS[part].map(color => ({ color, name: NAMES[language][color] ?? color }));
