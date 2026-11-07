import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import type { Entity, GameState } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { fireWeapon } from './combat';
import { gameEvents, GameEvent } from './events';
import { arena, enemyAt, spray, MUZZLE_Y, ORIGIN } from './flameTestKit';

const DAMAGE = WEAPONS_DATA[WeaponType.FLAMETHROWER].damage;
const TAN_6 = Math.tan((6 * Math.PI) / 180);
const TAN_15 = Math.tan((15 * Math.PI) / 180);

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

describe('flame stream reach', () => {
    it('burns an enemy 250 px straight ahead for one tick of damage', () => {
        const { state, shooter } = arena();
        const foe = enemyAt(state, 'foe', 250);
        spray(state, shooter);
        expect(foe.health).toBe(100 - DAMAGE);
    });

    it('does not reach an enemy 320 px away', () => {
        const { state, shooter } = arena();
        const foe = enemyAt(state, 'foe', 320);
        spray(state, shooter);
        expect(foe.health).toBe(100);
    });

    it('goes through a fighter: two enemies in a line are both hit', () => {
        const { state, shooter } = arena();
        const near = enemyAt(state, 'near', 150);
        const far = enemyAt(state, 'far', 250);
        spray(state, shooter);
        expect(near.health).toBe(100 - DAMAGE);
        expect(far.health).toBe(100 - DAMAGE);
    });

    it('hits a fighter once per tick even when all three rays cross it', () => {
        const { state, shooter } = arena();
        const foe = enemyAt(state, 'foe', 100);
        spray(state, shooter);
        expect(foe.health).toBe(100 - DAMAGE);
    });

    it('never hurts the shooter, a teammate or a dead fighter', () => {
        const { state, shooter } = arena(Team.BLUE);
        state.mode = GameMode.CTF;
        const mate = enemyAt(state, 'mate', 150, 0, Team.BLUE);
        const corpse = enemyAt(state, 'corpse', 250, 0, Team.RED);
        corpse.dead = true;
        const foe = enemyAt(state, 'foe', 200, 0, Team.RED);
        spray(state, shooter);
        expect(shooter.health).toBe(100);
        expect(mate.health).toBe(100);
        expect(corpse.health).toBe(100);
        expect(foe.health).toBe(100 - DAMAGE);
    });
});

describe('flame stream cone', () => {
    // The enemy's nearest hitbox edge sits `tan` x 200 px off the aim line: only a spread ray can reach it.
    const placeOffAxis = (state: GameState, side: 1 | -1, tan: number): Entity => {
        const offset = 200 * tan;
        // Below the aim line the top edge is the near one, above it the bottom edge
        const feetY = side === 1 ? MUZZLE_Y + offset + 72 : MUZZLE_Y - offset;
        return enemyAt(state, 'foe', 200, feetY);
    };

    it.each([['below', 1], ['above', -1]] as const)('hits an enemy about 6 degrees %s the aim line', (_name, side) => {
        const { state, shooter } = arena();
        const foe = placeOffAxis(state, side, TAN_6);
        spray(state, shooter);
        expect(foe.health).toBe(100 - DAMAGE);
    });

    it.each([['below', 1], ['above', -1]] as const)('misses an enemy about 15 degrees %s the aim line', (_name, side) => {
        const { state, shooter } = arena();
        const foe = placeOffAxis(state, side, TAN_15);
        spray(state, shooter);
        expect(foe.health).toBe(100);
    });

    it('follows the aim direction, not the horizontal', () => {
        const { state, shooter } = arena();
        const dir = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }; // up and to the right
        const target = enemyAt(state, 'target', ORIGIN.x + dir.x * 250, ORIGIN.y + dir.y * 250 + 36);
        const level = enemyAt(state, 'level', 250);
        spray(state, shooter, dir);
        expect(target.health).toBe(100 - DAMAGE);
        expect(level.health).toBe(100);
    });
});

describe('flame stream through fireWeapon', () => {
    const aim = { x: 300, y: MUZZLE_Y };

    it('spends one ammo per call', () => {
        const { state, shooter } = arena();
        const before = shooter.weapon.ammo;
        for (let i = 0; i < 3; i++) fireWeapon(state, shooter, aim);
        expect(shooter.weapon.ammo).toBe(before - 3);
    });

    it('burns the enemy ahead and launches nothing', () => {
        const { state, shooter } = arena();
        const foe = enemyAt(state, 'foe', 200);
        fireWeapon(state, shooter, aim);
        expect(foe.health).toBe(100 - DAMAGE);
        expect(state.projectiles).toHaveLength(0);
        expect(state.beams).toHaveLength(0);
        expect(events.some(e => e.type === 'EFFECT')).toBe(false); // no shell, no flash
    });

    it('does not fire on an empty tank', () => {
        const { state, shooter } = arena();
        shooter.weapon.ammo = 0;
        const foe = enemyAt(state, 'foe', 200);
        fireWeapon(state, shooter, aim);
        expect(foe.health).toBe(100);
    });

    it('announces the stream sound once per tick', () => {
        const { state, shooter } = arena();
        fireWeapon(state, shooter, aim);
        const sounds = events.filter(e => e.type === 'SOUND');
        expect(sounds).toEqual([{ type: 'SOUND', sound: 'flame', subtype: 'spray' }]);
    });
});
