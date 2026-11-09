#!/usr/bin/env bash
# Runs the Supabase SQL tests against a throwaway local Postgres cluster.
# Usage: bash scripts/test-sql.sh
#
# Two suites, each in its own fresh database: tournaments (database "postgres"), then leaderboards
# (database "leaderboards": auth stand-in, the two account migrations, the leaderboards migration, then the
# trigger and RPC suites and a check that the trigger's WARNING paths reach the client).
#
# The cluster lives in a temp dir under $TMPDIR, listens only on a Unix socket inside that dir
# (port number 54329, no TCP), so it never collides with a Postgres that is already running.
# It is stopped and deleted on exit, whatever happens. Exits non-zero when any assert fails.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
MIGRATION="$MIGRATIONS/20261104000000_tournaments.sql"
TESTS="$ROOT/supabase/tests/tournaments.test.sql"
LB_MIGRATION="$MIGRATIONS/20261109000000_leaderboards.sql"
AUTH_STUB="$ROOT/supabase/tests/auth-stub.sql"
LB_HELPERS="$ROOT/supabase/tests/leaderboards-helpers.sql"
LB_TESTS=("$ROOT/supabase/tests/leaderboards-trigger.test.sql" "$ROOT/supabase/tests/leaderboards-rpc.test.sql")
LB_WARNINGS="$ROOT/supabase/tests/leaderboards-warnings.sql"
PORT=54329
# A bin dir with the server itself (Homebrew's libpq puts a server-less initdb on PATH).
# Order: PG_BIN (override), a postgres on PATH, then Homebrew kegs oldest first (hosted Supabase runs 15).
find_pg_bin() {
    local dir
    for dir in ${PG_BIN:-} \
        "$(dirname "$(command -v postgres 2>/dev/null || echo /nonexistent/postgres)")" \
        /opt/homebrew/opt/postgresql@{15,16,17,18}/bin /usr/local/opt/postgresql@{15,16,17,18}/bin \
        /opt/homebrew/opt/postgresql/bin /usr/local/opt/postgresql/bin; do
        if [ -x "$dir/postgres" ] && [ -x "$dir/initdb" ] && [ -x "$dir/pg_ctl" ] && [ -x "$dir/psql" ]; then
            echo "$dir"
            return 0
        fi
    done
    return 1
}
PG_BIN="$(find_pg_bin)" || { echo "[test-sql] no Postgres server found; set PG_BIN=/path/to/postgres/bin" >&2; exit 1; }

# The macOS postmaster refuses to start without a valid locale in the environment.
export LC_ALL=en_US.UTF-8

WORK="$(mktemp -d "${TMPDIR:-/tmp}/vs-sqltest.XXXXXX")"
DATA="$WORK/data"

cleanup() {
    if [ -f "$DATA/postmaster.pid" ]; then
        "$PG_BIN/pg_ctl" -D "$DATA" -m immediate -w stop >/dev/null 2>&1 \
            || echo "[test-sql] warning: could not stop the cluster in $DATA" >&2
    fi
    rm -rf "$WORK"
}
trap cleanup EXIT

echo "[test-sql] $("$PG_BIN/postgres" --version), cluster in $WORK"
"$PG_BIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --no-locale >"$WORK/initdb.log" 2>&1 \
    || { cat "$WORK/initdb.log" >&2; exit 1; }

# wal_level=logical so the stand-in Realtime publication works without warnings.
"$PG_BIN/pg_ctl" -D "$DATA" -l "$WORK/server.log" -w \
    -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" start >/dev/null \
    || { cat "$WORK/server.log" >&2; exit 1; }

# Only warnings and errors: the migration's "already exists, skipping" notices are expected.
export PGOPTIONS="-c client_min_messages=warning"
PSQL=("$PG_BIN/psql" -X -q -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1)

# What hosted Supabase already has: the browser roles (once per cluster), and in every database pgcrypto in
# schema "extensions" and default privileges that grant everything on new public objects to the browser
# roles (so the migrations' revokes are tested against the real defaults).
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
SQL
supabase_defaults() {
    "$@" <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto schema extensions;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL
}
supabase_defaults "${PSQL[@]}"
# The Realtime publication (only the tournaments migration uses it).
"${PSQL[@]}" -c 'create publication supabase_realtime;'

echo "[test-sql] loading the migration twice (it must be idempotent)"
"${PSQL[@]}" -f "$MIGRATION"
# Simulate a database where an earlier version ran: it published tournament_seats, kept the heartbeats on the
# match row (a_seen_at, b_seen_at), had no seats.seen_at nor tournament_presence, and named settle() plainly.
# The re-run must bring it to the current shape (tournaments.test.sql checks it).
"${PSQL[@]}" <<'SQL'
alter publication supabase_realtime add table public.tournament_seats;
alter table public.tournament_matches add column a_seen_at timestamptz, add column b_seen_at timestamptz;
alter table public.tournament_seats drop column seen_at;
drop table public.tournament_presence;
create function public.settle(p_id uuid) returns void language sql as 'select';
SQL
"${PSQL[@]}" -f "$MIGRATION"

echo "[test-sql] running $TESTS"
"${PSQL[@]}" -f "$TESTS"

# Leaderboards: a fresh database with the account tables. Its locale must know Cyrillic, as hosted
# Supabase's does: the accounts migrations stop on a database that cannot lower-case it.
echo "[test-sql] leaderboards: fresh database, auth stand-in, account migrations"
"${PSQL[@]}" -c "create database leaderboards template template0 encoding 'UTF8' locale 'en_US.UTF-8'"
LB_PSQL=("$PG_BIN/psql" -X -q -h "$WORK" -p "$PORT" -U postgres -d leaderboards -v ON_ERROR_STOP=1)
supabase_defaults "${LB_PSQL[@]}"
"${LB_PSQL[@]}" -f "$AUTH_STUB"
"${LB_PSQL[@]}" -f "$MIGRATIONS/20261103000000_accounts.sql"
"${LB_PSQL[@]}" -f "$MIGRATIONS/20261105000000_account_hardening.sql"
echo "[test-sql] loading the leaderboards migration twice (it must be idempotent)"
"${LB_PSQL[@]}" -f "$LB_MIGRATION"
"${LB_PSQL[@]}" -f "$LB_MIGRATION"

"${LB_PSQL[@]}" -f "$LB_HELPERS"
for tests in "${LB_TESTS[@]}"; do
    echo "[test-sql] running $tests"
    "${LB_PSQL[@]}" -f "$tests"
done

# The suites silence their expected warnings; here each warning path runs once and its text must arrive.
echo "[test-sql] checking the trigger's warnings"
"${LB_PSQL[@]}" -f "$LB_WARNINGS" 2>"$WORK/warnings.log"
for expected in 'stat xp: skipped "x"' 'stat kills: first save brought 20000, capped to 10000' \
    'stat kills: one save raised it by 5000, clamped to 300'; do
    grep -qF "$expected" "$WORK/warnings.log" \
        || { echo "[test-sql] missing warning: $expected" >&2; cat "$WORK/warnings.log" >&2; exit 1; }
done
echo "[test-sql] PASS"
