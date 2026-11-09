// UI strings for the character setup screen. Merged into the main translation table in locales.ts.

import { Language } from '../types';

export interface SetupKeys {
    'cs.title': string;
    'cs.backToMenu': string;
    'cs.nextOffline': string;
    'cs.nextHost': string;
    'cs.nextJoin': string;
    'cs.skinCount': string;
    'cs.skinHint': string;
    'cs.prevSkin': string;
    'cs.nextSkin': string;
    'cs.name': string;
    'cs.nameHint': string;
    'cs.torso': string;
    'cs.head': string;
    'cs.arms': string;
    'cs.legs': string;
    'cs.jetpack': string;
    'cs.custom': string;
    'cs.colorOf': string;
    'cs.resetColor': string;
    'cs.back': string;
    'cs.startOffline': string;
    'cs.startHost': string;
    'cs.startJoin': string;
    'cs.preview': string;
    'cs.style.human': string;
    'cs.style.robot': string;
    'cs.style.beast': string;
    'cs.style.alien': string;
}

export const setupStrings: Record<Language, SetupKeys> = {
    en: {
        'cs.title': 'Character setup',
        'cs.backToMenu': 'Back to menu',
        'cs.nextOffline': 'Next: {0} on the {1} map',
        'cs.nextHost': 'Next: you host {0} on the {1} map',
        'cs.nextJoin': "Next: joining a friend's game",
        'cs.skinCount': 'Preset {0} of {1}',
        'cs.skinHint': '{0} preset. Picking one replaces every part and color.',
        'cs.prevSkin': 'Previous preset',
        'cs.nextSkin': 'Next preset',
        'cs.name': 'Name',
        'cs.nameHint': '{0} of {1} characters. Other players see it above your head.',
        'cs.torso': 'Torso',
        'cs.head': 'Head',
        'cs.arms': 'Arms',
        'cs.legs': 'Legs',
        'cs.jetpack': 'Jetpack',
        'cs.custom': 'Custom',
        'cs.colorOf': '{0} color',
        'cs.resetColor': 'Restore original {0} color',
        'cs.back': 'Back',
        'cs.startOffline': 'Start match',
        'cs.startHost': 'Create game',
        'cs.startJoin': 'Join game',
        'cs.preview': 'Your character',
        'cs.style.human': 'Human',
        'cs.style.robot': 'Robot',
        'cs.style.beast': 'Beast',
        'cs.style.alien': 'Alien',
    },
    ru: {
        'cs.title': 'Персонаж',
        'cs.backToMenu': 'В меню',
        'cs.nextOffline': 'Дальше: {0}, карта «{1}»',
        'cs.nextHost': 'Дальше: вы создаёте игру «{0}», карта «{1}»',
        'cs.nextJoin': 'Дальше: вход в игру друга',
        'cs.skinCount': 'Сборка {0} из {1}',
        'cs.skinHint': '{0}. Готовая сборка заменяет все детали и цвета.',
        'cs.prevSkin': 'Предыдущая сборка',
        'cs.nextSkin': 'Следующая сборка',
        'cs.name': 'Имя',
        'cs.nameHint': '{0} из {1} символов. Другие игроки видят его над головой.',
        'cs.torso': 'Торс',
        'cs.head': 'Голова',
        'cs.arms': 'Руки',
        'cs.legs': 'Ноги',
        'cs.jetpack': 'Джетпак',
        'cs.custom': 'Свой',
        'cs.colorOf': 'Цвет: {0}',
        'cs.resetColor': 'Вернуть исходный цвет: {0}',
        'cs.back': 'Назад',
        'cs.startOffline': 'Начать матч',
        'cs.startHost': 'Создать игру',
        'cs.startJoin': 'Войти в игру',
        'cs.preview': 'Ваш персонаж',
        'cs.style.human': 'Человек',
        'cs.style.robot': 'Робот',
        'cs.style.beast': 'Зверь',
        'cs.style.alien': 'Пришелец',
    },
};
