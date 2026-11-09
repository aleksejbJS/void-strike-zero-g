-- Void Strike: Zero-G — a stand-in for the parts of Supabase's "auth" schema the migrations use.
-- Loaded by scripts/test-sql.sh into a throwaway local database BEFORE 20261103000000_accounts.sql.
-- NEVER run this against the real project: hosted Supabase already has its own auth schema.
--
-- What the migrations touch: auth.users (id, email, raw_user_meta_data; the sign-up and e-mail triggers)
-- and auth.uid() (row-level security and the leaderboard RPC's "me").

create schema if not exists auth;

create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb,
    created_at timestamptz not null default now()
);

-- Same contract as Supabase's auth.uid(): the "sub" claim of the request's JWT, or null without a login.
-- Tests act as a player with: select set_config('request.jwt.claim.sub', '<uuid>', true);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
