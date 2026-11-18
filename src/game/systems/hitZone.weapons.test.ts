import { describe, it, expect } from 'vitest';
import { Entity, GameMode, Team, WeaponType } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import type { BodyId } from '../build/bodyTypes';
import { fireWeapon, shotOrigin } from './combat';
import { FLAME_HALF_ANGLE } from './flameConstants';
import { updatePhysics } from './physics';

// The owner shot a cat in the face and its health did not drop: the shot passed over the movement box.
// Each weapon fires level at 85 units above the target's feet: above the 72-unit box, at the cat's eyes.

const EYES = 85;

const target = (body: BodyId | undefined): Entity => {
    const t = createMockPlayer('t', Team.NONE);
    t.pos = { x: 200, y: 500 };
    t.armor = 0;
    t.build = body ? { ...t.build!, body } : undefined;
    if (!body) t.skinId = 'classic';
    return t;
};

/** A shooter whose muzzle line runs level through the target's eye height. */
const scene = (weapon: WeaponType, body: BodyId | undefined) => {
    const state = createMockState(GameMode.DEATHMATCH);
    const shooter = createMockPlayer('s', Team.NONE, weapon);
    const victim = target(body);
    shooter.pos = { x: 0, y: 500 };
    state.players.push(shooter, victim);
    return { state, shooter, victim };
};

/** Fire `weapon` level at the eye height; the muzzle is moved onto that line. */
const fireLevel = (weapon: WeaponType, body: BodyId | undefined) => {
    const { state, shooter, victim } = scene(weapon, body);
    const muzzleY = victim.pos.y - EYES;
    // shotOrigin sits 50 above the feet when standing: lift the shooter so the muzzle is at eye height
    shooter.pos.y = muzzleY + 50;
    shooter.lastFired = 0;
    fireWeapon(state, shooter, { x: victim.pos.x, y: muzzleY });
    return victim;
};

/**
 * Flame from above, aimed so the cone's lowest ray crosses the target's line at eye height and the
 * other two rays pass higher: only a hit zone that covers the head can be touched.
 */
const flameGrazingEyes = (body: BodyId | undefined) => {
    const { state, shooter, victim } = scene(WeaponType.FLAMETHROWER, body);
    shooter.pos.y = victim.pos.y - EYES - 40 + 50; // muzzle 40 above eye height
    shooter.lastFired = 0;
    const origin = shotOrigin(shooter);
    const lowest = Math.atan2(victim.pos.y - EYES - origin.y, victim.pos.x - origin.x);
    const aim = lowest - FLAME_HALF_ANGLE; // y grows downward: the lowest ray is aim + half angle
    fireWeapon(state, shooter, { x: origin.x + Math.cos(aim) * 100, y: origin.y + Math.sin(aim) * 100 });
    return victim;
};

const projectileLevel = (body: BodyId | undefined) => {
    const { state, victim } = scene(WeaponType.MACHINE_GUN, body);
    state.projectiles.push({
        id: 'shot', ownerId: 's', type: WeaponType.MACHINE_GUN, active: true, radius: 4,
        pos: { x: 160, y: victim.pos.y - EYES }, vel: { x: 30, y: 0 },
    });
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');
    return victim;
};

describe('a shot at the cat face hurts the cat', () => {
    it('a bullet', () => {
        expect(projectileLevel('cat').health).toBeLessThan(100);
    });

    it('a railgun beam', () => {
        expect(fireLevel(WeaponType.RAILGUN, 'cat').health).toBeLessThan(100);
    });

    it('a flame whose lowest ray grazes the eyes', () => {
        expect(flameGrazingEyes('cat').health).toBeLessThan(100);
    });

    it('the same shots still fly over a fighter drawn no taller than its box', () => {
        expect(projectileLevel(undefined).health).toBe(100);
        expect(fireLevel(WeaponType.RAILGUN, undefined).health).toBe(100);
        expect(flameGrazingEyes(undefined).health).toBe(100);
    });
});
