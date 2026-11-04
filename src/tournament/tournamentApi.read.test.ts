import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabase } from '../account/supabaseClient';
import { failed, makeFakeTournamentSupabase, ok } from '../test/fakeTournamentSupabase';
import { listOpen, loadSnapshot } from './tournamentApi';

vi.mock('../account/supabaseClient', () => ({ getSupabase: vi.fn() }));

const NOW = new Date('2026-11-04T12:00:00.000Z');
const T_ID = '11111111-1111-4111-8111-111111111111';

const tournamentRow = {
    id: T_ID, name: 'Friday cup', status: 'running', size: 4, creator_seat: 0,
    created_at: '2026-11-04T11:00:00Z', started_at: '2026-11-04T11:10:00Z', finished_at: null, champion_seat: null,
};
const seatRow = { seat: 1, nickname: 'Bea', is_bot: false, bracket_pos: 2, joined_at: '2026-11-04T11:01:00Z' };
const matchRow = {
    id: 'm1', round: 0, slot: 1, seat_a: 1, seat_b: null, host_seat: 1, host_peer_id: 'peer-1', status: 'ready',
    score_a: 0, score_b: 0, winner_seat: null, decided_by: null, ready_at: '2026-11-04T11:11:00Z',
};

let fake: ReturnType<typeof makeFakeTournamentSupabase>;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    fake = makeFakeTournamentSupabase();
    vi.mocked(getSupabase).mockReturnValue(fake.client);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('listOpen', () => {
    it('asks for lobbies < 30 min, running < 3 h and finished < 10 min, newest first', async () => {
        await listOpen();
        const { table, calls } = fake.queries[0];
        expect(table).toBe('tournaments');
        const or = calls.find(([method]) => method === 'or');
        expect(or?.[1]).toBe([
            'and(status.eq.lobby,created_at.gte.2026-11-04T11:30:00.000Z)',
            'and(status.eq.running,started_at.gte.2026-11-04T09:00:00.000Z)',
            'and(status.eq.finished,finished_at.gte.2026-11-04T11:50:00.000Z)',
        ].join(','));
        expect(calls).toContainEqual(['order', 'created_at', { ascending: false }]);
    });

    it('maps rows to camelCase', async () => {
        fake.tables.tournaments = ok([tournamentRow]);
        expect(await listOpen()).toEqual([{
            id: T_ID, name: 'Friday cup', status: 'running', size: 4, creatorSeat: 0,
            createdAt: '2026-11-04T11:00:00Z', startedAt: '2026-11-04T11:10:00Z', finishedAt: null, championSeat: null,
        }]);
    });

    it('gives offline without a client and unknown when the query fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fake.tables.tournaments = failed({ message: 'boom' });
        await expect(listOpen()).rejects.toMatchObject({ code: 'unknown', message: 'boom' });
        vi.mocked(getSupabase).mockReturnValue(null);
        await expect(listOpen()).rejects.toMatchObject({ code: 'offline' });
    });
});

describe('loadSnapshot', () => {
    it('reads seats with explicit columns (secret_hash is not readable) and orders the matches', async () => {
        fake.tables.tournaments = ok(tournamentRow);
        fake.tables.tournament_seats = ok([seatRow]);
        fake.tables.tournament_matches = ok([matchRow]);
        const snapshot = await loadSnapshot(T_ID);

        const byTable = (name: string) => fake.queries.find((q) => q.table === name)!.calls;
        const seatSelect = byTable('tournament_seats').find(([m]) => m === 'select');
        expect(seatSelect?.[1]).toBe('seat, nickname, is_bot, bracket_pos, joined_at');
        expect(seatSelect?.[1]).not.toContain('*');
        expect(byTable('tournament_seats')).toContainEqual(['eq', 'tournament_id', T_ID]);
        expect(byTable('tournament_matches')).toContainEqual(['eq', 'tournament_id', T_ID]);
        expect(byTable('tournaments')).toContainEqual(['eq', 'id', T_ID]);

        expect(snapshot.tournament).toMatchObject({ id: T_ID, status: 'running', size: 4, startedAt: '2026-11-04T11:10:00Z' });
        expect(snapshot.seats).toEqual([{ seat: 1, nickname: 'Bea', isBot: false, bracketPos: 2, joinedAt: '2026-11-04T11:01:00Z' }]);
        expect(snapshot.matches[0]).toEqual({
            id: 'm1', round: 0, slot: 1, seatA: 1, seatB: null, hostSeat: 1, hostPeerId: 'peer-1', status: 'ready',
            scoreA: 0, scoreB: 0, winnerSeat: null, decidedBy: null, readyAt: '2026-11-04T11:11:00Z',
        });
    });

    it('a tournament that is gone is an unknown error, not an empty snapshot', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fake.tables.tournaments = ok(null);
        await expect(loadSnapshot(T_ID)).rejects.toMatchObject({ code: 'unknown', message: expect.stringContaining('not found') });
    });

    it('any failing query fails the whole load', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fake.tables.tournaments = ok(tournamentRow);
        fake.tables.tournament_seats = failed({ message: 'permission denied for table tournament_seats', code: '42501' });
        await expect(loadSnapshot(T_ID)).rejects.toMatchObject({ code: 'unknown' });
    });
});
