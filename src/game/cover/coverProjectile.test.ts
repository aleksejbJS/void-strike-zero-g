import { describe, it, expect } from 'vitest';
import { Team, WeaponType } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { castRay } from '../systems/combat';
import { piece, stateWithCover, tick } from './coverTestKit';

/** A machine-gun bullet at (60, -50) moving `speed` px per tick to the right. */
const bullet = (speed: number) => ({
    id: 'b', ownerId: 'shooter', type: WeaponType.MACHINE_GUN, pos: { x: 60, y: -50 }, vel: { x: speed, y: 0 }, active: true, radius: 4,
});

describe('projectiles and cover', () => {
    it('a bullet stops at cover and does not reach the fighter behind it', () => {
        const wood = piece('w', 'wood', 100, -27); // x 75..125
        const state = stateWithCover(wood);
        const behind = createMockPlayer('behind', Team.NONE);
        behind.pos = { x: 160, y: 0 };
        state.players.push(behind);
        state.projectiles.push(bullet(120)); // one tick covers both the crate and the fighter

        tick(state);

        expect(wood.hp).toBe(150 - 6);
        expect(behind.health).toBe(100);
        expect(state.projectiles).toHaveLength(0);
    });

    it('a platform in front of the cover takes the shot instead', () => {
        const wood = piece('w', 'wood', 100, -27);
        const state = stateWithCover(wood);
        state.platforms.push({ id: 'wall', x: 65, y: -500, w: 5, h: 1000, color: '#000' });
        state.projectiles.push(bullet(120));

        tick(state);

        expect(wood.hp).toBe(150);
        expect(state.projectiles).toHaveLength(0);
    });

    it('cover in front of a platform takes the shot', () => {
        const wood = piece('w', 'wood', 100, -27);
        const state = stateWithCover(wood);
        state.platforms.push({ id: 'wall', x: 130, y: -500, w: 5, h: 1000, color: '#000' });
        state.projectiles.push(bullet(120));

        tick(state);

        expect(wood.hp).toBe(150 - 6);
    });

    it('broken cover lets a bullet through', () => {
        const wood = piece('w', 'wood', 100, -27, 0);
        const state = stateWithCover(wood);
        const behind = createMockPlayer('behind', Team.NONE);
        behind.pos = { x: 160, y: 0 };
        state.players.push(behind);
        state.projectiles.push(bullet(120));

        tick(state);

        expect(behind.health).toBe(100 - 6);
    });

    it('grapple hook passes through cover', () => {
        const state = stateWithCover(piece('w', 'wood', 100, -27), piece('g', 'glass', 150, -5));
        const ahead = { x: 1, y: 0 };

        expect(castRay(state, { x: 0, y: -50 }, ahead, 300)).toBeNull();

        state.platforms.push({ id: 'wall', x: 250, y: -500, w: 20, h: 1000, color: '#000' });
        expect(castRay(state, { x: 0, y: -50 }, ahead, 300)!.x).toBeGreaterThanOrEqual(250); // only the platform catches it
    });
});
