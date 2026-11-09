import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../account/supabaseClient';
import { LeaderboardError, fetchBoard, parseBoard } from './leaderboardApi';

vi.mock('../account/supabaseClient', () => ({ getSupabase: vi.fn() }));

const rpc = vi.fn();
const fakeClient = { rpc } as unknown as SupabaseClient;

const validPayload = {
    top: [
        { rank: 1, nickname: 'Alex', value: 120 },
        { rank: 2, nickname: 'Bea', value: 95 },
    ],
    me: { rank: 4, value: 60 },
};

beforeEach(() => {
    rpc.mockReset();
    vi.mocked(getSupabase).mockReturnValue(fakeClient);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('parseBoard', () => {
    it('reads a valid payload', () => {
        expect(parseBoard(validPayload)).toEqual(validPayload);
    });

    it('keeps me as null when the server sent null (guest or not ranked)', () => {
        expect(parseBoard({ top: validPayload.top, me: null })).toEqual({ top: validPayload.top, me: null });
    });

    it('turns null into an empty board', () => {
        expect(parseBoard(null)).toEqual({ top: [], me: null });
    });

    it('turns anything that is not an object into an empty board and says so', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const junk of ['oops', 42, [], undefined]) {
            expect(parseBoard(junk)).toEqual({ top: [], me: null });
        }
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[leaderboard]'), expect.anything());
    });

    it('drops a row whose value is a string, keeps the others, and says so', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const board = parseBoard({
            top: [{ rank: 1, nickname: 'Alex', value: '120' }, { rank: 2, nickname: 'Bea', value: 95 }],
            me: null,
        });
        expect(board.top).toEqual([{ rank: 2, nickname: 'Bea', value: 95 }]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[leaderboard]'), expect.anything());
    });

    it('drops rows with a missing nickname, a bad rank, a non-finite or negative value, or no object at all', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const board = parseBoard({
            top: [
                { rank: 1, value: 5 },
                { rank: 0, nickname: 'Zero', value: 5 },
                { rank: 1.5, nickname: 'Half', value: 5 },
                { rank: 2, nickname: 'Nan', value: Number.NaN },
                { rank: 3, nickname: 'Neg', value: -1 },
                null,
                'row',
                { rank: 4, nickname: 'Ok', value: 0 },
            ],
            me: null,
        });
        expect(board.top).toEqual([{ rank: 4, nickname: 'Ok', value: 0 }]);
    });

    it('gives an empty top when top is not an array', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(parseBoard({ top: 'nope', me: null })).toEqual({ top: [], me: null });
        expect(parseBoard({ me: null })).toEqual({ top: [], me: null });
    });

    it('gives me: null for a malformed me, without losing the top', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const me of [{ rank: 4 }, { rank: '4', value: 60 }, { rank: 4, value: '60' }, { rank: 0, value: 60 }, 'me', 7]) {
            expect(parseBoard({ top: validPayload.top, me })).toEqual({ top: validPayload.top, me: null });
        }
    });
});

describe('fetchBoard', () => {
    it('calls the leaderboard RPC with the exact parameter names and returns the parsed board', async () => {
        rpc.mockResolvedValueOnce({ data: validPayload, error: null });
        const board = await fetchBoard('kills', 'week');
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith('leaderboard', { p_stat: 'kills', p_period: 'week' });
        expect(board).toEqual(validPayload);
    });

    it('gives an empty board when the server answers null', async () => {
        rpc.mockResolvedValueOnce({ data: null, error: null });
        await expect(fetchBoard('xp', 'all')).resolves.toEqual({ top: [], me: null });
    });

    it('rejects with LeaderboardError("offline"), quietly, when the build has no Supabase client', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(getSupabase).mockReturnValue(null);
        const failure = await fetchBoard('wins', 'month').catch((e: unknown) => e);
        expect(failure).toBeInstanceOf(LeaderboardError);
        expect(failure).toMatchObject({ code: 'offline' });
        expect(rpc).not.toHaveBeenCalled();
        expect(spy).not.toHaveBeenCalled();
    });

    it.each(['bad_stat', 'bad_period'])('maps the server error "%s" to unknown and logs it', async (message) => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        rpc.mockResolvedValueOnce({ data: null, error: { message, code: 'P0001' } });
        const failure = await fetchBoard('botWins', 'week').catch((e: unknown) => e);
        expect(failure).toBeInstanceOf(LeaderboardError);
        expect(failure).toMatchObject({ code: 'unknown', message });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[leaderboard]'), expect.anything());
    });

    it('maps a returned error without a server code (supabase-js wraps a failed fetch like this) to network', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        rpc.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } });
        await expect(fetchBoard('xp', 'week')).rejects.toMatchObject({ name: 'LeaderboardError', code: 'network' });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[leaderboard]'), expect.anything());
    });

    it('maps a thrown fetch failure to network and logs it', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await expect(fetchBoard('tournamentsWon', 'all')).rejects.toMatchObject({ code: 'network', message: 'Failed to fetch' });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[leaderboard]'), expect.anything());
    });
});
