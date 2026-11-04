import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabase } from '../account/supabaseClient';
import { failed, makeFakeTournamentSupabase, ok } from '../test/fakeTournamentSupabase';
import {
    createTournament, joinTournament, leaveTournament, matchSeen, publishHost, reportResult, resolveStale, startTournament,
} from './tournamentApi';
import { TournamentError, type SeatTicket } from './types';

vi.mock('../account/supabaseClient', () => ({ getSupabase: vi.fn() }));

const SECRET = 'ab'.repeat(32);
const T_ID = '11111111-1111-4111-8111-111111111111';
const M_ID = '22222222-2222-4222-8222-222222222222';
const ticket: SeatTicket = { tournamentId: T_ID, seat: 3, secret: SECRET };

let fake: ReturnType<typeof makeFakeTournamentSupabase>;

beforeEach(() => {
    fake = makeFakeTournamentSupabase();
    vi.mocked(getSupabase).mockReturnValue(fake.client);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('RPC wrappers send the exact parameter names', () => {
    it('createTournament sends p_name and p_nickname and returns the ticket with the new id', async () => {
        fake.rpcResults.push(ok({ id: T_ID, seat: 0, secret: SECRET }));
        const result = await createTournament('Friday cup', 'Alex');
        expect(fake.rpc).toHaveBeenCalledWith('create_tournament', { p_name: 'Friday cup', p_nickname: 'Alex' });
        expect(result).toEqual({ tournamentId: T_ID, seat: 0, secret: SECRET });
    });

    it('joinTournament sends p_id and p_nickname; the ticket carries the id it joined', async () => {
        fake.rpcResults.push(ok({ seat: 2, secret: SECRET }));
        const result = await joinTournament(T_ID, 'Bea');
        expect(fake.rpc).toHaveBeenCalledWith('join_tournament', { p_id: T_ID, p_nickname: 'Bea' });
        expect(result).toEqual({ tournamentId: T_ID, seat: 2, secret: SECRET });
    });

    it('leaveTournament and startTournament send p_id, p_seat, p_secret', async () => {
        await leaveTournament(ticket);
        await startTournament(ticket);
        const ids = { p_id: T_ID, p_seat: 3, p_secret: SECRET };
        expect(fake.rpc).toHaveBeenNthCalledWith(1, 'leave_tournament', ids);
        expect(fake.rpc).toHaveBeenNthCalledWith(2, 'start_tournament', ids);
    });

    it('matchSeen sends p_match, p_seat, p_secret', async () => {
        await matchSeen(M_ID, ticket);
        expect(fake.rpc).toHaveBeenCalledWith('match_seen', { p_match: M_ID, p_seat: 3, p_secret: SECRET });
    });

    it('publishHost adds p_peer_id', async () => {
        await publishHost(M_ID, ticket, 'peer-xyz');
        expect(fake.rpc).toHaveBeenCalledWith('publish_host', { p_match: M_ID, p_seat: 3, p_secret: SECRET, p_peer_id: 'peer-xyz' });
    });

    it('reportResult adds p_score_a and p_score_b', async () => {
        await reportResult(M_ID, ticket, 10, 4);
        expect(fake.rpc).toHaveBeenCalledWith('report_result', {
            p_match: M_ID, p_seat: 3, p_secret: SECRET, p_score_a: 10, p_score_b: 4,
        });
    });

    it('resolveStale sends only p_id', async () => {
        await resolveStale(T_ID);
        expect(fake.rpc).toHaveBeenCalledWith('resolve_stale', { p_id: T_ID });
    });
});

describe('error mapping', () => {
    it.each(['not_open', 'full', 'not_creator', 'not_enough_players', 'bad_ticket'] as const)(
        'maps the Postgres message "%s" to TournamentError(%s) without logging',
        async (code) => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            fake.rpcResults.push(failed({ message: code, code: 'P0001' }));
            const err = await startTournament(ticket).catch((e: unknown) => e);
            expect(err).toBeInstanceOf(TournamentError);
            expect(err).toMatchObject({ code, message: code });
            expect(spy).not.toHaveBeenCalled();
        },
    );

    it.each(['bad_name', 'bad_nickname', 'bad_score', 'bad_peer_id'])(
        'maps the input error "%s" to unknown but keeps the raw message and logs it',
        async (message) => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            fake.rpcResults.push(failed({ message, code: 'P0001' }));
            const err = await createTournament('x', 'y').catch((e: unknown) => e);
            expect(err).toMatchObject({ code: 'unknown', message });
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.anything());
        },
    );

    it('maps a thrown fetch failure to unknown and logs it', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        fake.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await expect(resolveStale(T_ID)).rejects.toMatchObject({ code: 'unknown', message: 'Failed to fetch' });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.anything());
    });

    it('rejects a malformed ticket answer instead of handing out a broken ticket', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fake.rpcResults.push(ok({ id: T_ID, seat: 'zero' }));
        await expect(createTournament('x', 'y')).rejects.toMatchObject({ code: 'unknown' });
    });
});

describe('without a Supabase client', () => {
    beforeEach(() => {
        vi.mocked(getSupabase).mockReturnValue(null);
    });

    it('every wrapper gives TournamentError("offline")', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const calls = [
            () => createTournament('x', 'y'), () => joinTournament(T_ID, 'y'), () => leaveTournament(ticket),
            () => startTournament(ticket), () => matchSeen(M_ID, ticket), () => publishHost(M_ID, ticket, 'p'),
            () => reportResult(M_ID, ticket, 10, 0), () => resolveStale(T_ID),
        ];
        for (const call of calls) {
            await expect(call()).rejects.toMatchObject({ name: 'TournamentError', code: 'offline' });
        }
        expect(spy).not.toHaveBeenCalled(); // not having Supabase set up is normal, not an error
    });
});
