import { describe, it, expect } from 'vitest';
import { ProjectileCatchUp, CATCH_UP_TICKS } from './projectileCatchUp';
import { shotOrigin } from '../systems/combat';
import { createMockPlayer } from '../../test/mocks';
import { Projectile, Team, WeaponType } from '../../types';

const shooter = () => {
    const p = createMockPlayer('s', Team.NONE);
    p.pos = { x: 0, y: 100 };
    return p;
};

const bullet = (x: number, ownerId = 's'): Projectile => ({
    id: 'b', ownerId, pos: { x, y: 50 }, vel: { x: 10, y: 0 },
    type: WeaponType.MACHINE_GUN, radius: 3, active: true,
});

describe('ProjectileCatchUp', () => {
    it('draws a new projectile from its shooter\'s gun, not from where the snapshot put it', () => {
        const catchUp = new ProjectileCatchUp();
        const proj = bullet(200);
        catchUp.advance([proj], [shooter()]);
        const muzzle = shotOrigin(shooter());
        expect(Math.abs(proj.pos.x - muzzle.x)).toBeLessThan(40);
        expect(proj.pos.y).toBeCloseTo(muzzle.y + (50 - muzzle.y) / CATCH_UP_TICKS);
    });

    it('lands exactly on the real flight once caught up', () => {
        const catchUp = new ProjectileCatchUp();
        const proj = bullet(200);
        for (let i = 0; i < CATCH_UP_TICKS; i++) catchUp.advance([proj], [shooter()]);
        expect(proj.pos.x).toBeCloseTo(200 + 10 * CATCH_UP_TICKS);
        expect(proj.pos.y).toBeCloseTo(50);
    });

    it('keeps catching up when a snapshot replaces the projectile mid-way', () => {
        const catchUp = new ProjectileCatchUp();
        catchUp.advance([bullet(200)], [shooter()]);
        const fresh = bullet(210); // the snapshot's real position after one tick
        catchUp.advance([fresh], [shooter()]);
        const real = 220;
        const gapLeft = (shotOrigin(shooter()).x - 200) * (1 - 2 / CATCH_UP_TICKS);
        expect(fresh.pos.x).toBeCloseTo(real + gapLeft);
    });

    it('leaves projectiles alone when the shooter is unknown or far away', () => {
        const catchUp = new ProjectileCatchUp();
        const orphan = bullet(200, 'gone');
        catchUp.advance([orphan], [shooter()]);
        expect(orphan.pos.x).toBe(210);

        const far = { ...bullet(5000), id: 'far' };
        catchUp.advance([far], [shooter()]);
        expect(far.pos.x).toBe(5010);
    });

    it('does not start catching up later for a projectile it already let fly', () => {
        const catchUp = new ProjectileCatchUp();
        const far = bullet(5000);
        catchUp.advance([far], [shooter()]);
        far.pos.x = 100; // flies back past its shooter
        catchUp.advance([far], [shooter()]);
        expect(far.pos.x).toBe(110);
    });
});
