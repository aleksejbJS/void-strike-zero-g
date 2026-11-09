// Fire on and around a fighter, drawn from snapshot fields only: the flamethrower's stream (flameJet.ts), a
// burning body and a lit fuel tank roaring from the back. The stream and the tank jet spawn by elapsed time and
// the body flames are rate-limited per fighter (like BleedDrips), so 144 Hz spawns no more fire than 60 Hz.

import { Entity, GameState, Vector2, WeaponType } from '../../../types';
import { addFlame, spawnTankJet, tankFlash, TANK_JET_RATE } from '../../systems/flameParticles';
import { FighterPose, RIG_SCALE, upperPoint } from './fighterPose';
import { GripPoints } from './weaponGrips';
import { muzzlePoint } from './muzzleFlash';
import { TANK_SPOT } from './fuelTankBack';
import { FlameJet } from './flameJet';
import { RateEmitter } from './rateEmitter';

/** The jet shows this long after the last flame tick (the stream ticks every 100 ms). */
export const JET_MS = 150;

/** Least time between two emissions of body flames, and between two flashes of light at a lit tank, per fighter. */
const BODY_GAP_MS = 45;
const TANK_FLASH_GAP_MS = 70;
/** A fighter's speed is per 60 Hz frame, a particle's per 120 Hz tick. */
const ENTITY_TO_TICK_VEL = 0.5;

const BODY_COUNT = 3;
const BODY_COLORS = ['#ea580c', '#f97316', '#fb923c', '#fcd34d', '#facc15'];

/** The lit tank's jet is tipped this much upward. */
const TANK_TILT = 0.35;

const between = (min: number, max: number) => min + Math.random() * (max - min);

/** What the animator already worked out for this frame: the pose, the grip, the facing and a hop's lift. */
export interface FireFrame { pose: FighterPose; grip: GripPoints; facing: number; hop: number }

/** Is the fighter spraying flame: holding the flamethrower and a tick came less than JET_MS ago? */
export const isSpraying = (weapon: WeaponType, sinceShotMs: number): boolean =>
    weapon === WeaponType.FLAMETHROWER && sinceShotMs >= 0 && sinceShotMs < JET_MS;

export class FighterFire {
    private readonly stream = new FlameJet();
    private readonly tankRate = new RateEmitter();
    private bodyAt = -Infinity;
    private flashAt = -Infinity;

    /** All fire for one fighter this frame. `sinceShotMs`: time since its lastFired last changed. */
    update(state: GameState, p: Entity, f: FireFrame, sinceShotMs: number, now: number): void {
        const world = (pt: Vector2) => ({ x: p.pos.x + pt.x * f.facing * RIG_SCALE, y: p.pos.y + pt.y * RIG_SCALE - f.hop });
        // Rig angles face right; facing left mirrors them
        const turn = (a: number) => (f.facing === 1 ? a : Math.PI - a);
        if (isSpraying(p.weapon.type, sinceShotMs)) {
            const muzzle = world(muzzlePoint(f.pose, f.grip));
            this.jet(state, muzzle.x, muzzle.y, turn(f.pose.gunAngle), now);
        }
        this.body(state, p, now);
        if (typeof p.tankFuseAt !== 'number') return;
        const tank = world(upperPoint(f.pose, TANK_SPOT.x, TANK_SPOT.y));
        this.tank(state, p, tank.x, tank.y, turn(Math.PI + f.pose.lean + TANK_TILT), now);
    }

    /** The flame stream from the muzzle at (x, y) along `angle`, from the nozzle to FLAME_RANGE or the first wall. */
    jet(state: GameState, x: number, y: number, angle: number, now: number): void {
        this.stream.spray(state, x, y, angle, now);
    }

    /** Flames licking up over the whole body while `burnUntil` is ahead of `now`. */
    body(state: GameState, p: Pick<Entity, 'pos' | 'width' | 'height' | 'isProne' | 'burnUntil'>, now: number): void {
        if (!(typeof p.burnUntil === 'number' && p.burnUntil > now)) return;
        if (!this.due('bodyAt', BODY_GAP_MS, now)) return;
        const w = p.isProne ? p.width * 2 : p.width; // lying down, the body is longer than the hitbox is wide
        for (let i = 0; i < BODY_COUNT; i++) {
            const at = { x: p.pos.x + between(-0.45, 0.45) * w, y: p.pos.y - between(0.05, 0.95) * p.height };
            addFlame(state, at, BODY_COLORS, { x: between(-0.3, 0.3), y: -between(0.6, 1.6) }, between(8, 14));
        }
    }

    /** The lit tank's roaring jet from (x, y) along `angle`, with pulses of light, while `tankFuseAt` is set. */
    tank(state: GameState, p: Pick<Entity, 'tankFuseAt'> & Partial<Pick<Entity, 'vel'>>, x: number, y: number, angle: number, now: number): void {
        if (typeof p.tankFuseAt !== 'number') return;
        const carrier = p.vel ? { x: p.vel.x * ENTITY_TO_TICK_VEL, y: p.vel.y * ENTITY_TO_TICK_VEL } : undefined;
        spawnTankJet(state, x, y, angle, this.tankRate.take(now, TANK_JET_RATE), carrier);
        if (this.due('flashAt', TANK_FLASH_GAP_MS, now)) tankFlash(state, x, y);
    }

    /** True, and the clock restarted, when `gap` ms have passed; a clock that steps back starts a new count. */
    private due(key: 'bodyAt' | 'flashAt', gap: number, now: number): boolean {
        if (now >= this[key] && now - this[key] < gap) return false;
        this[key] = now;
        return true;
    }
}
