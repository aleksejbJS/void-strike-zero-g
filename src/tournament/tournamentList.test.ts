import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabase } from '../account/supabaseClient';
import { failed, makeFakeTournamentSupabase, ok } from '../test/fakeTournamentSupabase';
import { listTournaments } from './tournamentList';

vi.mock('../account/supabaseClient', () => ({ getSupabase: vi.fn() }));

const LOBBY = '11111111-1111-4111-8111-111111111111';
const RUNNING = '22222222-2222-4222-8222-222222222222';
const row = (id: string, status: string, size: number | null, creatorSeat: number) => ({
    id, name: `cup ${id[0]}`, status, size, creator_seat: creatorSeat,
    created_at: '2026-11-04T11:00:00Z', started_at: null, finished_at: null, champion_seat: null,
});
const seat = (tournamentId: string, n: number, nickname: string, isBot = false) =>
    ({ tournament_id: tournamentId, seat: n, nickname, is_bot: isBot });
const match = (tournamentId: string, round: number, status: string) => ({ tournament_id: tournamentId, round, status });

let fake: ReturnType<typeof makeFakeTournamentSupabase>;

beforeEach(() => {
    fake = makeFakeTournamentSupabase();
    vi.mocked(getSupabase).mockReturnValue(fake.client);
});

afterEach(() => { vi.restoreAllMocks(); });

describe('listTournaments', () => {
    it('adds the creator nickname, the human count and the current round to each listed tournament', async () => {
        fake.tables.tournaments = ok([row(LOBBY, 'lobby', null, 1), row(RUNNING, 'running', 8, 0)]);
        fake.tables.tournament_seats = ok([
            seat(LOBBY, 1, 'Kolya'), seat(LOBBY, 2, 'Lena'),
            seat(RUNNING, 0, 'Max'), seat(RUNNING, 1, 'Ann'), seat(RUNNING, 2, 'Bot-Nyx', true),
        ]);
        fake.tables.tournament_matches = ok([
            match(RUNNING, 0, 'done'), match(RUNNING, 0, 'done'), match(RUNNING, 1, 'ready'), match(RUNNING, 2, 'waiting'),
        ]);

        const items = await listTournaments();

        expect(items.map(i => [i.tournament.id, i.creator, i.humans, i.round])).toEqual([
            [LOBBY, 'Kolya', 2, null],
            [RUNNING, 'Max', 2, 1],
        ]);
        const select = (table: string) => fake.queries.find(q => q.table === table)!.calls;
        expect(select('tournament_seats')).toContainEqual(['select', 'tournament_id, seat, nickname, is_bot']);
        expect(select('tournament_seats')).toContainEqual(['in', 'tournament_id', [LOBBY, RUNNING]]);
        expect(select('tournament_matches')).toContainEqual(['select', 'tournament_id, round, status']);
        expect(select('tournament_matches')).toContainEqual(['in', 'tournament_id', [LOBBY, RUNNING]]);
    });

    it('makes no detail reads for an empty list', async () => {
        fake.tables.tournaments = ok([]);
        expect(await listTournaments()).toEqual([]);
        expect(fake.queries.map(q => q.table)).toEqual(['tournaments']);
    });

    it('fails as a TournamentError when the details cannot be read', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fake.tables.tournaments = ok([row(LOBBY, 'lobby', null, 0)]);
        fake.tables.tournament_seats = failed({ message: 'boom' });
        await expect(listTournaments()).rejects.toMatchObject({ code: 'unknown', message: 'boom' });
    });
});
