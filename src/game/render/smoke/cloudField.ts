// The smoke clouds of one game view: one air grid and one shader quad per gameplay cloud (CloudEntry), made
// when a cloud first appears and freed when it goes. Each frame the field takes the frame's stirs (gathered once
// by the caller's StirFeed), decides which clouds are worth stepping (the four nearest the view centre every frame,
// the others at half rate, those outside the view and a margin not at all) and draws the ones in view. Visual only.

import { Container } from 'pixi.js';
import type { GameState, SmokeCloud } from '../../../types';
import type { AirGrid, Box, Stir } from './airGrid';
import { CloudEntry } from './cloudEntry';
import type { FlameAir } from './flameAir';
import type { StepBudget } from './stepBudget';
import { GRID_N, VIEW_MARGIN, type SmokeQuality } from './smokeTuning';

/** What a frame of drawing knows: the game state, the flame engine's view of its streams, the visible world rect, the grid quality. */
export type SmokeFrame = { state: GameState; flame: FlameAir | null; view: Box; quality: SmokeQuality };

const FULL_RATE_CLOUDS = 4;                     // clouds nearest the view centre that step every frame
const FALLBACK_QUALITY: SmokeQuality = 'low';   // grid size when there is no frame to say (previews, tests)

const NO_STIRS: readonly Stir[] = [];

const byDistance = (a: CloudEntry, b: CloudEntry): number => a.dist2 - b.dist2;

export class CloudField {
    readonly layer = new Container();
    private readonly entries = new Map<string, CloudEntry>();
    private readonly inView: CloudEntry[] = []; // reused each frame
    private stamp = 0;
    private destroyed = false;

    /** The air grid of a cloud, for tests. */
    gridOf(id: string): AirGrid | undefined {
        return this.entries.get(id)?.grid;
    }

    /** Show exactly `smokes`: make, step, draw and free clouds. `now` is in ms. `stirs` are this frame's stirs, gathered
     *  once by the caller (the list is read, not kept); `budget` is the frame's step budget, shared with the plumes.
     *  Without a `frame` every cloud steps at full rate, none is left out and its grid size is the fallback quality's. */
    sync(smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null, stirs: readonly Stir[] = NO_STIRS, budget?: StepBudget): void {
        if (this.destroyed) return;
        if (smokes.length === 0) {
            if (this.entries.size > 0) this.dropAll();
            return;
        }
        this.track(smokes, now, frame);
        if (!frame) {
            for (const entry of this.entries.values()) this.stepAndShow(entry, now, true, null);
            return;
        }
        this.stepInView(now, frame, stirs, budget);
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
    }

    // Clouds in the view (plus margin) share the work, nearest the view centre first; the rest sleep
    private stepInView(now: number, frame: SmokeFrame, stirs: readonly Stir[], budget?: StepBudget): void {
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
            inView[i].queueStirs(stirs);
            this.stepAndShow(inView[i], now, i < FULL_RATE_CLOUDS, state, budget);
        }
    }

    private stepAndShow(entry: CloudEntry, now: number, full: boolean, state: GameState | null, budget?: StepBudget): void {
        entry.advance(now, full, state, budget);
        entry.show(now);
    }
}
