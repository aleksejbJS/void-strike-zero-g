// Release history shown in the menu's "What's new" panel. Newest first.
// A big release is split into groups (maps, fighter, …), each with its pictures and
// its few headline points; the full detail lives in CHANGELOG.md.

import { Language } from '../../types';
import { assetUrl } from '../../assetUrl';

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

const FIGHTER = { before: assetUrl('assets/patch/fighter-before.png'), after: assetUrl('assets/patch/fighter-after.png') };
const shots = (name: string, ext = 'jpg') => ({ before: assetUrl(`assets/patch/${name}-before.${ext}`), after: assetUrl(`assets/patch/${name}-after.${ext}`) });
const SHOTS = shots('shots'), STATION = shots('map-station'), MINE = shots('map-mine'), ARENA = shots('map-arena');
const FLAG = shots('flag'), CAMERA = shots('camera'), EXPLOSION = shots('explosion');
const PREVIEWS = shots('previews'), DEATH = shots('death'), MOBILE_HUD = shots('mobile-hud');

export const PATCH_NOTES: Record<Language, PatchNote[]> = {
    en: [
        { version: '0.4.34', date: 'Nov 9, 2026', points: [
            'New weapon: the flamethrower. One per map, for close fights: a 300 px stream that hits everyone in it and sets them on fire',
            'Burning fighters lose 1 HP every half second for 5 seconds. The flame breaks wooden crates twice as fast and barely hurts metal ones',
            'The fuel tank on your back can catch fire when you are hit. Three seconds later it blows up, tearing you apart and hurting everyone nearby',
            'A corpse with a lit tank keeps burning and explodes when its time runs out',
            'Bots pick up the flamethrower and walk in close to use it',
        ] },
        { version: '0.4.33', date: 'Nov 9, 2026', points: [
            'Character setup: a ↺ button next to a changed colour puts back the preset\'s original colour, without touching your parts',
        ] },
        { version: '0.4.32', date: 'Nov 9, 2026', points: [
            'Machine Gun: a 50-round magazine and a 1-second automatic reload — the fighter lowers the gun and the empty magazine drops out',
            'The ammo box shows the rounds left and a reload bar; the Machine Gun reloads in the background while you use another weapon',
            'Bots reload by the same rules',
        ] },
        { version: '0.4.31', date: 'Nov 4, 2026', points: [
            'Infiltration: bots defending the intel now take cover behind crates too',
        ] },
        { version: '0.4.30', date: 'Nov 4, 2026', points: [
            'Crates, glass panels and explosive barrels on every map except the tournament duel arena',
            'Wooden crates break fast, metal ones hold for long. Glass is see-through but stops bullets until it shatters',
            'Shoot a barrel and it blows up everyone nearby',
            'Broken cover comes back after 35 seconds',
            'Bots take cover, shoot through it and set off barrels',
        ] },
        { version: '0.4.29', date: 'Nov 4, 2026', points: [
            'Switch weapons with the mouse wheel: down for the next one, up for the previous. One trackpad swipe switches once',
        ] },
        { version: '0.4.28', date: 'Nov 4, 2026', points: [
            'Spawn protection: for 2 seconds after a respawn you can\'t be hurt and your fighter blinks. Firing ends it early',
        ] },
        { version: '0.4.27', date: 'Nov 4, 2026', points: [
            'Fixed: a railgun beam no longer just wounds a fighter whose armor shows 0; a tiny leftover of armor now counts as none',
            'On the hook, W and Space only reel you in: the jetpack stays off and refills the whole time you hang',
        ] },
        { version: '0.4.26', date: 'Nov 4, 2026', points: [
            'Safer accounts: if your login expires, your progress waits on this device for your next login and never goes to another account',
            'New nicknames may use only Latin or Russian letters, digits, "_", "-" and spaces, so nobody can register a look-alike of your name. The same rule applies to guest names; existing accounts keep their names',
            'Start now waits a moment while accounts are still loading, so you never start a match under someone else\'s nickname',
            'While an account window is open, nothing behind it can be clicked or reached with Tab',
        ] },
        { version: '0.4.25', date: 'Nov 4, 2026', groups: [
            { title: 'Tournaments', points: [
                'A new Tournaments button in the menu: a knockout of 1-on-1 duels for up to 8 players. Create one and share the link, or sign up for an open one; the creator presses Start and empty seats are filled by bots',
                'Duels are first to 10 kills on a new small arena, The Pit, with the same weapons for both fighters. All matches of a round are played at the same time',
                'Knocked out? Watch several running matches at once in a split screen, and click a match to open it full screen',
                'Lost your connection mid-duel? The game reconnects for up to a minute. To give up a duel, press Esc twice',
                'Three new achievements: Champion, Finalist and Flawless',
            ] },
        ] },
        { version: '0.4.24', date: 'Nov 4, 2026', points: [
            'The smoke launcher got its own picture: a grey launcher with a smoke drum and a puff at the muzzle, on the map, in your hands and in the HUD',
        ] },
        { version: '0.4.23', date: 'Nov 4, 2026', points: [
            'The jetpack now refills while you hang on your hook, as fast as on the ground',
        ] },
        { version: '0.4.22', date: 'Nov 3, 2026', groups: [
            { title: 'Accounts & profile', points: [
                'Protect your nickname with a password: nobody else can take it, and your achievements, fighter level and fighter look follow you to any device. You can also log in on the character screen',
                'A new Profile screen shows your level and every achievement with its progress',
                'Playing without an account works exactly as before, and a game starts even when the accounts service is down',
            ] },
        ] },
        { version: '0.4.20', date: 'Nov 3, 2026', points: [
            'Armor now saves you from the railgun: a beam through any armor burns it all, tears off a leg and leaves you with 10 health',
            'Without the leg you only hop slowly on the ground and bleed 1 health a second; pick up any medkit within 10 seconds to get the leg back. Jetpack and hook work as always',
            'If you bleed out, the frag goes to whoever fired the railgun. A red drop next to your health shows you are bleeding',
            'Bots lose legs too and fly for a medkit, even with the flag',
        ] },
        { version: '0.4.19', date: 'Nov 3, 2026', points: [
            'Smoke launcher: fire a smoke cloud anywhere and hide for 10 seconds — from players and bots',
        ] },
        { version: '0.4.18', date: 'Nov 3, 2026', points: [
            'Online, after you respawned the game kept you where you died while everyone else saw you at the spawn point, so your shots came from somewhere else entirely',
        ] },
        { version: '0.4.17', date: 'Nov 3, 2026', points: [
            'Rockets fly straight for the first half second (about a screen width) and only then start to drop',
        ] },
        { version: '0.4.16', date: 'Nov 3, 2026', points: [
            'The invite link in a game you host can now be closed with ×; the new link button next to sound and achievements brings it back',
        ] },
        { version: '0.4.15', date: 'Nov 3, 2026', points: [
            'Fighters can lie down: hold Z, or push the move stick down to the edge on a phone. Lying, you are hard to hit, crawl slowly and shoot only forward',
            'A jump gets you back on your feet',
        ] },
        { version: '0.4.14', date: 'Nov 3, 2026', points: [
            'Online, shots now leave the gun: bullets and rockets used to appear a little way ahead of the fighter who fired them, and further still for other players',
        ] },
        { version: '0.4.13', date: 'Nov 3, 2026', groups: [
            { title: 'Fighters', points: [
                'Fighters now walk as well as run: a slower pace with shorter steps, which everyone in the match sees',
            ] },
            { title: 'Playing on a phone', comparisons: [{ caption: 'A match on a phone in landscape', ...MOBILE_HUD }], points: [
                'A new phone HUD: a slim see-through bar on top with health, armor, fuel, the clock and your place; nothing overlaps any more',
                'Two sticks: the left one walks, runs at the edge and flies when pushed up, the right one aims with an aim line and fires only when pushed to the edge, so your finger never covers the target and rockets are not wasted while you aim',
                'Tap a weapon above the right stick to switch to it; the hook button sits next to the stick',
                'The menu and the character screen fit on a phone held sideways, no more scrolling through a long page',
                'On Android a match goes full screen, so the browser bar no longer takes space; a button on the top bar switches it off and on',
                'Fixed: on phones the Start match button could hide under the browser bar',
            ] },
        ] },
        { version: '0.4.12', date: 'Nov 3, 2026', groups: [
            { title: 'Deaths', comparisons: [{ caption: 'A machine-gun kill and a rocket kill', ...DEATH }], points: [
                'A killed fighter no longer breaks into loose pieces: they go limp and fall as one body in their own look, tumble and land on the platforms',
                'How they die depends on what killed them: a machine gun drops them, a point-blank shotgun or a nearby rocket throws them back, a direct rocket hit or a chainsaw tears them apart, a railgun cuts them in two',
                'The gun falls out of their hands, and bodies lying around jump when something explodes next to them',
            ] },
        ] },
        { version: '0.4.11', date: 'Nov 3, 2026', points: [
            'In Deathmatch, Gun Game and Hunger Games every bot now has its own look: a different skin with its own flame, pattern and shoulder badge',
        ] },
        { version: '0.4.10', date: 'Nov 2, 2026', points: [
            'Fixed: on the "Jetpack repair" poster the small line ran over the big one',
            'Fixed: on phones the top of the helmet was cut off in the character preview',
        ] },
        { version: '0.4.9', date: 'Nov 2, 2026', groups: [
            { title: 'Explosions', comparisons: [{ caption: 'A rocket blast', ...EXPLOSION }], points: [
                'Bigger, dirtier explosions: a lumpy fireball, hot debris flying out on smoke trails and a cloud of smoke that hangs for a moment; a grenade blast is a bit smaller than a rocket',
                'The screen shakes when something blows up near you',
            ] },
        ] },
        { version: '0.4.8', date: 'Nov 2, 2026', points: [
            'Big banners for the objective in team modes: "RED FLAG GRABBED", "BLUE CAPTURED THE FLAG", flag lost or returned, Hold the Flag taken or lost, intel grabbed, dropped or extracted',
        ] },
        { version: '0.4.7', date: 'Nov 2, 2026', points: [
            'The character screen fits a laptop screen: the Start button is always in view and the part tiles scroll in their own panel',
        ] },
        { version: '0.4.6', date: 'Nov 2, 2026', groups: [
            { title: 'Camera', comparisons: [{ caption: 'The same 2560 × 1440 window', ...CAMERA }], points: [
                'Every screen now shows the same part of the map: fighters, flags and effects are bigger on large monitors, and a big monitor no longer sees further than a small one',
            ] },
        ] },
        { version: '0.4.5', date: 'Nov 2, 2026', groups: [
            { title: 'Menu', comparisons: [{ caption: 'Deathmatch preview', ...PREVIEWS }], points: [
                'Mode previews in the menu are drawn by the game itself: real fighters in your own look, flags, rockets, ragdolls and the station, mine or arena behind them',
                'Each mode plays its own short scene: a flag run, the Gun Game ladder, the intel escape, the closing Hunger Games zone',
            ] },
        ] },
        { version: '0.4.4', date: 'Nov 2, 2026', points: [
            'Fixed missing art in the second match: after playing a match and going back to the menu, the next match could lose parts of the world and fighters (and the console filled with WebGL errors) until the page was reloaded',
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
        { version: '0.4.34', date: '09.11.2026', points: [
            'Новое оружие — огнемёт. По одному на карту, для ближнего боя: струя на 300 px задевает всех на пути и поджигает',
            'Горящий боец теряет 1 HP каждые полсекунды в течение 5 секунд. Деревянные ящики огонь ломает вдвое быстрее, металлические почти не берёт',
            'Топливный бак за спиной может загореться от попадания. Через три секунды он взрывается, разрывает носителя и ранит всех рядом',
            'Труп с горящим баком продолжает гореть и взрывается, когда время выходит',
            'Боты подбирают огнемёт и подходят вплотную, чтобы им пользоваться',
        ] },
        { version: '0.4.33', date: '09.11.2026', points: [
            'Настройка персонажа: кнопка ↺ рядом с изменённым цветом возвращает исходный цвет пресета, детали остаются',
        ] },
        { version: '0.4.32', date: '09.11.2026', points: [
            'Пулемёт: магазин на 50 патронов и автоматическая перезарядка за 1 секунду — боец опускает ствол, пустой магазин выпадает',
            'В HUD видно, сколько патронов осталось, и полоску перезарядки; пулемёт дозаряжается, пока вы стреляете из другого оружия',
            'Боты перезаряжаются по тем же правилам',
        ] },
        { version: '0.4.31', date: '04.11.2026', points: [
            'Infiltration: боты, охраняющие интел, теперь тоже прячутся за ящиками',
        ] },
        { version: '0.4.30', date: '04.11.2026', points: [
            'На всех картах, кроме турнирной арены для дуэлей, появились ящики, стеклянные перегородки и взрывные бочки',
            'Деревянный ящик разбивается быстро, металлический держится долго. Стекло прозрачное, но останавливает пули, пока не разобьётся',
            'Если прострелить бочку, она взорвётся и ранит всех рядом',
            'Сломанные укрытия возвращаются через 35 секунд',
            'Боты прячутся за ящиками, простреливают укрытия и подрывают бочки',
        ] },
        { version: '0.4.29', date: '04.11.2026', points: [
            'Оружие можно менять колесом мыши: вниз — следующее, вверх — предыдущее. Один свайп по тачпаду меняет оружие один раз',
        ] },
        { version: '0.4.28', date: '04.11.2026', points: [
            'Защита после респавна: 2 секунды вас нельзя ранить, а боец мигает. Выстрел снимает защиту раньше',
        ] },
        { version: '0.4.27', date: '04.11.2026', points: [
            'Исправлено: луч рельсы больше не просто ранит бойца, у которого броня показывает 0; крошечный остаток брони теперь не считается',
            'На крюке W и пробел только подтягивают вас: джетпак не включается и заправляется всё время, пока вы висите',
        ] },
        { version: '0.4.26', date: '04.11.2026', points: [
            'Аккаунты надёжнее: если вход истёк, прогресс ждёт на этом устройстве вашего следующего входа и никогда не уходит в другой аккаунт',
            'Новые ники — только латинские или русские буквы, цифры, «_», «-» и пробелы: зарегистрировать двойника вашего ника из похожих букв нельзя. То же правило действует для имени гостя; старые аккаунты сохраняют свои ники',
            'Кнопка «Старт» теперь ждёт, пока загружаются аккаунты, поэтому матч не начнётся под чужим ником',
            'Пока открыто окно аккаунта, ничего за ним нельзя нажать или выбрать клавишей Tab',
        ] },
        { version: '0.4.25', date: '04.11.2026', groups: [
            { title: 'Турниры', points: [
                'В меню появилась кнопка «Турниры». Турнир на вылет до 8 игроков: дуэли один на один. Создайте свой и поделитесь ссылкой или запишитесь в открытый; создатель нажимает «Старт», а пустые места занимают боты',
                'Дуэль идёт до 10 убийств на новой небольшой арене «Яма», оружие у обоих бойцов одинаковое. Все матчи раунда играются одновременно',
                'Вылетели? Смотрите сразу несколько идущих матчей на разделённом экране, а клик по матчу открывает его на весь экран',
                'Пропала связь посреди дуэли? Игра переподключается в течение минуты. Чтобы сдать дуэль, нажмите Esc дважды',
                'Три новых достижения: Champion, Finalist и Flawless',
            ] },
        ] },
        { version: '0.4.24', date: '04.11.2026', points: [
            'У дымового гранатомёта появилась своя картинка: серый гранатомёт с дымовым барабаном и облачком у дула — на карте, в руках и в HUD',
        ] },
        { version: '0.4.23', date: '04.11.2026', points: [
            'Джетпак теперь заправляется, пока вы висите на крюке, так же быстро, как на земле',
        ] },
        { version: '0.4.22', date: '03.11.2026', groups: [
            { title: 'Аккаунты и профиль', points: [
                'Защитите ник паролем: никто другой его не займёт, а достижения, уровень бойца и его внешний вид перейдут с вами на любое устройство. Войти в аккаунт можно и на экране бойца',
                'Новый экран «Профиль» показывает ваш уровень и все достижения с прогрессом',
                'Игра без аккаунта работает как раньше, а матч начнётся, даже если сервис аккаунтов не отвечает',
            ] },
        ] },
        { version: '0.4.20', date: '03.11.2026', points: [
            'Броня теперь спасает от рельсы: луч через любую броню сжигает её целиком, отрывает ногу и оставляет 10 здоровья',
            'Без ноги вы только медленно прыгаете по земле и теряете 1 здоровье в секунду; подберите любую аптечку за 10 секунд — и нога вернётся. Джетпак и крюк работают как обычно',
            'Если вы истекли кровью, фраг получает тот, кто стрелял из рельсы. Красная капля рядом со здоровьем показывает, что вы истекаете кровью',
            'Боты тоже теряют ноги и летят за аптечкой, даже с флагом',
        ] },
        { version: '0.4.19', date: '03.11.2026', points: [
            'Дымовой гранатомёт: выстрелите облаком дыма куда угодно и прячьтесь в нём 10 секунд — от игроков и от ботов',
        ] },
        { version: '0.4.18', date: '03.11.2026', points: [
            'В игре по сети после возрождения игра оставляла вас там, где вы погибли, а остальные видели вас на точке возрождения — поэтому ваши выстрелы летели совсем из другого места',
        ] },
        { version: '0.4.17', date: '03.11.2026', points: [
            'Ракета первые полсекунды (примерно ширина экрана) летит прямо и только потом начинает падать',
        ] },
        { version: '0.4.16', date: '03.11.2026', points: [
            'Плашку со ссылкой-приглашением в вашей игре теперь можно закрыть крестиком, а вернуть кнопкой-ссылкой рядом со звуком и достижениями',
        ] },
        { version: '0.4.15', date: '03.11.2026', points: [
            'Бойцы умеют ложиться: держите Z, а на телефоне тяните левый стик вниз до края. Лёжа в вас трудно попасть, вы медленно ползёте и стреляете только вперёд',
            'Прыжок поднимает бойца на ноги',
        ] },
        { version: '0.4.14', date: '03.11.2026', points: [
            'В игре по сети выстрелы вылетают из оружия: раньше пули и ракеты появлялись чуть впереди стрелявшего бойца, а у других игроков — ещё дальше',
        ] },
        { version: '0.4.13', date: '03.11.2026', groups: [
            { title: 'Бойцы', points: [
                'Бойцы теперь умеют ходить шагом, а не только бегать: медленнее и короткими шагами, и это видят все в матче',
            ] },
            { title: 'Игра на телефоне', comparisons: [{ caption: 'Матч на телефоне в альбомной ориентации', ...MOBILE_HUD }], points: [
                'Новый интерфейс для телефона: тонкая прозрачная полоса сверху со здоровьем, бронёй, топливом, временем и вашим местом; больше ничего не наезжает друг на друга',
                'Два стика: левый — шаг, у края — бег, вверх — полёт; правый — прицел с линией прицела, а стреляет только у края круга, так что палец не закрывает цель и ракеты не улетают, пока целишься',
                'Оружие меняется касанием по значку над правым стиком; кнопка крюка рядом со стиком',
                'Меню и экран персонажа помещаются на повёрнутом телефоне целиком, без прокрутки длинной страницы',
                'На Android матч открывается на весь экран, строка браузера больше не мешает; кнопка в верхней полосе выключает и включает этот режим',
                'Исправлено: на телефоне кнопка «Начать матч» могла прятаться под строкой браузера',
            ] },
        ] },
        { version: '0.4.12', date: '03.11.2026', groups: [
            { title: 'Гибель', comparisons: [{ caption: 'Убийство из пулемёта и ракетой', ...DEATH }], points: [
                'Убитый боец больше не разваливается на отдельные куски: он обмякает и падает целым телом в своём облике, кувыркается и ложится на платформу',
                'Как боец погибает, зависит от оружия: от пулемёта он просто падает, дробовик в упор или ракета рядом отбрасывают тело, прямое попадание ракеты или бензопила разрывают на части, рельсотрон разрезает пополам',
                'Оружие выпадает из рук, а лежащие тела подбрасывает, если рядом что-то взрывается',
            ] },
        ] },
        { version: '0.4.11', date: '03.11.2026', points: [
            'В Deathmatch, Gun Game и Hunger Games у каждого бота теперь свой облик: другой скин, своё пламя, узор и нашивка',
        ] },
        { version: '0.4.10', date: '02.11.2026', points: [
            'Исправлено: на постере «Джетпак починим за час» мелкая строка наезжала на крупную',
            'Исправлено: на телефоне в превью персонажа обрезался верх шлема',
        ] },
        { version: '0.4.9', date: '02.11.2026', groups: [
            { title: 'Взрывы', comparisons: [{ caption: 'Взрыв ракеты', ...EXPLOSION }], points: [
                'Взрывы крупнее и «грязнее»: комковатый огненный шар, раскалённые осколки разлетаются с дымными шлейфами, облако дыма висит ещё мгновение; взрыв гранаты чуть меньше ракетного',
                'Экран трясёт, когда что-то взрывается рядом с вами',
            ] },
        ] },
        { version: '0.4.8', date: '02.11.2026', points: [
            'Большие надписи о цели в командных режимах: «КРАСНЫЙ ФЛАГ ВЗЯТ», «СИНИЕ ЗАХВАТИЛИ ФЛАГ», флаг потерян или возвращён, флаг в «Удержании» взят или потерян, разведданные взяты, потеряны или вывезены',
        ] },
        { version: '0.4.7', date: '02.11.2026', points: [
            'Экран персонажа помещается на экран ноутбука: кнопка «Начать матч» всегда на виду, а плитки деталей прокручиваются в своей панели',
        ] },
        { version: '0.4.6', date: '02.11.2026', groups: [
            { title: 'Камера', comparisons: [{ caption: 'Одно и то же окно 2560 × 1440', ...CAMERA }], points: [
                'Любой экран теперь показывает одинаковый кусок карты: на больших мониторах бойцы, флаги и эффекты крупнее, а большой монитор больше не видит дальше маленького',
            ] },
        ] },
        { version: '0.4.5', date: '02.11.2026', groups: [
            { title: 'Меню', comparisons: [{ caption: 'Превью «Боя насмерть»', ...PREVIEWS }], points: [
                'Превью режимов в меню рисует сама игра: настоящие бойцы в вашем образе, флаги, ракеты, тряпичные куклы и станция, шахта или арена на фоне',
                'Каждый режим показывает свою короткую сцену: вынос флага, лестницу оружия, побег с разведданными, сужение зоны в «Голодных играх»',
            ] },
        ] },
        { version: '0.4.4', date: '02.11.2026', points: [
            'Исправлена пропадающая графика во втором матче: после матча и выхода в меню следующий матч мог терять часть мира и бойцов (а консоль — заполняться ошибками WebGL) до перезагрузки страницы',
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
