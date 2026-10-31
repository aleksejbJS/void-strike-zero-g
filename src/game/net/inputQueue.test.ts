import { describe, it, expect } from 'vitest';
import { InputQueue } from './inputQueue';
import { PHYSICS_TICK_RATE } from '../../constants';

const input = (sequence: number, timestamp = 0) =>
    ({ keys: {}, mouse: { x: 0, y: 0 }, mousePressed: false, hookPressed: false, sequence, timestamp });

describe('InputQueue', () => {
    it('returns inputs in order, then repeats the last one', () => {
        const q = new InputQueue();
        q.push(input(1));
        q.push(input(2));
        expect(q.next()!.sequence).toBe(1);
        expect(q.next()!.sequence).toBe(2);
        expect(q.next()!.sequence).toBe(2);
    });

    it('drops old and duplicate sequences', () => {
        const q = new InputQueue();
        expect(q.push(input(5))).toBe(true);
        expect(q.push(input(5))).toBe(false);
        expect(q.push(input(3))).toBe(false);
    });

    it('rate-limits floods using arrival time', () => {
        const q = new InputQueue();
        let accepted = 0;
        for (let i = 1; i <= PHYSICS_TICK_RATE * 10; i++) if (q.push(input(i, 100))) accepted++;
        expect(accepted).toBe(PHYSICS_TICK_RATE * 2);
        // A new second opens a new window
        expect(q.push(input(PHYSICS_TICK_RATE * 10 + 1, 1200))).toBe(true);
    });

    it('keeps the backlog bounded', () => {
        const q = new InputQueue();
        for (let i = 1; i <= 50; i++) q.push(input(i, i));
        // Oldest inputs were discarded: first one out is recent
        expect(q.next()!.sequence).toBeGreaterThan(30);
    });
});
