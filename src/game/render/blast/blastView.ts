// Runs the explosions and rocket trails (BlastFx) for SmokeView, and contains their failures. The blast smoke grids
// use the smoke shader: when they fail, the error is logged once, the grids are freed and every later blast gets the
// simple smoke puffs. When the rest fails, the error is logged once and blasts are drawn no more (the smoke clouds
// and the soot are not touched). Made the first frame there is a blast, debris or a rocket to draw (it draws the
// flame's textures), kept until destroy(). Visual only.

import type { Container } from 'pixi.js';
import type { Stir } from '../smoke/airGrid';
import type { SmokeFrame } from '../smoke/cloudField';
import type { StepBudget } from '../smoke/stepBudget';
import { WeaponType } from '../../../types';
import { BlastFx } from './blastFx';

/** True when the frame has something to draw: a blast marker, flying debris or a rocket in flight. */
export const blastWanted = (frame: SmokeFrame): boolean =>
    frame.state.particles.some((p) => p.type === 'ring' || p.type === 'debris')
    || frame.state.projectiles.some((p) => p.type === WeaponType.ROCKET_LAUNCHER);

export class BlastView {
    private fx: BlastFx | null = null;
    private gridsFailed = false;
    private failed = false;

    /** The layer to keep on top, once made. */
    get layer(): Container | null {
        return this.fx?.layer ?? null;
    }

    /** True while a blast smoke grid is alive (it wants this frame's stirs). */
    get hasGrids(): boolean {
        return (this.fx?.grids ?? 0) > 0;
    }

    /** Draw the frame. `shader` false (the smoke shader failed) or `low` quality: blast smoke as simple puffs. Returns
     *  true when the layer was made or dropped this frame (the caller restacks its layers). */
    sync(now: number, frame: SmokeFrame | null, stirs: readonly Stir[], shader: boolean, budget?: StepBudget): boolean {
        if (this.failed || !frame) return false;
        const grids = shader && !this.gridsFailed && frame.quality !== 'low';
        let made = false;
        try {
            if (!this.fx) {
                if (!blastWanted(frame)) return false;
                this.fx = new BlastFx();
                made = true;
            }
            this.fx.sync(now, frame, stirs, grids, budget);
            return made;
        } catch (err) {
            return this.fail(err, grids) || made;
        }
    }

    destroy(): void {
        this.fx?.destroy();
        this.fx = null;
    }

    // A failure with grids on is taken for a grid failure (they are the only GPU-heavy part): no grids from now on.
    // A failure without grids ends the blasts. True when a layer was dropped.
    private fail(err: unknown, grids: boolean): boolean {
        if (grids && this.fx) {
            console.error('Blast smoke failed, drawing simple puffs:', err);
            this.gridsFailed = true;
            this.fx.dropGrids();
            return false;
        }
        console.error('Blast effects failed, drawing no blasts:', err);
        this.failed = true;
        const had = this.fx !== null;
        this.destroy();
        return had;
    }
}
