import { describe, expect, it } from 'vitest';
import { partGeometry, placePart } from './placement';
import type { SourcePart } from './artTypes';

const part: SourcePart = { polygon: [[8, 8], [12, 8], [22, 22], [18, 22]],
    origin: [10, 10], axisEnd: [20, 20], channel: 'arm' };

describe('illustrated part placement', () => {
    it('uses authored atlas pixel scale for bone width while destination length still controls its axis', () => {
        const atlas = { ...part, pixelScale: 0.25 };
        const at = placePart(atlas, { start: { x: 0, y: 0 }, end: { x: 0, y: 20 } }, 0.1);
        expect(at.scaleX).toBe(0.25);
        expect(at.scaleY).toBeCloseTo(20 / Math.sqrt(200));
    });

    it('uses authored atlas pixel scale on both axes for a free hand or foot', () => {
        const atlas = { ...part, pixelScale: 0.3 };
        const at = placePart(atlas, { start: { x: 4, y: 8 }, rotation: 0.5 }, 0.1);
        expect(at).toMatchObject({ x: 4, y: 8, rotation: 0.5, scaleX: 0.3, scaleY: 0.3 });
    });

    it('rejects unusable authored pixel scales instead of collapsing or reversing parts', () => {
        for (const pixelScale of [0, -1, NaN, Infinity]) {
            expect(() => placePart({ ...part, pixelScale }, { start: { x: 0, y: 0 } }, 0.1)).toThrow();
        }
    });

    it('keeps source UVs intact while the bone frame follows rotated destination joints', () => {
        const geometry = partGeometry(part, [100, 100]);
        expect(geometry.uvs[0]).toBeCloseTo(0.08);
        expect(geometry.uvs[1]).toBeCloseTo(0.08);
        const at = placePart(part, { start: { x: 10, y: 20 }, end: { x: 30, y: 20 } }, 0.1);
        const sourceEndY = Math.sqrt(200);
        const x = at.x - Math.sin(at.rotation) * sourceEndY * at.scaleY;
        const y = at.y + Math.cos(at.rotation) * sourceEndY * at.scaleY;
        expect(x).toBeCloseTo(30);
        expect(y).toBeCloseTo(20);
        expect(at.scaleX).toBe(0.1);
    });

    it('hides collapsed physics bones without producing NaN geometry', () => {
        const at = placePart(part, { start: { x: 2, y: 3 }, end: { x: 2, y: 3 } }, 0.1);
        expect(at.visible).toBe(false);
        expect(Object.values(at).filter(v => typeof v === 'number').every(Number.isFinite)).toBe(true);
    });

    it('rejects zero source bones instead of dividing by zero', () => {
        const bad = { ...part, axisEnd: part.origin };
        expect(() => partGeometry(bad, [100, 100])).toThrow();
        expect(() => placePart(bad, { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }, 1)).toThrow();
    });
});
