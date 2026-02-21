import { describe, it, test, expect } from 'vitest';
import { distance, normalize, checkPointInRect, checkRectOverlap, segmentIntersectsRect } from './math';
import { Vector2 } from '../../types';

describe('Math Utilities', () => {
  describe('distance', () => {
    test('should calculate distance between two points', () => {
      const a: Vector2 = { x: 0, y: 0 };
      const b: Vector2 = { x: 3, y: 4 };

      expect(distance(a, b)).toBe(5); // 3-4-5 triangle
    });

    test('should return 0 for same point', () => {
      const a: Vector2 = { x: 5, y: 10 };

      expect(distance(a, a)).toBe(0);
    });

    test('should handle negative coordinates', () => {
      const a: Vector2 = { x: -1, y: -1 };
      const b: Vector2 = { x: 2, y: 3 };

      expect(distance(a, b)).toBe(5);
    });
  });

  describe('normalize', () => {
    test('should normalize a vector', () => {
      const v: Vector2 = { x: 3, y: 4 };
      const normalized = normalize(v);

      expect(normalized.x).toBeCloseTo(0.6);
      expect(normalized.y).toBeCloseTo(0.8);
      expect(Math.sqrt(normalized.x ** 2 + normalized.y ** 2)).toBeCloseTo(1);
    });

    test('should return zero vector for zero input', () => {
      const v: Vector2 = { x: 0, y: 0 };
      const normalized = normalize(v);

      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
    });

    test('should handle very small vectors', () => {
      const v: Vector2 = { x: 0.0001, y: 0.0001 };
      const normalized = normalize(v);
      const length = Math.sqrt(normalized.x ** 2 + normalized.y ** 2);

      expect(length).toBeCloseTo(1);
    });
  });

  describe('checkPointInRect', () => {
    const rect = { x: 10, y: 20, w: 30, h: 40 };

    test('should return true for point inside rectangle', () => {
      const point: Vector2 = { x: 25, y: 40 };

      expect(checkPointInRect(point, rect)).toBe(true);
    });

    test('should return false for point outside rectangle', () => {
      const point: Vector2 = { x: 5, y: 25 };

      expect(checkPointInRect(point, rect)).toBe(false);
    });

    test('should return true for point on rectangle boundary', () => {
      const point: Vector2 = { x: 10, y: 20 };

      expect(checkPointInRect(point, rect)).toBe(true);
    });
  });

  describe('checkRectOverlap', () => {
    const rect1 = { x: 0, y: 0, w: 10, h: 10 };

    test('should return true for overlapping rectangles', () => {
      const rect2 = { x: 5, y: 5, w: 10, h: 10 };

      expect(checkRectOverlap(rect1, rect2)).toBe(true);
    });

    test('should return false for non-overlapping rectangles', () => {
      const rect2 = { x: 20, y: 20, w: 10, h: 10 };

      expect(checkRectOverlap(rect1, rect2)).toBe(false);
    });

    test('should return true for touching rectangles', () => {
      const rect2 = { x: 10, y: 0, w: 10, h: 10 };

      expect(checkRectOverlap(rect1, rect2)).toBe(false); // Touching but not overlapping
    });

    test('should return true for one rectangle inside another', () => {
      const rect2 = { x: 2, y: 2, w: 5, h: 5 };

      expect(checkRectOverlap(rect1, rect2)).toBe(true);
    });
  });

  describe('segmentIntersectsRect', () => {
    const rect = { x: 10, y: 10, w: 20, h: 20 };

    test('should return true for segment crossing rectangle', () => {
      const a: Vector2 = { x: 5, y: 15 };
      const b: Vector2 = { x: 35, y: 15 };

      expect(segmentIntersectsRect(a, b, rect)).toBe(true);
    });

    test('should return false for segment not crossing rectangle', () => {
      const a: Vector2 = { x: 5, y: 5 };
      const b: Vector2 = { x: 35, y: 5 };

      expect(segmentIntersectsRect(a, b, rect)).toBe(false);
    });

    test('should return true for segment starting inside rectangle', () => {
      const a: Vector2 = { x: 15, y: 15 };
      const b: Vector2 = { x: 35, y: 35 };

      expect(segmentIntersectsRect(a, b, rect)).toBe(true);
    });

    test('should return true for segment ending inside rectangle', () => {
      const a: Vector2 = { x: 5, y: 15 };
      const b: Vector2 = { x: 15, y: 15 };

      expect(segmentIntersectsRect(a, b, rect)).toBe(true);
    });
  });
});
