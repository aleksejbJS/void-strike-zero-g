import { describe, it, expect } from 'vitest';
import { InputQueue } from './inputQueue';
import { PHYSICS_TICK_RATE } from '../../constants';
import { PlayerInput } from '../../types';

const input = (sequence: number, extra: Partial<PlayerInput> = {}): PlayerInput =>
    ({ keys: { KeyD: true }, mouse: { x: 0, y: 0 }, mousePressed: false, hookPressed: false, sequence, timestamp: sequence * 8, ...extra });

/** Feed the queue for `ticks` simulation ticks; `perTick(t)` says how many inputs arrive before tick t. */
const run = (q: InputQueue, ticks: number, perTick: (t: number) => number, firstSeq = 1) => {
    let seq = firstSeq;
    const consumed: number[] = [];
    for (let t = 0; t < ticks; t++) {
        for (let n = perTick(t); n > 0; n--) q.push(input(seq++));
        consumed.push(q.next()!.sequence);
    }
    return { consumed, nextSeq: seq };
};

const gaps = (seqs: number[]) => seqs.slice(1).filter((s, i) => s > seqs[i] + 1).length;

describe('InputQueue backlog control', () => {
    it('drains a standing backlog down to a couple of inputs', () => {
        const q = new InputQueue();
        for (let i = 1; i <= 12; i++) q.push(input(i));
        run(q, PHYSICS_TICK_RATE * 3, () => 1, 13); // one in, one out: the backlog would never shrink on its own
        expect(q.length).toBeLessThanOrEqual(3);
    });

    it('skips nothing when the queue only swings with network jitter', () => {
        const q = new InputQueue();
        // Bursts of 3 inputs every 3rd tick: same average rate, the queue empties every cycle
        const { consumed } = run(q, PHYSICS_TICK_RATE * 5, t => (t % 3 === 0 ? 3 : 0));
        expect(gaps(consumed)).toBe(0);
    });

    it('keeps the lag bounded when the client clock runs 1% fast', () => {
        const q = new InputQueue();
        // 121 inputs per 120 ticks for 20 s
        let owed = 0;
        run(q, PHYSICS_TICK_RATE * 20, () => { owed += 121 / 120; const n = Math.floor(owed); owed -= n; return n; });
        expect(q.length).toBeLessThanOrEqual(4);
    });

    it('skips an input that repeats its neighbour rather than a button change', () => {
        const q = new InputQueue();
        // Oldest input is the only one holding the hook: it must still reach the simulation
        q.push(input(1, { hookPressed: true }));
        for (let i = 2; i <= 12; i++) q.push(input(i));
        const { consumed } = run(q, PHYSICS_TICK_RATE, () => 1, 13);
        expect(consumed[0]).toBe(1);
    });
});
