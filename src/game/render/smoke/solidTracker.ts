// The solids of one smoke grid: the platforms and intact cover that overlap its box, marked into the grid. Platforms
// never change in a match and cover never moves, so both are measured once: the cover pieces that overlap the box are
// found when the tracker first sees the cover list (again only if the list stops matching them, e.g. a new map), and
// after that a refresh only reads whether each of them is intact. Visual only.

import type { GameState } from '../../../types';
import { isKnownCoverKind, type Cover } from '../../cover/coverTypes';
import { coverRect, isIntact } from '../../cover/coverGeometry';
import type { AirGrid, Box } from './airGrid';

/** What the solids are made from: the platforms (fixed for the match) and the cover that can break. */
export type SolidSource = Pick<GameState, 'platforms' | 'cover'>;

export const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const NO_COVER: readonly Cover[] = [];

export class SolidTracker {
    private platformBoxes: Box[] | null = null;
    private list: readonly Cover[] | null = null;   // the cover list the pieces below were found in
    private listLength = 0;
    private readonly index: number[] = [];          // where each overlapping piece sits in that list
    private readonly ids: string[] = [];            // ... its id, to check that a new list still matches
    private readonly rects: Box[] = [];             // ... and its rect
    private readonly intact: boolean[] = [];        // ... and whether it was intact when the solids were last marked
    private marked = false;

    constructor(private readonly grid: AirGrid, private readonly box: Box) {}

    /** Mark the solids now, unless the intact cover in the box is the same as at the last call. */
    refresh(state: SolidSource): void {
        const cover = state.cover ?? NO_COVER;
        if (!this.matches(cover)) this.find(cover);
        let changed = !this.marked;
        const { index, intact } = this;
        for (let m = 0; m < index.length; m++) {
            const now = isIntact(cover[index[m]]);
            if (now !== intact[m]) { intact[m] = now; changed = true; }
        }
        if (!changed) return;
        this.marked = true;
        this.platformBoxes ??= state.platforms.filter(p => overlaps(this.box, p));
        const boxes = [...this.platformBoxes];
        for (let m = 0; m < index.length; m++) if (intact[m]) boxes.push(this.rects[m]);
        this.grid.markSolids(boxes);
    }

    // The same list, or one of the same length with the same pieces at the same places (a snapshot copy)
    private matches(cover: readonly Cover[]): boolean {
        if (cover === this.list) return true;
        if (this.list === null || cover.length !== this.listLength) return false;
        const { index, ids } = this;
        for (let m = 0; m < index.length; m++) if (cover[index[m]].id !== ids[m]) return false;
        this.list = cover;
        return true;
    }

    // Measure every piece once and keep those that overlap the box. A kind this build has no spec for cannot be sized:
    // it is left out, as the cover views leave it out.
    private find(cover: readonly Cover[]): void {
        this.list = cover;
        this.listLength = cover.length;
        this.index.length = this.ids.length = this.rects.length = this.intact.length = 0;
        this.marked = false;
        for (let k = 0; k < cover.length; k++) {
            const c = cover[k];
            if (!isKnownCoverKind(c.kind)) continue;
            const rect = coverRect(c);
            if (!overlaps(this.box, rect)) continue;
            this.index.push(k);
            this.ids.push(c.id);
            this.rects.push(rect);
            this.intact.push(false);
        }
    }
}
