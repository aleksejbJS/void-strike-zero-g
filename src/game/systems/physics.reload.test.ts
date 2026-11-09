import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameMode, ItemType, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updatePhysics } from './physics';

const T0 = 2_000_000;
const tick = (state: ReturnType<typeof createMockState>) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'p1');

const fighter = (type: 'player' | 'bot') => {
    const state = createMockState(GameMode.DEATHMATCH);
    const p = createMockPlayer('p1', Team.NONE);
    p.type = type;
    p.pos = { x: 100, y: 100 };
    p.inventory = [p.weapon];
    state.players.push(p);
    return { state, p };
};

afterEach(() => { vi.useRealTimers(); });

describe('reloading inside the game loop', () => {
    it('refills an empty Machine Gun a second after it ran dry, for a bot as well', () => {
        vi.useFakeTimers({ now: T0 });
        const { state, p } = fighter('bot');
        p.weapon.ammo = 0;
        tick(state);
        expect(p.weapon.reloadEndsAt).toBe(T0 + 1000);

        vi.setSystemTime(T0 + 999);
        tick(state);
        expect(p.weapon.ammo).toBe(0);

        vi.setSystemTime(T0 + 1000);
        tick(state);
        expect(p.weapon.ammo).toBe(50);
    });

    it('lets an ammo box fill other weapons but not the Machine Gun magazine', () => {
        const { state, p } = fighter('player');
        p.weapon.ammo = 10;
        const shotgun = { ...WEAPONS_DATA[WeaponType.SHOTGUN], ammo: 5 };
        p.inventory.push(shotgun);
        state.pickups.push({ id: 'a', type: ItemType.AMMO, pos: { x: 100, y: 90 }, active: true, respawnTime: 0, value: 30 });
        tick(state);
        expect(state.pickups[0].active).toBe(false);
        expect(shotgun.ammo).toBe(35);
        expect(p.weapon.ammo).toBe(10);
    });

    it('leaves a spare Machine Gun lying when the fighter already carries one', () => {
        const { state, p } = fighter('player');
        p.weapon.ammo = 10;
        state.pickups.push({ id: 'w', type: ItemType.WEAPON, subtype: WeaponType.MACHINE_GUN, pos: { x: 100, y: 90 }, active: true, respawnTime: 0, value: 0 });
        tick(state);
        expect(state.pickups[0].active).toBe(true);
        expect(p.weapon.ammo).toBe(10);
        expect(p.inventory).toHaveLength(1);
    });
});
