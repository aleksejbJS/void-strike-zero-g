// Release history shown in the menu's "What's new" panel. Newest first.

import { Language } from '../../types';

export interface PatchNote {
    version: string;
    date: string | null; // null = the upcoming release (shown as "This update")
    points: string[];
}

export const PATCH_NOTES: Record<Language, PatchNote[]> = {
    en: [
        { version: '0.4.0', date: null, points: [
            'Create a game in your browser and invite friends with a link',
            'Hunger Games online, with 5-minute rounds',
            'Same game speed on 60, 120 and 144 Hz screens',
            'Blood, explosions and damage numbers show up online',
            'Railgun no longer shoots through walls, keys no longer get stuck, and many more fixes',
            'New look for the menu, character setup and HUD',
        ] },
        { version: '0.3.1', date: 'Nov 28, 2025', points: [
            'Gun Game: weapon ladder, no pickups, win with the last weapon',
            'Weapon selection fixes',
            'Skin arrows, robots and beasts with their own accents',
            'Server: localtunnel and ngrok tunnels',
            'Achievements count only for players; Gun Game ends without a sudden exit',
        ] },
        { version: '0.3.0', date: 'Nov 25, 2024', points: [
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
        { version: '0.4.0', date: null, points: [
            'Создайте игру прямо в браузере и пригласите друзей ссылкой',
            'Голодные игры онлайн, раунды по 5 минут',
            'Одинаковая скорость игры на мониторах 60, 120 и 144 Гц',
            'Кровь, взрывы и цифры урона видны и в онлайне',
            'Рельсотрон больше не стреляет сквозь стены, клавиши не залипают, и много других исправлений',
            'Новый вид меню, экрана персонажа и интерфейса в бою',
        ] },
        { version: '0.3.1', date: '28.11.2025', points: [
            'Гонка вооружений: прогрессия оружия, без пикапов, победа после финального оружия',
            'Фиксы выбора оружия',
            'Стрелки выбора скинов, роботы и звери с уникальными акцентами',
            'Сервер: туннели localtunnel и ngrok',
            'Ачивки только за игрока, победа в Гонке вооружений без резкого выхода',
        ] },
        { version: '0.3.0', date: '25.11.2024', points: [
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
