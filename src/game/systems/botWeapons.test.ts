import { describe, it, expect } from 'vitest';
import { Entity, ItemType, Pickup, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { makeState, makeBot } from '../../test/botFixtures';
import { FLAME_RANGE } from './flameConstants';
import { findWeaponPickup, pickBestWeapon } from './botWeapons';

const rail = (id: string, x: number, y: number): Pickup =>
  ({ id, type: ItemType.WEAPON, subtype: WeaponType.RAILGUN, pos: { x, y }, active: true, respawnTime: 0, value: 0 });

describe('findWeaponPickup', () => {
  // A floor and, far overhead, an island neither the jetpack nor the hook reaches from it
  const setup = () => {
    const state = makeState();
    state.platforms = [
      { id: 'floor', x: -2000, y: 0, w: 4000, h: 200, color: '#000' },
      { id: 'island', x: 100, y: -2000, w: 300, h: 40, color: '#000' },
    ];
    const bot = makeBot('bot1', Team.NONE, 0, 0) as any;
    return { state, bot };
  };

  it('skips a weapon on a surface no route leads to', () => {
    // A bot sent there parks on the nearest surface it can reach and never moves again
    const { state, bot } = setup();
    state.pickups = [rail('island', 200, -2050)];
    expect(findWeaponPickup(state, bot)).toBeNull();
  });

  it('still goes for one it can walk to', () => {
    const { state, bot } = setup();
    state.pickups = [rail('island', 200, -2050), rail('floor', 900, -50)];
    expect(findWeaponPickup(state, bot)?.id).toBe('floor');
  });
});

describe('flamethrower', () => {
  const flameBot = (holding: WeaponType) => {
    const bot = makeBot('bot1', Team.NONE, 0, 0) as unknown as Entity;
    bot.inventory = [{ ...WEAPONS_DATA[WeaponType.MACHINE_GUN] }, { ...WEAPONS_DATA[WeaponType.FLAMETHROWER] }];
    bot.weapon = bot.inventory.find(w => w.type === holding)!;
    return bot;
  };

  it('is picked up close and put away at range', () => {
    const closeBot = flameBot(WeaponType.MACHINE_GUN);
    pickBestWeapon(closeBot, 150);
    expect(closeBot.weapon.type).toBe(WeaponType.FLAMETHROWER);

    const farBot = flameBot(WeaponType.MACHINE_GUN);
    pickBestWeapon(farBot, 500);
    expect(farBot.weapon.type).toBe(WeaponType.MACHINE_GUN);
  });

  it('is swapped for the machine gun when the enemy backs off past its reach', () => {
    const bot = flameBot(WeaponType.FLAMETHROWER);
    pickBestWeapon(bot, FLAME_RANGE + 100);
    expect(bot.weapon.type).toBe(WeaponType.MACHINE_GUN);
  });

  it('is never chosen at the edge of its reach, where the stream barely arrives', () => {
    const bot = flameBot(WeaponType.MACHINE_GUN);
    pickBestWeapon(bot, FLAME_RANGE - 20);
    expect(bot.weapon.type).toBe(WeaponType.MACHINE_GUN);
  });

  it('is worth a detour for a bot without one', () => {
    const state = makeState();
    state.platforms = [{ id: 'floor', x: -2000, y: 0, w: 4000, h: 200, color: '#000' }];
    const bot = makeBot('bot1', Team.NONE, 0, 0) as unknown as Entity;
    state.pickups = [{
      id: 'flame', type: ItemType.WEAPON, subtype: WeaponType.FLAMETHROWER,
      pos: { x: 600, y: -16 }, active: true, respawnTime: 0, value: 0,
    }];
    expect(findWeaponPickup(state, bot)?.id).toBe('flame');
  });
});
