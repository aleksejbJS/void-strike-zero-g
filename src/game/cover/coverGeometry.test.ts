import { describe, it, expect } from 'vitest';
import { Cover, CoverKind, COVER_SPECS } from './coverTypes';
import { blastBlocks, coverRect, coverStage, firstCoverOnSegment, intactCover, isIntact, sightBlocks } from './coverGeometry';

const make = (id: string, kind: CoverKind, x: number, y: number, hp: number = COVER_SPECS[kind].hp): Cover =>
    ({ id, kind, pos: { x, y }, hp });
const stateOf = (...cover: Cover[]) => ({ cover, platforms: [] as { id: string; x: number; y: number; w: number; h: number; color: string }[] });

describe('coverRect', () => {
    it('puts the rect on pos = (centerX, bottomY)', () => {
        expect(coverRect(make('c', 'wood', 100, 300))).toEqual({ x: 75, y: 254, w: 50, h: 46 });
        expect(coverRect(make('g', 'glass', 0, 0))).toEqual({ x: -8, y: -90, w: 16, h: 90 });
    });
});

describe('isIntact / intactCover', () => {
    it('counts a piece as there while it has hp', () => {
        expect(isIntact(make('c', 'wood', 0, 0, 1))).toBe(true);
        expect(isIntact(make('c', 'wood', 0, 0, 0))).toBe(false);
    });

    it('lists only intact pieces and copes with a state without cover', () => {
        const state = stateOf(make('a', 'wood', 0, 0), make('b', 'metal', 100, 0, 0));
        expect(intactCover(state).map(c => c.id)).toEqual(['a']);
        expect(intactCover({})).toEqual([]);
    });
});

describe('coverStage', () => {
    it.each([[150, 0], [100, 0], [99, 1], [50, 1], [49, 2], [1, 2], [0, 3]])('wood at %i hp is stage %i', (hp, stage) => {
        expect(coverStage(make('c', 'wood', 0, 0, hp))).toBe(stage);
    });

    it('scales with the kind: a metal crate is intact until it drops to 330 hp', () => {
        expect(coverStage(make('m', 'metal', 0, 0, 331))).toBe(0);
        expect(coverStage(make('m', 'metal', 0, 0, 330))).toBe(1);
    });

    it('treats negative hp as destroyed', () => {
        expect(coverStage(make('c', 'wood', 0, 0, -20))).toBe(3);
    });
});

describe('firstCoverOnSegment', () => {
    const near = make('near', 'wood', 200, 100);
    const far = make('far', 'metal', 400, 100);

    it('returns the nearest piece along the segment with its entry fraction', () => {
        const hit = firstCoverOnSegment(stateOf(far, near), { x: 0, y: 80 }, { x: 500, y: 80 });
        expect(hit?.cover.id).toBe('near');
        expect(hit?.t).toBeCloseTo(175 / 500, 5);
    });

    it('honours the filter', () => {
        const hit = firstCoverOnSegment(stateOf(near, far), { x: 0, y: 80 }, { x: 500, y: 80 }, c => c.kind === 'metal');
        expect(hit?.cover.id).toBe('far');
    });

    it('ignores broken pieces and misses', () => {
        const broken = make('b', 'wood', 200, 100, 0);
        expect(firstCoverOnSegment(stateOf(broken), { x: 0, y: 80 }, { x: 500, y: 80 })).toBeNull();
        expect(firstCoverOnSegment(stateOf(near), { x: 0, y: 0 }, { x: 500, y: 0 })).toBeNull();
        expect(firstCoverOnSegment({}, { x: 0, y: 80 }, { x: 500, y: 80 })).toBeNull();
    });
});

describe('sightBlocks', () => {
    const a = { x: 0, y: 80 };
    const b = { x: 500, y: 80 };

    it('is blocked by wood, clear through glass and through broken wood', () => {
        expect(sightBlocks(stateOf(make('w', 'wood', 200, 100)), a, b)).toBe(true);
        expect(sightBlocks(stateOf(make('g', 'glass', 200, 100)), a, b)).toBe(false);
        expect(sightBlocks(stateOf(make('w', 'wood', 200, 100, 0)), a, b)).toBe(false);
    });

    it('is clear when the segment passes beside the cover', () => {
        expect(sightBlocks(stateOf(make('w', 'wood', 200, 100)), { x: 0, y: 20 }, { x: 500, y: 20 })).toBe(false);
    });
});

describe('blastBlocks', () => {
    const a = { x: 0, y: 80 };
    const b = { x: 500, y: 80 };

    it('is blocked by any intact cover, glass included', () => {
        expect(blastBlocks(stateOf(make('g', 'glass', 200, 100)), a, b)).toBe(true);
    });

    it('is blocked by a platform', () => {
        const state = { ...stateOf(), platforms: [{ id: 'p', x: 200, y: 50, w: 40, h: 100, color: '#000' }] };
        expect(blastBlocks(state, a, b)).toBe(true);
    });

    it('lets the exploding barrel itself through, and broken pieces', () => {
        const barrel = make('barrel', 'barrel', 200, 100);
        expect(blastBlocks(stateOf(barrel), a, b, 'barrel')).toBe(false);
        expect(blastBlocks(stateOf(make('w', 'wood', 200, 100, 0)), a, b)).toBe(false);
    });

    it('is clear in the open', () => {
        expect(blastBlocks(stateOf(), a, b)).toBe(false);
    });
});
