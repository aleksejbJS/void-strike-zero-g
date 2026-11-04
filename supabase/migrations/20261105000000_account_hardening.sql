-- Void Strike: Zero-G — account hardening (release 0.4.26).
-- Run AFTER 20261103000000_accounts.sql: paste this whole file into Supabase Dashboard -> SQL Editor ->
-- New query -> Run. Safe to run more than once. Setup steps: docs/supabase-setup.md
--
-- 1. New nicknames follow a strict whitelist: basic Latin, the basic Russian alphabet (with Ё/ё), digits,
--    "_", "-" and single spaces. No fullwidth or small-cap letters, Greek, accents, zero-width characters.
--    Existing accounts keep their names and keep logging in (only sign-up runs this check).
-- 2. The e-mail of an account can never change: it encodes the nickname, so changing it would hand the
--    account a different nickname (or take over a free one).

-- Precondition: the trigger compares lower(nickname) with the key the browser computed, which needs a
-- database locale that knows Cyrillic (Ё included). Fail here rather than on a player's sign-up.
do $$
begin
    if lower('ТЕСТЁ') <> 'тестё' then
        raise exception 'Database locale (%) cannot lower-case Cyrillic letters, so nickname checks would reject Cyrillic names. Ask the developer before going on.',
            (select datctype from pg_database where datname = current_database());
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Sign-up trigger: same function as in 20261103000000_accounts.sql, only the character checks changed.
-- Keep it in step with src/account/nickname.ts (see src/account/nicknameEmailContract.test.ts).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    -- Not trimmed on purpose: the spacing rule below must see exactly what the client sent.
    v_nickname text := coalesce(new.raw_user_meta_data ->> 'nickname', '');
    v_nickname_key text := coalesce(new.raw_user_meta_data ->> 'nickname_key', '');
begin
    -- Fail loudly: a rejected nickname aborts the whole sign-up instead of leaving a profile-less user.
    if btrim(v_nickname) = '' or btrim(v_nickname_key) = '' then
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

    -- No leading/trailing space and no double space ("Alex " must not pass for "Alex").
    if v_nickname <> btrim(v_nickname) or v_nickname ~ '  ' then
        raise exception 'Nickname must not start or end with a space or contain a double space';
    end if;

    -- The whitelist: A-Z, a-z, А-Я, а-я, Ё, ё, digits, "_", "-" and spaces. Written as code points
    -- (\u0410-\u044F is the letters from capital A to small ya, \u0401 is Yo, \u0451 is yo) so no locale can widen the ranges.
    if v_nickname !~ '^[A-Za-z0-9\u0410-\u044F\u0401\u0451_ -]+$' then
        raise exception 'Nickname may only contain Latin or Russian letters, digits, "_", "-" and spaces';
    end if;

    -- Latin and Cyrillic in one name is the look-alike trick ("Аlex" with a Cyrillic А).
    if v_nickname ~ '[A-Za-z]' and v_nickname ~ '[\u0410-\u044F\u0401\u0451]' then
        raise exception 'Nickname must not mix Latin and Cyrillic letters';
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

-- Only the trigger runs this function; nobody calls it directly. The trigger itself already exists
-- (20261103000000_accounts.sql) and calls the function replaced above.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- E-mail lock: the fake e-mail IS the nickname, so it may never change after sign-up
-- ---------------------------------------------------------------------------
-- Without this, a logged-in player could call /auth/v1/user with a new e-mail ("Confirm email" is off, so
-- it applies at once) and log in under another nickname's address.
create or replace function public.prevent_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.email is distinct from old.email then
        raise exception 'The e-mail of an account cannot be changed: it encodes the nickname';
    end if;
    return new;
end;
$$;

-- Only the trigger runs this function; nobody calls it directly.
revoke all on function public.prevent_email_change() from public, anon, authenticated;

-- Not "drop trigger if exists": on hosted Supabase that needs ownership of auth.users and can fail on a re-run.
do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'on_auth_user_email_change' and tgrelid = 'auth.users'::regclass
    ) then
        create trigger on_auth_user_email_change
            before update of email on auth.users
            for each row execute function public.prevent_email_change();
    end if;
end
$$;
