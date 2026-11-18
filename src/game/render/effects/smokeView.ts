// Draws GameState.smokes: each cloud as a stirred air grid drawn by a shader (see smoke/cloudField), and, when your
// own fighter stands in smoke, a faint outline of its hitbox over the clouds so you do not lose yourself.
// Without a working shader (no WebGL, a failed upload) it logs once and draws the old grey circles (see smokePuffs)
// from then on. Owns the frame's stir feed: stirs are gathered once per frame and shared by everything that uses them.
// It is the top effect view: above fighters, projectiles, particles and beams.

import { Container, Graphics } from 'pixi.js';
import { SmokeCloud } from '../../../types';
import { SmokeSilhouette } from '../smokeVisibility';
import { CloudField, type SmokeFrame } from '../smoke/cloudField';
import { StirFeed } from '../smoke/stirFeed';
import { cloudCircles } from './smokePuffs';
import { keepOnTop } from './keepOnTop';

const SILHOUETTE_COLOR = 0xffffff;
const SILHOUETTE_ALPHA = 0.45;
const SILHOUETTE_WIDTH = 1.5;
const SILHOUETTE_CORNER = 6;

export class SmokeView {
    private readonly gfx = new Graphics();      // the outline of your fighter; the grey circles too, if the shader failed
    private readonly feed = new StirFeed();
    private field: CloudField | null = null;    // made when the first cloud appears
    private stack: Container[] = [this.gfx];    // what stays on top of the layer, bottom to top: the cloud layer, then the outline
    private failed = false;                     // the shader clouds failed: circles from now on, no retry
    private destroyed = false;
    private drawn = false;

    constructor(private readonly layer: Container) {
        this.raise();
    }

    /** Show exactly the given clouds, and the local fighter's outline when it is in smoke. Without a `frame` (a
     *  preview) the clouds do not react to anything and none is skipped; the renderer passes the frame every time. */
    sync(smokes: readonly SmokeCloud[], now: number, silhouette: SmokeSilhouette | null, frame: SmokeFrame | null = null): void {
        if (this.destroyed) return;
        const circles = !this.drive(smokes, now, frame);
        this.raise();
        const wanted = silhouette !== null || (circles && smokes.length > 0);
        if (!wanted && !this.drawn) return;
        const g = this.gfx;
        g.clear();
        if (circles) {
            for (const cloud of smokes) {
                for (const c of cloudCircles(cloud, now)) g.circle(c.x, c.y, c.r).fill({ color: c.color, alpha: c.alpha });
            }
        }
        if (silhouette) {
            const { x, y, w, h } = silhouette;
            g.roundRect(x - w / 2, y - h, w, h, SILHOUETTE_CORNER)
                .stroke({ width: SILHOUETTE_WIDTH, color: SILHOUETTE_COLOR, alpha: SILHOUETTE_ALPHA });
        }
        this.drawn = wanted;
    }

    /** Free the clouds and destroy the Graphics; the view is not usable afterwards. */
    clear(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.field?.destroy();
        this.field = null;
        this.feed.idle();
        this.gfx.parent?.removeChild(this.gfx);
        if (!this.gfx.destroyed) this.gfx.destroy({ children: true, context: true });
    }

    // Run the shader clouds. False when they are not there (failed now or before): the caller draws circles instead.
    private drive(smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null): boolean {
        if (this.failed) return false;
        if (!this.field && smokes.length === 0) return true;      // nothing to make, nothing to do
        try {
            if (!this.field) {
                this.field = new CloudField();
                this.stack = [this.field.layer, this.gfx];
            }
            // One collect per frame, only while smoke exists; every cloud (and later every plume) shares its list
            const stirs = frame && smokes.length > 0 ? this.feed.collect(frame.state, frame.flame, now) : this.feed.idle();
            this.field.sync(smokes, now, frame, stirs);
            return true;
        } catch (err) {
            this.fail(err);
            return false;
        }
    }

    private fail(err: unknown): void {
        console.error('Smoke shader failed, drawing simple clouds:', err);
        this.failed = true;
        this.field?.destroy();
        this.field = null;
        this.stack = [this.gfx];
        this.feed.idle();
    }

    // Fighters and ragdolls added to the layer later would otherwise stand in front of the cloud.
    // keepOnTop only keeps foreign children below the effect stack; the other effect views can
    // still end up above us after a floating text reshuffles them, and a muzzle flash or blood
    // over the cloud would give away who is in it, so the cloud also insists on the very top.
    private raise(): void {
        const { layer, stack } = this;
        keepOnTop(layer, stack); // registers the clouds and the outline as effect views for the others
        const kids = layer.children, top = kids.length - 1;
        for (let i = 0; i < stack.length; i++) {
            if (kids[top - (stack.length - 1 - i)] === stack[i]) continue;
            layer.addChild(...stack);
            return;
        }
    }
}
