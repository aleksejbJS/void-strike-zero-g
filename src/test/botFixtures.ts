// Minimal game state and bot entities for bot AI tests.

import { GameState, GameMode, Team, WeaponType, MapId } from '../types';
import { WEAPONS_DATA } from '../constants';

export const makeState = (): GameState => ({
  mode: GameMode.DEATHMATCH,
  scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
  players: [],
  projectiles: [],
  particles: [],
  decals: [],
  floatingTexts: [],
  platforms: [],
  pickups: [],
  camera: { x: 0, y: 0, zoom: 1 },
  lastHTFScore: 0,
  infiltrationEndTime: undefined,
  ragdollParts: [],
  currentMap: MapId.DEFAULT,
  beams: [],
});

export const makeBot = (id: string, team: Team, x: number, y: number) => ({
  id,
  type: 'bot' as const,
  pos: { x, y },
  vel: { x: 0, y: 0 },
  width: 30,
  height: 55,
  color: '#3b82f6',
  isGrounded: true,
  isCrouching: false,
  health: 100,
  maxHealth: 100,
  armor: 0,
  maxArmor: 100,
  jetpackFuel: 100,
  maxFuel: 100,
  dead: false,
  respawnTimer: 0,
  team,
  facingRight: true,
  weapon: { ...WEAPONS_DATA[WeaponType.MACHINE_GUN] },
  inventory: [{ ...WEAPONS_DATA[WeaponType.MACHINE_GUN] }],
  lastFired: 0,
  skinId: 'classic',
  score: 0,
  grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 },
  lastDash: 0,
  hasFlag: Team.NONE,
});
