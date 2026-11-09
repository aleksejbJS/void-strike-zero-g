-- Void Strike: Zero-G — shared helpers for the leaderboards SQL tests (leaderboards-*.test.sql).
-- Loaded by scripts/test-sql.sh after the migration. NEVER run against the real project: it creates schema lb.
--
-- Saves go through public.player_progress, exactly as the browser saves, so the trigger does the work.
-- Within one DO block now() does not move, so tie-breaks by updated_at are set by hand (we run as superuser).

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
