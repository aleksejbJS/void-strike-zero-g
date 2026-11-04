import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SeatTicket } from './types';

const A: SeatTicket = { tournamentId: 'tournament-a', seat: 0, secret: 'aa'.repeat(32) };
const B: SeatTicket = { tournamentId: 'tournament-b', seat: 5, secret: 'bb'.repeat(32) };

// A fresh module per test: its in-memory fallback starts empty, like a page reload.
const freshStore = async () => {
    vi.resetModules();
    return import('./seatStore');
};

// The global test setup replaces localStorage with empty mocks: back it with a plain object that survives
// "reloads" (fresh module instances) within one test, like the real thing.
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

describe('seatStore', () => {
    it('saveTicket then ticketFor round-trips; an unknown tournament gives null', async () => {
        const store = await freshStore();
        store.saveTicket(A);
        expect(store.ticketFor('tournament-a')).toEqual(A);
        expect(store.ticketFor('nope')).toBeNull();
    });

    it('is stored under the tournamentTickets key and still there after a reload', async () => {
        (await freshStore()).saveTicket(A);
        expect(JSON.parse(stored.tournamentTickets)).toHaveProperty('tournament-a');

        const reloaded = await freshStore();
        expect(reloaded.ticketFor('tournament-a')).toEqual(A);
    });

    it('keeps one ticket per tournament; saving again replaces it; forget removes only that one', async () => {
        const store = await freshStore();
        store.saveTicket(A);
        store.saveTicket(B);
        store.saveTicket({ ...A, seat: 2 });
        expect(store.ticketFor('tournament-a')?.seat).toBe(2);
        store.forgetTicket('tournament-a');
        expect(store.ticketFor('tournament-a')).toBeNull();
        expect(store.ticketFor('tournament-b')).toEqual(B);
        expect((await freshStore()).ticketFor('tournament-a')).toBeNull();
    });

    it('forgetting a ticket that does not exist is harmless', async () => {
        const store = await freshStore();
        expect(() => store.forgetTicket('nope')).not.toThrow();
    });
});

describe('seatStore without working storage', () => {
    const brokenStorage = () => {
        const fail = () => { throw new DOMException('denied', 'SecurityError'); };
        vi.stubGlobal('localStorage', { getItem: fail, setItem: fail, removeItem: fail });
    };

    it('a throwing localStorage still works in memory and logs a warning', async () => {
        brokenStorage();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const store = await freshStore();
        store.saveTicket(A);
        expect(store.ticketFor('tournament-a')).toEqual(A);
        store.forgetTicket('tournament-a');
        expect(store.ticketFor('tournament-a')).toBeNull();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.anything());
    });

    it('a storage that refuses writes (quota) still remembers the ticket in memory', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
            removeItem: () => {},
        });
        const store = await freshStore();
        store.saveTicket(A);
        expect(store.ticketFor('tournament-a')).toEqual(A);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('no localStorage at all (Node) keeps tickets in memory without noise', async () => {
        vi.stubGlobal('localStorage', undefined);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const store = await freshStore();
        store.saveTicket(A);
        expect(store.ticketFor('tournament-a')).toEqual(A);
        expect(warn).not.toHaveBeenCalled();
    });

    it('corrupt stored data is ignored with a warning and replaced on the next save', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        stored.tournamentTickets = '{not json';
        const store = await freshStore();
        expect(store.ticketFor('tournament-a')).toBeNull();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.anything());
        store.saveTicket(A);
        expect(store.ticketFor('tournament-a')).toEqual(A);
    });

    it('stored entries of the wrong shape are dropped', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        stored.tournamentTickets = JSON.stringify({ x: { seat: 'one' }, 'tournament-b': B });
        const store = await freshStore();
        expect(store.ticketFor('x')).toBeNull();
        expect(store.ticketFor('tournament-b')).toEqual(B);
    });
});
