// The drawn flame of one game view, without Pixi: every flamethrower stream, splash fire, burning fighter
// and soot mark, stepped once a frame from the fighters' orders. FlameFx draws what this holds.

import { buildColors, FlameColors, FlamePaletteId } from './flamePalettes';
import { FlameOrders } from './flameOrders';
import { FlamePools, FlameStream } from './flameStream';
import { FirePatches } from './firePatches';
import { ScorchMarks } from './scorchMarks';
import { ParticlePool } from './particlePool';
import { FrontSums, MotionEnv, moveFire, moveJet, moveSmoke, moveSparks, Surface } from './particleMotion';
import { FlameQuality, MAX_DT, POOL, QUALITY_SHARE } from './flameTuning';

export class FlameSim {
    readonly pools: FlamePools = {
        fire: new ParticlePool(POOL.fire),
        jet: new ParticlePool(POOL.jet),
        spark: new ParticlePool(POOL.spark),
        smoke: new ParticlePool(POOL.smoke),
    };
    readonly streams = new Map<string, FlameStream>();
    readonly marks = new ScorchMarks(POOL.marks);
    readonly patches = new FirePatches(POOL.patches, this.marks);
    readonly colors: FlameColors;
    time = 0;
    private readonly fronts = new FrontSums();
    private readonly freeSlots: number[] = [];
    private readonly env: MotionEnv;

    constructor(readonly quality: FlameQuality = 'high', palette: FlamePaletteId = 'napalm') {
        this.colors = buildColors(palette);
        for (let s = POOL.streams - 1; s >= 0; s--) this.freeSlots.push(s);
        this.env = {
            dt: 0, time: 0, colors: this.colors, surfaces: [], fronts: this.fronts,
            splash: (x, y, nx, ny) => this.patches.splash(x, y, nx, ny),
        };
    }

    /** Fires burning in place: splash fire and burning fighters (for the crackle sound). */
    get burning(): number {
        return this.patches.burning;
    }

    /** Step `dt` seconds with this frame's orders, against `surfaces` (platforms and intact cover near the flame). */
    update(dt: number, orders: FlameOrders, surfaces: readonly Surface[]): void {
        const step = Math.min(Math.max(0, dt), MAX_DT);
        this.time += step;
        const share = QUALITY_SHARE[this.quality];

        for (const id of orders.streams.keys()) {
            if (this.streams.has(id)) continue;
            const slot = this.freeSlots.pop();
            if (slot === undefined) continue; // more flamethrowers on screen than slots: the extra ones are not drawn
            this.streams.set(id, new FlameStream(slot));
        }
        for (const [id, s] of this.streams) {
            s.order(orders.streams.get(id));
            s.emit(step, this.pools, share);
        }
        for (const [id, o] of orders.bodies) this.patches.body(id, o);

        this.fronts.reset();
        Object.assign(this.env, { dt: step, time: this.time, surfaces });
        moveFire(this.pools.fire, this.env);
        moveJet(this.pools.jet, this.env);
        moveSparks(this.pools.spark, this.env);
        moveSmoke(this.pools.smoke, this.env);
        this.patches.update(step, this.pools, share);
        this.marks.update(step);

        for (const [id, s] of this.streams) {
            s.updateFront(step, this.fronts);
            if (!s.done) continue;
            this.streams.delete(id);
            this.freeSlots.push(s.slot);
        }
    }

    clear(): void {
        for (const pool of Object.values(this.pools)) pool.clear();
        for (const s of this.streams.values()) this.freeSlots.push(s.slot);
        this.streams.clear();
        this.patches.clear();
        this.marks.clear();
    }
}
