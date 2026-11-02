// How a fresh corpse starts moving, by kind of death, and how later blasts push corpses.
// Values come from the approved mockup scenes (docs/plans/2026-11-02-death-ragdoll-mockup.html):
// mockup velocity × S, mockup distances × MOCKUP_SCALE. Pure math on the corpse data.

import { GRAVITY, PHYSICS_TICK_RATE } from '../../../constants';
import { Vector2 } from '../../../types';
import { Corpse, CorpsePoint, CorpsePointId } from './corpseBody';
import { MAX_SPEED } from './corpseStep';

/** Mockup lengths (136 px fighter) → game units (72-unit fighter). */
const MOCKUP_SCALE = 0.53;
/** The mockup's gravity, px per 60 Hz frame². */
const MOCKUP_GRAVITY = 0.42;
/**
 * Mockup velocities (px per 60 Hz frame) → units per tick, keeping every throw's arc and spin in fighter
 * heights: corpse gravity is ~6.5× the mockup's in game units, so velocities scale by √6.5 more than
 * MOCKUP_SCALE / 2 and the throws play out ~2.5× faster than in the mockup.
 */
const S = MOCKUP_SCALE / 2 * Math.sqrt(GRAVITY / (MOCKUP_GRAVITY * MOCKUP_SCALE / 4));
/** Entity velocity is per 60 Hz frame (Matter's base step); corpse velocity is per tick. */
const ENTITY_VEL_PER_TICK = 60 / PHYSICS_TICK_RATE;

/** Fall: the hip slips toward the shooter and the knees straighten (backwards from the way the body faces). */
const FALL_HIP = 1;
const FALL_KNEE = 1;
/** Thrown: the mockup's rocket blast (power 15, reach 260); the side nearest the blast gets the most. */
const THROW_POWER = 15 * S;
const THROW_REACH = 260 * MOCKUP_SCALE;
/** A shot: the mockup's shotgun (about 7 back and 3 up per frame). Closer than SHOT_RANGE to the body, `from` is a shot. */
const SHOT_POWER = 7 * S;
const SHOT_RANGE = 40;
/** Upward share of a blast's power (the mockup's lift). */
const LIFT = 0.45;
/** No point of a thrown body gets less than this share of the power. */
const THROW_FLOOR = 0.5;
/** Gib: the mockup's close blast (power 12, kept at 0.8) and its random scatter... */
const GIB_POWER = 12 * 0.8 * S;
/** ...plus pieces flying apart from the body's middle: this much speed per unit of distance from it. */
const GIB_SPREAD = 0.07;
/** Blast centre when the host sent none: this far in front of the hip (mockup: 40 px for a throw, 26 for a gib). */
const DEFAULT_THROW_FROM = 40 * MOCKUP_SCALE;
const DEFAULT_GIB_FROM = 26 * MOCKUP_SCALE;
/** An explosion pushes corpse points within this radius × its size, fading to nothing at the edge. */
const PUSH_RADIUS = 150;
const PUSH_POWER = 13 * S;
/**
 * Upward share of a later blast's push, more than a fresh throw's LIFT: a lying body has the floor
 * under it, so a blast beside it mostly shoves it along the floor; with this it hops up as well.
 */
const PUSH_LIFT = 1;
/** Closer than this to a blast centre a point has no direction: it is pushed straight up. */
const MIN_DIST = 0.001;

/** The halves a railgun cut separates: these points, and the rest (hip and legs). */
const UPPER: ReadonlySet<CorpsePointId> = new Set(['neck', 'head', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB', 'gunA', 'gunB']);
/** The body without the dropped gun: blasts throw these, the gun keeps its own toss (as in the mockup). */
const BODY: CorpsePointId[] = ['hip', 'neck', 'head', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB', 'knF', 'anF', 'knB', 'anB'];
/** The body above the cut that the beam throws. */
const UPPER_BODY: CorpsePointId[] = ['neck', 'head', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB'];
const LOWER_BODY: CorpsePointId[] = ['hip', 'knF', 'knB'];

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

/** Add a velocity (units per tick) to a verlet point. */
const kick = (p: CorpsePoint, vx: number, vy: number) => { p.px -= vx; p.py -= vy; };

/** -1 or 1: the horizontal way from `from` to the hip; without `from`, backwards. */
const awayX = (c: Corpse, from: Vector2 | undefined): 1 | -1 => {
    if (!from || from.x === c.points.hip.x) return c.facing === 1 ? -1 : 1;
    return c.points.hip.x > from.x ? 1 : -1;
};

/**
 * Push the body away from `from`: full power on the nearest side, falling off across the body, plus lift.
 * `radial` 1: each point flies straight away from `from` (a blast: from below it flips the body over).
 * `radial` 0: every point is shoved the same way, from `from` to the hip (a shot: the upper body leads,
 * so a shot at chest height knocks the body onto its back, as in the mockup's shotgun scene).
 */
const blast = (c: Corpse, from: Vector2, power: number, reach: number, floor: number, radial: number) => {
    const points = BODY.map(id => c.points[id]);
    const dists = points.map(p => Math.hypot(p.x - from.x, p.y - from.y));
    const near = Math.min(...dists);
    const hip = c.points.hip;
    const hipD = Math.max(Math.hypot(hip.x - from.x, hip.y - from.y), MIN_DIST);
    const shove = { x: (hip.x - from.x) / hipD, y: (hip.y - from.y) / hipD };
    points.forEach((p, i) => {
        const d = Math.max(dists[i], MIN_DIST);
        const x = shove.x + ((p.x - from.x) / d - shove.x) * radial;
        const y = shove.y + ((p.y - from.y) / d - shove.y) * radial;
        const len = Math.max(Math.hypot(x, y), MIN_DIST);
        const f = power * Math.max(floor, 1 - (dists[i] - near) / reach);
        kick(p, x / len * f + rnd(-S, S), y / len * f - power * LIFT + rnd(-S, S));
    });
};

/** The dropped weapon flips out of the hands (mockup `die`). */
const tossGun = (c: Corpse) => {
    kick(c.points.gunA, c.facing * rnd(-1, 1) * S, rnd(-4, -2) * S);
    kick(c.points.gunB, c.facing * rnd(1, 3) * S, rnd(-5, -2) * S);
};

/**
 * Machine gun: the upper body tips away from the shooter, the legs give way (mockup `mg`). The knees are
 * pushed straight, not bent as in the mockup: under the game's gravity bent knees fold at once and the
 * body ends sitting on its heels; straight legs slide out and it ends flat on its back, as the mockup's.
 */
const fall = (c: Corpse, from: Vector2 | undefined) => {
    const away = awayX(c, from);
    const p = c.points;
    kick(p.head, away * 3.2 * S, -0.6 * S);
    kick(p.neck, away * 2.2 * S, -0.2 * S);
    kick(p.hip, -away * FALL_HIP * S, 0);
    kick(p.knF, -c.facing * FALL_KNEE * S, 0);
    kick(p.knB, -c.facing * FALL_KNEE * 0.9 * S, 0);
    kick(p.haF, away * S, S);
    kick(p.haB, away * S, S);
};

const frontOfHip = (c: Corpse, ahead: number): Vector2 => ({ x: c.points.hip.x + c.facing * ahead, y: c.points.hip.y });

/**
 * Shotgun point blank or a rocket nearby: the whole body is flung away. A centre right at the body is
 * a shot (the pellets' last position): a shove of the mockup's shotgun strength. From SHOT_RANGE away
 * on it is a blast of the mockup's rocket strength; in between the two blend.
 */
const thrown = (c: Corpse, from: Vector2 | undefined) => {
    const at = from ?? frontOfHip(c, DEFAULT_THROW_FROM);
    const near = Math.min(...BODY.map(id => Math.hypot(c.points[id].x - at.x, c.points[id].y - at.y)));
    const w = Math.min(1, near / SHOT_RANGE);
    blast(c, at, SHOT_POWER + (THROW_POWER - SHOT_POWER) * w, THROW_REACH, THROW_FLOOR, w);
};

/** Rocket point blank or chainsaw: the joints tear and the pieces scatter (mockup `gib`). */
const gib = (c: Corpse, from: Vector2 | undefined) => {
    c.links = c.links.filter(l => !l.joint && !l.min);
    blast(c, from ?? frontOfHip(c, DEFAULT_GIB_FROM), GIB_POWER, THROW_REACH, 0.25, 1);
    const mid = { x: (c.points.hip.x + c.points.neck.x) / 2, y: (c.points.hip.y + c.points.neck.y) / 2 };
    for (const p of BODY.map(id => c.points[id])) {
        kick(p, (p.x - mid.x) * GIB_SPREAD + rnd(-2.5, 2.5) * S, (p.y - mid.y) * GIB_SPREAD + rnd(-2, 1) * S);
    }
};

/** Railgun: cut at the waist, the upper half flies along the beam, the legs fold where they stand (mockup `rail`). */
const cut = (c: Corpse, from: Vector2 | undefined) => {
    c.links = c.links.filter(l => UPPER.has(l.a) === UPPER.has(l.b));
    const hip = c.points.hip;
    const dx = from ? hip.x - from.x : -c.facing, dy = from ? hip.y - from.y : 0;
    const d = Math.max(Math.hypot(dx, dy), MIN_DIST);
    const along = { x: dx / d, y: dy / d };
    for (const id of UPPER_BODY) {
        const v = (id === 'head' ? 10 : rnd(7, 9)) * S;
        const lift = (id === 'head' ? 3.6 : rnd(2, 3.5)) * S;
        kick(c.points[id], along.x * v, along.y * v - lift);
    }
    for (const id of LOWER_BODY) {
        const v = rnd(-0.4, 0.6) * S;
        kick(c.points[id], along.x * v, along.y * v + 0.5 * S);
    }
};

const LAUNCH = { fall, thrown, gib, cut } as const;

/**
 * Slow the whole body down together to the step's speed cap, so the cap does not clip only the fastest
 * points (a rocket kill adds the victim's knockback) and the throw keeps its spin and shape.
 */
const fitSpeedCap = (c: Corpse) => {
    const points = Object.values(c.points);
    const fastest = Math.max(...points.map(p => Math.hypot(p.x - p.px, p.y - p.py)));
    if (fastest <= MAX_SPEED) return;
    const k = MAX_SPEED / fastest;
    for (const p of points) { p.px = p.x - (p.x - p.px) * k; p.py = p.y - (p.y - p.py) * k; }
};

/** Start a fresh corpse moving by its kind of death; `vel` = the victim's velocity (entity units). */
export const launchCorpse = (c: Corpse, from: Vector2 | undefined, vel: Vector2): void => {
    tossGun(c);
    LAUNCH[c.kind](c, from);
    const vx = vel.x * ENTITY_VEL_PER_TICK, vy = vel.y * ENTITY_VEL_PER_TICK;
    for (const p of Object.values(c.points)) kick(p, vx, vy);
    fitSpeedCap(c);
};

/** A later explosion at (x, y) pushes every corpse point within its reach; lying bodies are thrown again. */
export const pushCorpses = (corpses: Corpse[], x: number, y: number, size = 1): void => {
    const radius = PUSH_RADIUS * size;
    for (const c of corpses) {
        for (const p of Object.values(c.points)) {
            const dx = p.x - x, dy = p.y - y;
            const d = Math.hypot(dx, dy);
            if (d >= radius) continue;
            const f = PUSH_POWER * size * (1 - d / radius);
            if (d < MIN_DIST) { kick(p, 0, -f); continue; }
            kick(p, dx / d * f, dy / d * f - f * PUSH_LIFT);
        }
    }
};
