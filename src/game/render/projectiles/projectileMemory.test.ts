import { describe, it, expect } from 'vitest';
import { ProjectileMemory, firstPelletPerOwner, projectileAge } from './projectileMemory';
import { Projectile, WeaponType } from '../../../types';

const proj = (extra: Partial<Projectile>): Projectile =>
    ({ id: 'p', ownerId: 'o', pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 }, type: WeaponType.MACHINE_GUN, radius: 4, active: true, ...extra });

describe('ProjectileMemory', () => {
    it('keeps at most 7 remembered positions, newest first', () => {
        const m = new ProjectileMemory();
        for (let i = 0; i < 12; i++) m.remember('a', { x: i, y: 0 });
        const trail = m.trail('a');
        expect(trail).toHaveLength(7);
        expect(trail.map(q => q.x)).toEqual([11, 10, 9, 8, 7, 6, 5]);
    });

    it('forgets ids that are no longer live and reports size 0', () => {
        const m = new ProjectileMemory();
        for (let i = 0; i < 200; i++) m.remember(`p${i}`, { x: i, y: 0 });
        expect(m.size).toBe(200);
        m.forgetMissing(new Set());
        expect(m.size).toBe(0);
        expect(m.trail('p3')).toEqual([]);
    });

    it('keeps the ids that are still live', () => {
        const m = new ProjectileMemory();
        m.remember('keep', { x: 1, y: 2 });
        m.remember('drop', { x: 3, y: 4 });
        m.forgetMissing(new Set(['keep']));
        expect(m.size).toBe(1);
        expect(m.trail('keep')).toEqual([{ x: 1, y: 2 }]);
    });

    it('stores a copy, so a projectile moving its position vector does not rewrite history', () => {
        const m = new ProjectileMemory();
        const pos = { x: 5, y: 5 };
        m.remember('a', pos);
        pos.x = 99;
        m.remember('a', { x: 6, y: 5 });
        expect(m.trail('a').map(q => q.x)).toEqual([6, 5]);
    });

    it('does not record the same spot twice in a row (a frame without a physics tick)', () => {
        const m = new ProjectileMemory();
        m.remember('a', { x: 1, y: 1 });
        m.remember('a', { x: 1, y: 1 });
        expect(m.trail('a')).toHaveLength(1);
    });
});

describe('projectileAge', () => {
    it('derives a grenade age from its remaining life', () => {
        expect(projectileAge({ type: WeaponType.GRENADE_LAUNCHER, life: 45 } as Projectile)).toBe(15);
    });

    it('is 0 for a projectile without a life counter and counts from 360 for bullets', () => {
        expect(projectileAge(proj({}))).toBe(0);
        expect(projectileAge(proj({ life: 300 }))).toBe(60);
    });
});

describe('firstPelletPerOwner', () => {
    it('picks one shotgun pellet per owner and ignores other weapons', () => {
        const list = [
            proj({ id: 'mg', ownerId: 'a' }),
            proj({ id: 's1', ownerId: 'a', type: WeaponType.SHOTGUN }),
            proj({ id: 's2', ownerId: 'a', type: WeaponType.SHOTGUN }),
            proj({ id: 's3', ownerId: 'b', type: WeaponType.SHOTGUN }),
        ];
        expect(firstPelletPerOwner(list).map(p => p.id)).toEqual(['s1', 's3']);
    });

    it('returns nothing when no pellet is new', () => {
        expect(firstPelletPerOwner([])).toEqual([]);
    });
});
