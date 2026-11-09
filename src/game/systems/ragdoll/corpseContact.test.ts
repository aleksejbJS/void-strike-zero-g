// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Platform } from '../../../types';
import { collideCorpsePoint, creepCorpsePoint } from './corpseContact';

const block: Platform = { id: 'block', x: 100, y: 100, w: 20, h: 20, color: '#000' };

describe('illustrated thickness contact geometry', () => {
    it.each([
        { side: 'top', from: [110, 90], at: [110, 98], want: [110, 95] },
        { side: 'bottom', from: [110, 130], at: [110, 122], want: [110, 125] },
        { side: 'left', from: [90, 110], at: [98, 110], want: [95, 110] },
        { side: 'right', from: [130, 110], at: [122, 110], want: [125, 110] },
    ])('contacts the expanded $side boundary while the joint center is still outside the actual platform', ({ from, at, want }) => {
        const point = { x: at[0], y: at[1], px: from[0], py: from[1] };
        collideCorpsePoint(point, { x: from[0], y: from[1] }, block, 5);
        expect([point.x, point.y]).toEqual(want);
        expect(Math.hypot(point.x - point.px, point.y - point.py)).toBeCloseTo(2);
    });

    it('keeps tangential movement and drops only inward movement while a thick joint creeps out', () => {
        const inward = { x: 110, y: 102, px: 109, py: 100 };
        creepCorpsePoint(inward, block, 5);
        expect(inward.y).toBe(101);
        expect(inward.x - inward.px).toBe(1);
        expect(inward.y - inward.py).toBe(0);
        const outward = { x: 110, y: 102, px: 109, py: 105 };
        creepCorpsePoint(outward, block, 5);
        expect(outward.y - outward.py).toBe(-3);
    });

    it('preserves the original point contact and embedded velocity for legacy corpses', () => {
        const point = { x: 102, y: 110, px: 90, py: 110 };
        collideCorpsePoint(point, { x: 90, y: 110 }, block);
        expect(point.x).toBe(100);
        const embedded = { x: 110, y: 102, px: 109, py: 100 };
        creepCorpsePoint(embedded, block);
        expect(embedded.y - embedded.py).toBe(2);
    });
});
