-- Void Strike: Zero-G — SQL tests for supabase/migrations/20261109000000_leaderboards.sql
-- Run with: bash scripts/test-sql.sh (a throwaway local database with supabase/tests/auth-stub.sql).
-- NEVER run this against the real project: it creates a helper schema and test accounts.
--
-- Each case is one DO block of asserts. Saves go through public.player_progress, exactly as the browser
-- saves, so the trigger does the work. Within one DO block now() does not move, so tie-breaks by
-- updated_at are set by hand (we run as superuser). The "hostile value" case prints WARNING lines: expected.

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Helpers (schema lb)
-- ---------------------------------------------------------------------------
create schema lb;

-- A new account (the sign-up trigger creates its profile, so the nickname must pass its rules).
create function lb.user(p_nick text) returns uuid
language sql as $$
    insert into auth.users (email, raw_user_meta_data)
    values ('n' || encode(convert_to(lower(p_nick), 'UTF8'), 'hex') || '@players.invalid',
            jsonb_build_object('nickname', p_nick, 'nickname_key', lower(p_nick)))
    returning id
$$;

-- What the browser does on every cloud save: upsert the whole snapshot.
create function lb.save(p_user uuid, p_data jsonb) returns void
language sql as $$
    insert into public.player_progress (user_id, data) values (p_user, p_data)
    on conflict (user_id) do update set data = excluded.data, updated_at = now()
$$;

create function lb.week() returns date
language sql as $$ select date_trunc('week', now() at time zone 'utc')::date $$;

create function lb.month() returns date
language sql as $$ select date_trunc('month', now() at time zone 'utc')::date $$;

-- The stored total of one row, or null when the row does not exist.
create function lb.val(p_user uuid, p_stat text, p_period text) returns bigint
language sql as $$
    select value from public.player_stats
    where user_id = p_user and stat = p_stat and period = p_period
      and period_start = case p_period when 'week' then lb.week() when 'month' then lb.month()
                              else date '2000-01-01' end
$$;

create function lb.rows(p_user uuid, p_stat text) returns bigint
language sql as $$ select count(*) from public.player_stats where user_id = p_user and stat = p_stat $$;

-- Who calls the RPC: a player id, or null for a guest (no login).
create function lb.as_user(p_user uuid) returns void
language sql as $$ select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true) $$;

-- Runs p_sql and asserts it raises exactly the message p_code.
create function lb.expect_error(p_sql text, p_code text) returns void
language plpgsql as $$
declare v_msg text;
begin
    begin
        execute p_sql;
    exception when others then
        v_msg := sqlerrm;
    end;
    if v_msg is distinct from p_code then
        raise exception 'expected error "%", got "%" from: %', p_code, coalesce(v_msg, '(no error)'), p_sql;
    end if;
end $$;

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
-- Case: one save that jumps a counter by more than its limit is clamped to the limit (with a warning)
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := lb.user('Jumper');
begin
    perform lb.save(v_u, '{"xp": 0, "stats": {"kills": 0, "botKills": 0, "wins": 0, "botWins": 0, "tournamentsWon": 0}}');
    perform lb.save(v_u, '{"xp": 999999, "stats": {"kills": 5000, "botKills": 5000, "wins": 5000, "botWins": 5000, "tournamentsWon": 5000}}');
    assert lb.val(v_u, 'kills', 'all') = 300 and lb.val(v_u, 'kills', 'week') = 300
        and lb.val(v_u, 'kills', 'month') = 300, 'kills +300';
    assert lb.val(v_u, 'xp', 'all') = 1000 and lb.val(v_u, 'xp', 'week') = 1000, 'xp +1000';
    assert lb.val(v_u, 'botKills', 'all') = 600, 'botKills +600';
    assert lb.val(v_u, 'wins', 'all') = 30 and lb.val(v_u, 'botWins', 'all') = 30, 'wins and botWins +30';
    assert lb.val(v_u, 'tournamentsWon', 'month') = 5, 'tournamentsWon +5';
end $$;

-- ---------------------------------------------------------------------------
-- Case: a hostile snapshot never fails the save; bad values are skipped (each with a WARNING)
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := lb.user('Hacker');
begin
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
-- Case: the board shows the current period only; top 10 by value; your own place below it
-- ---------------------------------------------------------------------------
create table lb.ranked (n int primary key, id uuid);
do $$
declare v_u uuid;
begin
    delete from public.player_stats; -- earlier cases' players would sit on these boards
    for i in 1 .. 12 loop
        v_u := lb.user('Rank' || i);
        insert into lb.ranked values (i, v_u);
        perform lb.save(v_u, '{"stats": {"kills": 0, "wins": 0}}'); -- wins stays at its 0 baseline
        perform lb.save(v_u, jsonb_build_object('stats', jsonb_build_object('kills', i)));
    end loop;
end $$;

do $$
declare v json;
declare v_low uuid := (select id from lb.ranked where n = 1);
declare v_old uuid := (select id from lb.ranked where n = 5);
begin
    -- A big week row from LAST week must not show on this week's board.
    insert into public.player_stats (user_id, period, period_start, stat, value)
    values (v_old, 'week', lb.week() - 7, 'kills', 999);

    perform lb.as_user(v_low);
    v := public.leaderboard('kills', 'week');
    assert json_array_length(v -> 'top') = 10, 'top 10 only';
    assert (v -> 'top' -> 0 ->> 'rank')::int = 1 and (v -> 'top' -> 0 ->> 'value')::bigint = 12
        and v -> 'top' -> 0 ->> 'nickname' = 'Rank12', 'first place: the highest value with its nickname';
    assert (v -> 'top' -> 9 ->> 'rank')::int = 10 and (v -> 'top' -> 9 ->> 'value')::bigint = 3, 'tenth place';
    assert (v -> 'me' ->> 'rank')::int = 12 and (v -> 'me' ->> 'value')::bigint = 1, 'my own place below the top';

    v := public.leaderboard('kills', 'month');
    assert (v -> 'top' -> 0 ->> 'value')::bigint = 12, 'the same increases are on the monthly board';

    -- All-time totals: the baseline (0) plus the increase.
    v := public.leaderboard('kills', 'all');
    assert (v -> 'top' -> 0 ->> 'value')::bigint = 12 and (v -> 'me' ->> 'rank')::int = 12, 'all-time board';

    -- Values of 0 are never listed (everyone has an all-time wins row of 0): an empty list, and "me" is null.
    v := public.leaderboard('wins', 'all');
    assert json_array_length(v -> 'top') = 0 and json_typeof(v -> 'me') = 'null', 'zeros are not ranked';
    v := public.leaderboard('wins', 'week');
    assert json_array_length(v -> 'top') = 0 and json_typeof(v -> 'me') = 'null', 'empty board';
end $$;

-- ---------------------------------------------------------------------------
-- Case: equal values -> the one who got there first (earlier updated_at) ranks higher
-- ---------------------------------------------------------------------------
do $$
declare v json;
declare v_a uuid := (select id from lb.ranked where n = 11);
declare v_b uuid := (select id from lb.ranked where n = 12);
begin
    update public.player_stats set value = 50, updated_at = now() - interval '1 hour'
    where user_id = v_a and stat = 'kills' and period = 'week';
    update public.player_stats set value = 50, updated_at = now() - interval '2 hours'
    where user_id = v_b and stat = 'kills' and period = 'week';

    perform lb.as_user(v_a);
    v := public.leaderboard('kills', 'week');
    assert v -> 'top' -> 0 ->> 'nickname' = 'Rank12' and v -> 'top' -> 1 ->> 'nickname' = 'Rank11', 'earlier wins the tie';
    assert (v -> 'me' ->> 'rank')::int = 2 and (v -> 'me' ->> 'value')::bigint = 50, 'my rank follows the same order';
end $$;

-- ---------------------------------------------------------------------------
-- Case: a guest gets the board without "me"; bad arguments raise codes
-- ---------------------------------------------------------------------------
do $$
declare v json;
begin
    perform lb.as_user(null);
    v := public.leaderboard('kills', 'week');
    assert json_array_length(v -> 'top') = 10, 'a guest sees the board';
    assert json_typeof(v -> 'me') = 'null', 'a guest has no own place';

    perform lb.expect_error($q$select public.leaderboard('nope', 'week')$q$, 'bad_stat');
    perform lb.expect_error($q$select public.leaderboard(null, 'week')$q$, 'bad_stat');
    perform lb.expect_error($q$select public.leaderboard('kills', 'day')$q$, 'bad_period');
    perform lb.expect_error($q$select public.leaderboard('kills', null)$q$, 'bad_period');
end $$;

-- ---------------------------------------------------------------------------
-- Case: deleting an account removes its totals
-- ---------------------------------------------------------------------------
do $$
declare v_u uuid := (select id from lb.ranked where n = 3);
begin
    delete from auth.users where id = v_u;
    assert not exists (select 1 from public.player_stats where user_id = v_u), 'totals go with the account';
end $$;

-- ---------------------------------------------------------------------------
-- Case: what the browser roles may and may not do
-- ---------------------------------------------------------------------------
do $$
begin
    assert has_function_privilege('anon', 'public.leaderboard(text, text)', 'execute'), 'anon may read boards';
    assert has_function_privilege('authenticated', 'public.leaderboard(text, text)', 'execute'),
        'authenticated may read boards';
    assert not has_function_privilege('anon', 'public.record_player_stats()', 'execute'), 'anon cannot run the trigger fn';
    assert not has_function_privilege('authenticated', 'public.record_player_stats()', 'execute'),
        'authenticated cannot run the trigger fn';
    assert not has_table_privilege('anon', 'public.player_stats', 'select'), 'anon cannot read player_stats';
    assert not has_table_privilege('authenticated', 'public.player_stats', 'insert'),
        'authenticated cannot write player_stats';
end $$;

-- A save made the way the browser makes it (role authenticated, through player_progress RLS) still records
-- totals: the trigger runs as its owner, not as the player.
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

set role authenticated;
do $$
declare v_failed boolean;
declare v json;
begin
    v := public.leaderboard('kills', 'all');
    assert json_array_length(v -> 'top') > 0, 'the RPC works for a logged-in browser';

    v_failed := false;
    begin
        perform * from public.player_stats;
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'authenticated cannot select player_stats';

    v_failed := false;
    begin
        update public.player_stats set value = 1000000;
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'authenticated cannot update player_stats';
end $$;
reset role;

set role anon;
do $$
declare v json := public.leaderboard('kills', 'week');
declare v_failed boolean := false;
begin
    assert json_array_length(v -> 'top') > 0, 'the RPC works for a guest browser';
    begin
        insert into public.player_stats (user_id, period, period_start, stat, value)
        values (gen_random_uuid(), 'all', '2000-01-01', 'kills', 1);
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'anon cannot insert into player_stats';
end $$;
reset role;

select 'leaderboards.test.sql: all cases passed' as result;
