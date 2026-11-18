import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cover } from '../../cover/coverTypes';
import * as geometry from '../../cover/coverGeometry';
import { AirGrid } from './airGrid';
import { SolidTracker, type SolidSource } from './solidTracker';

// Count how often the tracker measures a cover piece
vi.mock('../../cover/coverGeometry', async (importOriginal) => {
    const real = await importOriginal<typeof import('../../cover/coverGeometry')>();
    return { ...real, coverRect: vi.fn(real.coverRect) };
});

const crate = (id: string, x: number, hp = 150): Cover => ({ id, kind: 'wood', pos: { x, y: 548 }, hp });   // 50 x 46, bottom at 548

describe('SolidTracker', () => {
    const box = { x: 700, y: 400, w: 200, h: 200 };
    let grid: AirGrid;
    beforeEach(() => {
        grid = new AirGrid(20, box.x, box.y, box.w);
        vi.mocked(geometry.coverRect).mockClear();
    });
    const solidAt = (x: number, y: number) => grid.solid[Math.floor((x - box.x) / grid.cell) + Math.floor((y - box.y) / grid.cell) * grid.n];

    it('measures the cover once, then only follows which pieces are intact', () => {
        const inBox = crate('in', 800), outside = crate('out', 2000);
        const state: SolidSource = { platforms: [], cover: [inBox, outside] };
        const tracker = new SolidTracker(grid, box);
        const marks = vi.spyOn(grid, 'markSolids');
        tracker.refresh(state);
        const measured = vi.mocked(geometry.coverRect).mock.calls.length;
        for (let k = 0; k < 20; k++) tracker.refresh(state);
        expect(vi.mocked(geometry.coverRect).mock.calls.length).toBe(measured);    // no measuring per step
        expect(marks).toHaveBeenCalledTimes(1);
        expect(solidAt(800, 530)).toBe(1);

        inBox.hp = 0;                                                             // broken: the air goes through
        tracker.refresh(state);
        expect(solidAt(800, 530)).toBe(0);
        inBox.hp = 150;                                                           // back
        tracker.refresh(state);
        expect(solidAt(800, 530)).toBe(1);
        outside.hp = 0;                                                           // a piece outside the box changes nothing
        tracker.refresh(state);
        expect(marks).toHaveBeenCalledTimes(3);
        expect(vi.mocked(geometry.coverRect).mock.calls.length).toBe(measured);
    });

    it('follows a new cover list with the same pieces (a snapshot) without measuring again, and a different one by measuring', () => {
        const tracker = new SolidTracker(grid, box);
        tracker.refresh({ platforms: [], cover: [crate('a', 800)] });
        const measured = vi.mocked(geometry.coverRect).mock.calls.length;
        tracker.refresh({ platforms: [], cover: [crate('a', 800, 0)] });          // same piece, new objects, now broken
        expect(solidAt(800, 530)).toBe(0);
        expect(vi.mocked(geometry.coverRect).mock.calls.length).toBe(measured);
        tracker.refresh({ platforms: [], cover: [crate('b', 760), crate('a', 800)] });    // a different list
        expect(solidAt(760, 530)).toBe(1);
        expect(solidAt(800, 530)).toBe(1);
    });

    it('marks the platforms in the box and leaves out a cover kind it cannot size', () => {
        const odd = { ...crate('odd', 800), kind: 'mystery' } as unknown as Cover;
        const tracker = new SolidTracker(grid, box);
        tracker.refresh({ platforms: [{ x: 650, y: 580, w: 300, h: 40 }] as SolidSource['platforms'], cover: [odd] });
        expect(solidAt(720, 590)).toBe(1);
        expect(solidAt(800, 530)).toBe(0);
    });
});
