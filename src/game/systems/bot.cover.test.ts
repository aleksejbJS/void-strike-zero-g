import { describe, it, expect, beforeEach } from 'vitest';
import { Entity, GameState, Team, Vector2, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { makeState, makeBot } from '../../test/botFixtures';
import { piece } from '../cover/coverTestKit';
import { Cover } from '../cover/coverTypes';
import { clearBotMemory, updateBotAI } from './bot';

beforeEach(() => clearBotMemory());

// A long floor at y 0 (pos = centre-x, bottom-y); the bot at x `botX`, one enemy at `enemyX`
const setup = (cover: Cover[], botX: number, enemyX: number, crouchedEnemy = false) => {
  const state: GameState = { ...makeState(), cover };
  state.platforms = [{ id: 'floor', x: -1000, y: 0, w: 3000, h: 100, color: '#000' }];
  const bot = makeBot('bot', Team.NONE, botX, 0) as unknown as Entity;
  const enemy = { ...makeBot('enemy', Team.NONE, enemyX, 0), ...(crouchedEnemy ? { height: 45, isCrouching: true } : {}) } as unknown as Entity;
  state.players = [bot, enemy];
  const shots: { at: Vector2; height: number }[] = [];
  const think = (now: number) => updateBotAI(bot, state, now, (b, at) => shots.push({ at, height: b.height }));
  return { state, bot, enemy, shots, think };
};

describe('bots and cover', () => {
  it('crouches behind a crate when an enemy is close and stands up to shoot', () => {
    // Crate at 100 between the bot and the enemy; the far-side spot is x 57
    const { bot, shots, think } = setup([piece('crate', 'wood', 100, 0)], 57, 200);
    const first = think(10_000); // just spotted: the reaction time runs, no shot yet
    expect(first).toMatchObject({ inputX: 0, wantsDown: true });
    Object.assign(bot, { isCrouching: true, height: 45 }); // what applyStance does with it
    const second = think(11_000);
    expect(shots).toHaveLength(1);
    expect(shots[0].height).toBe(72); // fired standing
    expect(second.wantsDown).toBe(false); // and stays up right after the shot
  });

  it('shoots the crate a crouching enemy hides behind', () => {
    const { shots, think } = setup([piece('crate', 'wood', 250, 0)], 0, 300, true);
    think(10_000);
    expect(shots).toHaveLength(1);
    expect(Math.abs(shots[0].at.x - 250)).toBeLessThan(12); // the crate's middle, give or take the spread
  });

  it('fires a railgun at the enemy through wood, not through metal', () => {
    const wood = setup([piece('crate', 'wood', 250, 0)], 0, 300, true);
    wood.bot.weapon = { ...WEAPONS_DATA[WeaponType.RAILGUN] };
    wood.bot.inventory = [wood.bot.weapon];
    wood.think(10_000);
    expect(wood.shots).toHaveLength(1);
    expect(Math.abs(wood.shots[0].at.x - 300)).toBeLessThan(15);

    const metal = setup([piece('plate', 'metal', 250, 0)], 0, 300, true);
    metal.bot.weapon = { ...WEAPONS_DATA[WeaponType.RAILGUN] };
    metal.bot.inventory = [metal.bot.weapon];
    metal.think(10_000);
    expect(metal.shots).toHaveLength(0);
  });

  it('shoots a barrel next to an enemy instead of the enemy', () => {
    const { shots, think } = setup([piece('keg', 'barrel', 300, 0)], 0, 400);
    think(10_000);
    think(11_000);
    expect(shots).toHaveLength(1);
    expect(Math.abs(shots[0].at.x - 300)).toBeLessThan(12);
  });

  // The flamethrower reaches FLAME_RANGE only: a crate within reach is burned, one beyond it is left to the machine gun
  const withFlamethrower = (cover: Cover[], enemyX: number) => {
    const ctx = setup(cover, 0, enemyX, true);
    ctx.bot.inventory = [{ ...WEAPONS_DATA[WeaponType.MACHINE_GUN] }, { ...WEAPONS_DATA[WeaponType.FLAMETHROWER] }];
    ctx.bot.weapon = ctx.bot.inventory[1];
    return ctx;
  };

  it('burns a crate within the flamethrower reach', () => {
    const { bot, shots, think } = withFlamethrower([piece('crate', 'wood', 150, 0)], 200);
    think(10_000);
    expect(bot.weapon.type).toBe(WeaponType.FLAMETHROWER);
    expect(shots).toHaveLength(1);
    expect(Math.abs(shots[0].at.x - 150)).toBeLessThan(25);
  });

  it('puts the flamethrower away for a crate beyond its reach', () => {
    const { bot, shots, think } = withFlamethrower([piece('crate', 'wood', 400, 0)], 450);
    think(10_000);
    expect(bot.weapon.type).toBe(WeaponType.MACHINE_GUN);
    expect(shots).toHaveLength(1);
  });
});
