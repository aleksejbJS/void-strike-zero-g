// A fixed pool of plain flame-particle records (no Pixi): flame cores, nozzle streaks, sparks or smoke.
// Records are reused through a free list; a full pool refuses new particles instead of growing.

export interface FlameParticle {
    readonly idx: number;
    alive: boolean;
    x: number; y: number; vx: number; vy: number;
    age: number; ttl: number;
    s0: number; s1: number;      // px size at birth and at full growth
    rot: number; vr: number;
    seed: number; tOff: number;  // turbulence phase; colour offset along the ramp
    aMax: number;                // peak alpha (smoke)
    soft: number;                // alpha factor (splash-fire cores are a bit dimmer)
    pilot: boolean;              // a pilot-light flicker, not a nozzle streak
    bounces: number;
    owner: number;               // slot of the stream that sprayed it, -1 for splash or body fire
    lead: number;                // s of flight still owed from its birth frame (births are spread over the frame)
    // What the sprite shows this frame, written by particleMotion
    w: number; h: number; angle: number; tint: number; alpha: number;
}

const blank = (idx: number): FlameParticle => ({
    idx, alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, ttl: 1, s0: 8, s1: 40, rot: 0, vr: 0,
    seed: 0, tOff: 0, aMax: 0.15, soft: 1, pilot: false, bounces: 0, owner: -1, lead: 0,
    w: 0, h: 0, angle: 0, tint: 0xffffff, alpha: 0,
});

export class ParticlePool {
    readonly items: FlameParticle[];
    private readonly free: number[] = [];
    count = 0;

    constructor(readonly cap: number) {
        this.items = Array.from({ length: cap }, (_, i) => blank(i));
        for (let i = cap - 1; i >= 0; i--) this.free.push(i);
    }

    /** A fresh live particle, or null when `share` of the pool is already alive. */
    get(share = 1): FlameParticle | null {
        if (this.count >= this.cap * share) return null;
        const i = this.free.pop();
        if (i === undefined) return null;
        const p = this.items[i];
        p.alive = true; p.age = 0; p.bounces = 0; p.pilot = false; p.soft = 1; p.owner = -1; p.lead = 0; p.alpha = 0;
        this.count++;
        return p;
    }

    kill(p: FlameParticle): void {
        if (!p.alive) return;
        p.alive = false;
        p.alpha = 0;
        this.free.push(p.idx);
        this.count--;
    }

    clear(): void {
        for (const p of this.items) this.kill(p);
    }
}
