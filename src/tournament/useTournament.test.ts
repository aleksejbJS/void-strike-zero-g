import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { loadSnapshot, resolveStale } from './tournamentApi';
import { watchTournament } from './tournamentFeed';
import { TournamentError, type TournamentSnapshot, type TournamentStatus } from './types';
import { useTournament } from './useTournament';

vi.mock('./tournamentApi', () => ({ loadSnapshot: vi.fn(), resolveStale: vi.fn() }));
vi.mock('./tournamentFeed', () => ({ watchTournament: vi.fn() }));

const T_ID = '11111111-1111-4111-8111-111111111111';
const snap = (status: TournamentStatus, name = 'cup'): TournamentSnapshot => ({
    tournament: {
        id: T_ID, name, status, size: null, creatorSeat: 0, createdAt: '', startedAt: null, finishedAt: null, championSeat: null,
    },
    seats: [],
    matches: [],
});

let feed: (s: TournamentSnapshot) => void;
const unsubscribe = vi.fn();
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(watchTournament).mockReset().mockImplementation((_id, onSnapshot) => { feed = onSnapshot; return unsubscribe; });
    vi.mocked(loadSnapshot).mockReset().mockResolvedValue(snap('lobby'));
    vi.mocked(resolveStale).mockReset().mockResolvedValue(undefined);
    unsubscribe.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('useTournament', () => {
    it('loads the snapshot itself, then follows the feed, and unsubscribes on unmount', async () => {
        const { result, unmount } = renderHook(() => useTournament(T_ID));
        expect(result.current).toEqual({ snapshot: null, error: null });
        await flush();
        expect(loadSnapshot).toHaveBeenCalledWith(T_ID);
        expect(result.current.snapshot?.tournament.name).toBe('cup');

        act(() => feed(snap('lobby', 'renamed')));
        expect(result.current.snapshot?.tournament.name).toBe('renamed');
        unmount();
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('keeps a feed snapshot that arrived before the slower first load', async () => {
        let answer!: (s: TournamentSnapshot) => void;
        vi.mocked(loadSnapshot).mockReturnValue(new Promise(resolve => { answer = resolve; }));
        const { result } = renderHook(() => useTournament(T_ID));
        act(() => feed(snap('lobby', 'from feed')));
        await act(async () => { answer(snap('lobby', 'old load')); });
        expect(result.current.snapshot?.tournament.name).toBe('from feed');
    });

    it('surfaces a failed first load, and a later feed snapshot clears it', async () => {
        vi.mocked(loadSnapshot).mockRejectedValue(new TournamentError('unknown', 'tournament not found'));
        const { result } = renderHook(() => useTournament(T_ID));
        await flush();
        expect(result.current.error?.code).toBe('unknown');
        act(() => feed(snap('lobby')));
        expect(result.current).toMatchObject({ error: null, snapshot: { tournament: { status: 'lobby' } } });
    });

    it('calls resolveStale every 15 s only while the tournament is running', async () => {
        const { unmount } = renderHook(() => useTournament(T_ID));
        await flush();
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(resolveStale).not.toHaveBeenCalled();

        act(() => feed(snap('running')));
        act(() => { vi.advanceTimersByTime(14_999); });
        expect(resolveStale).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(1); });
        expect(resolveStale).toHaveBeenCalledTimes(1);
        expect(resolveStale).toHaveBeenCalledWith(T_ID);

        act(() => feed(snap('finished')));
        act(() => { vi.advanceTimersByTime(60_000); });
        expect(resolveStale).toHaveBeenCalledTimes(1);

        act(() => feed(snap('running')));
        unmount();
        act(() => { vi.advanceTimersByTime(60_000); });
        expect(resolveStale).toHaveBeenCalledTimes(1);
    });

    it('logs a failed resolveStale and keeps trying', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(resolveStale).mockRejectedValue(new TournamentError('unknown', 'boom'));
        vi.mocked(loadSnapshot).mockResolvedValue(snap('running'));
        renderHook(() => useTournament(T_ID));
        await flush();
        await act(async () => { vi.advanceTimersByTime(15_000); });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.any(TournamentError));
        await act(async () => { vi.advanceTimersByTime(15_000); });
        expect(resolveStale).toHaveBeenCalledTimes(2);
    });
});
