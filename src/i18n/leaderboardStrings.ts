// UI strings for the Top screen (leaderboards): the menu button, the six boards, the periods and the table.
// Merged into the main translation table in locales.ts.

import { Language } from '../types';

const en = {
    'lb.menu': 'Top',
    'lb.title': 'Top players',
    'lb.back': 'Menu',
    'lb.cat.xp': 'XP',
    'lb.cat.kills': 'Kills',
    'lb.cat.botKills': 'Bot kills',
    'lb.cat.wins': 'Wins',
    'lb.cat.botWins': 'Wins vs bots',
    'lb.cat.tournamentsWon': 'Tournaments',
    'lb.period.week': 'This week',
    'lb.period.month': 'This month',
    'lb.period.all': 'All time',
    'lb.col.player': 'Player',
    'lb.you': 'You · {0}',
    'lb.unranked': 'Not ranked yet',
    'lb.guest': 'Register to get on the board',
    'lb.guest.button': 'Register',
    'lb.empty': 'Nobody on this board yet',
    'lb.error': 'Could not load the board.',
    'lb.retry': 'Retry',
    'lb.loading': 'Loading…',
};

export type LeaderboardKeys = Record<keyof typeof en, string>;

export const leaderboardStrings: Record<Language, LeaderboardKeys> = {
    en,
    ru: {
        'lb.menu': 'Топ',
        'lb.title': 'Топ игроков',
        'lb.back': 'Меню',
        'lb.cat.xp': 'XP',
        'lb.cat.kills': 'Убийства',
        'lb.cat.botKills': 'Убийства ботов',
        'lb.cat.wins': 'Победы',
        'lb.cat.botWins': 'Победы над ботами',
        'lb.cat.tournamentsWon': 'Турниры',
        'lb.period.week': 'Неделя',
        'lb.period.month': 'Месяц',
        'lb.period.all': 'Всё время',
        'lb.col.player': 'Игрок',
        'lb.you': 'Вы · {0}',
        'lb.unranked': 'Пока нет в рейтинге',
        'lb.guest': 'Зарегистрируйтесь, чтобы попасть в топ',
        'lb.guest.button': 'Зарегистрироваться',
        'lb.empty': 'Здесь пока никого нет',
        'lb.error': 'Не удалось загрузить топ.',
        'lb.retry': 'Повторить',
        'lb.loading': 'Загрузка…',
    },
};
