// Shared factories for game-state unit tests

import { GameState, GameMode, WeaponType, Entity, Team } from '../types';
import { WEAPONS_DATA } from '../constants';

export const createMockState = (mode: GameMode): GameState => ({
    mode,
    scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
    players: [],
    projectiles: [],
    particles: [],
    platforms: [],
    pickups: [],
    decals: [],
    floatingTexts: [],
    camera: { x: 0, y: 0, zoom: 1 },
    beams: [],
    corpses: [],
    currentMap: 'default' as any,
});

export const createMockPlayer = (id: string, team: Team, weaponType = WeaponType.MACHINE_GUN): Entity => ({
    id,
    type: 'player',
    team,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    width: 30,
    height: 72,
    color: '#ffffff',
    health: 100,
    maxHealth: 100,
    armor: 0,
    maxArmor: 100,
    jetpackFuel: 100,
    maxFuel: 100,
    inventory: [],
    weapon: { ...WEAPONS_DATA[weaponType] },
    isGrounded: false,
    isCrouching: false,
    facingRight: true,
    score: 0,
    dead: false,
    respawnTimer: 0,
    name: id,
    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 },
    hasFlag: Team.NONE,
    lastFired: 0,
    gunLevel: 0,
    gunProgress: 0,
    jetpackColor: '#fff',
    skinId: 'classic',
    lastDash: 0,
    lastProcessedInput: 0
});
