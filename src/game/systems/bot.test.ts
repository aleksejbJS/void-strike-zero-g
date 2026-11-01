import { describe, it, expect, beforeEach } from 'vitest';
import { botHasLineOfSight, updateBotAI, clearBotMemory } from './bot';
import { GameMode, Team, ItemType } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';

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
    expect(shots).toHaveLength(0); // reaction time
    updateBotAI(bot as any, state, 11_000, (_b, target) => shots.push(target));

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
    updateBotAI(bot as any, state, 11_000, (_b, target) => shots.push(target), GameMode.GUN_GAME);

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
    updateBotAI(bot as any, state, 11_000, (_b, target) => shots.push(target));

    expect(shots).toHaveLength(1);
    expect(shots[0].x).toBeGreaterThan(0);
  });

  it('keeps shooting while it retreats to a medkit', () => {
    const state = makeState();
    const bot = { ...makeBot('bot1', Team.NONE, 0, 0), health: 30 };
    state.players = [bot as any, makeBot('enemy', Team.NONE, 400, 0) as any];
    state.pickups = [{ id: 'hp', type: ItemType.HEALTH, pos: { x: -500, y: 0 }, active: true, respawnTime: 0, value: 50 }];
    const shots: any[] = [];

    updateBotAI(bot as any, state, 10_000, (_b, target) => shots.push(target));
    const controls = updateBotAI(bot as any, state, 11_000, (_b, target) => shots.push(target));

    expect(controls.inputX).toBe(-1);
    expect(shots).toHaveLength(1);
  });

  it('does not think a bot running at normal speed is stuck', () => {
    const state = makeState();
    state.platforms = [{ id: 'floor', x: -5000, y: 0, w: 10000, h: 200, color: '#000' }]; // bots navigate by surfaces
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
    state.platforms = [{ id: 'floor', x: -5000, y: 0, w: 10000, h: 200, color: '#000' }]; // bots navigate by surfaces
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
    state.platforms = [{ id: 'floor', x: -5000, y: 400, w: 10000, h: 200, color: '#000' }];
    const bot = { ...makeBot('bot1', Team.NONE, 0, 0), isGrounded: false };
    state.players = [bot as any, makeBot('enemy', Team.NONE, 600, 400) as any];

    expect(updateBotAI(bot as any, state, 10_000, noFire).isFlying).toBe(false);
  });
});
