import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabase } from '../account/supabaseClient';
import { makeFakeTournamentSupabase } from '../test/fakeTournamentSupabase';
import { loadSnapshot } from './tournamentApi';
import { watchTournament } from './tournamentFeed';
import { TournamentError, type TournamentSnapshot } from './types';

vi.mock('../account/supabaseClient', () => ({ getSupabase: vi.fn() }));
vi.mock('./tournamentApi', () => ({ loadSnapshot: vi.fn() }));

const T_ID = '11111111-1111-4111-8111-111111111111';
const snapshot = (name: string): TournamentSnapshot => ({
    tournament: {
        id: T_ID, name, status: 'lobby', size: null, creatorSeat: 0, createdAt: '2026-11-04T11:00:00Z',
        startedAt: null, finishedAt: null, championSeat: null,
    },
    seats: [],
    matches: [],
});

// A promise the test settles by hand (Promise.withResolvers is not in this project's TS lib).
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}

let fake: ReturnType<typeof makeFakeTournamentSupabase>;
const load = vi.mocked(loadSnapshot);

beforeEach(() => {
    vi.useFakeTimers();
    fake = makeFakeTournamentSupabase();
    vi.mocked(getSupabase).mockReturnValue(fake.client);
    load.mockReset();
    load.mockResolvedValue(snapshot('cup'));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('watchTournament subscription', () => {
    it('subscribes to the tournament row and the matches of that tournament only (not the seats)', () => {
        watchTournament(T_ID, () => {});
        expect(fake.channels).toHaveLength(1);
        expect(fake.channels[0].filters).toEqual([
            { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${T_ID}` },
            { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${T_ID}` },
        ]);
    });

    it('reloads once the channel is live, so nothing between the first read and the subscription is missed', async () => {
        const onSnapshot = vi.fn();
        watchTournament(T_ID, onSnapshot);
        fake.channels[0].setStatus('SUBSCRIBED');
        await vi.advanceTimersByTimeAsync(200);
        expect(load).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledWith(T_ID);
        expect(onSnapshot).toHaveBeenCalledWith(snapshot('cup'));
    });

    it('turns a burst of 5 changes into 1 load, 200 ms after the last one', async () => {
        const onSnapshot = vi.fn();
        watchTournament(T_ID, onSnapshot);
        for (let i = 0; i < 5; i++) {
            fake.channels[0].emitChange(i % 2 ? 'tournaments' : 'tournament_matches');
            await vi.advanceTimersByTimeAsync(50);
        }
        expect(load).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(150);
        expect(load).toHaveBeenCalledTimes(1);
        expect(onSnapshot).toHaveBeenCalledTimes(1);
    });

    it('delivers only the newest answer when an older load finishes late', async () => {
        const slow = deferred<TournamentSnapshot>();
        load.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(snapshot('new'));
        const onSnapshot = vi.fn();
        watchTournament(T_ID, onSnapshot);
        fake.channels[0].emitChange();
        await vi.advanceTimersByTimeAsync(200); // load 1 starts and hangs
        fake.channels[0].emitChange();
        await vi.advanceTimersByTimeAsync(200); // load 2 finishes
        slow.resolve(snapshot('old'));
        await vi.advanceTimersByTimeAsync(0);
        expect(onSnapshot).toHaveBeenCalledTimes(1);
        expect(onSnapshot).toHaveBeenCalledWith(snapshot('new'));
    });

    it('a failed load is logged and the next change tries again', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        load.mockRejectedValueOnce(new TournamentError('unknown', 'boom'));
        const onSnapshot = vi.fn();
        watchTournament(T_ID, onSnapshot);
        fake.channels[0].emitChange();
        await vi.advanceTimersByTimeAsync(200);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.anything());
        expect(onSnapshot).not.toHaveBeenCalled();
        fake.channels[0].emitChange();
        await vi.advanceTimersByTimeAsync(200);
        expect(onSnapshot).toHaveBeenCalledTimes(1);
    });
});
