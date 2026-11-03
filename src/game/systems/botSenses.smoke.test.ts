import { describe, it, expect } from 'vitest';
import { Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { canSee } from './botSenses';
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
