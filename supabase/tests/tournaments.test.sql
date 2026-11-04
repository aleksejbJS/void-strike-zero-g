-- Void Strike: Zero-G — SQL tests for supabase/migrations/20261104000000_tournaments.sql
-- Run with: bash scripts/test-sql.sh (a throwaway local cluster). NEVER run this against the real project:
-- it creates a helper schema and test tournaments.
--
-- Each case is one DO block of asserts and starts from a fresh create_tournament.
-- Time rules are tested by moving created_at / ready_at / *_seen_at into the past (we run as superuser).
-- Random choices (shuffle, walkover with both sides stale, bot vs bot) are checked by invariants only.

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Helpers (schema tt): remember every seat's secret so the cases can act as any seat
-- ---------------------------------------------------------------------------
create schema tt;
create table tt.tickets (tid uuid, seat int, secret text, primary key (tid, seat));

create function tt.create(p_name text default 'Cup', p_nick text default 'Host') returns uuid
language plpgsql as $$
declare v json;
begin
    v := public.create_tournament(p_name, p_nick);
    insert into tt.tickets values ((v ->> 'id')::uuid, (v ->> 'seat')::int, v ->> 'secret');
    return (v ->> 'id')::uuid;
end $$;

create function tt.join(p_tid uuid, p_nick text) returns int
language plpgsql as $$
declare v json;
begin
    v := public.join_tournament(p_tid, p_nick);
    insert into tt.tickets values (p_tid, (v ->> 'seat')::int, v ->> 'secret');
    return (v ->> 'seat')::int;
end $$;

create function tt.sec(p_tid uuid, p_seat int) returns text
language sql as $$ select secret from tt.tickets where tid = p_tid and seat = p_seat $$;

create function tt.start(p_tid uuid) returns void
language plpgsql as $$
declare v_creator int := (select creator_seat from public.tournaments where id = p_tid);
begin
    perform public.start_tournament(p_tid, v_creator, tt.sec(p_tid, v_creator));
end $$;

-- A started tournament with p_humans human seats (creator + joins).
create function tt.running(p_humans int) returns uuid
language plpgsql as $$
declare v_tid uuid := tt.create();
begin
    for i in 2 .. p_humans loop
        perform tt.join(v_tid, 'P' || i);
    end loop;
    perform tt.start(v_tid);
    return v_tid;
end $$;

create function tt.m(p_tid uuid, p_round int, p_slot int) returns public.tournament_matches
language sql as $$
    select * from public.tournament_matches where tournament_id = p_tid and round = p_round and slot = p_slot
$$;

create function tt.is_bot(p_tid uuid, p_seat int) returns boolean
language sql as $$ select is_bot from public.tournament_seats where tournament_id = p_tid and seat = p_seat $$;

-- Runs p_sql and asserts it raises exactly the message p_code.
create function tt.expect_error(p_sql text, p_code text) returns void
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

-- The host reports a result for the match.
create function tt.report(p_match uuid, p_a int, p_b int) returns void
language plpgsql as $$
declare m public.tournament_matches;
begin
    select * into m from public.tournament_matches where id = p_match;
    perform public.report_result(p_match, m.host_seat, tt.sec(m.tournament_id, m.host_seat), p_a, p_b);
end $$;

-- ---------------------------------------------------------------------------
-- Case: create returns seat 0 and a hex secret that is stored only as its sha256
-- ---------------------------------------------------------------------------
do $$
declare v json := public.create_tournament('  Friday Cup  ', ' Neo ');
declare t public.tournaments;
declare s public.tournament_seats;
begin
    select * into t from public.tournaments where id = (v ->> 'id')::uuid;
    select * into s from public.tournament_seats where tournament_id = t.id;
    assert (v ->> 'seat')::int = 0, 'creator gets seat 0';
    assert (v ->> 'secret') ~ '^[0-9a-f]{64}$', 'secret is 32 bytes hex';
    assert t.name = 'Friday Cup' and s.nickname = 'Neo', 'name and nickname are trimmed';
    assert t.status = 'lobby' and t.creator_seat = 0 and t.size is null, 'fresh lobby';
    assert s.secret_hash = extensions.digest(decode(v ->> 'secret', 'hex'), 'sha256'), 'secret stored as sha256';
    assert not s.is_bot and s.bracket_pos is null, 'creator seat is human, no bracket yet';
    perform tt.expect_error($q$select public.create_tournament('', 'Neo')$q$, 'bad_name');
    perform tt.expect_error($q$select public.create_tournament(repeat('x', 33), 'Neo')$q$, 'bad_name');
    perform tt.expect_error($q$select public.create_tournament('Cup', repeat('x', 17))$q$, 'bad_nickname');
end $$;

-- ---------------------------------------------------------------------------
-- Case: create deletes tournaments older than 24 h (seats and matches go with them)
-- ---------------------------------------------------------------------------
do $$
declare v_old uuid := tt.running(2);
begin
    update public.tournaments set created_at = now() - interval '25 hours' where id = v_old;
    perform tt.create();
    assert not exists (select 1 from public.tournaments where id = v_old), 'old tournament deleted';
    assert not exists (select 1 from public.tournament_seats where tournament_id = v_old), 'its seats deleted';
    assert not exists (select 1 from public.tournament_matches where tournament_id = v_old), 'its matches deleted';
end $$;

-- ---------------------------------------------------------------------------
-- Case: 2 humans -> size 4, 4 seats (2 bots), 3 matches; round 0 ready; bot vs bot decided at once
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid;
declare t public.tournaments;
declare m public.tournament_matches;
declare v_next public.tournament_matches;
declare v_bot_match_seen boolean := false;
begin
    -- The shuffle is random; bot vs bot happens in 1 of 3 draws. 60 draws miss it with p ~ 3e-11.
    for attempt in 1 .. 60 loop
        v_tid := tt.running(2);
        select * into t from public.tournaments where id = v_tid;
        assert t.status = 'running' and t.size = 4 and t.started_at is not null, 'running, size 4';
        assert (select count(*) from public.tournament_seats where tournament_id = v_tid) = 4, '4 seats';
        assert (select array_agg(nickname order by seat) from public.tournament_seats
                where tournament_id = v_tid and is_bot) = array['Bot-1', 'Bot-2'], 'bots Bot-1, Bot-2';
        assert (select array_agg(seat order by seat) from public.tournament_seats
                where tournament_id = v_tid and is_bot) = array[2, 3], 'bots take the seats after the humans';
        assert (select array_agg(bracket_pos order by bracket_pos) from public.tournament_seats
                where tournament_id = v_tid) = array[0, 1, 2, 3], 'bracket_pos is a permutation';
        assert (select count(*) from public.tournament_matches where tournament_id = v_tid) = 3, '3 matches';
        assert (select count(*) from public.tournament_matches where tournament_id = v_tid and round = 0) = 2,
            '2 first-round matches';
        for m in select * from public.tournament_matches where tournament_id = v_tid and round = 0 loop
            assert m.seat_a = (select seat from public.tournament_seats
                               where tournament_id = v_tid and bracket_pos = 2 * m.slot), 'seat a from bracket_pos';
            assert m.seat_b = (select seat from public.tournament_seats
                               where tournament_id = v_tid and bracket_pos = 2 * m.slot + 1), 'seat b from bracket_pos';
            if tt.is_bot(v_tid, m.seat_a) and tt.is_bot(v_tid, m.seat_b) then
                v_bot_match_seen := true;
                assert m.status = 'done' and m.decided_by = 'bot', 'bot vs bot is decided at once';
                assert m.winner_seat in (m.seat_a, m.seat_b), 'bot winner is one of the two';
                assert m.host_seat is null, 'nobody hosts bot vs bot';
                v_next := tt.m(v_tid, 1, 0);
                assert (case when m.slot % 2 = 0 then v_next.seat_a else v_next.seat_b end) = m.winner_seat,
                    'bot winner already in round 1';
            else
                assert m.status = 'ready' and m.ready_at is not null, 'a match with a human is ready';
                assert m.host_seat = (select min(seat) from public.tournament_seats where tournament_id = v_tid
                                      and seat in (m.seat_a, m.seat_b) and not is_bot), 'host = lower human seat';
                assert m.winner_seat is null and m.decided_by is null, 'not decided yet';
            end if;
        end loop;
        assert (tt.m(v_tid, 1, 0)).status = 'waiting', 'final waits for the humans';
        exit when v_bot_match_seen;
    end loop;
    assert v_bot_match_seen, 'never drew a bot vs bot match';
end $$;

-- 3 humans -> still size 4, with a single bot.
do $$
declare v_tid uuid := tt.running(3);
begin
    assert (select size from public.tournaments where id = v_tid) = 4, 'size 4';
    assert (select count(*) from public.tournament_seats where tournament_id = v_tid and is_bot) = 1, '1 bot';
    assert (select seat from public.tournament_seats where tournament_id = v_tid and is_bot) = 3, 'bot is seat 3';
end $$;

-- ---------------------------------------------------------------------------
-- Case: start errors
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid := tt.create();
begin
    perform tt.expect_error(format('select public.start_tournament(%L, 0, %L)', v_tid, tt.sec(v_tid, 0)),
        'not_enough_players');
    perform tt.join(v_tid, 'Guest');
    perform tt.expect_error(format('select public.start_tournament(%L, 0, %L)', v_tid, repeat('0', 64)), 'bad_ticket');
    perform tt.expect_error(format('select public.start_tournament(%L, 0, %L)', v_tid, 'not-hex'), 'bad_ticket');
    perform tt.expect_error(format('select public.start_tournament(%L, 0, %L)', v_tid, tt.sec(v_tid, 1)), 'bad_ticket');
    perform tt.expect_error(format('select public.start_tournament(%L, 1, %L)', v_tid, tt.sec(v_tid, 1)), 'not_creator');
    perform tt.start(v_tid);
    perform tt.expect_error(format('select public.start_tournament(%L, 0, %L)', v_tid, tt.sec(v_tid, 0)), 'not_open');
end $$;

-- ---------------------------------------------------------------------------
-- Case: join errors
-- ---------------------------------------------------------------------------
do $$
declare v_started uuid := tt.running(2);
declare v_stale uuid := tt.create();
declare v_full uuid := tt.create();
begin
    perform tt.expect_error(format('select public.join_tournament(%L, %L)', v_started, 'Late'), 'not_open');
    perform tt.expect_error(format('select public.join_tournament(%L, %L)', gen_random_uuid(), 'Lost'), 'not_open');

    update public.tournaments set created_at = now() - interval '31 minutes' where id = v_stale;
    perform tt.expect_error(format('select public.join_tournament(%L, %L)', v_stale, 'Late'), 'not_open');

    for i in 2 .. 8 loop
        assert tt.join(v_full, 'P' || i) = i - 1, 'seats are given in sign-up order';
    end loop;
    perform tt.expect_error(format('select public.join_tournament(%L, %L)', v_full, 'Ninth'), 'full');
    perform tt.expect_error(format('select public.join_tournament(%L, %L)', v_full, ''), 'bad_nickname');
end $$;

-- ---------------------------------------------------------------------------
-- Case: 5 humans -> size 8, 3 bots, 7 matches
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid := tt.running(5);
begin
    assert (select size from public.tournaments where id = v_tid) = 8, 'size 8';
    assert (select count(*) from public.tournament_seats where tournament_id = v_tid) = 8, '8 seats';
    assert (select array_agg(seat order by seat) from public.tournament_seats
            where tournament_id = v_tid and is_bot) = array[5, 6, 7], '3 bots after the humans';
    assert (select array_agg(bracket_pos order by bracket_pos) from public.tournament_seats
            where tournament_id = v_tid) = array[0, 1, 2, 3, 4, 5, 6, 7], 'bracket_pos is a permutation';
    assert (select count(*) from public.tournament_matches where tournament_id = v_tid) = 7, '7 matches';
    assert (select array_agg(n order by round) from (
                select round, count(*) as n from public.tournament_matches
                where tournament_id = v_tid group by round) r) = array[4, 2, 1]::bigint[], 'rounds of 4, 2, 1';
end $$;

-- ---------------------------------------------------------------------------
-- Case: leaving the lobby
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid := tt.create();
begin
    perform tt.join(v_tid, 'Second');
    perform tt.join(v_tid, 'Third');
    -- Seat 2 joined earlier than seat 1: the creator role must follow joined_at, not the seat number.
    update public.tournament_seats set joined_at = now() - interval '5 minutes' where tournament_id = v_tid and seat = 0;
    update public.tournament_seats set joined_at = now() - interval '3 minutes' where tournament_id = v_tid and seat = 1;
    update public.tournament_seats set joined_at = now() - interval '4 minutes' where tournament_id = v_tid and seat = 2;

    perform tt.expect_error(format('select public.leave_tournament(%L, 1, %L)', v_tid, tt.sec(v_tid, 0)), 'bad_ticket');
    perform public.leave_tournament(v_tid, 0, tt.sec(v_tid, 0));
    assert (select creator_seat from public.tournaments where id = v_tid) = 2, 'creator moves to earliest joined_at';
    assert not exists (select 1 from public.tournament_seats where tournament_id = v_tid and seat = 0), 'seat deleted';

    perform public.leave_tournament(v_tid, 1, tt.sec(v_tid, 1));
    assert (select status from public.tournaments where id = v_tid) = 'lobby', 'one seat left: still a lobby';
    perform public.leave_tournament(v_tid, 2, tt.sec(v_tid, 2));
    assert (select status from public.tournaments where id = v_tid) = 'expired', 'last one out: expired';
end $$;

-- A freed seat number is given to the next sign-up, and leaving after the start is refused.
do $$
declare v_tid uuid := tt.create();
begin
    perform tt.join(v_tid, 'Second');
    perform public.leave_tournament(v_tid, 1, tt.sec(v_tid, 1));
    delete from tt.tickets where tid = v_tid and seat = 1;
    assert tt.join(v_tid, 'Again') = 1, 'freed seat number is reused';
    perform tt.start(v_tid);
    perform tt.expect_error(format('select public.leave_tournament(%L, 1, %L)', v_tid, tt.sec(v_tid, 1)), 'not_open');
end $$;

-- ---------------------------------------------------------------------------
-- Case: heartbeat and host peer id
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid := tt.running(4);
declare m public.tournament_matches := tt.m(v_tid, 0, 0);
declare v_guest int := case when m.host_seat = m.seat_a then m.seat_b else m.seat_a end;
declare v_other int := (tt.m(v_tid, 0, 1)).seat_a;
begin
    perform public.match_seen(m.id, m.seat_a, tt.sec(v_tid, m.seat_a));
    assert (tt.m(v_tid, 0, 0)).a_seen_at = now() and (tt.m(v_tid, 0, 0)).b_seen_at is null, 'seat a seen';
    perform public.match_seen(m.id, m.seat_b, tt.sec(v_tid, m.seat_b));
    assert (tt.m(v_tid, 0, 0)).b_seen_at = now(), 'seat b seen';
    perform tt.expect_error(format('select public.match_seen(%L, %s, %L)', m.id, v_other, tt.sec(v_tid, v_other)),
        'bad_ticket');
    perform tt.expect_error(format('select public.match_seen(%L, %s, %L)', m.id, m.seat_a, repeat('a', 64)),
        'bad_ticket');

    perform tt.expect_error(format('select public.publish_host(%L, %s, %L, %L)', m.id, v_guest,
        tt.sec(v_tid, v_guest), 'peer-guest'), 'bad_ticket');
    perform public.publish_host(m.id, m.host_seat, tt.sec(v_tid, m.host_seat), 'peer-host');
    assert (tt.m(v_tid, 0, 0)).host_peer_id = 'peer-host', 'host peer id published';
end $$;

-- ---------------------------------------------------------------------------
-- Case: report_result — only the host, first decision wins, winner advances
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid := tt.running(4);
declare m public.tournament_matches := tt.m(v_tid, 0, 1);
declare v_guest int := case when m.host_seat = m.seat_a then m.seat_b else m.seat_a end;
declare v_done public.tournament_matches;
begin
    perform tt.expect_error(format('select public.report_result(%L, %s, %L, 10, 0)', m.id, v_guest,
        tt.sec(v_tid, v_guest)), 'bad_ticket');
    perform tt.expect_error(format('select public.report_result(%L, %s, %L, 10, 0)', m.id, m.host_seat,
        repeat('b', 64)), 'bad_ticket');
    perform tt.expect_error(format('select public.report_result(%L, %s, %L, 5, 5)', m.id, m.host_seat,
        tt.sec(v_tid, m.host_seat)), 'bad_score');
    perform tt.expect_error(format('select public.report_result(%L, %s, %L, -1, 3)', m.id, m.host_seat,
        tt.sec(v_tid, m.host_seat)), 'bad_score');

    perform tt.report(m.id, 4, 10);
    v_done := tt.m(v_tid, 0, 1);
    assert v_done.status = 'done' and v_done.decided_by = 'played', 'played';
    assert v_done.score_a = 4 and v_done.score_b = 10 and v_done.winner_seat = m.seat_b, 'higher score wins';
    assert (tt.m(v_tid, 1, 0)).seat_b = m.seat_b, 'odd slot winner becomes seat b of the next match';
    assert (tt.m(v_tid, 1, 0)).status = 'waiting', 'next match waits for the other semifinal';

    perform tt.report(m.id, 10, 0); -- second report: no-op
    v_done := tt.m(v_tid, 0, 1);
    assert v_done.score_a = 4 and v_done.score_b = 10 and v_done.winner_seat = m.seat_b, 'second report ignored';
end $$;

-- ---------------------------------------------------------------------------
-- Case: resolve_stale
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid := tt.running(4);
declare m0 public.tournament_matches := tt.m(v_tid, 0, 0);
declare m1 public.tournament_matches := tt.m(v_tid, 0, 1);
declare v_guest int := case when m0.host_seat = m0.seat_a then m0.seat_b else m0.seat_a end;
declare v_after public.tournament_matches;
begin
    -- m0: host never seen, guest seen just now, ready 61 s ago -> the guest wins by walkover.
    update public.tournament_matches set ready_at = now() - interval '61 seconds' where id = m0.id;
    -- m1: only 30 s old and nobody seen -> untouched for now.
    update public.tournament_matches set ready_at = now() - interval '30 seconds' where id = m1.id;
    perform public.match_seen(m0.id, v_guest, tt.sec(v_tid, v_guest));
    perform public.resolve_stale(v_tid);

    v_after := tt.m(v_tid, 0, 0);
    assert v_after.status = 'done' and v_after.decided_by = 'walkover' and v_after.winner_seat = v_guest,
        'seen guest wins over a host who never showed up';
    assert (tt.m(v_tid, 1, 0)).seat_a = v_guest, 'walkover winner advances';
    assert (tt.m(v_tid, 0, 1)).status = 'ready', 'a 30 s old match is untouched';

    -- The host comes back too late: its report is ignored.
    perform tt.report(m0.id, 10, 0);
    v_after := tt.m(v_tid, 0, 0);
    assert v_after.decided_by = 'walkover' and v_after.winner_seat = v_guest and v_after.score_a = 0,
        'report after walkover ignored';

    -- m1: both never seen, now 61 s old -> random winner by walkover.
    update public.tournament_matches set ready_at = now() - interval '61 seconds' where id = m1.id;
    perform public.resolve_stale(v_tid);
    v_after := tt.m(v_tid, 0, 1);
    assert v_after.status = 'done' and v_after.decided_by = 'walkover', 'both stale: walkover';
    assert v_after.winner_seat in (m1.seat_a, m1.seat_b), 'both stale: winner is one of the two';
    assert (tt.m(v_tid, 1, 0)).seat_b = v_after.winner_seat and (tt.m(v_tid, 1, 0)).status = 'ready', 'final is ready';
end $$;

-- A side seen more than 60 s ago is stale; one seen recently is not; a bot is never stale.
do $$
declare v_tid uuid := tt.running(3); -- seat 3 is the only bot, so it always meets a human
declare m public.tournament_matches;
declare v_human int;
declare v_other public.tournament_matches;
begin
    select * into m from public.tournament_matches where tournament_id = v_tid and round = 0 and 3 in (seat_a, seat_b);
    v_human := case when m.seat_a = 3 then m.seat_b else m.seat_a end;
    select * into v_other from public.tournament_matches where tournament_id = v_tid and round = 0 and id <> m.id;
    update public.tournament_matches set ready_at = now() - interval '5 minutes',
        a_seen_at = now() - interval '90 seconds', b_seen_at = now() - interval '90 seconds' where id = m.id;
    update public.tournament_matches set ready_at = now() - interval '5 minutes',
        a_seen_at = now() - interval '20 seconds', b_seen_at = now() - interval '20 seconds' where id = v_other.id;
    perform public.resolve_stale(v_tid);
    m := tt.m(v_tid, 0, m.slot);
    assert m.status = 'done' and m.decided_by = 'walkover' and m.winner_seat = 3, 'stale human loses to the bot';
    assert (tt.m(v_tid, 0, v_other.slot)).status = 'ready', 'both seen recently: untouched';
end $$;

-- ---------------------------------------------------------------------------
-- Case: a full bracket of 4 played to the end
-- ---------------------------------------------------------------------------
do $$
declare v_tid uuid := tt.running(4);
declare m public.tournament_matches;
declare t public.tournaments;
begin
    for pass in 1 .. 5 loop
        for m in select * from public.tournament_matches where tournament_id = v_tid and status = 'ready' loop
            perform tt.report(m.id, 10, 7);
        end loop;
    end loop;
    select * into t from public.tournaments where id = v_tid;
    m := tt.m(v_tid, 1, 0);
    assert m.status = 'done' and m.decided_by = 'played', 'final played';
    assert t.status = 'finished' and t.finished_at is not null, 'finished';
    assert t.champion_seat = m.winner_seat and t.champion_seat = m.seat_a, 'champion is the final winner';
    assert not exists (select 1 from public.tournament_matches where tournament_id = v_tid and status <> 'done'),
        'every match done';
    perform public.resolve_stale(v_tid); -- harmless on a finished tournament
    assert (select status from public.tournaments where id = v_tid) = 'finished', 'still finished';
end $$;

-- ---------------------------------------------------------------------------
-- Case: Realtime publication holds the three tables (the test script creates it before the migration)
-- ---------------------------------------------------------------------------
do $$
begin
    assert (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
            and tablename in ('tournaments', 'tournament_seats', 'tournament_matches')) = 3, 'tables in realtime';
end $$;

-- ---------------------------------------------------------------------------
-- Case: what the browser roles may and may not do
-- ---------------------------------------------------------------------------
do $$
begin
    assert not has_function_privilege('anon', 'public.settle(uuid)', 'execute'), 'anon cannot settle';
    assert not has_function_privilege('authenticated', 'public.settle(uuid)', 'execute'), 'authenticated cannot settle';
    assert not has_column_privilege('authenticated', 'public.tournament_seats', 'secret_hash', 'select'),
        'authenticated cannot read secret_hash';
    assert has_function_privilege('anon', 'public.resolve_stale(uuid)', 'execute'), 'anon may resolve_stale';
end $$;

set role anon;
do $$
declare v json;
declare v_failed boolean;
begin
    -- RPCs are open to the browser.
    v := public.create_tournament('Anon Cup', 'Ghost');
    assert (select nickname from public.tournament_seats where tournament_id = (v ->> 'id')::uuid) = 'Ghost',
        'anon reads seat columns';
    assert (select count(*) from public.tournament_matches) >= 0, 'anon reads matches';

    v_failed := false;
    begin
        perform secret_hash from public.tournament_seats;
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'anon cannot read secret_hash';

    v_failed := false;
    begin
        insert into public.tournaments (name, status) values ('Hack', 'lobby');
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'anon cannot insert tournaments';

    v_failed := false;
    begin
        update public.tournament_matches set winner_seat = 0;
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'anon cannot update matches';

    v_failed := false;
    begin
        delete from public.tournament_seats;
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'anon cannot delete seats';

    v_failed := false;
    begin
        perform public.settle((v ->> 'id')::uuid);
    exception when insufficient_privilege then v_failed := true;
    end;
    assert v_failed, 'anon cannot call settle';
end $$;
reset role;

select 'tournaments.test.sql: all cases passed' as result;
