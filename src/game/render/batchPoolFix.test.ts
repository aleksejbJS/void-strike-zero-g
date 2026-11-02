import { describe, expect, it, vi } from 'vitest';

// A stand-in for Pixi's Batcher: destroy() hands every entry of `batches` back to the pool
const returned: string[] = [];
vi.mock('pixi.js', () => ({
    Batcher: class {
        batches: string[] | null = [];
        batchIndex = 0;
        destroy() {
            this.batches?.forEach(b => returned.push(b));
            this.batches = null;
        }
    },
}));

const { Batcher } = await import('pixi.js');
const { installBatchPoolFix } = await import('./batchPoolFix');

type FakeBatcher = { batches: string[] | null; batchIndex: number; destroy(): void };
const makeBatcher = () => new (Batcher as unknown as new () => FakeBatcher)();

describe('installBatchPoolFix', () => {
    it("returns only the batches the batcher still owns, not last frames' ones already pooled", () => {
        installBatchPoolFix();
        const batcher = makeBatcher();
        // This frame owns a and b; c and d went back to the pool on begin() and may be in use elsewhere
        batcher.batches = ['a', 'b', 'c', 'd'];
        batcher.batchIndex = 2;

        returned.length = 0;
        batcher.destroy();

        expect(returned).toEqual(['a', 'b']);
    });

    it('patches only once', () => {
        installBatchPoolFix();
        const patched = Batcher.prototype.destroy;
        installBatchPoolFix();
        expect(Batcher.prototype.destroy).toBe(patched);
    });

    it('still destroys a batcher that was already destroyed', () => {
        installBatchPoolFix();
        const batcher = makeBatcher();
        batcher.batches = null;
        expect(() => batcher.destroy()).not.toThrow();
    });
});
