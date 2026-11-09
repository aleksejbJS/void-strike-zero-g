// The flamethrower's stream as drawn: overlapping glow sprites ('flame' particles) from the nozzle to the end
// of the flame, which is FLAME_RANGE or the first wall or intact piece of cover on the way (as in the simulation).
// Spawned by elapsed time, so the stream looks the same on every display rate.

import { GameState } from '../../../types';
import { addHotFlame } from '../../systems/flameParticles';
import { FLAME_HALF_ANGLE, FLAME_RANGE } from '../../systems/flameConstants';
import { flameReach } from '../../systems/flameReach';
import { RateEmitter } from './rateEmitter';

/** Flames per second of one stream. */
export const JET_RATE = 520;

/** A flame lives this many physics ticks; flames slow by DAMPING every tick (particles.ts). */
const LIFE_TICKS = 30;
const DAMPING = 0.9;
/** Start speed per px of travel: a flame starting at v · this goes `v` px over its life (v · (1 + 0.9 + …)). */
const SPEED_PER_PX = (1 - DAMPING) / (1 - DAMPING ** LIFE_TICKS);
/**
 * Each flame flies only this share of the way, born anywhere along the rest of it. A damped flame crosses
 * most of its way in a few ticks and then lingers, so flames that all flew from the nozzle would pile up at the end.
 */
const HOP = 0.3;
/** Births crowd toward the nozzle by this power, so the narrow start of the stream is as dense as the wide end. */
const CROWD = 1.8;
/** White-hot at the nozzle, yellow and orange along the way, red at the far end. */
const COLORS = ['#fff3c4', '#ffe08a', '#ffc24a', '#ff9a2e', '#ff7417', '#f2461c'];
/** Glow radius (px) at the nozzle and at the end of the range; each flame grows further as it ages (particleDraw). */
const SIZE = { near: 12, far: 28 };
/** A wall closer than this still shows a short tongue of flame at the nozzle. */
const MIN_REACH = 12;
/** When a wall stops the stream, every this-many-th flame splashes along the wall instead. */
const SPLASH_EVERY = 4;
/** The golden ratio's fraction: stepping by it spreads births evenly over the way, however many come per frame. */
const GOLDEN = 0.6180339887;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const colorAt = (d: number) => COLORS[Math.min(COLORS.length - 1, Math.max(0, Math.floor((d + Math.random() * 0.25) * COLORS.length)))];

export class FlameJet {
    private readonly rate = new RateEmitter();
    private stratum = Math.random();
    private count = 0;

    /** Spray from the nozzle at (x, y) along `angle` (radians) at `now`; called every frame while the fighter sprays. */
    spray(state: GameState, x: number, y: number, angle: number, now: number): void {
        const n = this.rate.take(now, JET_RATE);
        if (n === 0) return;
        const reach = Math.max(MIN_REACH, flameReach(state, { x, y }, angle, FLAME_RANGE));
        const blocked = reach < FLAME_RANGE * 0.98;
        for (let i = 0; i < n; i++) {
            if (blocked && ++this.count % SPLASH_EVERY === 0) this.splash(state, x, y, angle, reach);
            else this.flame(state, x, y, angle, reach);
        }
    }

    /** One flame born somewhere along the stream, hopping on toward its end. */
    private flame(state: GameState, x: number, y: number, angle: number, reach: number): void {
        this.stratum = (this.stratum + GOLDEN) % 1;
        const u = (1 - HOP) * this.stratum ** CROWD; // share of the way where it is born
        const a = angle + between(-FLAME_HALF_ANGLE, FLAME_HALF_ANGLE);
        const born = u * reach;
        const hop = Math.min(HOP * reach * (0.5 + u), reach - born) * between(0.85, 1);
        const v = hop * SPEED_PER_PX;
        const d = born / FLAME_RANGE; // colour and size follow the distance from the nozzle, not the share of a cut stream
        const size = (SIZE.near + (SIZE.far - SIZE.near) * d * 1.3) * between(0.8, 1.2);
        addHotFlame(state, { x: x + Math.cos(a) * born, y: y + Math.sin(a) * born }, colorAt(d),
            { x: Math.cos(a) * v, y: Math.sin(a) * v }, size, 1 / LIFE_TICKS);
    }

    /** A flame that hit the wall at `reach` and spreads along it, a little back toward the nozzle. */
    private splash(state: GameState, x: number, y: number, angle: number, reach: number): void {
        const side = Math.random() < 0.5 ? -1 : 1;
        const along = angle + side * Math.PI / 2;
        const v = between(1.5, 3.5);
        const at = { x: x + Math.cos(angle) * (reach - 4), y: y + Math.sin(angle) * (reach - 4) };
        const vel = { x: Math.cos(along) * v - Math.cos(angle) * 0.8, y: Math.sin(along) * v - Math.sin(angle) * 0.8 };
        addHotFlame(state, at, colorAt(Math.min(1, reach / FLAME_RANGE + 0.2)), vel, between(10, 18), 1 / LIFE_TICKS);
    }
}
