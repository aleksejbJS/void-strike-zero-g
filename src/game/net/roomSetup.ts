// Factories for the authoritative room: initial state, bots and joined players

import { Entity, GameMode, GameState, MapId, Team, WeaponType } from '../../types';
import { WEAPONS_DATA, GUN_GAME_LADDER, DEFAULT_MAX_FUEL } from '../../constants';
import { getPlatforms, getInitialPickups } from '../data/level';
import { JoinRequest } from './protocol';

export const isTeamMode = (mode: GameMode) =>
    mode === GameMode.CTF || mode === GameMode.HOLD_THE_FLAG || mode === GameMode.INFILTRATION;

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
    ragdollParts: [],
    lastHTFScore: 0,
    infiltrationEndTime: undefined,
    hungerWinnerId: null,
    gunGameWinnerId: null,
    beams: [],
});

const startingWeapon = (mode: GameMode) =>
    ({ ...WEAPONS_DATA[mode === GameMode.GUN_GAME ? GUN_GAME_LADDER[0] : WeaponType.MACHINE_GUN] });

const baseEntity = (mode: GameMode, team: Team) => {
    const weapon = startingWeapon(mode);
    return {
        pos: getSpawnPoint(team), vel: { x: 0, y: 0 }, width: 30, height: 72,
        isGrounded: false, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
        jetpackFuel: DEFAULT_MAX_FUEL, maxFuel: DEFAULT_MAX_FUEL, dead: false, respawnTimer: 0, team,
        facingRight: true, weapon, inventory: [weapon], lastFired: 0, score: 0,
        gunLevel: mode === GameMode.GUN_GAME ? 0 : undefined,
        gunProgress: mode === GameMode.GUN_GAME ? 0 : undefined,
        grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE,
        lastProcessedInput: 0,
    };
};

export const createBots = (mode: GameMode): Entity[] => {
    const count = isTeamMode(mode) ? 6 : 3;
    return Array.from({ length: count }, (_, i) => {
        let team = Team.NONE;
        if (mode === GameMode.INFILTRATION) team = i < 2 ? Team.BLUE : Team.RED;
        else if (isTeamMode(mode)) team = i % 2 === 0 ? Team.RED : Team.BLUE;
        const color = team === Team.RED ? '#ef4444' : '#3b82f6';
        return {
            ...baseEntity(mode, team),
            id: `bot_${i}`, type: 'bot' as const, name: `Bot ${i + 1}`,
            color, headColor: color, torsoColor: color, armColor: color, legColor: '#475569',
            jetpackColor: '#64748b', skinId: 'classic',
        };
    });
};

export const createJoinedPlayer = (id: string, req: JoinRequest, mode: GameMode, team: Team): Entity => ({
    ...baseEntity(mode, team),
    id, type: 'player', name: req.name, skinId: req.skinId,
    color: req.color, headColor: req.headColor, torsoColor: req.torsoColor,
    armColor: req.armColor, legColor: req.legColor, jetpackColor: req.jetpackColor,
});

/** Team with fewer human players (team modes only). Bots don't count — joiners replace them. */
export const pickTeam = (state: GameState): Team => {
    if (!isTeamMode(state.mode)) return Team.NONE;
    const humans = state.players.filter(p => p.type === 'player');
    const blue = humans.filter(p => p.team === Team.BLUE).length;
    const red = humans.filter(p => p.team === Team.RED).length;
    return blue <= red ? Team.BLUE : Team.RED;
};
