// Release history shown in the menu's "What's new" panel. Newest first.
// A big release is split into groups (maps, fighter, …), each with its pictures and
// its few headline points; the full detail lives in CHANGELOG.md.

import { Language } from '../../types';

/** A pair of screenshots showing what a change looks like. */
export interface BeforeAfter {
    caption: string;
    before: string;
    after: string;
}

export interface PatchGroup {
    title: string;
    points: string[];
    comparisons?: BeforeAfter[];
}

export interface PatchNote {
    version: string;
    date: string | null; // null = the upcoming release (shown as "This update")
    groups?: PatchGroup[]; // big releases
    points?: string[];     // small releases: one flat list
}

const FIGHTER = { before: '/assets/patch/fighter-before.png', after: '/assets/patch/fighter-after.png' };
const shots = (name: string, ext = 'jpg') => ({ before: `/assets/patch/${name}-before.${ext}`, after: `/assets/patch/${name}-after.${ext}` });
const SHOTS = shots('shots'), STATION = shots('map-station'), MINE = shots('map-mine'), ARENA = shots('map-arena');
const FLAG = shots('flag');

export const PATCH_NOTES: Record<Language, PatchNote[]> = {
    en: [
        { version: '0.4.5', date: null, points: [
            'The character screen fits a laptop screen: the Start button is always in view and the part tiles scroll in their own panel',
        ] },
        { version: '0.4.3', date: 'Nov 2, 2026', points: [
            'Build your fighter from parts: helmet, visor, ears, tail, jetpack, flame, torso pattern and shoulder badge; the old skins are now ready-made builds to start from, and your saved look stays',
            'New parts open one per level: every match you finish gives XP, a win gives more, and the end screen shows which part opened',
            'New parts include wolf and bunny ears, horns, lizard and mechanical tails and a glass dome; wings and rocket jetpacks; blue, toxic, purple and white flames; a camo pattern and number badges',
            'Real tails instead of the old stick: they curve and swing when running, jumping and flying; bunny ears flop and wings open in flight',
            'Arms and legs bend in one smooth piece, without the round knee and elbow pads',
        ] },
        { version: '0.4.2', date: 'Nov 2, 2026', groups: [
            { title: 'Flags', comparisons: [{ caption: 'Capture the Flag base', ...FLAG }], points: [
                'Flags are redrawn: a steel pole with a glowing crystal, cloth with folds that waves in the wind, and a heavy base with hazard tape',
                'A carried flag streams behind a running fighter and hangs down when they stop',
                'Fixed: in Capture the Flag the enemy flag on a carrier\'s back was yellow instead of its team colour',
            ] },
        ] },
        { version: '0.4.1', date: 'Nov 2, 2026', points: [
            'Fixed the black world at match start: starting a match quickly from the character screen could stop the world from drawing, leaving only the HUD until the page was reloaded',
        ] },
        { version: '0.4.0', date: 'Nov 2, 2026', groups: [
            { title: 'Maps', comparisons: [
                { caption: 'Standard map: a space station', ...STATION },
                { caption: 'Tunnels: an asteroid mine', ...MINE },
                { caption: 'Hunger Games: a show arena', ...ARENA },
            ], points: [
                'The standard map is a space station: windows onto a planet, lamps and beacons, cargo, posters and screens, worn metal decks',
                'Tunnels is an asteroid mine with timber supports, strings of bulbs and ore carts; Hunger Games is a show arena with stands, spotlights and big screens',
                'Tunnels: the rocket launcher, chainsaw and armor no longer sit inside the solid central block',
            ] },
            { title: 'Fighter', comparisons: [{ caption: 'The new fighter', ...FIGHTER }], points: [
                'A jointed body: shoulders, knees and elbows, both hands on the weapon, steps in time with the run, a helmet that looks where you aim',
                'Sturdier and shinier: larger head, chest and boots, thicker arms and legs, a visor glint, pads and a strap, dust under the feet when running and landing',
                'Body parts fly apart in their own colors after a death; a custom color for every body part',
            ] },
            { title: 'Shots and hits', comparisons: [{ caption: 'Shots and hits', ...SHOTS }], points: [
                'Glowing bullet trails, a plasma orb, a rocket with smoke, a spinning grenade; sparks and scorch marks on walls and floors, blood and a flash on a fighter that gets hit',
                "Brighter, fuller explosions with a fireball, shockwave, embers and smoke; a warm flash of light on the fighter's hands when firing",
                'Railgun and explosions no longer go through walls; bullets no longer pierce players',
            ] },
            { title: 'Bots', points: [
                'Bots know the map: they reach every floor, no longer get stuck under platforms, and use the grapple hook to climb ledges the jetpack cannot',
                'Bots move in a fight: strafe, hop when hit, escape when nearly dead; in CTF they carry the flag straight home and escort the carrier',
                'Fairer and smarter: a moment to react to a new enemy, more misses at long range and at moving targets, and they fight in Gun Game',
            ] },
            { title: 'Modes and multiplayer', points: [
                'Matches end on score or after 10 minutes, then a results screen and the next match',
                "Create a game in your browser and invite friends with a link, or join a friend's server by its address; smoother movement and all effects online",
                'Hunger Games online with 5-minute rounds: fighters start spread over the arena with 3 seconds of protection; the zone keeps its floor, closes in every 30 seconds and stops when the round is decided',
                'CTF: teams respawn on the floor behind their base, so a flag carrier has a real chance to get home; team modes tell you what to do',
            ] },
            { title: 'Interface', points: [
                'New look for the menu, character setup and HUD',
                'Pick a mode and watch how it plays, with its key rules; the Infiltration preview shows the whole raid',
            ] },
            { title: 'Fixes', points: [
                'Running is twice as fast; the same game speed on 60, 120 and 144 Hz screens',
                'Fighters no longer slide along the floor with frozen legs',
                'No more free point for the smaller team in CTF, keys no longer get stuck, and many more fixes',
            ] },
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
        { version: '0.4.5', date: null, points: [
            'Экран персонажа помещается на экран ноутбука: кнопка «Начать матч» всегда на виду, а плитки деталей прокручиваются в своей панели',
        ] },
        { version: '0.4.3', date: '02.11.2026', points: [
            'Соберите бойца из деталей: шлем, визор, уши, хвост, джетпак, пламя, узор на торсе и знак на плече; старые скины стали готовыми сборками, а ваш сохранённый облик остался',
            'Новые детали открываются по одной за уровень: за каждый доигранный матч даётся опыт, за победу — больше, а на экране итогов видно, какая деталь открылась',
            'Среди новых деталей — волчьи и заячьи уши, рожки, хвост ящера и механический хвост, стеклянный купол; джетпаки «Крылышки» и «Ракета»; синее, ядовитое, фиолетовое и белое пламя; камуфляж и знак с номером',
            'Настоящие хвосты вместо прежней палки: изгибаются и раскачиваются на бегу, в прыжке и в полёте; заячьи уши болтаются, а крылышки раскрываются в полёте',
            'Руки и ноги сгибаются одним плавным куском, без круглых наколенников и налокотников',
        ] },
        { version: '0.4.2', date: '02.11.2026', groups: [
            { title: 'Флаги', comparisons: [{ caption: 'База в «Захвате флага»', ...FLAG }], points: [
                'Флаги нарисованы заново: стальное древко со светящимся кристаллом, ткань со складками, которая колышется на ветру, и тяжёлая база с жёлто-чёрной полосой',
                'Флаг за спиной развевается позади бегущего бойца и обвисает, когда он останавливается',
                'Исправлено: в «Захвате флага» вражеский флаг за спиной носителя был жёлтым, а не цвета своей команды',
            ] },
        ] },
        { version: '0.4.1', date: '02.11.2026', points: [
            'Исправлен чёрный мир в начале матча: быстрый старт матча с экрана персонажа мог остановить отрисовку мира — до перезагрузки страницы оставался виден только интерфейс',
        ] },
        { version: '0.4.0', date: '02.11.2026', groups: [
            { title: 'Карты', comparisons: [
                { caption: 'Стандартная карта: космическая станция', ...STATION },
                { caption: 'Тоннели: шахта на астероиде', ...MINE },
                { caption: 'Голодные игры: шоу-арена', ...ARENA },
            ], points: [
                'Стандартная карта — космическая станция: окна с видом на планету, лампы и маячки, контейнеры, плакаты и экраны, потёртые металлические настилы',
                'Тоннели — шахта на астероиде с деревянной крепью, гирляндами лампочек и вагонетками; Голодные игры — шоу-арена с трибунами, прожекторами и большими экранами',
                'Тоннели: ракетница, бензопила и броня больше не лежат внутри сплошного центрального блока',
            ] },
            { title: 'Боец', comparisons: [{ caption: 'Новый боец', ...FIGHTER }], points: [
                'Тело с суставами: плечи, колени и локти, оружие в обеих руках, шаг в такт бегу, шлем смотрит туда, куда целитесь',
                'Плотнее и ярче: крупнее голова, грудь и ботинки, толще руки и ноги, блик на визоре, наколенники и ремень, пыль под ногами при беге и приземлении',
                'После смерти части тела разлетаются в своих цветах; свой цвет для каждой части тела',
            ] },
            { title: 'Выстрелы и попадания', comparisons: [{ caption: 'Выстрелы и попадания', ...SHOTS }], points: [
                'Светящиеся следы пуль, плазменный шар, ракета с дымом, вращающаяся граната; искры и подпалины на стенах и полу, кровь и вспышка на бойце, в которого попали',
                'Взрывы стали ярче и объёмнее: огненный шар, ударная волна, угли и дым; при стрельбе на руках бойца вспыхивает тёплый свет',
                'Рельсотрон и взрывы больше не проходят сквозь стены, пули не прошивают игроков',
            ] },
            { title: 'Боты', points: [
                'Боты знают карту: добираются до любого этажа, не застревают под платформами и забираются крюком туда, куда не долетает джетпак',
                'Боты двигаются в бою: уходят вбок, подпрыгивают после попадания, спасаются почти без здоровья; в CTF несут флаг прямо домой и прикрывают несущего',
                'Честнее и умнее: им нужно время среагировать на нового врага, они чаще промахиваются издалека и по движущимся целям, и дерутся в Гонке вооружений',
            ] },
            { title: 'Режимы и сеть', points: [
                'Матч заканчивается по очкам или через 10 минут, потом итоги и следующий матч',
                'Создайте игру прямо в браузере и пригласите друзей ссылкой или войдите на сервер друга по адресу; движение в онлайне плавнее, все эффекты видны',
                'Голодные игры онлайн, раунды по 5 минут: бойцы появляются по всей арене и 3 секунды неуязвимы; у зоны всегда есть пол, она сужается каждые 30 секунд и замирает, когда раунд решён',
                'CTF: команды возрождаются на полу за своей базой — у несущего флаг появился шанс добежать; в командных режимах подсказка, что делать',
            ] },
            { title: 'Интерфейс', points: [
                'Новый вид меню, экрана персонажа и интерфейса в бою',
                'Выберите режим и посмотрите, как он играется, с главными правилами; превью «Проникновения» показывает весь рейд',
            ] },
            { title: 'Исправления', points: [
                'Бег стал вдвое быстрее; одинаковая скорость игры на мониторах 60, 120 и 144 Гц',
                'Бойцы больше не скользят по полу с застывшими ногами',
                'В CTF меньшая команда больше не получает бесплатных очков, клавиши не залипают, и много других исправлений',
            ] },
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
