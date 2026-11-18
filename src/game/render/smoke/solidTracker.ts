// The solids of one smoke grid: the platforms and intact cover that overlap its box, marked into the grid. Platforms
// never change in a match; cover can break and come back, so the marks follow the intact pieces in the box. Visual only.

import type { GameState } from '../../../types';
import { isKnownCoverKind, type Cover } from '../../cover/coverTypes';
import { coverRect, isIntact } from '../../cover/coverGeometry';
import type { AirGrid, Box } from './airGrid';

/** What the solids are made from: the platforms (fixed for the match) and the cover that can break. */
export type SolidSource = Pick<GameState, 'platforms' | 'cover'>;

export const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export class SolidTracker {
    private platformBoxes: Box[] | null = null;
    private coverKey: string | null = null;    // ids of the intact cover in the box when the solids were last marked

    constructor(private readonly grid: AirGrid, private readonly box: Box) {}

    /** Mark the solids now, unless the intact cover in the box is the same as at the last call. */
    refresh(state: SolidSource): void {
        const key = this.intactCoverKey(state);
        if (key === this.coverKey) return;
        this.coverKey = key;
        this.platformBoxes ??= state.platforms.filter(p => overlaps(this.box, p));
        const boxes = [...this.platformBoxes];
        for (const c of state.cover ?? []) if (this.isSolidCover(c)) boxes.push(coverRect(c));
        this.grid.markSolids(boxes);
    }

    private intactCoverKey(state: SolidSource): string {
        let key = '';
        for (const c of state.cover ?? []) if (this.isSolidCover(c)) key += `${c.id},`;
        return key;
    }

    // A kind this build has no spec for cannot be sized: it is left out, as the cover views leave it out
    private isSolidCover(c: Cover): boolean {
        return isIntact(c) && isKnownCoverKind(c.kind) && overlaps(this.box, coverRect(c));
    }
}
