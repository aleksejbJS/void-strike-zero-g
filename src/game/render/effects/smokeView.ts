// Draws GameState.smokes: each cloud as a stirred air grid drawn by a shader (see smoke/cloudField), and, when your
// own fighter stands in smoke, a faint outline of its hitbox over the clouds so you do not lose yourself. Under the
// clouds it draws the flamethrower's soot plumes (see smoke/sootPlumes), which replace the flame's own smoke sprites.
// Without a working shader (no WebGL, a failed upload) it logs once and draws the old grey circles (see smokePuffs)
// from then on; a failing plume path logs once and draws no soot. Owns the frame's stir feed: stirs are gathered once
// per frame and shared by the clouds and the plumes.
// It is the top effect view: above fighters, projectiles, particles and beams.

import { Container, Graphics } from 'pixi.js';
import { SmokeCloud } from '../../../types';
import { SmokeSilhouette } from '../smokeVisibility';
import type { Stir } from '../smoke/airGrid';
import { CloudField, type SmokeFrame } from '../smoke/cloudField';
import { SootPlumes, sootWanted } from '../smoke/sootPlumes';
import { StirFeed } from '../smoke/stirFeed';
import { cloudCircles } from './smokePuffs';
import { keepOnTop } from './keepOnTop';

const SILHOUETTE_COLOR = 0xffffff;
const SILHOUETTE_ALPHA = 0.45;
const SILHOUETTE_WIDTH = 1.5;
const SILHOUETTE_CORNER = 6;

export class SmokeView {
    private readonly gfx = new Graphics();      // the outline of your fighter; the grey circles too, if the shader failed
    private readonly context = this.gfx.context; // kept here: a Graphics destroyed with the stage forgets its context
    private readonly feed = new StirFeed();
    private field: CloudField | null = null;    // made when the first cloud appears
    private plumes: SootPlumes | null = null;   // made when the flame first leaves soot
    private stack: Container[] = [this.gfx];    // what stays on top of the layer, bottom to top: the soot plumes, the clouds, the outline
    private failed = false;                     // the shader clouds failed: circles from now on, no retry
    private sootFailed = false;                 // the plumes failed: no soot from now on, no retry
    private destroyed = false;
    private drawn = false;

    constructor(private readonly layer: Container) {
        this.raise();
    }

    /** Show exactly the given clouds, and the local fighter's outline when it is in smoke. Without a `frame` (a
     *  preview) the clouds do not react to anything and none is skipped; the renderer passes the frame every time. */
    sync(smokes: readonly SmokeCloud[], now: number, silhouette: SmokeSilhouette | null, frame: SmokeFrame | null = null): void {
        if (this.destroyed) return;
        const stirs = this.stirsOf(smokes, now, frame);
        const circles = !this.drive(smokes, now, frame, stirs);
        this.driveSoot(now, frame, stirs);
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

    /** Free the clouds and destroy the Graphics; the view is not usable afterwards. Safe to call twice, and after the
     *  stage was destroyed (the game screen tears the Pixi app down first, then clears its views). */
    clear(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.field?.destroy();
        this.field = null;
        this.plumes?.destroy();
        this.plumes = null;
        this.feed.idle();
        const { gfx } = this;
        gfx.parent?.removeChild(gfx);
        if (!gfx.destroyed) gfx.destroy({ children: true, context: true });
        else this.context.destroy();                // the stage destroyed the Graphics but left its context
    }

    // This frame's stirs: one collect, shared by the clouds and the plumes, and only while one of them has something
    // to react (a cloud, a plume alive, or soot in the flame this frame); otherwise the feed forgets what it followed
    private stirsOf(smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null): readonly Stir[] {
        const clouds = !this.failed && smokes.length > 0;
        const soot = !this.sootFailed && ((this.plumes?.count ?? 0) > 0 || sootWanted(frame));
        return frame && (clouds || soot) ? this.feed.collect(frame.state, frame.flame, now) : this.feed.idle();
    }

    // Run the shader clouds. False when they are not there (failed now or before): the caller draws circles instead.
    private drive(smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null, stirs: readonly Stir[]): boolean {
        if (this.failed) return false;
        if (!this.field && smokes.length === 0) return true;      // nothing to make, nothing to do
        try {
            if (!this.field) {
                this.field = new CloudField();
                this.stack = this.stackOf();
            }
            this.field.sync(smokes, now, frame, stirs);
            return true;
        } catch (err) {
            this.fail(err);
            return false;
        }
    }

    // Run the soot plumes: made when the flame first leaves soot, kept (empty) after that
    private driveSoot(now: number, frame: SmokeFrame | null, stirs: readonly Stir[]): void {
        if (this.sootFailed || (!this.plumes && !sootWanted(frame))) return;
        try {
            if (!this.plumes) {
                this.plumes = new SootPlumes();
                this.stack = this.stackOf();
            }
            this.plumes.sync(now, frame, stirs, this.feed.frameDt);
        } catch (err) {
            console.error('Soot plumes failed, the flame draws no soot:', err);
            this.sootFailed = true;
            this.plumes?.destroy();
            this.plumes = null;
            this.stack = this.stackOf();
        }
    }

    private fail(err: unknown): void {
        console.error('Smoke shader failed, drawing simple clouds:', err);
        this.failed = true;
        this.field?.destroy();
        this.field = null;
        this.stack = this.stackOf();
    }

    // What stays on top, bottom to top
    private stackOf(): Container[] {
        const stack: Container[] = [];
        if (this.plumes) stack.push(this.plumes.layer);
        if (this.field) stack.push(this.field.layer);
        stack.push(this.gfx);
        return stack;
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
