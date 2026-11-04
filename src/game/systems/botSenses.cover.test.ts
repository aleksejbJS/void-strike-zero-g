import { describe, it, expect } from 'vitest';
import { Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { piece } from '../cover/coverTestKit';
import { aimPointOf, botHasLineOfSight, canSee, centerOf, muzzleOf } from './botSenses';

// Bot and enemy 300 px apart on open ground (pos = centre-x, bottom-y), a piece of cover halfway;
// the enemy crouches (45 px), so a 46 px crate hides all of it
const setup = (kind: 'wood' | 'metal' | 'glass' | 'barrel', hp?: number) => {
  const state = { ...makeState(), cover: [piece('c', kind, 150, 0, hp)] };
  const bot = makeBot('bot1', Team.RED, 0, 0) as any;
  const enemy = { ...makeBot('enemy', Team.BLUE, 300, 0), height: 45, isCrouching: true } as any;
  state.players = [bot, enemy];
  return { state, bot, enemy };
};

describe('bot sight and cover', () => {
  it('glass does not block sight, wood does', () => {
    const glass = setup('glass');
    expect(botHasLineOfSight(glass.state, muzzleOf(glass.bot), centerOf(glass.enemy))).toBe(true);
    expect(canSee(glass.state, glass.bot, glass.enemy, 1000)).toBe(true);
    const wood = setup('wood');
    expect(botHasLineOfSight(wood.state, muzzleOf(wood.bot), centerOf(wood.enemy))).toBe(false);
    expect(canSee(wood.state, wood.bot, wood.enemy, 1000)).toBe(false);
  });

  it('metal and barrels block sight too, a broken crate does not', () => {
    for (const kind of ['metal', 'barrel'] as const) {
      const s = setup(kind);
      expect(canSee(s.state, s.bot, s.enemy, 1000)).toBe(false);
    }
    const broken = setup('wood', 0);
    expect(canSee(broken.state, broken.bot, broken.enemy, 1000)).toBe(true);
  });

  it('sees and aims at the head of a fighter standing behind a crate', () => {
    const s = setup('wood');
    s.enemy.height = 72;
    expect(canSee(s.state, s.bot, s.enemy, 1000)).toBe(true);
    expect(aimPointOf(s.state, s.bot, s.enemy).y).toBeLessThan(-46); // above the crate's top
    // A bot pressed against its own crate shoots over it at a close standing enemy too
    s.state.cover = [piece('mine', 'wood', 43, 0)];
    s.enemy.pos.x = 143;
    expect(canSee(s.state, s.bot, s.enemy, 1000)).toBe(true);
  });
});
