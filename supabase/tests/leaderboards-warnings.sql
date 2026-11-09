-- Void Strike: Zero-G — takes each WARNING path of record_player_stats() once.
-- Run by scripts/test-sql.sh after the leaderboards tests; the script checks these warnings reach the client:
--   stat xp: skipped "x" ...                                  (a bad value)
--   stat kills: first save brought 20000, capped to 10000    (the baseline cap)
--   stat kills: one save raised it by 5000, clamped to 300   (the per-save limit)
-- NEVER run this against the real project.

do $$
declare v_u uuid := lb.user('Warned');
begin
    perform lb.save(v_u, '{"xp": "x", "stats": {"kills": 20000}}');
    perform lb.save(v_u, '{"stats": {"kills": 25000}}');
end $$;
