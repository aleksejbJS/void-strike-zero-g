// A corpse that died with a lit fuel tank: the tank roars from its back until it blows (TANK_BLAST),
// then the body is torn to pieces with blood. Display side only, like the rest of the corpses.
// The simulation's module graph reaches this file (via effects.ts): import nothing that reaches pixi.js.

import { GameState, Vector2 } from '../../../types';
import { createParticles } from '../effectSpawn';
import { spawnTankJet } from '../flameParticles';
import { RIG_SCALE } from '../../render/fighter/fighterPose';
import { Corpse, CorpsePointId } from './corpseBody';
import { addCorpse } from './corpses';

/** Blood droplets when a tank blast tears a corpse apart (an ordinary death throws 40). */
export const TANK_BLOOD = 60;
const BLOOD_COLOR = '#dc2626';
/** A burst of the tank's jet every this many corpse ticks (120 per second). */
const FIRE_EVERY_TICKS = 3;
/** The tank on a corpse's back: this far up the spine from the hip and this far behind it (rig units),
 *  the same spot as TANK_SPOT in render/fighter/fuelTankBack.ts (not imported: that file reaches pixi.js). */
const TANK_UP = 10;
const TANK_BACK = 14;
/** The jet leans up this much; any downward part of the back's way is dropped, so it never blows into the floor. */
const JET_LIFT = 0.6;
/** Corpse speed is per tick, a DEATH event's velocity per 60 Hz frame. */
const TICK_TO_ENTITY_VEL = 2;

const between = (min: number, max: number) => min + Math.random() * (max - min);

/** Where the tank sits on the corpse and which way (radians) its jet points, from the spine hip → neck. */
const tankOf = (c: Corpse): { at: Vector2; angle: number } => {
    const { hip, neck } = c.points;
    const len = Math.hypot(neck.x - hip.x, neck.y - hip.y) || 1;
    const up = { x: (neck.x - hip.x) / len, y: (neck.y - hip.y) / len };
    // Standing and facing right the spine points up (0, -1) and the back left (-1, 0)
    const back = { x: c.facing * up.y, y: -c.facing * up.x };
    const at = {
        x: hip.x + (up.x * TANK_UP + back.x * TANK_BACK) * RIG_SCALE,
        y: hip.y + (up.y * TANK_UP + back.y * TANK_BACK) * RIG_SCALE,
    };
    return { at, angle: Math.atan2(Math.min(back.y, 0) - JET_LIFT, back.x) };
};

/** Fire from the back of every corpse that carries a lit tank; called once per corpse tick. */
export const corpseTankFire = (state: GameState): void => {
    for (const c of state.corpses) {
        if (c.tankId === undefined || c.age % FIRE_EVERY_TICKS !== 0) continue;
        const { at, angle } = tankOf(c);
        spawnTankJet(state, at.x, at.y, angle);
    }
};

const finitePoint = (p: Vector2 | undefined): Vector2 | undefined =>
    p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : undefined;

/** Move every point of `to` onto the same point of `from`, keeping the velocity `to` was launched with. */
const layOver = (to: Corpse, from: Corpse) => {
    for (const id of Object.keys(to.points) as CorpsePointId[]) {
        const p = to.points[id], q = from.points[id];
        const vx = p.x - p.px, vy = p.y - p.py;
        p.x = q.x; p.y = q.y; p.px = q.x - vx; p.py = q.y - vy;
    }
};

/**
 * The lit tank `id` blew at `from`: the corpse carrying it is replaced by a gib of the same fighter, its
 * pieces starting where the body lay and flying apart from the blast, with blood. No such corpse
 * (it never reached this client, or it is gone): nothing happens.
 */
export const gibTankCorpse = (state: GameState, id: string, from: Vector2): void => {
    if (typeof id !== 'string') return; // a host may send anything
    const old = state.corpses.find(c => c.tankId === id);
    if (!old) return;
    state.corpses = state.corpses.filter(c => c !== old);
    const blast = finitePoint(from) ?? tankOf(old).at;
    const hip = old.points.hip;
    const gib = addCorpse(state, {
        type: 'DEATH', x: hip.x, y: hip.y, color: BLOOD_COLOR, height: 0, kind: 'gib', from: blast,
        vel: { x: (hip.x - hip.px) * TICK_TO_ENTITY_VEL, y: (hip.y - hip.py) * TICK_TO_ENTITY_VEL },
        facing: old.facing, weapon: old.weapon, parts: old.colors, oneLeg: old.oneLeg, blast: true,
    });
    layOver(gib, old);
    const torso = { x: (hip.x + old.points.neck.x) / 2, y: (hip.y + old.points.neck.y) / 2 };
    for (let i = 0; i < TANK_BLOOD; i++) {
        const a = Math.random() * Math.PI * 2, v = between(1, 5);
        createParticles(state, torso.x, torso.y, 1, BLOOD_COLOR, 'blood', { vel: { x: Math.cos(a) * v, y: Math.sin(a) * v - 2 } });
    }
};
