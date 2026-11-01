// HUD objective hints for team modes ("You have the red flag. Bring it to your base.")

import { Language } from '../types';

export interface ObjectiveKeys {
    'obj.red': string;
    'obj.blue': string;
    'obj.ctfGrab': string;
    'obj.ctfCarry': string;
    'obj.ctfDefend': string;
    'obj.htfFree': string;
    'obj.htfYou': string;
    'obj.htfTeam': string;
    'obj.htfEnemy': string;
    'obj.infAttack': string;
    'obj.infCarry': string;
    'obj.infDefend': string;
    'obj.infStop': string;
}

export const objectiveStrings: Record<Language, ObjectiveKeys> = {
    en: {
        'obj.red': 'red',
        'obj.blue': 'blue',
        'obj.ctfGrab': 'Grab the {0} flag from their base.',
        'obj.ctfCarry': 'You have the {0} flag. Bring it to your base.',
        'obj.ctfDefend': 'They took your flag. Stop the carrier!',
        'obj.htfFree': 'Grab the golden flag.',
        'obj.htfYou': 'You hold the flag: +1 every 4 seconds. Stay alive!',
        'obj.htfTeam': 'Your team holds the flag. Cover them.',
        'obj.htfEnemy': 'They hold the flag. Take it back!',
        'obj.infAttack': 'Steal the intel from the red side.',
        'obj.infCarry': 'You have the intel. Get to extraction!',
        'obj.infDefend': 'Guard the intel until the timer runs out.',
        'obj.infStop': 'They have the intel. Stop the carrier!',
    },
    ru: {
        'obj.red': 'красный',
        'obj.blue': 'синий',
        'obj.ctfGrab': 'Заберите {0} флаг с их базы.',
        'obj.ctfCarry': 'У вас {0} флаг. Несите его на свою базу.',
        'obj.ctfDefend': 'Ваш флаг украли. Остановите носителя!',
        'obj.htfFree': 'Захватите золотой флаг.',
        'obj.htfYou': 'Флаг у вас: +1 каждые 4 секунды. Не умирайте!',
        'obj.htfTeam': 'Флаг у вашей команды. Прикройте носителя.',
        'obj.htfEnemy': 'Флаг у противника. Отберите его!',
        'obj.infAttack': 'Украдите разведданные на стороне красных.',
        'obj.infCarry': 'Данные у вас. Бегите к точке эвакуации!',
        'obj.infDefend': 'Охраняйте данные, пока не выйдет время.',
        'obj.infStop': 'Данные у противника. Остановите носителя!',
    },
};
