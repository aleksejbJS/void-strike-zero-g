// Fire on and around a fighter, drawn from snapshot fields only: the flamethrower's jet, a burning body
// and a lit fuel tank roaring from the back. Each kind is rate-limited per fighter (like BleedDrips),
// so a frame rate of 144 Hz spawns no more fire than 60 Hz.

import { Entity, GameState, Vector2, WeaponType } from '../../../types';
import { createParticles } from '../../systems/effectSpawn';
import { FLAME_HALF_ANGLE, FLAME_RANGE } from '../../systems/flameConstants';
import { FighterPose, RIG_SCALE, upperPoint } from './fighterPose';
import { GripPoints } from './weaponGrips';
import { muzzlePoint } from './muzzleFlash';

/** The jet shows this long after the last flame tick (the stream ticks every 100 ms). */
export const JET_MS = 150;

/** Least time between two emissions of each kind, per fighter. */
const JET_GAP_MS = 20;
const BODY_GAP_MS = 45;
const TANK_GAP_MS = 25;
/** With this many live particles (a big fight full of blasts), no new fire is added. */
const FIRE_CAP = 1200;

/** A jet particle lives this many physics ticks; 'fire' particles slow by DAMPING every tick (particles.ts). */
const JET_LIFE_TICKS = 30;
const DAMPING = 0.9;
/** Start speed that carries a jet particle FLAME_RANGE over its life: v · (1 + 0.9 + 0.81 + …). */
const JET_SPEED = FLAME_RANGE * (1 - DAMPING) / (1 - DAMPING ** JET_LIFE_TICKS);
const JET_COUNT = 3;
const JET_COLORS = ['#fff7c2', '#fde047', '#fbbf24', '#fb923c', '#f97316', '#ef4444'];

const BODY_COUNT = 2;
const BODY_COLORS = ['#ea580c', '#f97316', '#fb923c', '#fcd34d', '#facc15'];

/** The tank's jet: hotter (blue-white), bigger and faster than body flames, from the tank on the back. */
const TANK_COUNT = 3;
const TANK_COLORS = ['#ffffff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#60a5fa'];
const TANK_SPREAD = 0.25;   // radians either side of the jet's way
/** The tank in the upper-body frame (rig units, behind the jetpack), and its jet tipped this much upward. */
const TANK_AT = { x: -14, y: -10 };
const TANK_TILT = 0.35;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const pick = (colors: string[]) => colors[Math.floor(Math.random() * colors.length)];

/** One flame particle unless the scene is already full of particles. */
const flame = (state: GameState, at: Vector2, colors: string[], vel: Vector2, size: number, decay?: number) => {
    if (state.particles.length >= FIRE_CAP) return;
    createParticles(state, at.x, at.y, 1, pick(colors), 'fire', { vel, size, ...(decay !== undefined && { decay }) });
};

/** One burst of a lit tank's jet from (x, y) along `angle`; also used by corpses that carry a lit tank. */
export const spawnTankJet = (state: GameState, x: number, y: number, angle: number): void => {
    for (let i = 0; i < TANK_COUNT; i++) {
        const a = angle + between(-TANK_SPREAD, TANK_SPREAD), v = between(5, 8);
        flame(state, { x, y }, TANK_COLORS, { x: Math.cos(a) * v, y: Math.sin(a) * v }, between(7, 12), between(0.045, 0.06));
    }
};

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
        const tank = world(upperPoint(f.pose, TANK_AT.x, TANK_AT.y));
        this.tank(state, p, tank.x, tank.y, turn(Math.PI + f.pose.lean + TANK_TILT), now);
    }

    /** The flame stream from the muzzle at (x, y) along `angle`, reaching about FLAME_RANGE. */
    jet(state: GameState, x: number, y: number, angle: number, now: number): void {
        if (!this.due('jetAt', JET_GAP_MS, now)) return;
        for (let i = 0; i < JET_COUNT; i++) {
            const a = angle + between(-FLAME_HALF_ANGLE, FLAME_HALF_ANGLE), v = JET_SPEED * between(0.85, 1.05);
            flame(state, { x, y }, JET_COLORS, { x: Math.cos(a) * v, y: Math.sin(a) * v }, between(5, 10), 1 / JET_LIFE_TICKS);
        }
    }

    /** Flames licking up over the whole body while `burnUntil` is ahead of `now`. */
    body(state: GameState, p: Pick<Entity, 'pos' | 'width' | 'height' | 'isProne' | 'burnUntil'>, now: number): void {
        if (!(typeof p.burnUntil === 'number' && p.burnUntil > now)) return;
        if (!this.due('bodyAt', BODY_GAP_MS, now)) return;
        const w = p.isProne ? p.width * 2 : p.width; // lying down, the body is longer than the hitbox is wide
        for (let i = 0; i < BODY_COUNT; i++) {
            const at = { x: p.pos.x + between(-0.45, 0.45) * w, y: p.pos.y - between(0.05, 0.95) * p.height };
            flame(state, at, BODY_COLORS, { x: between(-0.3, 0.3), y: -between(0.6, 1.6) }, between(5, 9));
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
