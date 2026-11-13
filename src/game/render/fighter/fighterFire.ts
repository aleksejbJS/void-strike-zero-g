// Fire on and around a fighter, drawn from snapshot fields only: the flamethrower's stream and a burning body
// are orders for the view's flame engine (render/flame/flameFx.ts); a lit fuel tank roars from the back as
// 'flame' particles, spawned by elapsed time so 144 Hz spawns no more fire than 60 Hz.

import { Entity, GameState, Vector2, WeaponType } from '../../../types';
import { spawnTankJet, tankFlash, TANK_JET_RATE } from '../../systems/flameParticles';
import { FighterPose, RIG_SCALE, upperPoint } from './fighterPose';
import { GripPoints } from './weaponGrips';
import { muzzlePoint } from './muzzleFlash';
import { TANK_SPOT } from './fuelTankBack';
import { RateEmitter } from './rateEmitter';
import type { FlameOrders } from '../flame/flameOrders';

/** The jet shows this long after the last flame tick (the stream ticks every 100 ms). */
export const JET_MS = 150;

/** Least time between two flashes of light at a lit tank, per fighter. */
const TANK_FLASH_GAP_MS = 70;
/** A fighter's speed is per 60 Hz frame, a particle's per 120 Hz tick. */
const ENTITY_TO_TICK_VEL = 0.5;

/** The lit tank's jet is tipped this much upward. */
const TANK_TILT = 0.35;

/** What the animator already worked out for this frame: the pose, the grip, the facing and a hop's lift. */
export interface FireFrame { pose: FighterPose; grip: GripPoints; facing: number; hop: number }

/** Is the fighter spraying flame: holding the flamethrower and a tick came less than JET_MS ago? */
export const isSpraying = (weapon: WeaponType, sinceShotMs: number): boolean =>
    weapon === WeaponType.FLAMETHROWER && sinceShotMs >= 0 && sinceShotMs < JET_MS;

export class FighterFire {
    private readonly tankRate = new RateEmitter();
    private flashAt = -Infinity;

    /** All fire for one fighter this frame. `sinceShotMs`: time since its lastFired last changed. */
    update(state: GameState, flames: FlameOrders, p: Entity, f: FireFrame, sinceShotMs: number, now: number): void {
        const world = (pt: Vector2) => ({ x: p.pos.x + pt.x * f.facing * RIG_SCALE, y: p.pos.y + pt.y * RIG_SCALE - f.hop });
        // Rig angles face right; facing left mirrors them
        const turn = (a: number) => (f.facing === 1 ? a : Math.PI - a);
        if (p.weapon.type === WeaponType.FLAMETHROWER) {
            const muzzle = world(muzzlePoint(f.pose, f.grip));
            flames.stream(p.id, { x: muzzle.x, y: muzzle.y, angle: turn(f.pose.gunAngle), firing: isSpraying(p.weapon.type, sinceShotMs) });
        }
        this.body(flames, p, now);
        if (typeof p.tankFuseAt !== 'number') return;
        const tank = world(upperPoint(f.pose, TANK_SPOT.x, TANK_SPOT.y));
        this.tank(state, p, tank.x, tank.y, turn(Math.PI + f.pose.lean + TANK_TILT), now);
    }

    /** Fire over the whole body while `burnUntil` is ahead of `now`. */
    body(flames: FlameOrders, p: Pick<Entity, 'id' | 'pos' | 'width' | 'height' | 'isProne' | 'burnUntil'>, now: number): void {
        if (!(typeof p.burnUntil === 'number' && p.burnUntil > now)) return;
        flames.body(p.id, { x: p.pos.x, y: p.pos.y, w: p.width, h: p.height, prone: !!p.isProne }); // lying down, the hitbox is already low
    }

    /** The lit tank's roaring jet from (x, y) along `angle`, with pulses of light, while `tankFuseAt` is set. */
    tank(state: GameState, p: Pick<Entity, 'tankFuseAt'> & Partial<Pick<Entity, 'vel'>>, x: number, y: number, angle: number, now: number): void {
        if (typeof p.tankFuseAt !== 'number') return;
        const carrier = p.vel ? { x: p.vel.x * ENTITY_TO_TICK_VEL, y: p.vel.y * ENTITY_TO_TICK_VEL } : undefined;
        spawnTankJet(state, x, y, angle, this.tankRate.take(now, TANK_JET_RATE), carrier);
        if (this.due('flashAt', TANK_FLASH_GAP_MS, now)) tankFlash(state, x, y);
    }

    /** True, and the clock restarted, when `gap` ms have passed; a clock that steps back starts a new count. */
    private due(key: 'flashAt', gap: number, now: number): boolean {
        if (now >= this[key] && now - this[key] < gap) return false;
        this[key] = now;
        return true;
    }
}
