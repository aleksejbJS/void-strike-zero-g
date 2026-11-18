import { describe, expect, it } from 'vitest';
import { SmokeMeter } from './smokeMeter';

describe('SmokeMeter', () => {
    it('averages the last 120 samples and ignores calls when disabled', () => {
        const meter = new SmokeMeter(true);
        for (let k = 0; k < 30; k++) meter.record(10);        // pushed out of the window by the next 120
        for (let k = 0; k < 120; k++) meter.record(k % 2 === 0 ? 1 : 3);
        expect(meter.average).toBeCloseTo(2, 9);
        expect(meter.max).toBe(3);
        expect(meter.peak).toBe(10);                          // since the last reset, not only in the window
        expect(meter.frames).toBe(150);

        const off = new SmokeMeter(false);
        off.record(5);
        expect(off.average).toBe(0);
        expect(off.max).toBe(0);
        expect(off.frames).toBe(0);
    });

    it('averages only what it has, and forgets everything on reset', () => {
        const meter = new SmokeMeter(true);
        meter.record(2);
        meter.record(4);
        expect(meter.average).toBe(3);
        expect(meter.mean).toBe(3);
        meter.record(Number.NaN);                             // a broken clock reading is not a sample
        expect(meter.frames).toBe(2);
        meter.reset();
        expect([meter.average, meter.max, meter.peak, meter.mean, meter.frames]).toEqual([0, 0, 0, 0, 0]);
    });
});
