import { describe, it, expect } from 'vitest';
import { WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { COVER_SPECS, CoverKind } from '../cover/coverTypes';
import { piece } from '../cover/coverTestKit';
import { FLAME_COVER_MULT } from './flameConstants';
import { arena, enemyAt, spray, MUZZLE_Y } from './flameTestKit';

const DAMAGE = WEAPONS_DATA[WeaponType.FLAMETHROWER].damage;

describe('flame stream and walls', () => {
    it('is stopped by a platform: an enemy behind it is untouched', () => {
        const { state, shooter } = arena();
        state.platforms.push({ id: 'wall', x: 100, y: -500, w: 20, h: 1000, color: '#000' });
        const foe = enemyAt(state, 'foe', 200);
        spray(state, shooter);
        expect(foe.health).toBe(100);
    });

    it('still burns an enemy standing in front of the platform', () => {
        const { state, shooter } = arena();
        state.platforms.push({ id: 'wall', x: 200, y: -500, w: 20, h: 1000, color: '#000' });
        const foe = enemyAt(state, 'foe', 150);
        spray(state, shooter);
        expect(foe.health).toBe(100 - DAMAGE);
    });

    it('is stopped by a wood crate, which takes one tick of damage times its multiplier', () => {
        const { state, shooter } = arena();
        const crate = piece('c1', 'wood', 100, MUZZLE_Y + COVER_SPECS.wood.h / 2);
        state.cover = [crate];
        const foe = enemyAt(state, 'foe', 250);
        spray(state, shooter);
        expect(crate.hp).toBe(COVER_SPECS.wood.hp - DAMAGE * FLAME_COVER_MULT.wood);
        expect(crate.hp).toBe(140);
        expect(foe.health).toBe(100);
    });

    it.each(['wood', 'metal', 'glass', 'barrel'] as CoverKind[])('hurts a %s piece by the flame multiplier of that kind', kind => {
        const { state, shooter } = arena();
        const cover = piece('c1', kind, 100, MUZZLE_Y + COVER_SPECS[kind].h / 2);
        state.cover = [cover];
        spray(state, shooter);
        expect(COVER_SPECS[kind].hp - cover.hp).toBeCloseTo(DAMAGE * FLAME_COVER_MULT[kind]);
    });

    it('hurts every distinct piece a ray stops at, each once', () => {
        const { state, shooter } = arena();
        // The upper crate catches the level and the upward rays, the lower one the downward ray
        const upper = piece('upper', 'wood', 100, -41);
        const lower = piece('lower', 'wood', 100, 7);
        state.cover = [upper, lower];
        spray(state, shooter);
        expect(upper.hp).toBe(COVER_SPECS.wood.hp - DAMAGE * FLAME_COVER_MULT.wood);
        expect(lower.hp).toBe(COVER_SPECS.wood.hp - DAMAGE * FLAME_COVER_MULT.wood);
    });

    it('does not reach a crate beyond its range', () => {
        const { state, shooter } = arena();
        const crate = piece('c1', 'wood', 340, MUZZLE_Y + COVER_SPECS.wood.h / 2);
        state.cover = [crate];
        spray(state, shooter);
        expect(crate.hp).toBe(COVER_SPECS.wood.hp);
    });

    it('does not damage cover behind a platform', () => {
        const { state, shooter } = arena();
        state.platforms.push({ id: 'wall', x: 60, y: -500, w: 20, h: 1000, color: '#000' });
        const crate = piece('c1', 'wood', 150, MUZZLE_Y + COVER_SPECS.wood.h / 2);
        state.cover = [crate];
        spray(state, shooter);
        expect(crate.hp).toBe(COVER_SPECS.wood.hp);
    });

    it('burns through a broken piece', () => {
        const { state, shooter } = arena();
        const crate = piece('c1', 'wood', 100, MUZZLE_Y + COVER_SPECS.wood.h / 2, 0);
        state.cover = [crate];
        const foe = enemyAt(state, 'foe', 250);
        spray(state, shooter);
        expect(foe.health).toBe(100 - DAMAGE);
    });
});
