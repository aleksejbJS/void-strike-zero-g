// UI strings for key bindings: the profile's Controls tab and the input names.
// Merged into the main translation table in locales.ts.

import { Language } from '../types';

const en = {
    'kb.tabs': 'Profile sections',
    'kb.tab.achievements': 'Achievements',
    'kb.tab.controls': 'Controls',
    'kb.action.left': 'Left',
    'kb.action.right': 'Right',
    'kb.action.jetpack': 'Jetpack (up)',
    'kb.action.down': 'Down / crouch',
    'kb.action.prone': 'Lie down',
    'kb.action.fire': 'Fire',
    'kb.action.grapple': 'Grapple',
    'kb.press': 'Press a key…',
    'kb.empty': '—',
    'kb.clear': 'Clear',
    'kb.reset': 'Reset all',
    'kb.unbound': 'No key for: {0}',
    'kb.freed': 'Key moved to another action',
    'kb.hint': 'Click a slot, then press a key or mouse button. Esc cancels. Esc, F3 and 1–9 belong to the game.',
    'kb.slot': '{0}, slot {1}: {2}',
    'kb.key.space': 'Space',
    'kb.mouse.0': 'LMB',
    'kb.mouse.1': 'MMB',
    'kb.mouse.2': 'RMB',
    'kb.mouse.3': 'Mouse 4',
    'kb.mouse.4': 'Mouse 5',
};

export type BindingKeys = Record<keyof typeof en, string>;

export const bindingStrings: Record<Language, BindingKeys> = {
    en,
    ru: {
        'kb.tabs': 'Разделы профиля',
        'kb.tab.achievements': 'Достижения',
        'kb.tab.controls': 'Управление',
        'kb.action.left': 'Влево',
        'kb.action.right': 'Вправо',
        'kb.action.jetpack': 'Джетпак (вверх)',
        'kb.action.down': 'Вниз / присесть',
        'kb.action.prone': 'Лечь',
        'kb.action.fire': 'Огонь',
        'kb.action.grapple': 'Крюк',
        'kb.press': 'Нажмите клавишу…',
        'kb.empty': '—',
        'kb.clear': 'Очистить',
        'kb.reset': 'Сбросить всё',
        'kb.unbound': 'Нет кнопки: {0}',
        'kb.freed': 'Клавиша перешла к другому действию',
        'kb.hint': 'Нажмите на слот, затем клавишу или кнопку мыши. Esc — отмена. Esc, F3 и 1–9 заняты игрой.',
        'kb.slot': '{0}, слот {1}: {2}',
        'kb.key.space': 'Пробел',
        'kb.mouse.0': 'ЛКМ',
        'kb.mouse.1': 'СКМ',
        'kb.mouse.2': 'ПКМ',
        'kb.mouse.3': 'Мышь 4',
        'kb.mouse.4': 'Мышь 5',
    },
};
