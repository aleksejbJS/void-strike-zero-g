import { describe, it, expect } from 'vitest';
import { LocalPrediction } from './prediction';
import { createMockPlayer } from '../../test/mocks';
import { Team } from '../../types';

const server = (x: number, ack: number) => ({ ...createMockPlayer('me', Team.NONE), pos: { x, y: 0 }, lastProcessedInput: ack });

describe('LocalPrediction', () => {
    it('does nothing when the server agrees with the prediction', () => {
        const pred = new LocalPrediction();
        const local = createMockPlayer('me', Team.NONE);
        pred.record(1, { x: 10, y: 0 });
        expect(pred.reconcile(server(10, 1), local)).toBe('ok');
    });

    it('blends a small error in over several ticks instead of snapping', () => {
        const pred = new LocalPrediction();
        const local = createMockPlayer('me', Team.NONE);
        local.pos = { x: 50, y: 0 };
        pred.record(1, { x: 10, y: 0 });
        expect(pred.reconcile(server(30, 1), local)).toBe('corrected');

        pred.applyCorrection(local);
        expect(local.pos.x).toBeGreaterThan(50);
        expect(local.pos.x).toBeLessThan(70);
        for (let i = 0; i < 100; i++) pred.applyCorrection(local);
        expect(local.pos.x).toBeCloseTo(70, 1);
    });

    it('does not apply the same error twice on the next snapshot', () => {
        const pred = new LocalPrediction();
        const local = createMockPlayer('me', Team.NONE);
        pred.record(1, { x: 10, y: 0 });
        pred.record(2, { x: 20, y: 0 });
        pred.reconcile(server(30, 1), local); // +20 error
        // The server's next position is consistent with the corrected path
        expect(pred.reconcile(server(40, 2), local)).toBe('ok');
    });

    it('snaps when the error is huge', () => {
        const pred = new LocalPrediction();
        const local = createMockPlayer('me', Team.NONE);
        pred.record(1, { x: 0, y: 0 });
        expect(pred.reconcile(server(5000, 1), local)).toBe('snapped');
        expect(local.pos.x).toBe(5000);
    });
});
