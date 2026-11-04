// All tickets this browser holds, and being told when they change (the tournament autopilot follows them).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SeatTicket } from './types';

const A: SeatTicket = { tournamentId: 'tournament-a', seat: 0, secret: 'aa'.repeat(32) };
const B: SeatTicket = { tournamentId: 'tournament-b', seat: 5, secret: 'bb'.repeat(32) };

const freshStore = async () => {
    vi.resetModules();
    return import('./seatStore');
};

let stored: Record<string, string>;

beforeEach(() => {
    stored = {};
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => (key in stored ? stored[key] : null),
        setItem: (key: string, value: string) => { stored[key] = value; },
        removeItem: (key: string) => { delete stored[key]; },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('seatStore: held tickets', () => {
    it('lists every ticket held, after a reload too', async () => {
        const store = await freshStore();
        expect(store.heldTickets()).toEqual([]);
        store.saveTicket(A);
        store.saveTicket(B);
        expect((await freshStore()).heldTickets()).toEqual([A, B]);
    });

    it('tells listeners about saves and forgets until they unsubscribe', async () => {
        const store = await freshStore();
        const listener = vi.fn();
        const stop = store.onTicketsChanged(listener);
        store.saveTicket(A);
        store.forgetTicket('tournament-a');
        expect(listener).toHaveBeenCalledTimes(2);
        stop();
        store.saveTicket(B);
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
