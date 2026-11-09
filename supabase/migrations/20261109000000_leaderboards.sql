-- Void Strike: Zero-G — leaderboards: weekly, monthly and all-time totals, and the RPC that serves the boards.
-- Run AFTER 20261103000000_accounts.sql: paste this whole file into Supabase Dashboard -> SQL Editor ->
-- New query -> Run. Safe to run more than once. Setup steps: docs/supabase-setup.md (section "Leaderboards").
-- Tests: bash scripts/test-sql.sh (supabase/tests/leaderboards.test.sql, on a throwaway local Postgres).
--
-- How it works:
--   * A trigger on player_progress compares each ranked counter of the saved snapshot with the stored all-time
--     total and adds the INCREASE to this week, this month and all-time. A lower value (another device's older
--     copy) or a missing counter (an older build) changes nothing. The first save only records the all-time
--     baseline, so veterans do not flood the first weekly board. A jump above the per-save limit is clamped.
--   * The trigger never makes a save fail: a bad value is skipped with a WARNING naming player and counter.
--   * Browsers cannot read or write player_stats; they read the boards through leaderboard() only.
-- Week starts Monday 00:00 UTC, month on the 1st 00:00 UTC; "all" rows use period_start 2000-01-01.
-- Error messages are codes the client maps: bad_stat, bad_period.

-- player_stats: one row per (player, period, period start, counter).
create table if not exists public.player_stats (
    user_id uuid not null references auth.users (id) on delete cascade,
    period text not null check (period in ('week', 'month', 'all')),
    period_start date not null,
    stat text not null,
    value bigint not null default 0,
    updated_at timestamptz not null default now(), -- when the value last grew: the earlier one wins a tie
    primary key (user_id, period, period_start, stat)
);

-- The board query: one period of one counter, best first, ties by who got there first.
create index if not exists player_stats_board_idx
    on public.player_stats (stat, period, period_start, value desc, updated_at);

-- RLS on with no policies, and no table rights: only the security-definer functions below touch the rows.
-- Supabase grants ALL on new tables to anon/authenticated by default: take it back.
alter table public.player_stats enable row level security;
revoke all on table public.player_stats from public, anon, authenticated;

-- Ranked counters and their per-save limits (no real session gets near them); null = not a ranked counter.
-- Keep in step with the boards in the client (src/leaderboard) and the counters it pushes (src/game/stats).
create or replace function public.leaderboard_stat_limit(p_stat text)
returns bigint
language sql
immutable
set search_path = public
as $$
    select case p_stat
        when 'xp' then 1000
        when 'kills' then 300
        when 'botKills' then 600
        when 'wins' then 30
        when 'botWins' then 30
        when 'tournamentsWon' then 5
    end::bigint
$$;

revoke all on function public.leaderboard_stat_limit(text) from public, anon, authenticated;

-- Trigger: turn increases of the saved counters into week / month / all-time totals.
create or replace function public.record_player_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_week date := date_trunc('week', now() at time zone 'utc')::date;
    v_month date := date_trunc('month', now() at time zone 'utc')::date;
    v_stat text;
    v_raw jsonb;
    v_num numeric;
    v_value bigint;
    v_total bigint;
    v_delta bigint;
    v_limit bigint;
begin
    foreach v_stat in array array['xp', 'kills', 'botKills', 'wins', 'botWins', 'tournamentsWon'] loop
        -- xp sits at the top of the snapshot, the other counters in "stats". Missing: an older build, skip.
        v_raw := case when v_stat = 'xp' then new.data -> 'xp' else new.data -> 'stats' -> v_stat end;
        continue when v_raw is null;

        -- Anything but a whole number from 0 to the bigint maximum is skipped (a hostile or broken client).
        -- Only a JSON number is cast, and only to numeric (never fails): the player's save must never fail.
        v_num := case when jsonb_typeof(v_raw) = 'number' then v_raw::numeric end;
        if v_num is null or v_num < 0 or v_num <> trunc(v_num) or v_num > 9223372036854775807 then
            raise warning 'record_player_stats: user %, stat %: skipped % (not a whole number from 0 to 2^63-1)',
                new.user_id, v_stat, left(v_raw::text, 40);
            continue;
        end if;
        v_value := v_num::bigint;

        -- Saves of one player are serialised by the player_progress row lock; "for update" is a second lock.
        select value into v_total
        from public.player_stats
        where user_id = new.user_id and period = 'all' and period_start = date '2000-01-01' and stat = v_stat
        for update;

        if not found then
            -- First save with this counter: the baseline. Nothing goes to week/month.
            insert into public.player_stats (user_id, period, period_start, stat, value)
            values (new.user_id, 'all', date '2000-01-01', v_stat, v_value)
            on conflict (user_id, period, period_start, stat) do nothing;
            continue;
        end if;

        v_delta := v_value - v_total; -- both are 0..bigint max, so this cannot overflow
        continue when v_delta <= 0;    -- unchanged, or an older copy from another device

        v_limit := public.leaderboard_stat_limit(v_stat);
        if v_delta > v_limit then
            raise warning 'record_player_stats: user %, stat %: one save raised it by %, clamped to %',
                new.user_id, v_stat, v_delta, v_limit;
            v_delta := v_limit;
        end if;

        -- total + delta <= the saved value, and week/month never exceed all-time: no overflow either.
        insert into public.player_stats (user_id, period, period_start, stat, value, updated_at)
        values (new.user_id, 'all', date '2000-01-01', v_stat, v_delta, now()),
               (new.user_id, 'week', v_week, v_stat, v_delta, now()),
               (new.user_id, 'month', v_month, v_stat, v_delta, now())
        on conflict (user_id, period, period_start, stat)
            do update set value = player_stats.value + excluded.value, updated_at = now();
    end loop;

    return null; -- an AFTER trigger: ignored
end;
$$;

-- Only the trigger runs this function; nobody calls it directly.
revoke all on function public.record_player_stats() from public, anon, authenticated;

-- player_progress is our own table, so dropping and re-creating its trigger is safe on a re-run.
drop trigger if exists on_player_progress_saved on public.player_progress;
create trigger on_player_progress_saved
    after insert or update of data on public.player_progress
    for each row execute function public.record_player_stats();

-- leaderboard(stat, period): the top 10 of the current period, plus the caller's own place.
-- Returns { "top": [{ "rank", "nickname", "value" }], "me": { "rank", "value" } | null }.
-- Order: value desc, then the earlier updated_at, then user id (only so equal rows never swap between calls).
-- Values of 0 are never listed. "me" only for a logged-in caller with a value above 0 in this period.
create or replace function public.leaderboard(p_stat text, p_period text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_start date;
    v_me uuid := auth.uid();
    v_mine public.player_stats;
    v_top json;
    v_me_json json;
begin
    if public.leaderboard_stat_limit(p_stat) is null then
        raise exception 'bad_stat';
    end if;
    v_start := case p_period
        when 'week' then date_trunc('week', now() at time zone 'utc')::date
        when 'month' then date_trunc('month', now() at time zone 'utc')::date
        when 'all' then date '2000-01-01'
    end;
    if v_start is null then
        raise exception 'bad_period';
    end if;

    select coalesce(json_agg(json_build_object('rank', b.rank, 'nickname', b.nickname, 'value', b.value)
                             order by b.rank), '[]'::json)
    into v_top
    from (
        select row_number() over (order by s.value desc, s.updated_at, s.user_id)::int as rank, p.nickname, s.value
        from public.player_stats s
        join public.profiles p on p.id = s.user_id
        where s.stat = p_stat and s.period = p_period and s.period_start = v_start and s.value > 0
        order by s.value desc, s.updated_at, s.user_id
        limit 10
    ) b;

    if v_me is not null then
        select * into v_mine
        from public.player_stats s
        where s.user_id = v_me and s.stat = p_stat and s.period = p_period and s.period_start = v_start
          and s.value > 0;
        if found then
            -- Rank = 1 + everyone ahead of me in the same order as the top list.
            select json_build_object('rank', 1 + count(*)::int, 'value', v_mine.value)
            into v_me_json
            from public.player_stats s
            join public.profiles p on p.id = s.user_id
            where s.stat = p_stat and s.period = p_period and s.period_start = v_start and s.value > 0
              and (s.value > v_mine.value
                   or (s.value = v_mine.value and (s.updated_at, s.user_id) < (v_mine.updated_at, v_mine.user_id)));
        end if;
    end if;

    return json_build_object('top', v_top, 'me', v_me_json);
end;
$$;

revoke all on function public.leaderboard(text, text) from public;
grant execute on function public.leaderboard(text, text) to anon, authenticated;
