import { describe, it, expect } from 'vitest';
import { FighterAnimator } from './fighterAnimator';
import { createMockPlayer, createMockState } from '../../../test/mocks';
import { GameMode, Team, WeaponType } from '../../../types';
import { WEAPONS_DATA } from '../../../constants';

const magazines = (game: ReturnType<typeof createMockState>) => game.particles.filter(p => p.type === 'magazine');

const setup = () => {
    const game = createMockState(GameMode.DEATHMATCH);
    const p = createMockPlayer('a', Team.BLUE);
    p.pos = { x: 100, y: 500 };
    return { game, p, animator: new FighterAnimator() };
};

describe('the dropped magazine', () => {
    it('falls out once when a reload starts, near the gun', () => {
        const { game, p, animator } = setup();
        animator.frame(p, 0, 1000, {}, game);
        p.weapon.ammo = 0;
        p.weapon.reloadEndsAt = 2000;
        animator.frame(p, 0, 1016, {}, game);
        // Online the timer jitters by a few ms between snapshots: still the same reload
        p.weapon.reloadEndsAt = 2004;
        animator.frame(p, 0, 1032, {}, game);
        const mags = magazines(game);
        expect(mags).toHaveLength(1);
        expect(Math.abs(mags[0].pos.x - 100)).toBeLessThan(40);
        expect(mags[0].pos.y).toBeLessThan(500);
    });

    it('drops nothing for a fighter first seen mid-reload, or on switching back to a reloading gun', () => {
        const { game, p, animator } = setup();
        p.weapon.reloadEndsAt = 2000;
        animator.frame(p, 0, 1000, {}, game);
        const machineGun = p.weapon;
        p.weapon = { ...WEAPONS_DATA[WeaponType.SHOTGUN] };
        animator.frame(p, 0, 1016, {}, game);
        p.weapon = machineGun;
        animator.frame(p, 0, 1032, {}, game);
        expect(magazines(game)).toHaveLength(0);
    });

    it('lowers the gun in the middle of the reload', () => {
        const { game, p, animator } = setup();
        p.weapon.reloadEndsAt = 1500; // 1000 ms reload, half done at t = 1000
        const lowered = animator.frame(p, 0, 1000, {}, game).pose.gunAngle;
        expect(lowered).toBeGreaterThan(0.8);
    });
});
