// The stirs of one rendered frame, gathered once and shared by everything in the air that reacts to them (the smoke
// clouds, later the soot plumes). The feed measures the frame time between calls and forgets what it followed (shots,
// blasts, beams) after a frame it was not asked, so a long gap does not turn into one long chain of stirs. Visual only.

import type { GameState } from '../../../types';
import type { Stir } from './airGrid';
import type { FlameAir } from './flameAir';
import { SmokeStirs } from './smokeStirs';
import { IMPULSE_DT } from './smokeTuning';

const NO_STIRS: readonly Stir[] = [];

export class StirFeed {
    private readonly source = new SmokeStirs();
    private readonly out: Stir[] = [];          // this frame's stirs, rebuilt by every collect
    private lastNow = 0;                        // time (ms) of the last collect
    private watching = false;                   // was the last frame collected (so the memory of the source is current)

    /** Gather this frame's stirs. Call once per rendered frame, and only while something needs them. `now` is in ms.
     *  The list is reused: it is valid until the next call. */
    collect(state: GameState, flame: FlameAir | null, now: number): readonly Stir[] {
        // After a frame that did not collect, the memory is stale and there is no frame time to measure (60 Hz is assumed)
        let frameDt = IMPULSE_DT;
        if (this.watching) frameDt = (now - this.lastNow) / 1000;
        else this.source.reset();
        this.watching = true;
        this.lastNow = now;
        this.source.collect(state, flame, this.out, frameDt);
        return this.out;
    }

    /** A frame with nothing to stir (no smoke, no frame): drop the list and the memory. Returns the empty list. */
    idle(): readonly Stir[] {
        this.watching = false;
        this.out.length = 0;
        return NO_STIRS;
    }
}
