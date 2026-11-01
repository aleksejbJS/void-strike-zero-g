import { describe, it, expect, beforeEach } from 'vitest';
import { updateBotAI, clearBotMemory } from './bot';
import { GameMode, Team, ItemType } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';

beforeEach(() => {
  clearBotMemory();
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
    state.platforms = [
      { id: 'ledge', x: -100, y: 0, w: 300, h: 20, color: '#000' },
      { id: 'floor', x: -500, y: 400, w: 1000, h: 100, color: '#000' },
    ];
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

describe('bot aim', () => {
  it('waits a human reaction time before firing at a newly spotted enemy', () => {
    const state = makeState();
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    state.players = [bot as any, makeBot('enemy', Team.NONE, 450, 0) as any];
    const shotTimes: number[] = [];
    for (let t = 10_000; t <= 11_000; t += 50) updateBotAI(bot as any, state, t, () => shotTimes.push(t));

    expect(shotTimes[0]).toBeGreaterThanOrEqual(10_400);
    expect(shotTimes[0]).toBeLessThanOrEqual(10_950);
  });

  it('opens fire only a reaction time after the round-start shield', () => {
    const state = makeState();
    state.mode = GameMode.HUNGER_GAMES;
    state.hungerRoundStartedAt = 10_000; // shield until 13 000
    const bot = makeBot('bot1', Team.NONE, 0, 0);
    state.players = [bot as any, makeBot('enemy', Team.NONE, 450, 0) as any];
    const shotTimes: number[] = [];
    for (let t = 10_000; t <= 14_500; t += 50) updateBotAI(bot as any, state, t, () => shotTimes.push(t));

    expect(shotTimes[0]).toBeGreaterThanOrEqual(13_400);
  });

  it('misses more at a fast target far away than at a still one up close', () => {
    const spreadAt = (x: number, vx: number) => {
      const state = makeState();
      const bot = makeBot('bot1', Team.NONE, 0, 0);
      const enemy = { ...makeBot('enemy', Team.NONE, x, 0), vel: { x: 0, y: vx } };
      state.players = [bot as any, enemy as any];
      const ys: number[] = [];
      for (let i = 0; i < 200; i++) {
        clearBotMemory();
        updateBotAI(bot as any, state, 10_000, () => {});
        updateBotAI(bot as any, state, 11_000, (_b, t) => ys.push(t.y));
      }
      const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      return Math.sqrt(ys.reduce((a, y) => a + (y - mean) ** 2, 0) / ys.length); // spread of the shots
    };
    expect(spreadAt(800, 4)).toBeGreaterThan(spreadAt(150, 0) * 4);
  });
});
