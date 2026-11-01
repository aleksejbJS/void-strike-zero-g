import { describe, it, expect, beforeEach } from 'vitest';
import { botHasLineOfSight, updateBotAI, clearBotMemory } from './bot';
import { GameState, GameMode, Team, WeaponType, MapId, ItemType } from '../../types';
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
    state.platforms = [{ id: 'wall', x: 40, y: 40, w: 20, h: 20, color: '#000' }];
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
  const noFire = () => {};

  it('walks towards a visible enemy and shoots at it', () => {
    const state = makeState();
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    const enemy = makeBot('enemy', Team.NONE, 400, 0);
    state.players = [bot as any, enemy as any];
    const shots: any[] = [];

    const controls = updateBotAI(bot as any, state, 10_000, (_b, target) => shots.push(target));

    expect(controls.inputX).toBe(1);
    expect(shots).toHaveLength(1);
    expect(bot.facingRight).toBe(true);
  });

  it('treats everyone as an enemy in free-for-all modes such as Gun Game', () => {
    const state = makeState();
    state.mode = GameMode.GUN_GAME;
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    state.players = [bot as any, makeBot('enemy', Team.NONE, 400, 0) as any];
    const shots: any[] = [];

    updateBotAI(bot as any, state, 10_000, (_b, target) => shots.push(target), GameMode.GUN_GAME);

    expect(shots).toHaveLength(1);
  });

  it('prefers a visible enemy over a closer one behind a wall', () => {
    const state = makeState();
    state.platforms = [{ id: 'wall', x: -150, y: -200, w: 20, h: 300, color: '#000' }];
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    const hidden = makeBot('hidden', Team.NONE, -250, 0);
    const visible = makeBot('visible', Team.NONE, 500, 0);
    state.players = [bot as any, hidden as any, visible as any];
    const shots: any[] = [];

    updateBotAI(bot as any, state, 10_000, (_b, target) => shots.push(target));

    expect(shots).toHaveLength(1);
    expect(shots[0].x).toBeGreaterThan(0);
  });

  it('keeps shooting while it retreats to a medkit', () => {
    const state = makeState();
    const bot = { ...makeBot('bot1', Team.NONE, 0, 0), health: 30 };
    state.players = [bot as any, makeBot('enemy', Team.NONE, 400, 0) as any];
    state.pickups = [{ id: 'hp', type: ItemType.HEALTH, pos: { x: -500, y: 0 }, active: true, respawnTime: 0, value: 50 }];
    const shots: any[] = [];

    const controls = updateBotAI(bot as any, state, 10_000, (_b, target) => shots.push(target));

    expect(controls.inputX).toBe(-1);
    expect(shots).toHaveLength(1);
  });

  it('does not think a bot running at normal speed is stuck', () => {
    const state = makeState();
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    state.players = [bot as any, makeBot('enemy', Team.NONE, 3000, 0) as any];

    let flew = false;
    for (let tick = 0; tick < 240; tick++) {
      bot.pos.x += 2; // ~240 px/s at 120 ticks/s
      flew ||= updateBotAI(bot as any, state, 10_000 + tick * (1000 / 120), noFire).isFlying;
    }
    expect(flew).toBe(false);
  });

  it('jetpacks out when it tries to move but does not', () => {
    const state = makeState();
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    state.players = [bot as any, makeBot('enemy', Team.NONE, 3000, 0) as any];

    let flew = false;
    for (let tick = 0; tick < 240; tick++) {
      flew ||= updateBotAI(bot as any, state, 10_000 + tick * (1000 / 120), noFire).isFlying;
    }
    expect(flew).toBe(true);
  });

  it('drops down to a goal below instead of hovering over it', () => {
    const state = makeState();
    const bot = { ...makeBot('bot1', Team.NONE, 0, 0), isGrounded: false };
    state.players = [bot as any, makeBot('enemy', Team.NONE, 600, 400) as any];

    expect(updateBotAI(bot as any, state, 10_000, noFire).isFlying).toBe(false);
  });
});

describe('updateBotAI in Hunger Games', () => {
  const hungerState = () => {
    const state = makeState();
    state.mode = GameMode.HUNGER_GAMES;
    state.hungerZone = { x: -500, y: -500, w: 1000, h: 1000 };
    return state;
  };

  it('does not go for a medkit outside the zone', () => {
    const state = hungerState();
    const bot = { ...makeBot('bot1', Team.NONE, 0, 0), health: 20 };
    state.players = [bot as any, makeBot('enemy', Team.NONE, 450, 0) as any];
    state.pickups = [{ id: 'hp', type: ItemType.HEALTH, pos: { x: -2000, y: 0 }, active: true, respawnTime: 0, value: 50 }];

    const controls = updateBotAI(bot as any, state, 10_000, () => {});

    expect(controls.inputX).toBe(1); // fights instead of walking into the zone wall
  });

  it('walks off its platform to reach an enemy straight below', () => {
    const state = hungerState();
    state.platforms = [{ id: 'ledge', x: -100, y: 0, w: 300, h: 20, color: '#000' }];
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    state.players = [bot as any, makeBot('enemy', Team.NONE, 10, 400) as any];

    const controls = updateBotAI(bot as any, state, 10_000, () => {});

    expect(controls.inputX).toBe(-1); // the left edge is nearer
    expect(controls.isFlying).toBe(false);
  });

  it('holds fire during the round-start shield', () => {
    const state = hungerState();
    state.hungerRoundStartedAt = 9_000;
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    state.players = [bot as any, makeBot('enemy', Team.NONE, 300, 0) as any];
    const shots: any[] = [];

    updateBotAI(bot as any, state, 10_000, (_b, t) => shots.push(t));

    expect(shots).toHaveLength(0);
  });
});
