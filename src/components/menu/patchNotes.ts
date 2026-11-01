// Release history shown in the menu's "What's new" panel. Newest first.

import { Language } from '../../types';

export interface PatchNote {
    version: string;
    date: string | null; // null = the upcoming release (shown as "This update")
    points: string[];
    beforeAfter?: BeforeAfter;
}

/** A pair of screenshots showing what a change looks like. */
export interface BeforeAfter {
    caption: string;
    before: string;
    after: string;
}

const FIGHTER = { before: '/assets/patch/fighter-before.png', after: '/assets/patch/fighter-after.png' };

export const PATCH_NOTES: Record<Language, PatchNote[]> = {
    en: [
        { version: '0.4.0', date: null, beforeAfter: { caption: 'The new fighter', ...FIGHTER }, points: [
            'New fighter: shoulders, knees and elbows, both hands on the weapon, steps in time with the run, recoil, a helmet that looks where you aim',
            'Body parts fly apart in their own colors after a death',
            'New look for the menu, character setup and HUD',
            'Pick a mode and see how it plays, with its key rules',
            'Infiltration preview shows the whole raid: grab the intel, bring it to extraction',
            'Matches end on score or after 10 minutes, then a results screen and the next match',
            'Create a game in your browser and invite friends with a link',
            "Join a friend's server by its address; smoother movement online",
            'Blood, explosions and damage numbers show up online',
            'Hunger Games online, with 5-minute rounds',
            'Team modes tell you what to do: "Bring the flag to your base"',
            'Custom color for every body part',
            'Running is twice as fast',
            'Smarter bots: they fight in Gun Game, go after enemies they can see and shoot back while retreating',
            'Same game speed on 60, 120 and 144 Hz screens',
            'Railgun and explosions no longer go through walls; bullets no longer pierce players',
            'No more free point for the smaller team in CTF, keys no longer get stuck, and many more fixes',
        ] },
        { version: '0.3.1', date: 'Nov 28, 2025', points: [
            'Gun Game: weapon ladder, no pickups, win with the last weapon',
            'Weapon selection fixes',
            'Skin arrows, robots and beasts with their own accents',
            'Server: localtunnel and ngrok tunnels',
            'Achievements count only for players; Gun Game ends without a sudden exit',
        ] },
        { version: '0.3.0', date: 'Nov 25, 2025', points: [
            'Ragdolls: bodies break into six parts',
            'Modular characters: head, torso, arms and legs',
            'New mode: Hold the Flag',
            'Peer-to-peer multiplayer',
            'Bots chase their targets',
        ] },
        { version: '0.0.4', date: 'Oct 5, 2024', points: [
            'New weapon sprites with a glow',
            'Railgun fires a blue beam and deals 200 damage',
            'Own textures for drops and flags',
        ] },
    ],
    ru: [
        { version: '0.4.0', date: null, beforeAfter: { caption: 'Новый боец', ...FIGHTER }, points: [
            'Новый боец: плечи, колени и локти, оружие в обеих руках, шаг в такт бегу, отдача, шлем смотрит туда, куда целитесь',
            'После смерти части тела разлетаются в своих цветах',
            'Новый вид меню, экрана персонажа и интерфейса в бою',
            'Выберите режим и посмотрите, как он играется, с главными правилами',
            'Превью «Проникновения» показывает весь рейд: схватить данные и донести до эвакуации',
            'Матч заканчивается по очкам или через 10 минут, потом итоги и следующий матч',
            'Создайте игру прямо в браузере и пригласите друзей ссылкой',
            'Вход на сервер друга по адресу; движение в онлайне стало плавнее',
            'Кровь, взрывы и цифры урона видны и в онлайне',
            'Голодные игры онлайн, раунды по 5 минут',
            'В командных режимах подсказка, что делать: «Несите флаг на свою базу»',
            'Свой цвет для каждой части тела',
            'Бег стал вдвое быстрее',
            'Боты умнее: дерутся в Гонке вооружений, идут на видимых врагов и отстреливаются при отступлении',
            'Одинаковая скорость игры на мониторах 60, 120 и 144 Гц',
            'Рельсотрон и взрывы больше не проходят сквозь стены, пули не прошивают игроков',
            'В CTF меньшая команда больше не получает бесплатных очков, клавиши не залипают, и много других исправлений',
        ] },
        { version: '0.3.1', date: '28.11.2025', points: [
            'Гонка вооружений: прогрессия оружия, без пикапов, победа после финального оружия',
            'Фиксы выбора оружия',
            'Стрелки выбора скинов, роботы и звери с уникальными акцентами',
            'Сервер: туннели localtunnel и ngrok',
            'Ачивки только за игрока, победа в Гонке вооружений без резкого выхода',
        ] },
        { version: '0.3.0', date: '25.11.2025', points: [
            'Ragdoll-физика: тела разлетаются на 6 частей',
            'Модульные персонажи: голова, торс, руки, ноги',
            'Новый режим «Удержание флага»',
            'Мультиплеер P2P',
            'Боты активнее преследуют цели',
        ] },
        { version: '0.0.4', date: '05.10.2024', points: [
            'Новые спрайты оружия с подсветкой',
            'Рельсотрон стреляет синим лучом и наносит 200 урона',
            'Свои текстуры у дропов и флагов',
        ] },
    ],
};
