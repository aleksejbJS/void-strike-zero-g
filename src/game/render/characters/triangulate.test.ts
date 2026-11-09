import { describe, expect, it } from 'vitest';
import { triangulatePolygon } from './triangulate';
import type { XY } from './artTypes';

const triangleArea = (a: XY, b: XY, c: XY) =>
    Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;

describe('character source polygons', () => {
    it.each([false, true])('preserves a concave cutout area in either winding (%s)', reverse => {
        const points: XY[] = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]];
        if (reverse) points.reverse();
        const indices = triangulatePolygon(points);
        let area = 0;
        for (let i = 0; i < indices.length; i += 3) area += triangleArea(points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]);
        expect(indices).toHaveLength((points.length - 2) * 3);
        expect(area).toBeCloseTo(5);
    });

    it('rejects invalid and degenerate geometry explicitly', () => {
        expect(() => triangulatePolygon([[0, 0], [1, 1]])).toThrow();
        expect(() => triangulatePolygon([[0, 0], [1, 1], [2, 2]])).toThrow();
        expect(() => triangulatePolygon([[0, 0], [NaN, 1], [1, 2]])).toThrow();
        expect(() => triangulatePolygon([[0, 0], [2, 2], [0, 2], [2, 0]])).toThrow();
    });
});
