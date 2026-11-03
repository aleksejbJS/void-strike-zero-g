-- Void Strike: Zero-G — nickname + password accounts.
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once. Setup steps: docs/supabase-setup.md

-- Precondition. The sign-up trigger compares lower(nickname) with the key the browser computed,
-- which needs a database locale that lower-cases Cyrillic. Fail here rather than on a player's sign-up.
do $$
begin
    if lower('Тест') <> 'тест' then
        raise exception 'Database locale (%) cannot lower-case Cyrillic, so nickname checks would reject Cyrillic names. Ask the developer before going on.',
            (select datctype from pg_database where datname = current_database());
    end if;
end
$$;

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
-- Anyone holding the public anon key can call /auth/v1/signup directly, so the browser's checks
-- prove nothing. This trigger repeats the nickname rules and binds the nickname to the unique
-- e-mail, which is what makes "one nickname = one account" hold. Keep it in step with
-- src/account/nickname.ts (see src/account/nicknameEmailContract.test.ts).
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
    -- Fail loudly: a rejected nickname aborts the whole sign-up instead of leaving a profile-less user.
    if v_nickname = '' or v_nickname_key = '' then
        raise exception 'Sign-up needs "nickname" and "nickname_key" in the user metadata';
    end if;

    -- Same form as nicknameToEmail(): the key is hex-encoded UTF-8, so one key is one e-mail is one account.
    if new.email is distinct from
        'n' || encode(convert_to(v_nickname_key, 'UTF8'), 'hex') || '@players.invalid' then
        raise exception 'Sign-up e-mail does not match the nickname key';
    end if;

    if char_length(v_nickname) not between 3 and 12 then
        raise exception 'Nickname must be 3-12 characters';
    end if;

    if lower(v_nickname) <> v_nickname_key then
        raise exception 'Nickname key must be the lower-cased nickname';
    end if;

    if v_nickname_key = 'anonymous' or v_nickname_key ~ '^bot [0-9]+$' then
        raise exception 'This nickname is reserved';
    end if;

    insert into public.profiles (id, nickname, nickname_key)
    values (new.id, v_nickname, v_nickname_key);

    return new;
end;
$$;

-- Only the trigger runs this function; nobody calls it directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Not "drop trigger if exists": on hosted Supabase that needs ownership of auth.users and can fail on a re-run.
-- The function above is replaced in place, and an existing trigger keeps calling it.
do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass
    ) then
        create trigger on_auth_user_created
            after insert on auth.users
            for each row execute function public.handle_new_user();
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- player_progress: the saved snapshot, private to its owner
-- ---------------------------------------------------------------------------
create table if not exists public.player_progress (
    user_id uuid primary key references auth.users (id) on delete cascade,
    data jsonb not null check (pg_column_size(data) <= 65536), -- a snapshot is a few KB; stops abuse
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
