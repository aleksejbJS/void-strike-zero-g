// Draws GameState.smokes: each cloud as grey puffs around an opaque core (see smokePuffs), and,
// when your own fighter stands in smoke, a faint outline of its hitbox over the clouds so you
// do not lose yourself. Clouds are few, so one Graphics repainted each frame serves them all.
// It is the top effect view: above fighters, projectiles, particles and beams.

import { Container, Graphics } from 'pixi.js';
import { SmokeCloud } from '../../../types';
import { SmokeSilhouette } from '../smokeVisibility';
import { cloudCircles } from './smokePuffs';
import { keepOnTop } from './keepOnTop';

const SILHOUETTE_COLOR = 0xffffff;
const SILHOUETTE_ALPHA = 0.45;
const SILHOUETTE_WIDTH = 1.5;
const SILHOUETTE_CORNER = 6;

export class SmokeView {
    private readonly gfx = new Graphics();
    private drawn = false;

    constructor(private readonly layer: Container) {
        this.raise();
    }

    /** Show exactly the given clouds, and the local fighter's outline when it is in smoke. */
    sync(smokes: readonly SmokeCloud[], now: number, silhouette: SmokeSilhouette | null): void {
        this.raise();
        if (!smokes.length && !silhouette && !this.drawn) return;
        const g = this.gfx;
        g.clear();
        for (const cloud of smokes) {
            for (const c of cloudCircles(cloud, now)) g.circle(c.x, c.y, c.r).fill({ color: c.color, alpha: c.alpha });
        }
        if (silhouette) {
            const { x, y, w, h } = silhouette;
            g.roundRect(x - w / 2, y - h, w, h, SILHOUETTE_CORNER)
                .stroke({ width: SILHOUETTE_WIDTH, color: SILHOUETTE_COLOR, alpha: SILHOUETTE_ALPHA });
        }
        this.drawn = smokes.length > 0 || silhouette !== null;
    }

    /** Destroy the Graphics; the view is not usable afterwards. */
    clear(): void {
        this.gfx.parent?.removeChild(this.gfx);
        if (!this.gfx.destroyed) this.gfx.destroy();
    }

    // Fighters and ragdolls added to the layer later would otherwise stand in front of the cloud.
    // keepOnTop only keeps foreign children below the effect stack; the other effect views can
    // still end up above us after a floating text reshuffles them, and a muzzle flash or blood
    // over the cloud would give away who is in it, so the cloud also insists on the very top.
    private raise(): void {
        keepOnTop(this.layer, [this.gfx]); // registers the cloud as an effect view for the others
        const kids = this.layer.children;
        if (kids[kids.length - 1] !== this.gfx) this.layer.addChild(this.gfx);
    }
}
