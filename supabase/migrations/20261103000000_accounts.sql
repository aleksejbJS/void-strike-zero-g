-- Void Strike: Zero-G — nickname + password accounts.
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once. Setup steps: docs/supabase-setup.md

-- ---------------------------------------------------------------------------
-- profiles: one public row per account (the display nickname + its lookup key)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    nickname text not null,
    nickname_key text not null unique,
    created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Everyone may read profiles: the "is this name taken" check needs it.
drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
    on public.profiles for select
    using (true);

-- No insert/update/delete policy on purpose: the browser can never write a profile.
-- Rows are created only by the trigger below. The revoke is a second lock behind RLS.
revoke insert, update, delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sign-up trigger: an auth user can never exist without its profile row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_nickname text := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));
    v_nickname_key text := btrim(coalesce(new.raw_user_meta_data ->> 'nickname_key', ''));
begin
    -- Fail loudly: a missing nickname aborts the whole sign-up instead of leaving a profile-less user.
    if v_nickname = '' or v_nickname_key = '' then
        raise exception 'Sign-up needs "nickname" and "nickname_key" in the user metadata';
    end if;

    insert into public.profiles (id, nickname, nickname_key)
    values (new.id, v_nickname, v_nickname_key);

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- player_progress: the saved snapshot, private to its owner
-- ---------------------------------------------------------------------------
create table if not exists public.player_progress (
    user_id uuid primary key references auth.users (id) on delete cascade,
    data jsonb not null,
    updated_at timestamptz default now()
);

alter table public.player_progress enable row level security;

drop policy if exists "owner reads and writes own progress" on public.player_progress;
create policy "owner reads and writes own progress"
    on public.player_progress for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- nickname_taken: the guest-side check, also used by the keep-alive workflow
-- ---------------------------------------------------------------------------
create or replace function public.nickname_taken(nick_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles p where p.nickname_key = nickname_taken.nick_key
    );
$$;

revoke all on function public.nickname_taken(text) from public;
grant execute on function public.nickname_taken(text) to anon, authenticated;
