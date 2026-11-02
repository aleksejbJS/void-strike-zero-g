// Seven-segment digits for the number badge: pure geometry, no drawing.

import { Vector2 } from '../../../../types';

export type Segment = [Vector2, Vector2];

const MAX_NUMBER = 99;
const DIGIT_W = 0.4;   // width of one digit in the unit box; the two digits leave a gap of 1 - 2 * DIGIT_W

// Segment ends in a digit box of width 1 and height 1 (y down), named as on a seven-segment display.
const SEGMENTS = {
    a: [0, 0, 1, 0],       // top
    b: [1, 0, 1, 0.5],     // upper right
    c: [1, 0.5, 1, 1],     // lower right
    d: [0, 1, 1, 1],       // bottom
    e: [0, 0.5, 0, 1],     // lower left
    f: [0, 0, 0, 0.5],     // upper left
    g: [0, 0.5, 1, 0.5],   // middle
} as const;

type SegmentName = keyof typeof SEGMENTS;

const DIGITS: readonly string[] = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];

/** The badge number as a whole number from 0 to 99 (anything else is clamped; not a number shows 0). */
const toBadgeNumber = (n: number) => (Number.isFinite(n) ? Math.min(MAX_NUMBER, Math.max(0, Math.trunc(n))) : 0);

const digit = (value: number, left: number): Segment[] =>
    [...DIGITS[value]].map(name => {
        const [x0, y0, x1, y1] = SEGMENTS[name as SegmentName];
        return [{ x: left + x0 * DIGIT_W, y: y0 }, { x: left + x1 * DIGIT_W, y: y1 }];
    });

/** The lit segments of a number shown as two digits ("07" for 7) in the unit box (0..1 both ways, y down). */
export const digitSegments = (n: number): Segment[] => {
    const value = toBadgeNumber(n);
    return [...digit(Math.floor(value / 10), 0), ...digit(value % 10, 1 - DIGIT_W)];
};
