// The six boards and three periods of the Top screen, in the order they are shown, with their label keys.

import type { Period, RankedStat } from '../../leaderboard/leaderboardApi';
import type { TranslationKeys } from '../../i18n/locales';

export const BOARD_CATEGORIES: readonly RankedStat[] = ['xp', 'kills', 'botKills', 'wins', 'botWins', 'tournamentsWon'];

export const BOARD_PERIODS: readonly Period[] = ['week', 'month', 'all'];

export const DEFAULT_CATEGORY: RankedStat = 'xp';
export const DEFAULT_PERIOD: Period = 'week';

export const categoryLabelKey = (stat: RankedStat): keyof TranslationKeys => `lb.cat.${stat}`;

export const periodLabelKey = (period: Period): keyof TranslationKeys => `lb.period.${period}`;

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

/** 1284 -> "1 284" (groups split by a no-break space), the same in both languages, as in the mockup. */
export const formatValue = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NO_BREAK_SPACE);
