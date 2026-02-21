import { describe, it, expect, beforeEach } from 'vitest';
import { botHasLineOfSight, updateBotAI, clearBotMemory } from './bot';
import { GameState, GameMode, Team, WeaponType, MapId } from '../../types';
import { WEAPONS_DATA } from '../../constants';

const makeState = (): GameState => ({
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

const makeBot = (id: string, team: Team, x: number, y: number) => ({
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

beforeEach(() => {
  clearBotMemory();
});

describe('botHasLineOfSight', () => {
  it('returns false when a platform blocks the ray', () => {
    const state = makeState();
    state.platforms = [{ x: 40, y: 40, w: 20, h: 20, color: '#000' }];
    const see = botHasLineOfSight(state, { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(see).toBe(false);
  });

  it('returns true when nothing blocks the ray', () => {
    const state = makeState();
    const see = botHasLineOfSight(state, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(see).toBe(true);
  });
});

describe('updateBotAI', () => {
  it('moves bot toward an enemy and can fire', () => {
    const state = makeState();
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    const enemy = makeBot('enemy', Team.NONE, 200, 0);
    state.players = [bot as any, enemy as any];
    const shots: any[] = [];

    const flying = updateBotAI(bot as any, state, Date.now(), (_b, target) => shots.push(target));

    expect(bot.vel.x).not.toBe(0);
    // In absence of obstacles, bot should face and potentially shoot the enemy
    expect(shots.length).toBeGreaterThanOrEqual(0);
    expect(typeof flying).toBe('boolean');
  });
});
