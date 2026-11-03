// Factories for the authoritative room: initial state, bots and joined players

import { Entity, GameMode, GameState, MapId, Team, WeaponType } from '../../types';
import { WEAPONS_DATA, GUN_GAME_LADDER, DEFAULT_MAX_FUEL } from '../../constants';
import { getPlatforms, getInitialPickups } from '../data/level';
import { createHungerZone, hungerSpawnPoint, HUNGER_ROUND_SIZE } from '../systems/hungerRound';
import { ffaBotLooks } from '../build/botLooks';
import { JoinRequest } from './protocol';

export const isTeamMode = (mode: GameMode) =>
    mode === GameMode.CTF || mode === GameMode.HOLD_THE_FLAG || mode === GameMode.INFILTRATION;

/** Spawn point for the room's mode (Hunger Games scatters fighters over its arena). */
export const spawnPointFor = (mode: GameMode) => (team: Team) =>
    mode === GameMode.HUNGER_GAMES ? hungerSpawnPoint()
        : mode === GameMode.CTF && team !== Team.NONE ? ctfSpawnPoint(team)
            : getSpawnPoint(team);

// CTF: each team respawns on the floor behind its base, ~700 px from its flag. Respawning on
// the flag itself put defenders on top of a carrier 3 s after they died, so captures almost
// never happened.
const CTF_SPAWN_X = { [Team.BLUE]: -1150, [Team.RED]: 2950 };
const CTF_FLOOR_Y = 760;
export const ctfSpawnPoint = (team: Team.BLUE | Team.RED) => ({ x: CTF_SPAWN_X[team] + Math.random() * 200, y: CTF_FLOOR_Y });

export const getSpawnPoint = (team: Team) => {
    if (team === Team.BLUE) return { x: -400 + Math.random() * 200, y: 400 };
    if (team === Team.RED) return { x: 2200 + Math.random() * 200, y: 400 };
    return { x: Math.random() * 2000, y: Math.random() > 0.5 ? 700 : 200 };
};

export const createRoomState = (mode: GameMode, map: MapId): GameState => ({
    mode,
    currentMap: map,
    scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
    players: [],
    projectiles: [],
    particles: [],
    decals: [],
    floatingTexts: [],
    platforms: getPlatforms(mode, map),
    pickups: getInitialPickups(mode, map),
    camera: { x: 0, y: 0, zoom: 1 },
    corpses: [],
    lastHTFScore: 0,
    infiltrationEndTime: undefined,
    hungerZone: mode === GameMode.HUNGER_GAMES ? createHungerZone(Date.now()) : undefined,
    hungerRoundStartedAt: mode === GameMode.HUNGER_GAMES ? Date.now() : undefined,
    hungerWinnerId: null,
    gunGameWinnerId: null,
    beams: [],
    smokes: [],
});

const startingWeapon = (mode: GameMode) =>
    ({ ...WEAPONS_DATA[mode === GameMode.GUN_GAME ? GUN_GAME_LADDER[0] : WeaponType.MACHINE_GUN] });

const baseEntity = (mode: GameMode, team: Team) => {
    const weapon = startingWeapon(mode);
    return {
        pos: spawnPointFor(mode)(team), vel: { x: 0, y: 0 }, width: 30, height: 72,
        isGrounded: false, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
        jetpackFuel: DEFAULT_MAX_FUEL, maxFuel: DEFAULT_MAX_FUEL, dead: false, respawnTimer: 0, team,
        facingRight: true, weapon, inventory: [weapon], lastFired: 0, score: 0,
        gunLevel: mode === GameMode.GUN_GAME ? 0 : undefined,
        gunProgress: mode === GameMode.GUN_GAME ? 0 : undefined,
        grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE,
        lastProcessedInput: 0,
        jetpackOn: false,
        wound: undefined, // a new life starts whole (the Object.assign in respawnEveryone clears an old wound)
    };
};

/** Team bots wear their team colour; free-for-all bots each get their own look. */
export const createBots = (mode: GameMode): Entity[] => {
    const count = mode === GameMode.HUNGER_GAMES ? HUNGER_ROUND_SIZE : isTeamMode(mode) ? 6 : 3;
    const ffaLooks = isTeamMode(mode) ? [] : ffaBotLooks(count);
    return Array.from({ length: count }, (_, i) => {
        let team = Team.NONE;
        if (mode === GameMode.INFILTRATION) team = i < 2 ? Team.BLUE : Team.RED;
        else if (isTeamMode(mode)) team = i % 2 === 0 ? Team.RED : Team.BLUE;
        const color = team === Team.RED ? '#ef4444' : '#3b82f6';
        const look = ffaLooks[i] ?? {
            color, headColor: color, torsoColor: color, armColor: color, legColor: '#475569',
            jetpackColor: '#64748b', skinId: 'classic',
        };
        return {
            ...baseEntity(mode, team),
            id: `bot_${i}`, type: 'bot' as const, name: `Bot ${i + 1}`,
            ...look,
        };
    });
};

export const createJoinedPlayer = (id: string, req: JoinRequest, mode: GameMode, team: Team): Entity => ({
    ...baseEntity(mode, team),
    id, type: 'player', name: req.name, skinId: req.skinId,
    color: req.color, headColor: req.headColor, torsoColor: req.torsoColor,
    armColor: req.armColor, legColor: req.legColor, jetpackColor: req.jetpackColor,
    build: req.build,
});

/** Team with fewer human players (team modes only). Bots don't count — joiners replace them. */
export const pickTeam = (state: GameState): Team => {
    if (!isTeamMode(state.mode)) return Team.NONE;
    const humans = state.players.filter(p => p.type === 'player');
    const blue = humans.filter(p => p.team === Team.BLUE).length;
    const red = humans.filter(p => p.team === Team.RED).length;
    return blue <= red ? Team.BLUE : Team.RED;
};

/**
 * New Hunger Games round in place: everyone (spectators included) respawns fresh,
 * pickups and zone reset. Surplus bots leave so waiting humans take their places.
 */
export const resetHungerRound = (state: GameState, now: number) => {
    const humans = state.players.filter(p => p.type === 'player').length;
    const target = Math.max(HUNGER_ROUND_SIZE, humans);
    while (state.players.length > target) {
        const botIndex = state.players.findIndex(p => p.type === 'bot');
        if (botIndex === -1) break;
        state.players.splice(botIndex, 1);
    }

    state.hungerZone = createHungerZone(now); // resets spawn spots, so before respawning
    respawnEveryone(state);
    state.hungerWinnerId = null;
    state.hungerRoundEndsAt = undefined;
    state.hungerRoundStartedAt = now;
    state.hungerEndReason = undefined;
};

/** Fresh start for every player (keeping identity, team and input tracking), pickups and shots. */
const respawnEveryone = (state: GameState) => {
    for (const p of state.players) {
        const { lastProcessedInput, aim } = p;
        Object.assign(p, baseEntity(state.mode, p.team), { lastProcessedInput, aim });
    }
    state.projectiles = [];
    state.beams = [];
    state.smokes = [];
    state.pickups = getInitialPickups(state.mode, state.currentMap);
};

/** Next score/time-limited match on the same mode and map (spec 2026-11-01-match-end). */
export const resetMatch = (state: GameState) => {
    respawnEveryone(state);
    state.scores = { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 };
    state.lastHTFScore = 0;
    state.infiltrationEndTime = undefined;
    state.matchStartedAt = undefined; // the clock starts on the next tick
    state.matchEndsAt = undefined;
    state.matchWinner = undefined;
    state.matchEndReason = undefined;
};
