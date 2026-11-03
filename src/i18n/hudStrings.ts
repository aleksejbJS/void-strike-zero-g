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
    'hud.fightIn': string;
    'hud.shieldHint': string;
    'hud.timeUp': string;
    'hud.finalRanking': string;
    'hud.placeBet': string;
    'hud.nobodyToBet': string;
    'hud.gunLevel': string;
    'hud.gunKills': string;
    'hud.gunComplete': string;
    'hud.mobileTitle': string;
    'hud.touchMove': string;
    'hud.touchAim': string;
    'hud.touchWeapons': string;
    'hud.place': string;
    'hud.fullscreen': string;
    'hud.exitFullscreen': string;
    'hud.hook': string;
    // Objective banner: {0} is a flag adjective (flagOf*) or a team name (team*)
    'hud.flagOfRed': string;
    'hud.flagOfBlue': string;
    'hud.teamRed': string;
    'hud.teamBlue': string;
    'hud.flagGrabbed': string;
    'hud.flagLost': string;
    'hud.flagReturned': string;
    'hud.flagCaptured': string;
    'hud.holdGrabbed': string;
    'hud.holdLost': string;
    'hud.intelGrabbed': string;
    'hud.intelLost': string;
    'hud.intelCaptured': string;
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
        'hud.fightIn': 'Fight in {0}',
        'hud.shieldHint': 'Nobody can be hurt yet: pick your spot',
        'hud.timeUp': "Time's up",
        'hud.finalRanking': 'Final ranking',
        'hud.placeBet': 'Bet 100 credits on a survivor',
        'hud.nobodyToBet': 'Nobody left to bet on',
        'hud.gunLevel': 'Weapon {0} of {1}',
        'hud.gunKills': '{0} of {1} kills to the next weapon',
        'hud.gunComplete': 'Gun Game complete',
        'hud.mobileTitle': 'Touch controls',
        'hud.touchMove': 'Left stick: walk, run at the edge; up to fly, down to crouch, down to the edge to lie',
        'hud.touchAim': 'Right stick: aim, push to the edge to fire',
        'hud.touchWeapons': 'Tap a weapon to switch',
        'hud.place': '#{0} of {1}',
        'hud.fullscreen': 'Full screen',
        'hud.exitFullscreen': 'Exit full screen',
        'hud.hook': 'Grappling hook',
        'hud.flagOfRed': 'Red',
        'hud.flagOfBlue': 'Blue',
        'hud.teamRed': 'Red',
        'hud.teamBlue': 'Blue',
        'hud.flagGrabbed': '{0} flag grabbed',
        'hud.flagLost': '{0} flag lost',
        'hud.flagReturned': '{0} flag returned',
        'hud.flagCaptured': '{0} captured the flag',
        'hud.holdGrabbed': '{0} has the flag',
        'hud.holdLost': '{0} lost the flag',
        'hud.intelGrabbed': 'Intel grabbed',
        'hud.intelLost': 'Intel dropped',
        'hud.intelCaptured': 'Intel extracted',
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
        'hud.fightIn': 'Бой через {0}',
        'hud.shieldHint': 'Пока никто не получает урон — выберите позицию',
        'hud.timeUp': 'Время вышло',
        'hud.finalRanking': 'Итоги раунда',
        'hud.placeBet': 'Поставьте 100 кредитов на выжившего',
        'hud.nobodyToBet': 'Ставить не на кого',
        'hud.gunLevel': 'Оружие {0} из {1}',
        'hud.gunKills': '{0} из {1} убийств до следующего оружия',
        'hud.gunComplete': 'Гонка вооружений завершена',
        'hud.mobileTitle': 'Управление касанием',
        'hud.touchMove': 'Левый стик: шаг, у края — бег; вверх — полёт, вниз — присесть, вниз до края — лечь',
        'hud.touchAim': 'Правый стик: прицел, до края — огонь',
        'hud.touchWeapons': 'Нажмите на оружие, чтобы сменить',
        'hud.place': '№{0} из {1}',
        'hud.fullscreen': 'На весь экран',
        'hud.exitFullscreen': 'Выйти из полноэкранного режима',
        'hud.hook': 'Крюк',
        'hud.flagOfRed': 'Красный',
        'hud.flagOfBlue': 'Синий',
        'hud.teamRed': 'Красные',
        'hud.teamBlue': 'Синие',
        'hud.flagGrabbed': '{0} флаг взят',
        'hud.flagLost': '{0} флаг потерян',
        'hud.flagReturned': '{0} флаг возвращён',
        'hud.flagCaptured': '{0} захватили флаг',
        'hud.holdGrabbed': '{0} взяли флаг',
        'hud.holdLost': '{0} потеряли флаг',
        'hud.intelGrabbed': 'Разведданные взяты',
        'hud.intelLost': 'Разведданные потеряны',
        'hud.intelCaptured': 'Разведданные вывезены',
    },
};
