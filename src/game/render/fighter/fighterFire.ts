// Fire on and around a fighter, drawn from snapshot fields only: the flamethrower's jet, a burning body
// and a lit fuel tank roaring from the back. Each kind is rate-limited per fighter (like BleedDrips),
// so a frame rate of 144 Hz spawns no more fire than 60 Hz.

import { Entity, GameState, Vector2, WeaponType } from '../../../types';
import { addFlame, spawnTankJet } from '../../systems/flameParticles';
import { FLAME_HALF_ANGLE, FLAME_RANGE } from '../../systems/flameConstants';
import { FighterPose, RIG_SCALE, upperPoint } from './fighterPose';
import { GripPoints } from './weaponGrips';
import { muzzlePoint } from './muzzleFlash';
import { TANK_SPOT } from './fuelTankBack';

/** The jet shows this long after the last flame tick (the stream ticks every 100 ms). */
export const JET_MS = 150;

/** Least time between two emissions of each kind, per fighter. */
const JET_GAP_MS = 20;
const BODY_GAP_MS = 45;
const TANK_GAP_MS = 25;

/** A jet particle lives this many physics ticks; 'fire' particles slow by DAMPING every tick (particles.ts). */
const JET_LIFE_TICKS = 30;
const DAMPING = 0.9;
/** Start speed per px of travel left: a particle starting at v · this goes `v` px over its life (v · (1 + 0.9 + …)). */
const SPEED_PER_PX = (1 - DAMPING) / (1 - DAMPING ** JET_LIFE_TICKS);
const JET_COUNT = 8;
/** Hot near the nozzle, redder at the far end; and the flame widens as it goes. */
const JET_COLORS = ['#fff7c2', '#fde047', '#fbbf24', '#fb923c', '#f97316', '#ef4444'];
const JET_SIZE = { near: 10, far: 28 };
/**
 * Each flame flies only this share of the range, born anywhere along the rest of it. A damped particle
 * crosses most of its way in a few ticks and then lingers at the end, so flames that all flew the whole
 * range from the muzzle would pile up at the far end and leave a gap behind the nozzle.
 */
const JET_HOP = 0.3;
/** Births crowd toward the nozzle by this power, so the narrow start of the stream is as dense as the wide end. */
const JET_CROWD = 1.8;

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
    private jetAt = -Infinity;
    private bodyAt = -Infinity;
    private tankAt = -Infinity;

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
        const tank = world(upperPoint(f.pose, TANK_SPOT.x, TANK_SPOT.y));
        this.tank(state, p, tank.x, tank.y, turn(Math.PI + f.pose.lean + TANK_TILT), now);
    }

    /** The flame stream from the muzzle at (x, y) along `angle`, one stream from the nozzle to about FLAME_RANGE. */
    jet(state: GameState, x: number, y: number, angle: number, now: number): void {
        if (!this.due('jetAt', JET_GAP_MS, now)) return;
        for (let i = 0; i < JET_COUNT; i++) {
            const a = angle + between(-FLAME_HALF_ANGLE, FLAME_HALF_ANGLE), dx = Math.cos(a), dy = Math.sin(a);
            // How far along the way it is born: one flame per stretch of the way, so every burst spans the whole
            // stream; flames born near the nozzle also hop shorter
            const u = (1 - JET_HOP) * ((i + Math.random()) / JET_COUNT) ** JET_CROWD, born = u * FLAME_RANGE;
            const v = JET_HOP * FLAME_RANGE * (0.5 + u) * SPEED_PER_PX * between(0.85, 1.05);
            const at = { x: x + dx * born, y: y + dy * born };
            const color = JET_COLORS[Math.min(JET_COLORS.length - 1, Math.floor((u + Math.random() * 0.3) * JET_COLORS.length))];
            const size = JET_SIZE.near + (JET_SIZE.far - JET_SIZE.near) * u * between(0.8, 1.2);
            addFlame(state, at, [color], { x: dx * v, y: dy * v }, size, 1 / JET_LIFE_TICKS);
        }
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

    /** The lit tank's jet from (x, y) along `angle`, while `tankFuseAt` is set. */
    tank(state: GameState, p: Pick<Entity, 'tankFuseAt'>, x: number, y: number, angle: number, now: number): void {
        if (typeof p.tankFuseAt !== 'number') return;
        if (!this.due('tankAt', TANK_GAP_MS, now)) return;
        spawnTankJet(state, x, y, angle);
    }

    /** True, and the clock restarted, when `gap` ms have passed; a clock that steps back starts a new count. */
    private due(key: 'jetAt' | 'bodyAt' | 'tankAt', gap: number, now: number): boolean {
        if (now >= this[key] && now - this[key] < gap) return false;
        this[key] = now;
        return true;
    }
}
