// The smoke clouds of one game view: one air grid and one shader quad per gameplay cloud (CloudEntry), made
// when a cloud first appears and freed when it goes. Each frame the field gathers the frame's stirs once,
// decides which clouds are worth stepping (the four nearest the view centre every frame, the others at half
// rate, those outside the view and a margin not at all) and draws the ones in view. Visual only.

import { Container } from 'pixi.js';
import type { GameState, SmokeCloud } from '../../../types';
import type { AirGrid, Box, Stir } from './airGrid';
import { CloudEntry } from './cloudEntry';
import type { FlameAir } from './flameAir';
import { SmokeStirs } from './smokeStirs';
import { GRID_N, type SmokeQuality } from './smokeTuning';

/** What a frame of drawing knows: the game state, the flame engine's view of its streams, the visible world rect, the grid quality. */
export type SmokeFrame = { state: GameState; flame: FlameAir | null; view: Box; quality: SmokeQuality };

const FULL_RATE_CLOUDS = 4;                     // clouds nearest the view centre that step every frame
const VIEW_MARGIN = 200;                        // px: a cloud this far outside the view still steps, so it is ready when it comes in
const FALLBACK_QUALITY: SmokeQuality = 'low';   // grid size when there is no frame to say (previews, tests)

const byDistance = (a: CloudEntry, b: CloudEntry): number => a.dist2 - b.dist2;

export class CloudField {
    readonly layer = new Container();
    private readonly entries = new Map<string, CloudEntry>();
    private readonly stirs = new SmokeStirs();
    private readonly frameStirs: Stir[] = [];   // this frame's stirs, rebuilt by SmokeStirs.collect
    private readonly inView: CloudEntry[] = []; // reused each frame
    private stamp = 0;
    private watching = false;                   // did the last sync collect stirs (so the stir memory is current)
    private destroyed = false;

    /** The air grid of a cloud, for tests. */
    gridOf(id: string): AirGrid | undefined {
        return this.entries.get(id)?.grid;
    }

    /** Show exactly `smokes`: make, step, draw and free clouds. `now` is in ms. Without a `frame` every cloud
     *  steps at full rate with no stirs, none is left out and its grid size is the fallback quality's. */
    sync(smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null): void {
        if (this.destroyed) return;
        if (smokes.length === 0) {
            if (this.watching || this.entries.size > 0) this.dropAll();
            return;
        }
        this.track(smokes, now, frame);
        if (!frame) {
            this.watching = false;
            for (const entry of this.entries.values()) this.stepAndShow(entry, now, true, null);
            return;
        }
        // The stirs follow what changes from frame to frame: after a frame that did not collect, their memory is stale
        if (!this.watching) this.stirs.reset();
        this.watching = true;
        this.stirs.collect(frame.state, frame.flame, this.frameStirs);
        this.stepInView(now, frame);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.dropAll();
        this.layer.parent?.removeChild(this.layer);
        this.layer.destroy();
    }

    private add(cloud: SmokeCloud, now: number, frame: SmokeFrame | null): CloudEntry {
        const n = GRID_N[frame?.quality ?? FALLBACK_QUALITY];
        const entry = new CloudEntry(cloud, n, now, frame?.state ?? null);
        this.entries.set(cloud.id, entry);
        this.layer.addChild(entry.quad.mesh);
        return entry;
    }

    // Make the entries of new clouds, free those of clouds that are gone
    private track(smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null): void {
        const stamp = ++this.stamp;
        for (const cloud of smokes) {
            const entry = this.entries.get(cloud.id) ?? this.add(cloud, now, frame);
            entry.stamp = stamp;
        }
        for (const [id, entry] of this.entries) {
            if (entry.stamp === stamp) continue;
            entry.destroy();
            this.entries.delete(id);
        }
    }

    private dropAll(): void {
        for (const entry of this.entries.values()) entry.destroy();
        this.entries.clear();
        this.inView.length = 0;
        this.frameStirs.length = 0;
        this.watching = false;
    }

    // Clouds in the view (plus margin) share the work, nearest the view centre first; the rest sleep
    private stepInView(now: number, frame: SmokeFrame): void {
        const { view, state } = frame;
        const vx0 = view.x - VIEW_MARGIN, vx1 = view.x + view.w + VIEW_MARGIN;
        const vy0 = view.y - VIEW_MARGIN, vy1 = view.y + view.h + VIEW_MARGIN;
        const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
        const { inView } = this;
        inView.length = 0;
        for (const entry of this.entries.values()) {
            const { x, y, w, h } = entry.box;
            if (x > vx1 || x + w < vx0 || y > vy1 || y + h < vy0) {
                entry.sleep(now);
                continue;
            }
            entry.dist2 = (entry.cloud.pos.x - cx) ** 2 + (entry.cloud.pos.y - cy) ** 2;
            inView.push(entry);
        }
        inView.sort(byDistance);
        for (let i = 0; i < inView.length; i++) {
            inView[i].queueStirs(this.frameStirs);
            this.stepAndShow(inView[i], now, i < FULL_RATE_CLOUDS, state);
        }
    }

    private stepAndShow(entry: CloudEntry, now: number, full: boolean, state: GameState | null): void {
        entry.advance(now, full, state);
        entry.show(now);
    }
}
