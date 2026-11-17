// The volumetric flame of one game view (the game screen or a watched match tile): every flamethrower stream,
// splash fire and burning fighter, drawn from the orders the fighters gave this frame. Looks only — the
// simulation decides who burns. One engine per view, shared by all its fighters, with fixed sprite pools.

import { Container } from 'pixi.js';
import type { GameState } from '../../../types';
import { keepOnTop } from '../effects/keepOnTop';
import { FlameSim } from './flameSim';
import type { FlameOrders } from './flameOrders';
import type { Surface } from './particleMotion';
import type { FlameQuality } from './flameTuning';
import { flameTextures } from './flameTextures';
import { ParticleSprites } from './particleSprites';
import { PatchSprites } from './patchSprites';
import { FlameGlows } from './flameGlows';
import { nearbySurfaces } from './flameSurfaces';

export class FlameFx {
    private readonly sim: FlameSim;
    /** Everything but the soot, bottom to top: smoke, fire beds, tongues, light, flame cores, nozzle jets, sparks. */
    private readonly root = new Container();
    private readonly smoke: ParticleSprites;
    private readonly fire: ParticleSprites;
    private readonly jet: ParticleSprites;
    private readonly sparks: ParticleSprites;
    private readonly patches: PatchSprites;
    private readonly glows: FlameGlows;
    private readonly surfaces: Surface[] = [];
    private last = Number.NaN;
    private destroyed = false;

    /** Flame goes on top of `gameLayer`; soot marks into `decalLayer`, under the fighters. */
    constructor(private readonly gameLayer: Container, private readonly decalLayer: Container, quality: FlameQuality) {
        this.sim = new FlameSim(quality);
        const tex = flameTextures();
        const { pools } = this.sim;
        this.smoke = new ParticleSprites(pools.smoke, tex.smoke, false);
        this.fire = new ParticleSprites(pools.fire, tex.flame, true);
        this.jet = new ParticleSprites(pools.jet, tex.core, true);
        this.sparks = new ParticleSprites(pools.spark, tex.ember, true);
        this.patches = new PatchSprites(this.sim.patches, this.sim.marks, tex);
        this.glows = new FlameGlows(tex.glow);
        this.root.addChild(this.smoke.layer, this.patches.patchLayer, this.patches.tongueLayer, this.glows.layer,
            this.fire.layer, this.jet.layer, this.sparks.layer);
    }

    /** Fires burning in place (splash fire and burning fighters), for the crackle sound. */
    get burning(): number {
        return this.sim.burning;
    }

    /** Step to `now` (ms) with this frame's `orders` (cleared here) and redraw. */
    update(now: number, orders: FlameOrders, world: Pick<GameState, 'platforms' | 'cover'>): void {
        if (this.destroyed) { orders.clear(); return; }
        const dt = Number.isFinite(this.last) && now >= this.last ? (now - this.last) / 1000 : 0;
        this.last = now;
        this.sim.update(dt, orders, nearbySurfaces(world, this.sim.pools, orders, this.surfaces));
        orders.clear();

        const { time, colors } = this.sim;
        this.smoke.sync();
        this.patches.sync(time, colors);
        this.glows.sync(this.sim.streams.values(), time, colors);
        this.fire.sync();
        this.jet.sync();
        this.sparks.sync();
        keepOnTop(this.gameLayer, [this.root]);
        if (this.patches.markLayer.parent !== this.decalLayer) this.decalLayer.addChild(this.patches.markLayer);
    }

    /** Destroy every sprite (the shared textures stay); the engine is not usable afterwards. */
    clear(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.sim.clear();
        this.patches.markLayer.removeFromParent();
        this.patches.destroy(); // also its mark layer
        this.glows.destroy();
        for (const v of [this.smoke, this.fire, this.jet, this.sparks]) v.destroy();
        this.root.destroy({ children: true });
    }
}
