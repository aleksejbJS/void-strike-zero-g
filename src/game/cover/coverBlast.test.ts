import { describe, it, expect } from 'vitest';
import { Team, WeaponType } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { createExplosion } from '../systems/explosion';
import { BARREL_CHAIN_MS, COVER_RETURN_MS } from './coverTypes';
import { piece, stateWithCover } from './coverTestKit';

const ROCKET = WeaponType.ROCKET_LAUNCHER; // 65 damage, ×3 against cover = 195
const blast = (state: ReturnType<typeof stateWithCover>, x: number, y: number, directCoverId?: string) =>
    createExplosion(state, { x, y }, 'owner', 150, ROCKET, undefined, { directCoverId });

describe('blast against cover', () => {
    it('the piece the projectile hit takes damage x3 whatever the distance', () => {
        const metal = piece('m', 'metal', 900, 0);
        const state = stateWithCover(metal);

        blast(state, 100, -23, 'm');

        expect(metal.hp).toBe(500 - 195);
    });

    it('other cover in the radius takes damage x3 with falloff from its centre', () => {
        const wood = piece('w', 'wood', 300, 0); // centre (300, -23)
        const state = stateWithCover(wood);

        blast(state, 225, -23); // 75 px away: half of 195

        expect(wood.hp).toBeCloseTo(150 - 97.5, 5);
    });

    it('opts.damage replaces the weapon damage as the blast base', () => {
        const wood = piece('w', 'wood', 900, 0);
        const state = stateWithCover(wood);

        createExplosion(state, { x: 100, y: -23 }, 'owner', 150, ROCKET, undefined, { directCoverId: 'w', damage: 30 });

        expect(wood.hp).toBe(150 - 90); // 30 × 3
    });

    it('cover outside the radius is untouched', () => {
        const wood = piece('w', 'wood', 450, 0);
        const state = stateWithCover(wood);

        blast(state, 225, -23);

        expect(wood.hp).toBe(150);
    });

    it('blast behind a platform does not reach cover', () => {
        const wood = piece('w', 'wood', 260, 0);
        const state = stateWithCover(wood);
        state.platforms.push({ id: 'wall', x: 200, y: -500, w: 15, h: 1000, color: '#000' });

        blast(state, 150, -23);
        expect(wood.hp).toBe(150);

        state.platforms.length = 0; // the same blast with the wall gone does hurt
        blast(state, 150, -23);
        expect(wood.hp).toBeLessThan(150);
    });

    it('a fighter behind an intact crate is shielded from a blast', () => {
        const crate = piece('c', 'metal', 300, 0); // spans x 275..325
        const state = stateWithCover(crate);
        const hidden = createMockPlayer('hidden', Team.NONE);
        hidden.pos = { x: 345, y: 0 };
        state.players.push(hidden);

        blast(state, 250, -23, 'c'); // the rocket hit the crate: the crate takes it, the fighter does not
        expect(hidden.health).toBe(100);
        expect(crate.hp).toBe(305);

        crate.hp = 0; // with the crate gone the same blast reaches the fighter
        blast(state, 250, -23);
        expect(hidden.health).toBeLessThan(100);
    });

    it('a blast that breaks a barrel sets it off after the chain delay, credited to the owner', () => {
        const barrel = piece('b', 'barrel', 300, 0);
        const state = stateWithCover(barrel);

        blast(state, 250, -23, 'b');

        expect(barrel.hp).toBe(0);
        expect(barrel.creditId).toBe('owner');
        expect(barrel.returnsAt! - barrel.fuseAt!).toBe(COVER_RETURN_MS - BARREL_CHAIN_MS);
    });
});
