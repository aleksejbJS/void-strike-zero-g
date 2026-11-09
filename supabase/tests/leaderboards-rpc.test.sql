-- Void Strike: Zero-G — SQL tests for 20261109000000_leaderboards.sql: the leaderboard RPC and browser privileges.
-- Run with: bash scripts/test-sql.sh (throwaway local database: auth-stub.sql, migrations, leaderboards-helpers.sql).
-- NEVER run this against the real project. Each case is one DO block of asserts.
-- Starts by emptying player_stats, so the boards hold only this file's players.

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

select 'leaderboards-rpc.test.sql: all cases passed' as result;
