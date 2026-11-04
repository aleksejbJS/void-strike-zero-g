-- Void Strike: Zero-G — tournament brackets (lobby, seats, matches) and the RPCs that move them.
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once. Setup steps: docs/supabase-setup.md (section "Tournaments").
-- Tests: bash scripts/test-sql.sh (supabase/tests/tournaments.test.sql, on a throwaway local Postgres).
--
-- How it is locked down:
--   * Browsers (roles anon / authenticated) may only READ the three tables, and never a seat's secret_hash.
--   * Every write goes through the security-definer functions below. Guests have no account, so a seat is
--     proven by its secret: 32 random bytes handed out once (hex) and stored only as sha256.
--   * Every write locks the tournament row first, so two browsers acting at the same moment are applied one
--     after the other: the first decision about a match wins, the second is a no-op.
--   * Server time (now()) is the only clock for every time rule.
-- Error messages are codes the client maps: not_open, full, not_creator, not_enough_players, bad_ticket,
-- and for malformed input bad_name, bad_nickname, bad_score, bad_peer_id.

-- digest() and gen_random_bytes(). Hosted Supabase already has pgcrypto in schema "extensions".
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 32),
    status text not null default 'lobby' check (status in ('lobby', 'running', 'finished', 'expired')),
    size int check (size in (4, 8)),                 -- set at start
    creator_seat int not null default 0,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    champion_seat int,
    updated_at timestamptz not null default now() -- bumped on every seat change (see Realtime below)
);
-- For databases where an earlier version of this file already ran.
alter table public.tournaments add column if not exists updated_at timestamptz not null default now();

-- seat: 0..7. The creator is 0, sign-ups take the lowest free number, bots take the numbers left at start.
create table if not exists public.tournament_seats (
    tournament_id uuid not null references public.tournaments (id) on delete cascade,
    seat int not null check (seat between 0 and 7),
    nickname text not null check (char_length(nickname) between 1 and 16),
    is_bot boolean not null default false,
    bracket_pos int check (bracket_pos between 0 and 7), -- shuffled at start
    secret_hash bytea,                                   -- sha256 of the seat secret; null for bots
    joined_at timestamptz not null default now(),
    primary key (tournament_id, seat)
);

-- round 0 is the first round; the winner of (round, slot) plays in (round + 1, slot / 2).
create table if not exists public.tournament_matches (
    id uuid primary key default gen_random_uuid(),
    tournament_id uuid not null references public.tournaments (id) on delete cascade,
    round int not null check (round between 0 and 2),
    slot int not null check (slot between 0 and 3),
    seat_a int,
    seat_b int,
    host_seat int,
    host_peer_id text constraint tournament_matches_host_peer_id_len check (char_length(host_peer_id) <= 128),
    status text not null default 'waiting' check (status in ('waiting', 'ready', 'done')),
    score_a int not null default 0,
    score_b int not null default 0,
    winner_seat int,
    decided_by text check (decided_by in ('played', 'walkover', 'bot')),
    ready_at timestamptz,
    a_seen_at timestamptz,
    b_seen_at timestamptz,
    unique (tournament_id, round, slot)
);
-- For databases where an earlier version of this file already ran (the table existed without the check).
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'tournament_matches_host_peer_id_len' and conrelid = 'public.tournament_matches'::regclass
    ) then
        alter table public.tournament_matches add constraint tournament_matches_host_peer_id_len
            check (char_length(host_peer_id) <= 128);
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Read access: everyone may read, nobody may write directly
-- ---------------------------------------------------------------------------
alter table public.tournaments enable row level security;
alter table public.tournament_seats enable row level security;
alter table public.tournament_matches enable row level security;

drop policy if exists "tournaments are readable by everyone" on public.tournaments;
create policy "tournaments are readable by everyone" on public.tournaments for select using (true);
drop policy if exists "tournament seats are readable by everyone" on public.tournament_seats;
create policy "tournament seats are readable by everyone" on public.tournament_seats for select using (true);
drop policy if exists "tournament matches are readable by everyone" on public.tournament_matches;
create policy "tournament matches are readable by everyone" on public.tournament_matches for select using (true);

-- Supabase grants ALL on new tables to anon/authenticated by default. Take it all back, then give
-- back reads only. No insert/update/delete policy exists either: RLS is the second lock.
revoke all on table public.tournaments, public.tournament_seats, public.tournament_matches
    from public, anon, authenticated;
grant select on table public.tournaments, public.tournament_matches to anon, authenticated;
-- Column grants: every seat column except secret_hash. A table-level select would expose it.
grant select (tournament_id, seat, nickname, is_bot, bracket_pos, joined_at)
    on table public.tournament_seats to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: the browsers watch tournaments and tournament_matches. Skipped when the publication does
-- not exist (local test cluster) and for tables already in it, so a re-run never fails.
-- tournament_seats is deliberately NOT published: a change payload could carry secret_hash if Realtime
-- ignored the column grant. Seat changes bump tournaments.updated_at instead, and the browser reloads
-- the seats through the normal (column-granted) select. An earlier version of this file published the
-- seats, so they are removed here when present.
-- ---------------------------------------------------------------------------
do $$
declare
    v_table text;
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
        raise notice 'Publication supabase_realtime not found (or covers all tables): skipping Realtime setup';
        return;
    end if;
    foreach v_table in array array['tournaments', 'tournament_matches'] loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
        ) then
            execute format('alter publication supabase_realtime add table public.%I', v_table);
        end if;
    end loop;
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_seats'
    ) then
        alter publication supabase_realtime drop table public.tournament_seats;
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers (never callable from the browser)
-- ---------------------------------------------------------------------------

-- Raises 'bad_ticket' unless p_secret is the secret of human seat p_seat in tournament p_id.
create or replace function public.tournament_check_ticket(p_id uuid, p_seat int, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
    if p_secret is null or p_secret !~ '^[0-9a-fA-F]{64}$' then
        raise exception 'bad_ticket';
    end if;
    if not exists (
        select 1 from tournament_seats s
        where s.tournament_id = p_id and s.seat = p_seat and not s.is_bot
          and s.secret_hash = digest(decode(lower(p_secret), 'hex'), 'sha256')
    ) then
        raise exception 'bad_ticket';
    end if;
end;
$$;

-- Moves the bracket forward until nothing changes. Called by the RPCs inside their transaction.
create or replace function public.settle(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_changed int;
    v_rows int;
begin
    loop
        v_changed := 0;

        -- 1. Winners move on: an even slot feeds seat a of the next match, an odd slot seat b.
        update tournament_matches n set seat_a = d.winner_seat
        from tournament_matches d
        where d.tournament_id = p_id and d.status = 'done' and d.slot % 2 = 0
          and n.tournament_id = p_id and n.round = d.round + 1 and n.slot = d.slot / 2 and n.seat_a is null;
        get diagnostics v_rows = row_count;
        v_changed := v_changed + v_rows;

        update tournament_matches n set seat_b = d.winner_seat
        from tournament_matches d
        where d.tournament_id = p_id and d.status = 'done' and d.slot % 2 = 1
          and n.tournament_id = p_id and n.round = d.round + 1 and n.slot = d.slot / 2 and n.seat_b is null;
        get diagnostics v_rows = row_count;
        v_changed := v_changed + v_rows;

        -- 2. Both opponents known: the match is ready. The lower human seat hosts (null for bot vs bot).
        update tournament_matches m set
            status = 'ready',
            ready_at = now(),
            host_seat = (
                select min(s.seat) from tournament_seats s
                where s.tournament_id = p_id and s.seat in (m.seat_a, m.seat_b) and not s.is_bot
            )
        where m.tournament_id = p_id and m.status = 'waiting' and m.seat_a is not null and m.seat_b is not null;
        get diagnostics v_rows = row_count;
        v_changed := v_changed + v_rows;

        -- 3. Bot vs bot is not played: a coin flip decides it.
        update tournament_matches m set
            status = 'done',
            decided_by = 'bot',
            winner_seat = case when random() < 0.5 then m.seat_a else m.seat_b end
        where m.tournament_id = p_id and m.status = 'ready'
          and exists (select 1 from tournament_seats s
                      where s.tournament_id = p_id and s.seat = m.seat_a and s.is_bot)
          and exists (select 1 from tournament_seats s
                      where s.tournament_id = p_id and s.seat = m.seat_b and s.is_bot);
        get diagnostics v_rows = row_count;
        v_changed := v_changed + v_rows;

        -- 4. The final (the only match of the last round) is done: the tournament is finished.
        update tournaments t set status = 'finished', finished_at = now(), champion_seat = f.winner_seat
        from tournament_matches f
        where t.id = p_id and t.status = 'running'
          and f.tournament_id = p_id and f.status = 'done'
          and f.round = (select max(x.round) from tournament_matches x where x.tournament_id = p_id);
        get diagnostics v_rows = row_count;
        v_changed := v_changed + v_rows;

        exit when v_changed = 0;
    end loop;
end;
$$;

-- Supabase also grants EXECUTE on new functions to the browser roles by default: take it back.
revoke all on function public.tournament_check_ticket(uuid, int, text) from public, anon, authenticated;
revoke all on function public.settle(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lobby RPCs
-- ---------------------------------------------------------------------------

-- Creates a lobby; the creator gets seat 0. Also clears out tournaments older than 24 h.
create or replace function public.create_tournament(p_name text, p_nickname text)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_name text := btrim(coalesce(p_name, ''));
    v_nickname text := btrim(coalesce(p_nickname, ''));
    v_secret bytea := gen_random_bytes(32);
    v_id uuid;
begin
    if char_length(v_name) not between 1 and 32 then
        raise exception 'bad_name';
    end if;
    if char_length(v_nickname) not between 1 and 16 then
        raise exception 'bad_nickname';
    end if;

    -- Housekeeping: seats and matches go with them (on delete cascade).
    delete from tournaments where created_at < now() - interval '24 hours';

    insert into tournaments (name) values (v_name) returning id into v_id;
    insert into tournament_seats (tournament_id, seat, nickname, secret_hash)
    values (v_id, 0, v_nickname, digest(v_secret, 'sha256'));

    return json_build_object('id', v_id, 'seat', 0, 'secret', encode(v_secret, 'hex'));
end;
$$;

-- Takes the lowest free seat of an open lobby (open = status lobby and under 30 min old).
create or replace function public.join_tournament(p_id uuid, p_nickname text)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_nickname text := btrim(coalesce(p_nickname, ''));
    v_secret bytea := gen_random_bytes(32);
    v_seat int;
begin
    if char_length(v_nickname) not between 1 and 16 then
        raise exception 'bad_nickname';
    end if;

    -- Lock: two sign-ups at once must not take the same seat or a 9th seat.
    perform 1 from tournaments t
    where t.id = p_id and t.status = 'lobby' and t.created_at >= now() - interval '30 minutes'
    for update;
    if not found then
        raise exception 'not_open';
    end if;

    select min(g) into v_seat
    from generate_series(0, 7) g
    where not exists (select 1 from tournament_seats s where s.tournament_id = p_id and s.seat = g);
    if v_seat is null then
        raise exception 'full';
    end if;

    insert into tournament_seats (tournament_id, seat, nickname, secret_hash)
    values (p_id, v_seat, v_nickname, digest(v_secret, 'sha256'));
    -- Seats are not in Realtime: this row change is what tells the lobby someone joined.
    update tournaments t set updated_at = now() where t.id = p_id;

    return json_build_object('seat', v_seat, 'secret', encode(v_secret, 'hex'));
end;
$$;

-- Leaves a lobby. The creator role passes to the earliest remaining sign-up; the last one out expires it.
create or replace function public.leave_tournament(p_id uuid, p_seat int, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_status text;
    v_next int;
begin
    select t.status into v_status from tournaments t where t.id = p_id for update;
    perform tournament_check_ticket(p_id, p_seat, p_secret);
    if v_status <> 'lobby' then
        raise exception 'not_open';
    end if;

    delete from tournament_seats s where s.tournament_id = p_id and s.seat = p_seat;

    select s.seat into v_next from tournament_seats s
    where s.tournament_id = p_id
    order by s.joined_at, s.seat
    limit 1;

    -- Seats are not in Realtime: bumping updated_at is what tells the lobby someone left.
    update tournaments t set
        updated_at = now(),
        creator_seat = case when t.creator_seat = p_seat and v_next is not null then v_next else t.creator_seat end,
        status = case when v_next is null then 'expired' else t.status end
    where t.id = p_id;
end;
$$;

-- The creator starts: fill with bots, shuffle the bracket, create every match, settle bot vs bot.
create or replace function public.start_tournament(p_id uuid, p_seat int, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    t tournaments;
    v_humans int;
    v_size int;
begin
    select * into t from tournaments where id = p_id for update;
    perform tournament_check_ticket(p_id, p_seat, p_secret);
    if t.status <> 'lobby' or t.created_at < now() - interval '30 minutes' then
        raise exception 'not_open';
    end if;
    if t.creator_seat <> p_seat then
        raise exception 'not_creator';
    end if;

    select count(*) into v_humans from tournament_seats s where s.tournament_id = p_id;
    if v_humans < 2 then
        raise exception 'not_enough_players';
    end if;
    v_size := case when v_humans <= 4 then 4 else 8 end;

    -- Bots take the free seat numbers, lowest first: Bot-1, Bot-2, ...
    insert into tournament_seats (tournament_id, seat, nickname, is_bot)
    select p_id, g, 'Bot-' || row_number() over (order by g), true
    from generate_series(0, 7) g
    where not exists (select 1 from tournament_seats s where s.tournament_id = p_id and s.seat = g)
    order by g
    limit v_size - v_humans;

    -- Random draw: bracket positions 0..size-1.
    update tournament_seats s set bracket_pos = r.pos
    from (
        select x.seat, (row_number() over (order by random()) - 1)::int as pos
        from tournament_seats x where x.tournament_id = p_id
    ) r
    where s.tournament_id = p_id and s.seat = r.seat;

    -- Every match of every round: size/2 in round 0, then half as many each round down to the final.
    for v_round in 0 .. (case when v_size = 4 then 1 else 2 end) loop
        insert into tournament_matches (tournament_id, round, slot)
        select p_id, v_round, g from generate_series(0, v_size / (2 << v_round) - 1) g;
    end loop;

    -- Round 0: bracket positions 2*slot and 2*slot+1 meet.
    update tournament_matches m set
        seat_a = (select s.seat from tournament_seats s where s.tournament_id = p_id and s.bracket_pos = 2 * m.slot),
        seat_b = (select s.seat from tournament_seats s where s.tournament_id = p_id and s.bracket_pos = 2 * m.slot + 1)
    where m.tournament_id = p_id and m.round = 0;

    update tournaments set status = 'running', size = v_size, started_at = now(), updated_at = now() where id = p_id;

    perform settle(p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Match RPCs
-- ---------------------------------------------------------------------------

-- Locks the match's tournament, then returns the match. Raises 'bad_ticket' unless p_seat (with its
-- secret) is one of the match's two seats. Shared by the three heartbeat/host/report RPCs.
create or replace function public.tournament_lock_match(p_match uuid, p_seat int, p_secret text)
returns public.tournament_matches
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_tournament uuid;
    m tournament_matches;
begin
    select x.tournament_id into v_tournament from tournament_matches x where x.id = p_match;
    if v_tournament is null then
        raise exception 'bad_ticket';
    end if;
    perform 1 from tournaments t where t.id = v_tournament for update;
    select * into m from tournament_matches x where x.id = p_match;
    perform tournament_check_ticket(v_tournament, p_seat, p_secret);
    if p_seat is distinct from m.seat_a and p_seat is distinct from m.seat_b then
        raise exception 'bad_ticket';
    end if;
    return m;
end;
$$;

revoke all on function public.tournament_lock_match(uuid, int, text) from public, anon, authenticated;

-- Heartbeat from a fighter of the match: "I am still here" (feeds resolve_stale).
create or replace function public.match_seen(p_match uuid, p_seat int, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    m tournament_matches := tournament_lock_match(p_match, p_seat, p_secret);
begin
    update tournament_matches x set
        a_seen_at = case when p_seat = m.seat_a then now() else x.a_seen_at end,
        b_seen_at = case when p_seat = m.seat_b then now() else x.b_seen_at end
    where x.id = p_match;
end;
$$;

-- The host's browser publishes its PeerJS id so the guest (and spectators) can connect.
create or replace function public.publish_host(p_match uuid, p_seat int, p_secret text, p_peer_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    m tournament_matches := tournament_lock_match(p_match, p_seat, p_secret);
begin
    if m.host_seat is distinct from p_seat then
        raise exception 'bad_ticket';
    end if;
    if p_peer_id is null or char_length(p_peer_id) not between 1 and 128 then
        raise exception 'bad_peer_id';
    end if;
    update tournament_matches x set host_peer_id = p_peer_id where x.id = p_match and x.status = 'ready';
end;
$$;

-- The host reports the final score. First decision wins: on a match that is no longer ready
-- (already reported, or decided by walkover) this is a no-op.
create or replace function public.report_result(
    p_match uuid, p_seat int, p_secret text, p_score_a int, p_score_b int
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    m tournament_matches := tournament_lock_match(p_match, p_seat, p_secret);
begin
    if m.host_seat is distinct from p_seat then
        raise exception 'bad_ticket';
    end if;
    if m.status <> 'ready' then
        return;
    end if;
    -- A duel always has a winner (sudden death on a tie), so equal scores mean a broken client.
    -- The score limit is 10, so nobody can have more.
    if p_score_a is null or p_score_b is null or least(p_score_a, p_score_b) < 0
        or greatest(p_score_a, p_score_b) > 10 or p_score_a = p_score_b then
        raise exception 'bad_score';
    end if;

    update tournament_matches x set
        status = 'done',
        decided_by = 'played',
        score_a = p_score_a,
        score_b = p_score_b,
        winner_seat = case when p_score_a > p_score_b then m.seat_a else m.seat_b end
    where x.id = p_match;

    perform settle(m.tournament_id);
end;
$$;

-- Anyone may call this (every browser watching the bracket does, now and then). A ready match older
-- than 60 s is decided by walkover when a human side has not sent a heartbeat for 60 s:
-- one side stale -> the other side wins; both stale -> coin flip. Bots are never stale.
-- Any ready match older than 15 min is closed too (coin flip when neither side is stale): a stalling host
-- or a link that never forms must not freeze the bracket. A real duel ends within 10 min plus sudden death.
create or replace function public.resolve_stale(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
    perform 1 from tournaments t where t.id = p_id and t.status = 'running' for update;
    if not found then
        return;
    end if;

    with sides as (
        select
            m.id, m.seat_a, m.seat_b,
            not sa.is_bot and (m.a_seen_at is null or m.a_seen_at < now() - interval '60 seconds') as a_stale,
            not sb.is_bot and (m.b_seen_at is null or m.b_seen_at < now() - interval '60 seconds') as b_stale,
            m.ready_at < now() - interval '15 minutes' as timed_out
        from tournament_matches m
        join tournament_seats sa on sa.tournament_id = m.tournament_id and sa.seat = m.seat_a
        join tournament_seats sb on sb.tournament_id = m.tournament_id and sb.seat = m.seat_b
        where m.tournament_id = p_id and m.status = 'ready' and m.ready_at < now() - interval '60 seconds'
    )
    update tournament_matches x set
        status = 'done',
        decided_by = 'walkover',
        winner_seat = case
            when s.a_stale = s.b_stale then (case when random() < 0.5 then s.seat_a else s.seat_b end)
            when s.a_stale then s.seat_b
            else s.seat_a
        end
    from sides s
    where x.id = s.id and (s.a_stale or s.b_stale or s.timed_out);

    perform settle(p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: the RPCs are the browser's only way to write
-- ---------------------------------------------------------------------------
revoke all on function public.create_tournament(text, text) from public;
revoke all on function public.join_tournament(uuid, text) from public;
revoke all on function public.leave_tournament(uuid, int, text) from public;
revoke all on function public.start_tournament(uuid, int, text) from public;
revoke all on function public.match_seen(uuid, int, text) from public;
revoke all on function public.publish_host(uuid, int, text, text) from public;
revoke all on function public.report_result(uuid, int, text, int, int) from public;
revoke all on function public.resolve_stale(uuid) from public;

grant execute on function public.create_tournament(text, text) to anon, authenticated;
grant execute on function public.join_tournament(uuid, text) to anon, authenticated;
grant execute on function public.leave_tournament(uuid, int, text) to anon, authenticated;
grant execute on function public.start_tournament(uuid, int, text) to anon, authenticated;
grant execute on function public.match_seen(uuid, int, text) to anon, authenticated;
grant execute on function public.publish_host(uuid, int, text, text) to anon, authenticated;
grant execute on function public.report_result(uuid, int, text, int, int) to anon, authenticated;
grant execute on function public.resolve_stale(uuid) to anon, authenticated;
