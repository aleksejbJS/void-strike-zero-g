import { describe, it, expect } from 'vitest';
import { ItemType, Pickup, Team, WeaponType } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { findWeaponPickup } from './botWeapons';

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
