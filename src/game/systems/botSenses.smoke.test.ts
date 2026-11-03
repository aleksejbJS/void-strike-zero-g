import { describe, it, expect } from 'vitest';
import { Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { canSee, senseTarget } from './botSenses';
import { clearBotMemory, getBotMemory } from './botMemory';
import { SMOKE_DURATION_MS, spawnSmoke } from './smoke';

// Open floor, bot and enemy 300 px apart (pos = centre-x, bottom-y)
const setup = () => {
  const state = makeState();
  const bot = makeBot('bot1', Team.RED, 0, 0);
  const enemy = makeBot('enemy', Team.BLUE, 300, 0);
  state.players = [bot as any, enemy as any];
  return { state, bot: bot as any, enemy: enemy as any };
};

const NOW = 1000;
const BODY_CENTER_Y = -27; // enemy centre: pos.y - height / 2

describe('canSee with smoke', () => {
  it('sees the enemy when there is no smoke', () => {
    const { state, bot, enemy } = setup();
    expect(canSee(state, bot, enemy, NOW)).toBe(true);
  });

  it('does not see through a cloud between them', () => {
    const { state, bot, enemy } = setup();
    spawnSmoke(state, { x: 150, y: -40 }, NOW);
    expect(canSee(state, bot, enemy, NOW)).toBe(false);
  });

  it('does not see an enemy standing in a cloud', () => {
    const { state, bot, enemy } = setup();
    spawnSmoke(state, { x: 300, y: BODY_CENTER_Y }, NOW);
    expect(canSee(state, bot, enemy, NOW)).toBe(false);
  });

  it('still sees out of a cloud the bot itself stands in', () => {
    const { state, bot, enemy } = setup();
    spawnSmoke(state, { x: 0, y: -50 }, NOW);
    expect(canSee(state, bot, enemy, NOW)).toBe(true);
  });

  it('sees again once the cloud has expired', () => {
    const { state, bot, enemy } = setup();
    spawnSmoke(state, { x: 150, y: -40 }, NOW);
    expect(canSee(state, bot, enemy, NOW + 5000)).toBe(false); // mid-life, still thick
    expect(canSee(state, bot, enemy, NOW + SMOKE_DURATION_MS)).toBe(true);
  });
});

describe('fallback target with nobody in sight', () => {
  // Bot at 0; enemy A 200 px right, enemy B 600 px left; walls on both sides hide both
  const setupTwo = () => {
    clearBotMemory();
    const state = makeState();
    const bot = makeBot('bot1', Team.RED, 0, 0) as any;
    const near = makeBot('near', Team.BLUE, 200, 0) as any;
    const far = makeBot('far', Team.BLUE, -600, 0) as any;
    state.players = [bot, near, far];
    state.platforms = [
      { id: 'wallR', x: 100, y: -200, w: 20, h: 300, color: '#000' },
      { id: 'wallL', x: -120, y: -200, w: 20, h: 300, color: '#000' },
    ];
    return { state, bot, near, far, mem: getBotMemory(bot) };
  };

  it('with no smoke heads for the nearest enemy', () => {
    const { state, bot, mem } = setupTwo();
    expect(senseTarget(state, bot, mem, NOW)?.id).toBe('near');
  });

  it('prefers a wall-hidden enemy over a nearer one hidden in smoke', () => {
    const { state, bot, mem } = setupTwo();
    spawnSmoke(state, { x: 200, y: BODY_CENTER_Y }, NOW);
    expect(senseTarget(state, bot, mem, NOW)?.id).toBe('far');
    expect(mem.targetVisible).toBe(false);
  });

  it('falls back to a smoke-hidden enemy when it is the only one', () => {
    const { state, bot, far, mem } = setupTwo();
    state.players = state.players.filter((p: any) => p !== far);
    spawnSmoke(state, { x: 200, y: BODY_CENTER_Y }, NOW);
    expect(senseTarget(state, bot, mem, NOW)?.id).toBe('near');
  });
});
