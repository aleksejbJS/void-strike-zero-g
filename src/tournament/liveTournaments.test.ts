// One live copy per tournament, shared by every screen that asks for it (the bracket and the autopilot).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSnapshot, resolveStale } from './tournamentApi';
import { watchTournament } from './tournamentFeed';
import type { TournamentSnapshot, TournamentStatus } from './types';
import { subscribeTournament, type LiveTournament } from './liveTournaments';

vi.mock('./tournamentApi', () => ({ loadSnapshot: vi.fn(), resolveStale: vi.fn() }));
vi.mock('./tournamentFeed', () => ({ watchTournament: vi.fn() }));

const T_ID = 't1';
const snap = (status: TournamentStatus, name = 'cup'): TournamentSnapshot => ({
    tournament: { id: T_ID, name, status, size: null, creatorSeat: 0, createdAt: '', startedAt: null, finishedAt: null, championSeat: null },
    seats: [],
    matches: [],
});

let feed: (s: TournamentSnapshot) => void;
const stopFeed = vi.fn();
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(watchTournament).mockReset().mockImplementation((_id, onSnapshot) => { feed = onSnapshot; return stopFeed; });
    vi.mocked(loadSnapshot).mockReset().mockResolvedValue(snap('lobby'));
    vi.mocked(resolveStale).mockReset().mockResolvedValue(undefined);
    stopFeed.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('subscribeTournament', () => {
    it('two subscribers share one first read and one feed; the last one out stops it', async () => {
        const a = vi.fn<[LiveTournament], void>();
        const b = vi.fn<[LiveTournament], void>();
        const stopA = subscribeTournament(T_ID, a);
        await flush();
        const stopB = subscribeTournament(T_ID, b);
        expect(b).toHaveBeenCalledWith({ snapshot: snap('lobby'), error: null }); // gets the current copy at once
        expect(loadSnapshot).toHaveBeenCalledTimes(1);
        expect(watchTournament).toHaveBeenCalledTimes(1);

        feed(snap('running', 'renamed'));
        expect(a).toHaveBeenLastCalledWith({ snapshot: snap('running', 'renamed'), error: null });
        expect(b).toHaveBeenLastCalledWith({ snapshot: snap('running', 'renamed'), error: null });
        stopA();
        expect(stopFeed).not.toHaveBeenCalled();
        stopB();
        expect(stopFeed).toHaveBeenCalledTimes(1);
    });

    it('resolveStale runs once every 15 s however many subscribers watch a running tournament', async () => {
        vi.mocked(loadSnapshot).mockResolvedValue(snap('running'));
        const stops = [subscribeTournament(T_ID, vi.fn()), subscribeTournament(T_ID, vi.fn())];
        await flush();
        await vi.advanceTimersByTimeAsync(15_000);
        expect(resolveStale).toHaveBeenCalledTimes(1);
        stops.forEach(stop => stop());
        await vi.advanceTimersByTimeAsync(60_000);
        expect(resolveStale).toHaveBeenCalledTimes(1);
    });

    it('re-reads a lobby every 15 s (seat heartbeats are not in Realtime), and stops once it runs', async () => {
        const stop = subscribeTournament(T_ID, vi.fn());
        await flush();
        await vi.advanceTimersByTimeAsync(15_000);
        expect(loadSnapshot).toHaveBeenCalledTimes(2);
        feed(snap('running'));
        await vi.advanceTimersByTimeAsync(60_000);
        expect(loadSnapshot).toHaveBeenCalledTimes(2);
        stop();
    });

    it('a lobby re-read that answers after a newer feed snapshot is dropped', async () => {
        const listener = vi.fn<[LiveTournament], void>();
        const stop = subscribeTournament(T_ID, listener);
        await flush();
        let answer!: (s: TournamentSnapshot) => void;
        vi.mocked(loadSnapshot).mockReturnValue(new Promise(resolve => { answer = resolve; }));
        await vi.advanceTimersByTimeAsync(15_000); // the re-read starts
        feed(snap('running', 'started'));
        answer(snap('lobby', 'old'));
        await flush();
        expect(listener).toHaveBeenLastCalledWith({ snapshot: snap('running', 'started'), error: null });
        stop();
    });

    it('a failed lobby re-read is logged and the copy kept', async () => {
        const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const listener = vi.fn<[LiveTournament], void>();
        const stop = subscribeTournament(T_ID, listener);
        await flush();
        vi.mocked(loadSnapshot).mockRejectedValue(new Error('offline'));
        await vi.advanceTimersByTimeAsync(15_000);
        expect(warned).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.any(Error));
        expect(listener).toHaveBeenLastCalledWith({ snapshot: snap('lobby'), error: null });
        stop();
    });
});
