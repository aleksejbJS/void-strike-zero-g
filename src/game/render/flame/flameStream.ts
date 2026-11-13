// One fighter's flamethrower as drawn: the stream fades in and out with the trigger and sprays flame cores,
// white-blue nozzle streaks, sparks and smoke; a pilot light flickers at the nozzle all the while it is held.

import type { StreamOrder } from './flameOrders';
import type { FlameParticle, ParticlePool } from './particlePool';
import type { FrontSums } from './particleMotion';
import { SCALE, STREAM } from './flameTuning';

export interface FlamePools { fire: ParticlePool; jet: ParticlePool; spark: ParticlePool; smoke: ParticlePool }

type Channel = 'flame' | 'jet' | 'spark' | 'smoke' | 'pilot';

/** Where the bulk of a free stream ends, px from the nozzle (the demo's range estimate at our scale). */
export const STREAM_REACH = 45 + (STREAM.speed / STREAM.drag) * (1 - Math.exp(-STREAM.drag * STREAM.life));

/** Most particles of one kind one frame may add, however long the frame was. */
const MAX_PER_FRAME = 320;
const rnd = Math.random;

export class FlameStream {
    power = 0;
    x = 0; y = 0; angle = 0;
    firing = false;
    held = false;
    /** The middle of the flame, where its big glow sits; `frontLive` when real flame is there to measure. */
    readonly front = { x: 0, y: 0 };
    frontLive = false;
    private fresh = true;
    private readonly acc: Record<Channel, number> = { flame: 0, jet: 0, spark: 0, smoke: 0, pilot: 0 };

    constructor(readonly slot: number) {}

    /** This frame's order; none means the fighter put the flamethrower away or is not drawn. */
    order(o: StreamOrder | undefined): void {
        this.held = !!o;
        this.firing = !!o?.firing;
        if (!o) return;
        this.x = o.x; this.y = o.y; this.angle = o.angle;
        if (this.fresh) { this.front.x = o.x; this.front.y = o.y; this.fresh = false; }
    }

    /** Nothing more to draw: put away and burnt out. */
    get done(): boolean {
        return !this.held && this.power < 0.03;
    }

    /** Fade the power toward the trigger and spray this frame's particles; `share` is the quality tier's. */
    emit(dt: number, pools: FlamePools, share: number): void {
        const on = this.firing ? 1 : 0;
        this.power += (on - this.power) * Math.min(1, dt * (this.firing ? STREAM.fadeIn : STREAM.fadeOut));
        const pw = this.power;
        if (pw > 0.03) {
            this.spawn('flame', STREAM.flameRate * share * pw, dt, () => this.flame(pools.fire.get(share), dt));
            this.spawn('jet', STREAM.jetRate * share * pw, dt, () => this.jet(pools.jet.get(share), dt));
            this.spawn('spark', STREAM.sparkRate * share * pw, dt, () => this.spark(pools.spark.get(share)));
            this.spawn('smoke', STREAM.smokeRate * share * pw, dt, () => this.smoke(pools.smoke.get(share), pools.fire));
        }
        if (this.held) this.spawn('pilot', STREAM.pilotRate, dt, () => this.pilot(pools.jet.get(share)));
    }

    /** Ease the front toward the middle of this stream's flame (or halfway along the aim when there is none). */
    updateFront(dt: number, fronts: FrontSums): void {
        const n = fronts.n[this.slot];
        this.frontLive = n > 3;
        const tx = this.frontLive ? fronts.x[this.slot] / n : this.x + Math.cos(this.angle) * STREAM_REACH * 0.5;
        const ty = this.frontLive ? fronts.y[this.slot] / n : this.y + Math.sin(this.angle) * STREAM_REACH * 0.5;
        const k = Math.min(1, dt * 6);
        this.front.x += (tx - this.front.x) * k;
        this.front.y += (ty - this.front.y) * k;
    }

    private spawn(ch: Channel, perSecond: number, dt: number, make: () => boolean): void {
        this.acc[ch] += perSecond * dt;
        let n = Math.min(MAX_PER_FRAME, Math.floor(this.acc[ch]));
        this.acc[ch] -= Math.floor(this.acc[ch]);
        while (n-- > 0) if (!make()) return; // the pool is full
    }

    /** Spread births over the frame: each particle left the nozzle some time within it and flies that much more. */
    private lead(p: FlameParticle, dt: number): void {
        p.lead = rnd() * dt;
        p.age = p.lead;
    }

    private flame(p: FlameParticle | null, dt: number): boolean {
        if (!p) return false;
        const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
        const a = this.angle + (rnd() - 0.5) * STREAM.spread * (0.4 + 0.6 * rnd());
        const sp = STREAM.speed * (0.7 + rnd() * 0.55), off = (4 + rnd() * 14) * SCALE, j = (rnd() - 0.5) * 7 * SCALE;
        p.x = this.x + ca * off - sa * j; p.y = this.y + sa * off + ca * j;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        p.ttl = STREAM.life * (0.55 + rnd() * 0.8);
        p.s0 = (11 + rnd() * 13) * SCALE; p.s1 = (46 + rnd() * 54) * SCALE;
        p.rot = rnd() * Math.PI * 2; p.vr = (rnd() - 0.5) * 2.4;
        p.seed = rnd() * 100; p.tOff = (rnd() - 0.5) * 0.1;
        p.owner = this.slot;
        this.lead(p, dt);
        return true;
    }

    private jet(p: FlameParticle | null, dt: number): boolean {
        if (!p) return false;
        const a = this.angle + (rnd() - 0.5) * STREAM.spread * 0.5, sp = STREAM.speed * (1.05 + rnd() * 0.25);
        p.x = this.x + Math.cos(this.angle) * 4 * SCALE; p.y = this.y + Math.sin(this.angle) * 4 * SCALE;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        p.ttl = 0.1 + rnd() * 0.12; p.s0 = (5 + rnd() * 4) * SCALE;
        this.lead(p, dt);
        return true;
    }

    private spark(p: FlameParticle | null): boolean {
        if (!p) return false;
        const a = this.angle + (rnd() - 0.5) * STREAM.spread * 3.2, sp = STREAM.speed * (0.85 + rnd() * 0.6);
        p.x = this.x + Math.cos(this.angle) * 8 * SCALE; p.y = this.y + Math.sin(this.angle) * 8 * SCALE;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        p.ttl = 0.5 + rnd() * 0.7; p.s0 = 2.4 + rnd() * 2.4;
        return true;
    }

    /** Smoke rises from an older core of this stream's flame, or from halfway along the aim. */
    private smoke(p: FlameParticle | null, fire: ParticlePool): boolean {
        if (!p) return false;
        let dx = this.x + Math.cos(this.angle) * STREAM_REACH * 0.55, dy = this.y + Math.sin(this.angle) * STREAM_REACH * 0.55;
        let dvx = Math.cos(this.angle) * 60 * SCALE, dvy = -30 * SCALE;
        for (let k = 0; k < 8; k++) {
            const q = fire.items[Math.floor(rnd() * fire.items.length)];
            if (q.alive && q.owner === this.slot && q.age / q.ttl > 0.4) { dx = q.x; dy = q.y; dvx = q.vx * 0.22; dvy = q.vy * 0.2 - 30 * SCALE; break; }
        }
        p.x = dx + (rnd() - 0.5) * 28 * SCALE; p.y = dy + (rnd() - 0.5) * 28 * SCALE;
        p.vx = dvx; p.vy = dvy - rnd() * 40 * SCALE;
        p.ttl = 1.6 + rnd() * 1.6;
        p.s0 = (30 + rnd() * 24) * SCALE; p.s1 = p.s0 * (2.6 + rnd());
        p.rot = rnd() * Math.PI * 2; p.vr = (rnd() - 0.5) * 0.8;
        p.aMax = 0.07 + rnd() * 0.08; p.seed = rnd() * 100;
        return true;
    }

    private pilot(p: FlameParticle | null): boolean {
        if (!p) return false;
        p.pilot = true;
        const a = this.angle + (rnd() - 0.5) * 0.7, sp = (40 + rnd() * 60) * SCALE;
        p.x = this.x + Math.cos(this.angle) * 3 * SCALE; p.y = this.y + Math.sin(this.angle) * 3 * SCALE;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 20 * SCALE;
        p.ttl = 0.14 + rnd() * 0.16; p.s0 = (3.5 + rnd() * 4) * SCALE;
        return true;
    }
}
