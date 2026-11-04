import { describe, it, expect } from 'vitest';
import { Team, WeaponType } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { fireWeapon } from '../systems/combat';
import { piece, stateWithCover } from './coverTestKit';

/** A standing shooter at (0, 0) with the given weapon (muzzle at y = -50), and an enemy 400 px to the right. */
const duel = (weapon: WeaponType, ...cover: ReturnType<typeof piece>[]) => {
    const state = stateWithCover(...cover);
    const shooter = createMockPlayer('shooter', Team.NONE, weapon);
    const enemy = createMockPlayer('enemy', Team.NONE);
    enemy.pos = { x: 400, y: 0 }; // body spans x 385..415 and y -72..0, so the level beam at y = -50 hits it
    state.players.push(shooter, enemy);
    return { state, shooter, enemy };
};

describe('railgun beam through cover', () => {
    it('rail passes wood and glass and hits the fighter behind', () => {
        const wood = piece('wood', 'wood', 100, -27);
        const glass = piece('glass', 'glass', 200, -5);
        const { state, shooter, enemy } = duel(WeaponType.RAILGUN, wood, glass);

        fireWeapon(state, shooter, { x: 400, y: -50 });

        expect(enemy.dead).toBe(true);
        expect(wood.hp).toBe(0); // 200 damage each
        expect(glass.hp).toBe(0);
        expect(state.beams![0].end.x).toBeCloseTo(385, 0); // the beam ran on to the fighter
    });

    it('rail stops in metal', () => {
        const before = piece('before', 'wood', 40, -27);
        const metal = piece('metal', 'metal', 100, -27);
        const behind = piece('behind', 'wood', 200, -27);
        const { state, shooter, enemy } = duel(WeaponType.RAILGUN, before, metal, behind);

        fireWeapon(state, shooter, { x: 400, y: -50 });

        expect(enemy.health).toBe(100);
        expect(metal.hp).toBe(300);
        expect(before.hp).toBe(0); // crossed on the way in
        expect(behind.hp).toBe(150); // never reached
        expect(state.beams![0].end.x).toBeCloseTo(75, 0); // the beam ends on the metal's face
    });

    it('rail stops in a barrel and sets it off at once', () => {
        const barrel = piece('barrel', 'barrel', 100, -27);
        const { state, shooter, enemy } = duel(WeaponType.RAILGUN, barrel);

        fireWeapon(state, shooter, { x: 400, y: -50 });

        expect(enemy.health).toBe(100);
        expect(barrel.hp).toBe(0);
        expect(barrel.fuseAt).toBe(barrel.returnsAt! - 35000); // lit with no chain delay
    });

    it('a fighter in front of the cover takes the beam and the cover behind is spared', () => {
        const wood = piece('wood', 'wood', 300, -27);
        const { state, shooter, enemy } = duel(WeaponType.RAILGUN);
        enemy.pos = { x: 200, y: 0 };
        state.cover = [wood];

        fireWeapon(state, shooter, { x: 400, y: -50 });

        expect(enemy.dead).toBe(true);
        expect(wood.hp).toBe(150);
    });
});

describe('chainsaw against cover', () => {
    // Aiming at (200, -50) puts the saw point 70 px out, at (70, -50)
    const sawAt = (rectLeft: number) => {
        const wood = piece('wood', 'wood', rectLeft + 25, -27);
        const { state, shooter } = duel(WeaponType.CHAINSAW, wood);
        fireWeapon(state, shooter, { x: 200, y: -50 });
        return wood;
    };

    it('cuts a piece whose rect is within 40 px of the saw point', () => {
        expect(sawAt(110).hp).toBe(120); // 40 px away: 30 per tick
    });

    it('leaves a piece further than that alone', () => {
        expect(sawAt(111).hp).toBe(150);
    });
});
