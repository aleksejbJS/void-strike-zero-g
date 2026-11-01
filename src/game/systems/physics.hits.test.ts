import { describe, it, expect } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { createExplosion } from './combat';
import { updatePhysics } from './physics';

const tick = (state: ReturnType<typeof createMockState>) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');

const wall = { id: 'wall', x: 200, y: -500, w: 40, h: 1000, color: '#000' };

describe('Explosions', () => {
    it('do not hurt players behind a wall', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const hidden = createMockPlayer('hidden', Team.NONE);
        hidden.pos = { x: 260, y: 100 };
        state.platforms.push(wall);
        state.players.push(hidden);

        createExplosion(state, { x: 180, y: 80 }, 'someone', 150, WeaponType.ROCKET_LAUNCHER);

        expect(hidden.health).toBe(100);
    });

    it('a rocket hitting a wall explodes on the near side', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const near = createMockPlayer('near', Team.NONE);
        const far = createMockPlayer('far', Team.NONE);
        near.pos = { x: 170, y: 100 };
        far.pos = { x: 270, y: 100 };
        state.platforms.push(wall);
        state.players.push(near, far);
        state.projectiles.push({ id: 'r', ownerId: 'shooter', type: WeaponType.ROCKET_LAUNCHER, pos: { x: 195, y: 70 }, vel: { x: 14, y: 0 }, active: true, radius: 4 });

        tick(state);

        expect(near.health).toBeLessThan(100);
        expect(far.health).toBe(100);
    });
});

describe('Bullets', () => {
    it('hit only the first player in their path', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const front = createMockPlayer('front', Team.NONE);
        const back = createMockPlayer('back', Team.NONE);
        front.pos = { x: 100, y: 100 };
        back.pos = { x: 110, y: 100 };
        state.players.push(back, front); // order in the list must not matter
        state.projectiles.push({ id: 'b', ownerId: 'shooter', type: WeaponType.MACHINE_GUN, pos: { x: 60, y: 70 }, vel: { x: 60, y: 0 }, active: true, radius: 4 });

        tick(state);

        expect(front.health).toBe(100 - WEAPONS_DATA[WeaponType.MACHINE_GUN].damage);
        expect(back.health).toBe(100);
    });
});
