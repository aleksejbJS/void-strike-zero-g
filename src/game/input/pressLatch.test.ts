import { describe, it, expect } from 'vitest';
import { createPressLatch } from './pressLatch';

describe('createPressLatch', () => {
    it('a tap released before the next tick is still seen by that tick, once', () => {
        const latch = createPressLatch();
        latch.down();
        latch.up();
        expect(latch.held()).toBe(true);  // the tick reads a press
        latch.ticked();
        expect(latch.held()).toBe(false); // and only that one tick
    });

    it('a held key stays held across ticks until it is released', () => {
        const latch = createPressLatch();
        latch.down();
        latch.ticked();
        latch.ticked();
        expect(latch.held()).toBe(true);
        latch.up();
        expect(latch.held()).toBe(false);
    });

    it('nothing pressed reads as not held', () => {
        const latch = createPressLatch();
        latch.ticked();
        expect(latch.held()).toBe(false);
    });

    it('reset forgets a pending tap (the window lost focus)', () => {
        const latch = createPressLatch();
        latch.down();
        latch.reset();
        expect(latch.held()).toBe(false);
    });
});
