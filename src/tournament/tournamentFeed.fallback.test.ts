import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabase } from '../account/supabaseClient';
import { makeFakeTournamentSupabase } from '../test/fakeTournamentSupabase';
import { loadSnapshot } from './tournamentApi';
import { watchTournament } from './tournamentFeed';
import type { TournamentSnapshot } from './types';

vi.mock('../account/supabaseClient', () => ({ getSupabase: vi.fn() }));
vi.mock('./tournamentApi', () => ({ loadSnapshot: vi.fn() }));

const T_ID = '11111111-1111-4111-8111-111111111111';
const POLL_MS = 5000;
const SNAPSHOT = { seats: [], matches: [] } as unknown as TournamentSnapshot;

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
    load.mockResolvedValue({} as never);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('watchTournament polling fallback', () => {
    it.each(['CHANNEL_ERROR', 'TIMED_OUT'] as const)('%s switches to polling every 5 s', async (status) => {
        watchTournament(T_ID, () => {});
        fake.channels[0].setStatus(status);
        expect(load).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(POLL_MS);
        expect(load).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(POLL_MS * 2);
        expect(load).toHaveBeenCalledTimes(3);
    });

    it('repeated channel errors do not start a second poll timer', async () => {
        watchTournament(T_ID, () => {});
        fake.channels[0].setStatus('CHANNEL_ERROR');
        fake.channels[0].setStatus('TIMED_OUT');
        await vi.advanceTimersByTimeAsync(POLL_MS);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('polling stops when the channel recovers', async () => {
        watchTournament(T_ID, () => {});
        fake.channels[0].setStatus('CHANNEL_ERROR');
        fake.channels[0].setStatus('SUBSCRIBED');
        await vi.advanceTimersByTimeAsync(200); // the reload after SUBSCRIBED
        load.mockClear();
        await vi.advanceTimersByTimeAsync(POLL_MS * 3);
        expect(load).not.toHaveBeenCalled();
    });

    it('the unsubscribe function removes the channel and stops the debounce timer and the polling', async () => {
        const onSnapshot = vi.fn();
        const stop = watchTournament(T_ID, onSnapshot);
        fake.channels[0].emitChange(); // debounce timer pending
        fake.channels[0].setStatus('CHANNEL_ERROR'); // polling running
        stop();
        expect(fake.removeChannel).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(POLL_MS * 3);
        expect(load).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
        expect(() => stop()).not.toThrow(); // calling it twice is harmless
        expect(fake.removeChannel).toHaveBeenCalledTimes(1);
    });

    it('statuses that arrive after the unsubscribe start no timer', async () => {
        const stop = watchTournament(T_ID, () => {});
        stop();
        fake.channels[0].setStatus('SUBSCRIBED');
        fake.channels[0].setStatus('CHANNEL_ERROR');
        fake.channels[0].setStatus('TIMED_OUT');
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(POLL_MS * 3);
        expect(load).not.toHaveBeenCalled();
    });

    it('a poll tick is skipped while a load is still running, so a slow load is still delivered', async () => {
        const slow = deferred<TournamentSnapshot>();
        load.mockReturnValueOnce(slow.promise);
        const onSnapshot = vi.fn();
        watchTournament(T_ID, onSnapshot);
        fake.channels[0].setStatus('CHANNEL_ERROR');
        await vi.advanceTimersByTimeAsync(POLL_MS); // load 1 starts and hangs
        expect(load).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(POLL_MS * 2 + 2000); // 12 s in: the tick at 10 s was skipped
        expect(load).toHaveBeenCalledTimes(1);
        slow.resolve(SNAPSHOT);
        await vi.advanceTimersByTimeAsync(0);
        expect(onSnapshot).toHaveBeenCalledTimes(1);
        expect(onSnapshot).toHaveBeenCalledWith(SNAPSHOT);
        await vi.advanceTimersByTimeAsync(POLL_MS); // polling goes on once the load is done
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('a failed load does not block the next poll tick', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        load.mockRejectedValueOnce(new Error('boom'));
        watchTournament(T_ID, () => {});
        fake.channels[0].setStatus('CHANNEL_ERROR');
        await vi.advanceTimersByTimeAsync(POLL_MS * 2);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('a load that finishes after the unsubscribe is not delivered', async () => {
        const slow = deferred<never>();
        load.mockReturnValueOnce(slow.promise);
        const onSnapshot = vi.fn();
        const stop = watchTournament(T_ID, onSnapshot);
        fake.channels[0].emitChange();
        await vi.advanceTimersByTimeAsync(200);
        stop();
        slow.resolve({} as never);
        await vi.advanceTimersByTimeAsync(0);
        expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('without a Supabase client it polls nothing and the returned function is a no-op', async () => {
        vi.mocked(getSupabase).mockReturnValue(null);
        const stop = watchTournament(T_ID, () => {});
        await vi.advanceTimersByTimeAsync(POLL_MS * 3);
        expect(load).not.toHaveBeenCalled();
        expect(() => stop()).not.toThrow();
    });
});
