-- Void Strike: Zero-G — SQL tests for 20261109000000_leaderboards.sql: the trigger (period totals).
-- Run with: bash scripts/test-sql.sh (throwaway local database: auth-stub.sql, migrations, leaderboards-helpers.sql).
-- NEVER run this against the real project. Each case is one DO block of asserts.
-- Expected WARNINGs are silenced inside their blocks; test-sql.sh checks the warning paths separately.

-- ---------------------------------------------------------------------------
-- Case: the first save is the baseline (all-time only); later increases reach week, month and all
-- ---------------------------------------------------------------------------
create table lb.players (name text primary key, id uuid);
insert into lb.players values ('first', lb.user('First'));

do $$
declare v_u uuid := (select id from lb.players where name = 'first');
begin
    perform lb.save(v_u, '{"achievements": {}, "xp": 500, "look": null, "stats": {"kills": 10, "wins": 0}}');
    assert lb.val(v_u, 'xp', 'all') = 500, 'baseline xp';
    assert lb.val(v_u, 'kills', 'all') = 10, 'baseline kills';
    assert lb.val(v_u, 'wins', 'all') = 0, 'a present 0 creates the baseline row';
    assert lb.val(v_u, 'botKills', 'all') is null, 'a missing counter creates nothing';
    assert lb.rows(v_u, 'kills') = 1 and lb.rows(v_u, 'xp') = 1, 'no week/month rows on the baseline';

    perform lb.save(v_u, '{"xp": 500, "stats": {"kills": 13, "wins": 0}}');
    assert lb.val(v_u, 'kills', 'all') = 13, 'all-time kills';
    assert lb.val(v_u, 'kills', 'week') = 3, 'weekly kills = the increase';
    assert lb.val(v_u, 'kills', 'month') = 3, 'monthly kills = the increase';
    assert lb.rows(v_u, 'xp') = 1, 'xp did not grow: still only the baseline';
    assert lb.rows(v_u, 'wins') = 1, 'wins did not grow: still only the baseline';
end $$;

-- ---------------------------------------------------------------------------
-- Case: a lower value (another device with an older copy) and an old build without "stats" change nothing
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := (select id from lb.players where name = 'first');
begin
    perform lb.save(v_u, '{"xp": 500, "stats": {"kills": 11}}');
    assert lb.val(v_u, 'kills', 'all') = 13 and lb.val(v_u, 'kills', 'week') = 3
        and lb.val(v_u, 'kills', 'month') = 3, 'a lower value is ignored';

    perform lb.save(v_u, '{"achievements": {}, "xp": 650}');
    assert lb.val(v_u, 'kills', 'all') = 13 and lb.val(v_u, 'kills', 'week') = 3, 'no stats: kills untouched';
    assert lb.val(v_u, 'wins', 'all') = 0, 'no stats: wins untouched';
    assert lb.val(v_u, 'xp', 'all') = 650 and lb.val(v_u, 'xp', 'week') = 150
        and lb.val(v_u, 'xp', 'month') = 150, 'xp still counts from an old build';

    -- Back to the newer device: only what is above the stored total counts.
    perform lb.save(v_u, '{"xp": 650, "stats": {"kills": 15}}');
    assert lb.val(v_u, 'kills', 'all') = 15 and lb.val(v_u, 'kills', 'week') = 5, 'counts on from the total';
end $$;

-- ---------------------------------------------------------------------------
-- Case: one save that jumps a counter by more than its limit is clamped; the excess is never paid later
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := lb.user('Jumper');
begin
    perform set_config('client_min_messages', 'error', true); -- the expected clamp warnings
    perform lb.save(v_u, '{"xp": 0, "stats": {"kills": 0, "botKills": 0, "wins": 0, "botWins": 0, "tournamentsWon": 0}}');
    perform lb.save(v_u, '{"xp": 999999, "stats": {"kills": 5000, "botKills": 5000, "wins": 5000, "botWins": 5000, "tournamentsWon": 5000}}');
    assert lb.val(v_u, 'kills', 'all') = 300 and lb.val(v_u, 'kills', 'week') = 300
        and lb.val(v_u, 'kills', 'month') = 300, 'kills +300';
    assert lb.val(v_u, 'xp', 'all') = 1000 and lb.val(v_u, 'xp', 'week') = 1000, 'xp +1000';
    assert lb.val(v_u, 'botKills', 'all') = 600, 'botKills +600';
    assert lb.val(v_u, 'wins', 'all') = 30 and lb.val(v_u, 'botWins', 'all') = 30, 'wins and botWins +30';
    assert lb.val(v_u, 'tournamentsWon', 'month') = 5, 'tournamentsWon +5';

    -- The same snapshot again (the client keeps its maximum): the dropped excess is not paid out again.
    perform lb.save(v_u, '{"xp": 999999, "stats": {"kills": 5000, "botKills": 5000, "wins": 5000, "botWins": 5000, "tournamentsWon": 5000}}');
    assert lb.val(v_u, 'kills', 'all') = 300 and lb.val(v_u, 'kills', 'week') = 300
        and lb.val(v_u, 'kills', 'month') = 300, 'kills unchanged on a repeated save';
    assert lb.val(v_u, 'xp', 'all') = 1000 and lb.val(v_u, 'tournamentsWon', 'all') = 5, 'others unchanged too';

    -- A normal increase after that counts in full.
    perform lb.save(v_u, '{"xp": 1000004, "stats": {"kills": 5005}}');
    assert lb.val(v_u, 'kills', 'all') = 305 and lb.val(v_u, 'kills', 'week') = 305
        and lb.val(v_u, 'kills', 'month') = 305, 'kills +5';
    assert lb.val(v_u, 'xp', 'all') = 1005 and lb.val(v_u, 'xp', 'week') = 1005, 'xp +5';
end $$;

-- ---------------------------------------------------------------------------
-- Case: the first save (baseline) is capped per counter; later increases count from the raw value
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := lb.user('Veteran');
begin
    perform set_config('client_min_messages', 'error', true); -- the expected cap warnings
    perform lb.save(v_u, '{"xp": 9000000000000000000, "stats": {"kills": 20000, "botKills": 10000, "wins": 5000, "botWins": 999, "tournamentsWon": 101}}');
    assert lb.val(v_u, 'xp', 'all') = 200000, 'xp baseline capped at 200000';
    assert lb.val(v_u, 'kills', 'all') = 10000 and lb.val(v_u, 'botKills', 'all') = 10000, 'kills capped, botKills at cap';
    assert lb.val(v_u, 'wins', 'all') = 1000 and lb.val(v_u, 'botWins', 'all') = 999, 'wins capped, botWins below cap';
    assert lb.val(v_u, 'tournamentsWon', 'all') = 100, 'tournamentsWon capped';
    assert lb.rows(v_u, 'xp') = 1 and lb.rows(v_u, 'kills') = 1, 'still no week/month rows on the baseline';

    perform lb.save(v_u, '{"xp": 9000000000000000010, "stats": {"kills": 20000}}');
    assert lb.val(v_u, 'xp', 'all') = 200010 and lb.val(v_u, 'xp', 'week') = 10
        and lb.val(v_u, 'xp', 'month') = 10, 'a later +10 is +10';
    assert lb.rows(v_u, 'kills') = 1 and lb.val(v_u, 'kills', 'all') = 10000, 'an unchanged raw value adds nothing';
end $$;

-- ---------------------------------------------------------------------------
-- Case: a hostile snapshot never fails the save; bad values are skipped (each with a WARNING)
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := lb.user('Hacker');
begin
    perform set_config('client_min_messages', 'error', true); -- the expected warnings (checked by test-sql.sh)
    perform lb.save(v_u, '{"xp": 10, "stats": {"kills": 10, "botKills": 10, "wins": 10, "botWins": 10, "tournamentsWon": 1}}');
    perform lb.save(v_u, '{"xp": "9999", "stats": {"kills": -5, "botKills": 12.5, "wins": 1e30, "botWins": true, "tournamentsWon": null}}');
    assert (select data ->> 'xp' from public.player_progress where user_id = v_u) = '9999', 'the save itself went through';
    assert lb.val(v_u, 'xp', 'all') = 10 and lb.val(v_u, 'kills', 'all') = 10 and lb.val(v_u, 'botKills', 'all') = 10
        and lb.val(v_u, 'wins', 'all') = 10 and lb.val(v_u, 'botWins', 'all') = 10
        and lb.val(v_u, 'tournamentsWon', 'all') = 1, 'nothing changed';
    assert lb.rows(v_u, 'kills') = 1 and lb.rows(v_u, 'wins') = 1, 'no week/month rows from bad values';

    perform lb.save(v_u, '{"xp": [1], "stats": [1, 2]}');
    perform lb.save(v_u, '"not an object"');
    perform lb.save(v_u, '{"xp": 9223372036854775808, "stats": "x"}');
    assert lb.val(v_u, 'xp', 'all') = 10 and lb.val(v_u, 'kills', 'all') = 10, 'still nothing changed';

    -- A brand-new player whose first snapshot is bad gets no baseline from the bad values.
    v_u := lb.user('Hacker2');
    perform lb.save(v_u, '{"xp": -1, "stats": {"kills": "lots", "wins": 3}}');
    assert lb.rows(v_u, 'xp') = 0 and lb.rows(v_u, 'kills') = 0, 'no baseline from bad values';
    assert lb.val(v_u, 'wins', 'all') = 3, 'the good value still makes its baseline';
end $$;

-- ---------------------------------------------------------------------------
-- Case: a save made as the browser makes it (role authenticated, through player_progress RLS) still records
-- totals: the trigger runs as its owner, not as the player
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('lb.browser_user', lb.user('Browser')::text, false); end $$;
set role authenticated;
do $$
declare v_u uuid := current_setting('lb.browser_user')::uuid;
begin
    perform set_config('request.jwt.claim.sub', v_u::text, true);
    insert into public.player_progress (user_id, data) values (v_u, '{"xp": 100, "stats": {"kills": 4}}')
    on conflict (user_id) do update set data = excluded.data;
    insert into public.player_progress (user_id, data) values (v_u, '{"xp": 120, "stats": {"kills": 9}}')
    on conflict (user_id) do update set data = excluded.data;
end $$;
reset role;
do $$
declare v_u uuid := current_setting('lb.browser_user')::uuid;
begin
    assert lb.val(v_u, 'kills', 'all') = 9 and lb.val(v_u, 'kills', 'week') = 5, 'browser save: kills';
    assert lb.val(v_u, 'xp', 'all') = 120 and lb.val(v_u, 'xp', 'month') = 20, 'browser save: xp';
end $$;

-- ---------------------------------------------------------------------------
-- Case: deleting an account removes its totals
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := current_setting('lb.browser_user')::uuid;
begin
    delete from auth.users where id = v_u;
    assert not exists (select 1 from public.player_stats where user_id = v_u), 'totals go with the account';
end $$;

select 'leaderboards-trigger.test.sql: all cases passed' as result;
