// UI strings for the "Hazard Bay" menu, character setup and HUD.
// Merged into the main translation table in locales.ts.

import { Language } from '../types';

export interface HazardKeys {
    'hb.tagline': string;
    'hb.chooseMode': string;
    'hb.map': string;
    'hb.mapDefault': string;
    'hb.mapTunnels': string;
    'hb.mapHunger': string;
    'hb.playBots': string;
    'hb.playSub': string;
    'hb.playFriends': string;
    'hb.createGame': string;
    'hb.inviteLabel': string;
    'hb.invitePlaceholder': string;
    'hb.join': string;
    'hb.whatsNew': string;
    'hb.thisUpdate': string;
    'hb.close': string;
    'hb.switchLanguage': string;
    'hb.previewLabel': string;
    'ctl.move': string;
    'ctl.jetpack': string;
    'ctl.fire': string;
    'ctl.grapple': string;
    'ctl.weapons': string;
    'ctl.leftClick': string;
    'ctl.rightClick': string;
    'ctl.or': string;
    'pv.you': string;
    'pv.killLine': string;
    'pv.killsThisWeapon': string;
    'pv.upgrade': string;
    'pv.blueBase': string;
    'pv.redBase': string;
    'pv.blue': string;
    'pv.red': string;
    'pv.extraction': string;
    'pv.infGoal': string;
    'pv.intel': string;
    'pv.alive': string;
    'pv.roundEnds': string;
}

export const hazardStrings: Record<Language, HazardKeys> = {
    en: {
        'hb.tagline': 'Zero-G arena shooter. Jetpack, grapple, no floor you can trust.',
        'hb.chooseMode': 'Choose a mode',
        'hb.map': 'Map',
        'hb.mapDefault': 'Default',
        'hb.mapTunnels': 'Tunnels',
        'hb.mapHunger': 'Hunger arena',
        'hb.playBots': 'Play vs bots',
        'hb.playSub': '{0} on the {1} map',
        'hb.playFriends': 'Play with friends',
        'hb.createGame': 'Create game and get a link',
        'hb.inviteLabel': 'Got an invite? Paste it here',
        'hb.invitePlaceholder': 'Invite link or address',
        'hb.join': 'Join',
        'hb.whatsNew': "What's new",
        'hb.thisUpdate': 'This update',
        'hb.close': 'Close',
        'hb.switchLanguage': 'Switch language to Russian',
        'hb.previewLabel': 'How {0} plays',
        'ctl.move': 'Move',
        'ctl.jetpack': 'Jetpack',
        'ctl.fire': 'Fire',
        'ctl.grapple': 'Grapple',
        'ctl.weapons': 'Weapons',
        'ctl.leftClick': 'Left click',
        'ctl.rightClick': 'Right click',
        'ctl.or': 'or',
        'pv.you': 'You',
        'pv.killLine': '{0} fragged {1}',
        'pv.killsThisWeapon': 'Kills this weapon: {0}',
        'pv.upgrade': 'Upgrade',
        'pv.blueBase': 'Blue base',
        'pv.redBase': 'Red base',
        'pv.blue': 'Blue',
        'pv.red': 'Red',
        'pv.extraction': 'Extraction',
        'pv.infGoal': 'Blue: bring the intel out · Red: hold for {0}',
        'pv.intel': 'Intel',
        'pv.alive': 'Alive {0}',
        'pv.roundEnds': 'Round ends in {0}',
    },
    ru: {
        'hb.tagline': 'Арена-шутер в невесомости. Джетпак, крюк и ни одного надёжного пола.',
        'hb.chooseMode': 'Выберите режим',
        'hb.map': 'Карта',
        'hb.mapDefault': 'Стандартная',
        'hb.mapTunnels': 'Тоннели',
        'hb.mapHunger': 'Арена Голодных игр',
        'hb.playBots': 'Играть с ботами',
        'hb.playSub': '{0}, карта «{1}»',
        'hb.playFriends': 'Играть с друзьями',
        'hb.createGame': 'Создать игру и получить ссылку',
        'hb.inviteLabel': 'Есть приглашение? Вставьте его сюда',
        'hb.invitePlaceholder': 'Ссылка или адрес',
        'hb.join': 'Войти',
        'hb.whatsNew': 'Что нового',
        'hb.thisUpdate': 'Это обновление',
        'hb.close': 'Закрыть',
        'hb.switchLanguage': 'Переключить язык на английский',
        'hb.previewLabel': 'Как играется режим {0}',
        'ctl.move': 'Движение',
        'ctl.jetpack': 'Джетпак',
        'ctl.fire': 'Огонь',
        'ctl.grapple': 'Крюк',
        'ctl.weapons': 'Оружие',
        'ctl.leftClick': 'ЛКМ',
        'ctl.rightClick': 'ПКМ',
        'ctl.or': 'или',
        'pv.you': 'Вы',
        'pv.killLine': '{0}: фраг — {1}',
        'pv.killsThisWeapon': 'Убийств этим оружием: {0}',
        'pv.upgrade': 'Апгрейд',
        'pv.blueBase': 'База синих',
        'pv.redBase': 'База красных',
        'pv.blue': 'Синие',
        'pv.red': 'Красные',
        'pv.extraction': 'Эвакуация',
        'pv.infGoal': 'Синие: вынести данные · Красные: продержаться {0}',
        'pv.intel': 'Данные',
        'pv.alive': 'Живы {0}',
        'pv.roundEnds': 'До конца раунда {0}',
    },
};
