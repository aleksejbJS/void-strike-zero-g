// In-game HUD strings. Merged into the main translation table in locales.ts.

import { Language } from '../types';

export interface HudKeys {
    'hud.scoreboard': string;
    'hud.you': string;
    'hud.health': string;
    'hud.armor': string;
    'hud.fuel': string;
    'hud.youDied': string;
    'hud.respawnIn': string;
    'hud.sound': string;
    'hud.achievements': string;
    'hud.achievementUnlocked': string;
    'hud.totalXp': string;
    'hud.complete': string;
    'hud.progress': string;
    'hud.unlocked': string;
    'hud.close': string;
    'hud.invite': string;
    'hud.copy': string;
    'hud.copied': string;
    'hud.waiting': string;
    'hud.credits': string;
    'hud.betHint': string;
    'hud.betPlaced': string;
    'hud.winner': string;
    'hud.noSurvivors': string;
    'hud.roundEnds': string;
    'hud.zoneShrinks': string;
    'hud.nextRound': string;
    'hud.timeUp': string;
    'hud.finalRanking': string;
    'hud.placeBet': string;
    'hud.nobodyToBet': string;
    'hud.gunLevel': string;
    'hud.gunKills': string;
    'hud.gunComplete': string;
    'hud.mobileTitle': string;
    'hud.mobileMove': string;
    'hud.mobileAim': string;
    'hud.mobileButtons': string;
    'hud.jump': string;
    'hud.hook': string;
}

export const hudStrings: Record<Language, HudKeys> = {
    en: {
        'hud.scoreboard': 'Scoreboard',
        'hud.you': '(you)',
        'hud.health': 'Health',
        'hud.armor': 'Armor',
        'hud.fuel': 'Jetpack fuel',
        'hud.youDied': 'You died',
        'hud.respawnIn': 'Back in {0}s',
        'hud.sound': 'Sound on or off',
        'hud.achievements': 'Achievements',
        'hud.achievementUnlocked': 'Achievement unlocked',
        'hud.totalXp': 'Total XP',
        'hud.complete': '{0}% complete',
        'hud.progress': 'Progress: {0} of {1}',
        'hud.unlocked': 'Unlocked',
        'hud.close': 'Close',
        'hud.invite': 'Invite friends with this link',
        'hud.copy': 'Copy link',
        'hud.copied': 'Copied',
        'hud.waiting': 'Friends who open it join this game',
        'hud.credits': 'Credits: {0}',
        'hud.betHint': 'Bet 100 on a survivor after you die',
        'hud.betPlaced': 'Your bet: {0}',
        'hud.winner': 'Winner: {0}',
        'hud.noSurvivors': 'No survivors',
        'hud.roundEnds': 'Round ends in {0}',
        'hud.zoneShrinks': 'Zone shrinks in {0}s',
        'hud.nextRound': 'Next round in {0}s',
        'hud.timeUp': "Time's up",
        'hud.finalRanking': 'Final ranking',
        'hud.placeBet': 'Bet 100 credits on a survivor',
        'hud.nobodyToBet': 'Nobody left to bet on',
        'hud.gunLevel': 'Weapon {0} of {1}',
        'hud.gunKills': '{0} of {1} kills to the next weapon',
        'hud.gunComplete': 'Gun Game complete',
        'hud.mobileTitle': 'Touch controls',
        'hud.mobileMove': 'Left half: move',
        'hud.mobileAim': 'Right half: aim and fire',
        'hud.mobileButtons': 'Buttons: jetpack and hook',
        'hud.jump': 'Jetpack',
        'hud.hook': 'Grappling hook',
    },
    ru: {
        'hud.scoreboard': 'Счёт',
        'hud.you': '(вы)',
        'hud.health': 'Здоровье',
        'hud.armor': 'Броня',
        'hud.fuel': 'Топливо джетпака',
        'hud.youDied': 'Вы погибли',
        'hud.respawnIn': 'Возрождение через {0} с',
        'hud.sound': 'Включить или выключить звук',
        'hud.achievements': 'Достижения',
        'hud.achievementUnlocked': 'Достижение получено',
        'hud.totalXp': 'Всего опыта',
        'hud.complete': 'Выполнено {0}%',
        'hud.progress': 'Прогресс: {0} из {1}',
        'hud.unlocked': 'Получено',
        'hud.close': 'Закрыть',
        'hud.invite': 'Пригласите друзей этой ссылкой',
        'hud.copy': 'Скопировать ссылку',
        'hud.copied': 'Скопировано',
        'hud.waiting': 'Кто откроет её, попадёт в эту игру',
        'hud.credits': 'Кредиты: {0}',
        'hud.betHint': 'После гибели поставьте 100 на выжившего',
        'hud.betPlaced': 'Ваша ставка: {0}',
        'hud.winner': 'Победитель: {0}',
        'hud.noSurvivors': 'Выживших нет',
        'hud.roundEnds': 'До конца раунда {0}',
        'hud.zoneShrinks': 'Зона сузится через {0} с',
        'hud.nextRound': 'Следующий раунд через {0} с',
        'hud.timeUp': 'Время вышло',
        'hud.finalRanking': 'Итоги раунда',
        'hud.placeBet': 'Поставьте 100 кредитов на выжившего',
        'hud.nobodyToBet': 'Ставить не на кого',
        'hud.gunLevel': 'Оружие {0} из {1}',
        'hud.gunKills': '{0} из {1} убийств до следующего оружия',
        'hud.gunComplete': 'Гонка вооружений завершена',
        'hud.mobileTitle': 'Управление касанием',
        'hud.mobileMove': 'Левая половина: движение',
        'hud.mobileAim': 'Правая половина: прицел и огонь',
        'hud.mobileButtons': 'Кнопки: джетпак и крюк',
        'hud.jump': 'Джетпак',
        'hud.hook': 'Крюк',
    },
};
