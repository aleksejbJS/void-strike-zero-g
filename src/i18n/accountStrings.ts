// UI strings for nickname + password accounts (setup screen line, plate and the sign-up / log-in window).
// Merged into the main translation table in locales.ts.

import { Language } from '../types';

export interface AccountKeys {
    'ac.line.protect': string;
    'ac.line.logIn': string;
    'ac.plate.tag': string;
    'ac.plate.hint': string;
    'ac.plate.profile': string;
    'ac.taken': string;
    'ac.dialog': string;
    'ac.tab.signup': string;
    'ac.tab.login': string;
    'ac.nickname': string;
    'ac.password': string;
    'ac.hint.signup': string;
    'ac.hint.login': string;
    'ac.submit.signup': string;
    'ac.submit.login': string;
    'ac.busy': string;
    'ac.cancel': string;
    'ac.err.taken': string;
    'ac.err.bad_credentials': string;
    'ac.err.invalid_nickname': string;
    'ac.err.weak_password': string;
    'ac.err.rate_limited': string;
    'ac.err.network': string;
    'ac.err.unexpected': string;
    'ac.nick.too_short': string;
    'ac.nick.too_long': string;
    'ac.nick.bad_chars': string;
    'ac.nick.mixed_scripts': string;
    'ac.nick.reserved': string;
}

export const accountStrings: Record<Language, AccountKeys> = {
    en: {
        'ac.line.protect': 'Protect nickname with a password',
        'ac.line.logIn': 'Log in',
        'ac.plate.tag': 'account',
        'ac.plate.hint': 'Your nickname belongs to the account.',
        'ac.plate.profile': 'Profile →',
        'ac.taken': "This name is taken. If it's your account, enter the password",
        'ac.dialog': 'Account',
        'ac.tab.signup': 'New account',
        'ac.tab.login': 'Log in',
        'ac.nickname': 'Nickname',
        'ac.password': 'Password',
        'ac.hint.signup': 'The password cannot be recovered, so remember it. Your achievements and XP move into the account.',
        'ac.hint.login': 'Progress from this device is merged into your account.',
        'ac.submit.signup': 'Create',
        'ac.submit.login': 'Log in',
        'ac.busy': 'Please wait…',
        'ac.cancel': 'Cancel',
        'ac.err.taken': 'This nickname is taken. Pick another one, or log in if it is yours.',
        'ac.err.bad_credentials': 'Wrong nickname or password.',
        'ac.err.invalid_nickname': 'This nickname is not allowed.',
        'ac.err.weak_password': 'Password needs at least {0} characters.',
        'ac.err.rate_limited': 'Too many attempts. Wait a minute and try again.',
        'ac.err.network': 'No connection to accounts right now. Try again in a moment.',
        'ac.err.unexpected': 'Something went wrong. Try again.',
        'ac.nick.too_short': 'Nickname needs at least {0} characters.',
        'ac.nick.too_long': 'Nickname can have at most {0} characters.',
        'ac.nick.bad_chars': 'Use only letters, digits, "_", "-" and single spaces.',
        'ac.nick.mixed_scripts': 'Do not mix Latin and Cyrillic letters in one nickname.',
        'ac.nick.reserved': 'This nickname is reserved. Pick another one.',
    },
    ru: {
        'ac.line.protect': 'Защитить ник паролем',
        'ac.line.logIn': 'Войти',
        'ac.plate.tag': 'аккаунт',
        'ac.plate.hint': 'Ник привязан к аккаунту.',
        'ac.plate.profile': 'Профиль →',
        'ac.taken': 'Это имя занято. Если это ваш аккаунт, введите пароль',
        'ac.dialog': 'Аккаунт',
        'ac.tab.signup': 'Новый аккаунт',
        'ac.tab.login': 'Войти',
        'ac.nickname': 'Ник',
        'ac.password': 'Пароль',
        'ac.hint.signup': 'Пароль не восстановить, запомните его. Ваши достижения и XP перенесутся в аккаунт.',
        'ac.hint.login': 'Прогресс с этого устройства объединится с аккаунтом.',
        'ac.submit.signup': 'Создать',
        'ac.submit.login': 'Войти',
        'ac.busy': 'Подождите…',
        'ac.cancel': 'Отмена',
        'ac.err.taken': 'Этот ник занят. Выберите другой или войдите, если он ваш.',
        'ac.err.bad_credentials': 'Неверный ник или пароль.',
        'ac.err.invalid_nickname': 'Такой ник недопустим.',
        'ac.err.weak_password': 'Пароль должен быть не короче {0} символов.',
        'ac.err.rate_limited': 'Слишком много попыток. Подождите минуту и повторите.',
        'ac.err.network': 'Сейчас нет связи с аккаунтами. Повторите чуть позже.',
        'ac.err.unexpected': 'Что-то пошло не так. Повторите попытку.',
        'ac.nick.too_short': 'Ник должен быть не короче {0} символов.',
        'ac.nick.too_long': 'Ник должен быть не длиннее {0} символов.',
        'ac.nick.bad_chars': 'Только буквы, цифры, «_», «-» и одиночные пробелы.',
        'ac.nick.mixed_scripts': 'Не смешивайте латинские и кириллические буквы в одном нике.',
        'ac.nick.reserved': 'Этот ник зарезервирован. Выберите другой.',
    },
};
