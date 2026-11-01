// Match goal and results-screen strings. Merged into the main translation table in locales.ts.

import { Language } from '../types';

export interface MatchKeys {
    'match.goal.dm': string;
    'match.goal.ctf': string;
    'match.goal.points': string;
    'match.teamWins': string;
    'match.playerWins': string;
    'match.draw': string;
    'match.byScore': string;
    'match.byTime': string;
    'match.next': string;
    'match.toMenu': string;
    'match.ranking': string;
}

export const matchStrings: Record<Language, MatchKeys> = {
    en: {
        'match.goal.dm': 'First to {0} kills',
        'match.goal.ctf': 'First to {0} captures',
        'match.goal.points': 'First to {0} points',
        'match.teamWins': '{0} team wins',
        'match.playerWins': '{0} wins',
        'match.draw': 'Draw',
        'match.byScore': 'Score limit reached',
        'match.byTime': "Time's up",
        'match.next': 'Next match in {0}s',
        'match.toMenu': 'Back to menu',
        'match.ranking': 'Final ranking',
    },
    ru: {
        'match.goal.dm': 'До {0} убийств',
        'match.goal.ctf': 'До {0} захватов',
        'match.goal.points': 'До {0} очков',
        'match.teamWins': 'Победили {0}',
        'match.playerWins': 'Победитель: {0}',
        'match.draw': 'Ничья',
        'match.byScore': 'Набран лимит очков',
        'match.byTime': 'Время вышло',
        'match.next': 'Следующий матч через {0} с',
        'match.toMenu': 'В меню',
        'match.ranking': 'Итоги',
    },
};
