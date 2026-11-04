// What each game mode is about, in player language — shown under the menu's mode preview.
// Rules mirror the real code (respawn delay, Gun Game ladder, HTF scoring, round limits).

import { GameMode, Language } from '../../types';

export interface ModeInfo {
    name: string;
    meta: string;  // who plays against whom
    desc: string;
    rules: [string, string, string];
}

// The modes the menu offers. GameMode.DUEL is deliberately absent: it is tournament-only.
export const MODE_ORDER: GameMode[] = [
    GameMode.DEATHMATCH,
    GameMode.GUN_GAME,
    GameMode.CTF,
    GameMode.HOLD_THE_FLAG,
    GameMode.INFILTRATION,
    GameMode.HUNGER_GAMES,
];

export const MODE_INFO: Record<Language, Record<GameMode, ModeInfo>> = {
    en: {
        [GameMode.DEATHMATCH]: { name: 'Deathmatch', meta: 'Free for all', desc: 'Everyone for themselves. Most kills leads the scoreboard.',
            rules: ['You respawn 3 seconds after dying', 'Weapons, health, armor and fuel lie around the map', 'Your own rockets hurt you, and can launch you upward'] },
        [GameMode.GUN_GAME]: { name: 'Gun Game', meta: 'Free for all', desc: 'Every 5 kills swap your weapon for the next one on the ladder.',
            rules: ['Everyone starts with the machine gun', 'Dying moves you one weapon back', '5 kills with the railgun wins the match'] },
        [GameMode.CTF]: { name: 'Capture the Flag', meta: 'Red vs blue', desc: 'Steal the enemy flag and bring it to your base.',
            rules: ['Touch your own flag while carrying theirs to score', 'If the carrier dies, the flag goes back to its base', 'Your bullets pass through teammates'] },
        [GameMode.HOLD_THE_FLAG]: { name: 'Hold the Flag', meta: 'Red vs blue', desc: 'One golden flag. Whoever holds it scores.',
            rules: ['Holding the flag scores a point every 4 seconds', 'The carrier is slower and takes 10% more damage', 'Crouch and jump to drop it for a teammate'] },
        [GameMode.INFILTRATION]: { name: 'Infiltration', meta: 'Attack vs defense', desc: 'Blue steals the intel, red guards it.',
            rules: ['Blue scores by carrying the intel to extraction', 'Red scores by holding out for 3 minutes', 'Dropped intel stays where its carrier fell'] },
        [GameMode.HUNGER_GAMES]: { name: 'Hunger Games', meta: 'Last one standing', desc: 'One life each. The safe zone keeps shrinking.',
            rules: ['No respawns until the next round', 'The zone shrinks after every death and every 30 seconds', 'Last survivor wins, or the best one after 5 minutes'] },
        [GameMode.DUEL]: { name: 'Duel', meta: 'One on one', desc: 'Tournament match on The Pit. First to 10 kills wins.',
            rules: ['Everyone has the full weapon loadout', 'Only health, armor and ammo lie around', 'Tied after 10 minutes: next kill wins'] },
    },
    ru: {
        [GameMode.DEATHMATCH]: { name: 'Бой насмерть', meta: 'Каждый за себя', desc: 'Каждый сам за себя. Больше всех убийств — первое место.',
            rules: ['Возрождение через 3 секунды после смерти', 'По карте лежат оружие, аптечки, броня и топливо', 'Свои ракеты ранят и вас — и могут подбросить вверх'] },
        [GameMode.GUN_GAME]: { name: 'Гонка вооружений', meta: 'Каждый за себя', desc: 'Каждые 5 убийств меняют ваше оружие на следующее по лестнице.',
            rules: ['Все начинают с пулемёта', 'Смерть откатывает на одно оружие назад', '5 убийств из рельсотрона — победа'] },
        [GameMode.CTF]: { name: 'Захват флага', meta: 'Красные против синих', desc: 'Украдите вражеский флаг и принесите на свою базу.',
            rules: ['С чужим флагом коснитесь своего — это очко', 'Если носитель погиб, флаг возвращается на базу', 'Пули проходят сквозь союзников'] },
        [GameMode.HOLD_THE_FLAG]: { name: 'Удержание флага', meta: 'Красные против синих', desc: 'Один золотой флаг. Кто его держит, тот и набирает очки.',
            rules: ['Флаг в руках — очко каждые 4 секунды', 'Носитель медленнее и получает на 10% больше урона', 'Присесть и прыгнуть — бросить флаг союзнику'] },
        [GameMode.INFILTRATION]: { name: 'Проникновение', meta: 'Атака и защита', desc: 'Синие крадут разведданные, красные их охраняют.',
            rules: ['Синие получают очко, донеся данные до эвакуации', 'Красные получают очко, продержавшись 3 минуты', 'Выпавшие данные остаются там, где упал носитель'] },
        [GameMode.HUNGER_GAMES]: { name: 'Голодные игры', meta: 'Последний выживший', desc: 'Одна жизнь на раунд. Безопасная зона всё время сужается.',
            rules: ['Без возрождений до следующего раунда', 'Зона сужается после каждой смерти и каждые 30 секунд', 'Побеждает последний — или лучший выживший через 5 минут'] },
        [GameMode.DUEL]: { name: 'Дуэль', meta: 'Один на один', desc: 'Матч турнира на арене «Яма». До 10 убийств.',
            rules: ['У всех полный набор оружия', 'Лежат только аптечки, броня и патроны', 'Ничья через 10 минут: побеждает следующее убийство'] },
    },
};
