import { Language } from '../types';

export interface TranslationKeys {
  // Menu
  'menu.title': string;
  'menu.deploy': string;
  'menu.createGame': string;
  'menu.join': string;
  'menu.gameId': string;
  'menu.serverAddress': string;
  // Online
  'net.connecting': string;
  'net.cannotConnect': string;
  'net.serverFull': string;
  'net.joinInvalid': string;
  'net.alreadyJoined': string;
  'net.backToMenu': string;
  'menu.controls': string;
  'menu.move': string;
  'menu.jetpack': string;
  'menu.weapon': string;
  'menu.grapple': string;
  'menu.fire': string;
  'menu.dash': string;

  // Game Modes
  'mode.deathmatch': string;
  'mode.gungame': string;
  'mode.ctf': string;
  'mode.htf': string;
  'mode.infiltration': string;
  'mode.hunger': string;

  // UI
  'ui.scoreboard': string;
  'ui.credits': string;
  'ui.betOn': string;
  'ui.betAfterDeath': string;
  'ui.winner': string;
  'ui.gunProgress': string;
  'ui.zoneShrinks': string;
  'ui.nextRound': string;
  'ui.placeBet': string;
  'ui.finalRanking': string;
  'ui.youDied': string;
  'ui.respawnIn': string;
  'ui.inviteLink': string;
  'ui.waitingForPlayers': string;
  'ui.noSurvivors': string;

  // Achievements
  'achievements.title': string;
  'achievements.unlocked': string;
  'achievements.progress': string;
  'achievements.totalXP': string;
  'achievements.complete': string;

  // Weapons
  'weapon.machineGun': string;
  'weapon.shotgun': string;
  'weapon.plasmaGun': string;
  'weapon.rocketLauncher': string;
  'weapon.railgun': string;
  'weapon.grenadeLauncher': string;
  'weapon.chainsaw': string;

  // Items
  'item.health': string;
  'item.armor': string;
  'item.ammo': string;
  'item.fuel': string;
  'item.flag': string;
  'item.weapon': string;

  // Common
  'common.grabbed': string;
  'common.hp': string;
  'common.arm': string;
  'common.jetpackFuel': string;
}

export const translations: Record<Language, TranslationKeys> = {
  en: {
    // Menu
    'menu.title': 'VOID STRIKE',
    'menu.deploy': 'DEPLOY',
    'menu.createGame': 'CREATE GAME',
    'menu.join': 'JOIN',
    'menu.gameId': 'Game ID',
    'menu.serverAddress': 'Server address (IP or URL)',
    'net.connecting': 'Connecting to server…',
    'net.cannotConnect': 'Cannot connect to',
    'net.serverFull': 'Server is full',
    'net.joinInvalid': 'Server rejected your profile (check your name)',
    'net.alreadyJoined': 'Already joined from this tab',
    'net.backToMenu': 'Press Esc to return to the menu',
    'menu.controls': 'Controls',
    'menu.move': 'WASD Move',
    'menu.jetpack': 'SPACE Jetpack',
    'menu.weapon': '1-6 Weapon',
    'menu.grapple': 'R-CLK / SHIFT Grapple',
    'menu.fire': 'L-CLK Fire',
    'menu.dash': 'SHIFT Dash',

    // Game Modes
    'mode.deathmatch': 'DEATHMATCH',
    'mode.gungame': 'GUN GAME',
    'mode.ctf': 'CAPTURE THE FLAG',
    'mode.htf': 'HOLD THE FLAG',
    'mode.infiltration': 'INFILTRATION',
    'mode.hunger': 'HUNGER GAMES',

    // UI
    'ui.scoreboard': 'Scoreboard',
    'ui.credits': 'Credits',
    'ui.betOn': 'Bet placed on',
    'ui.betAfterDeath': 'Bet 100 on a survivor after you die',
    'ui.winner': 'Winner',
    'ui.gunProgress': 'Gun Game',
    'ui.zoneShrinks': 'Zone shrinks in',
    'ui.nextRound': 'Next round in',
    'ui.placeBet': 'Place Your Bet (100)',
    'ui.finalRanking': 'Final Ranking',
    'ui.youDied': 'YOU DIED',
    'ui.respawnIn': 'Respawn in',
    'ui.inviteLink': 'INVITE LINK:',
    'ui.waitingForPlayers': 'Waiting for players...',
    'ui.noSurvivors': 'No survivors to bet on',

    // Achievements
    'achievements.title': 'Achievements',
    'achievements.unlocked': 'Unlocked',
    'achievements.progress': 'Progress',
    'achievements.totalXP': 'Total XP',
    'achievements.complete': 'Complete',

    // Weapons
    'weapon.machineGun': 'Machine Gun',
    'weapon.shotgun': 'Shotgun',
    'weapon.plasmaGun': 'Plasma Gun',
    'weapon.rocketLauncher': 'Rocket Launcher',
    'weapon.railgun': 'Railgun',
    'weapon.grenadeLauncher': 'Grenade Launcher',
    'weapon.chainsaw': 'Chainsaw',

    // Items
    'item.health': 'Health',
    'item.armor': 'Armor',
    'item.ammo': 'Ammo',
    'item.fuel': 'Fuel',
    'item.flag': 'Flag',
    'item.weapon': 'Weapon',

    // Common
    'common.grabbed': 'GRABBED',
    'common.hp': 'HP',
    'common.arm': 'ARM',
    'common.jetpackFuel': 'Jetpack Fuel',
  },

  ru: {
    // Menu
    'menu.title': 'VOID STRIKE',
    'menu.deploy': 'СТАРТ',
    'menu.createGame': 'СОЗДАТЬ ИГРУ',
    'menu.join': 'ПРИСОЕДИНИТЬСЯ',
    'menu.gameId': 'ID Игры',
    'menu.serverAddress': 'Адрес сервера (IP или URL)',
    'net.connecting': 'Подключение к серверу…',
    'net.cannotConnect': 'Не удалось подключиться к',
    'net.serverFull': 'Сервер заполнен',
    'net.joinInvalid': 'Сервер отклонил профиль (проверьте имя)',
    'net.alreadyJoined': 'Вы уже подключены из этой вкладки',
    'net.backToMenu': 'Нажмите Esc, чтобы вернуться в меню',
    'menu.controls': 'Управление',
    'menu.move': 'WASD Движение',
    'menu.jetpack': 'ПРОБЕЛ Реактивный ранец',
    'menu.weapon': '1-6 Оружие',
    'menu.grapple': 'ПРАВАЯ КНОПКА / SHIFT Крюк',
    'menu.fire': 'ЛЕВАЯ КНОПКА Огонь',
    'menu.dash': 'SHIFT Рывок',

    // Game Modes
    'mode.deathmatch': 'БОЙ НАСМЕРТЬ',
    'mode.gungame': 'GUN GAME',
    'mode.ctf': 'ЗАХВАТ ФЛАГА',
    'mode.htf': 'УДЕРЖАНИЕ ФЛАГА',
    'mode.infiltration': 'ДИВЕРСИЯ',
    'mode.hunger': 'ИГРЫ ГОЛОДА',

    // UI
    'ui.scoreboard': 'Таблица результатов',
    'ui.credits': 'Кредиты',
    'ui.betOn': 'Ставка на',
    'ui.betAfterDeath': 'Ставка 100 на выжившего после смерти',
    'ui.winner': 'Победитель',
    'ui.gunProgress': 'Gun Game',
    'ui.zoneShrinks': 'Зона сжимается через',
    'ui.nextRound': 'Следующий раунд через',
    'ui.placeBet': 'Сделайте ставку (100)',
    'ui.finalRanking': 'Финальный рейтинг',
    'ui.youDied': 'ВЫ ПОГИБЛИ',
    'ui.respawnIn': 'Возрождение через',
    'ui.inviteLink': 'ССЫЛКА НА ПРИГЛАШЕНИЕ:',
    'ui.waitingForPlayers': 'Ожидание игроков...',
    'ui.noSurvivors': 'Нет выживших для ставки',

    // Achievements
    'achievements.title': 'Достижения',
    'achievements.unlocked': 'Разблокировано',
    'achievements.progress': 'Прогресс',
    'achievements.totalXP': 'Всего XP',
    'achievements.complete': 'Завершено',

    // Weapons
    'weapon.machineGun': 'Пулемёт',
    'weapon.shotgun': 'Дробовик',
    'weapon.plasmaGun': 'Плазменная пушка',
    'weapon.rocketLauncher': 'Ракетница',
    'weapon.railgun': 'Рельсотрон',
    'weapon.grenadeLauncher': 'Гранатомёт',
    'weapon.chainsaw': 'Бензопила',

    // Items
    'item.health': 'Здоровье',
    'item.armor': 'Броня',
    'item.ammo': 'Патроны',
    'item.fuel': 'Топливо',
    'item.flag': 'Флаг',
    'item.weapon': 'Оружие',

    // Common
    'common.grabbed': 'ПОДОБРАНО',
    'common.hp': 'HP',
    'common.arm': 'БРОНЯ',
    'common.jetpackFuel': 'Топливо ранца',
  }
};
