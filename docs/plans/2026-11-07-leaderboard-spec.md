# Leaderboards — Spec

**Date:** 2026-11-07 · **Status:** draft, awaiting owner approval
**Base:** `main` at 0.4.31. Build on a feature branch in a worktree (another session may share the checkout).

## Intent

Registered players want to see who is best and where they stand. A "Top" screen shows the top 10 in each
category; if you are not in the top 10, a separate row under the list shows your own place and value
("You — 37th, 214 kills"). Weekly and monthly boards give newcomers a race they can actually win.

To feed the boards, the game keeps **full lifetime counters** for everything the achievements track.
Achievements still unlock at their target (e.g. Executioner at 100 kills), but the counter keeps going.

## Owner decisions (2026-11-07)

| Question | Decision |
|---|---|
| Who is ranked | Registered players only (guests are not on the boards) |
| What is shown | Top 10 + your own row below if you are outside the top 10 |
| Boards | **XP, Kills, Bot kills, Wins, Wins vs bots, Tournaments won** |
| Kills vs bot kills | Killing a live player → Kills; killing a bot → Bot kills (in any match, online or offline) |
| Wins vs bot wins | A win counts as **Win** if the match had **≥ 2 live humans**; with only 1 human it is a **Win vs bots** |
| Tournaments | A tournament win counts even if every opponent was a bot |
| Periods | **This week, this month, all time** |
| Counters | Lifetime counters for every achievement direction; they keep counting past the achievement target |
| Broken trackers | Fix them as part of this work (owner asked explicitly for play time) |
| Layout | **Option B**: categories as a vertical list on the left, table on the right (more boards can be added as rows). Mockup: `docs/plans/2026-11-07-leaderboard-layout-mockup.html` |
| Week/month computation | **Option A**: the server computes deltas between saved totals (see Data) |
| Online counters | **General channel**: the room reports *all* of a player's in-sim counters to that player (kills, bot kills, weapon kills, flag captures, flag hold time, item pickups, HG wins), not just kills |

## Goals

- A "Top" button in the main-menu header next to Profile opens the Top screen (Hazard Bay style, EN + RU).
- Left: category list (6 boards). Above or beside the table: period switch Week / Month / All time.
- Table: rank, nickname, value. Places 1–3 tinted (gold / white / bronze as in the mockup).
- Logged-in player in the top 10: their row is highlighted in place. Outside: a `· · ·` gap and a highlighted
  "You · <nickname>" row with their rank and value. Value 0 → "Not ranked yet" in place of a rank.
- Guest: in place of the "You" row, "Register to get on the board" + a button that opens the existing
  account sign-up.
- Lifetime counters for: kills (players), bot kills, kills by chainsaw / sniper / explosives, flag captures,
  flag hold seconds, Hunger Games wins, double jumps, hook uses, dash uses, item pickups, play seconds,
  match wins, bot-match wins, tournaments won.
- Fix the trackers that have no callers today, so these achievements become earnable:
  `trackPlayTime` (Veteran), `trackFlagHoldTime` (King of the Hill), `trackHungerGamesWin` (Survivor).
  Found while planning: the game has **no double jump and no dash**, so Acrobatic and Speed Demon (and therefore
  Perfectionist) stay unearnable; they are out of scope here, pending the owner's decision.
- Online counters reach the player's own client. Today `trackKill`, `trackFlagCapture` and
  `trackItemPickup` run inside the simulation (`combat.ts`, `physics.ts`), which online is the Node server or
  the browser host, so an online player's kills, captures and pickups never reach their own progress. The
  "Kills" board (live players) depends on this. Owner chose a **general per-player counter channel** from the
  room to each client (works for the Node server and the browser host), so future boards (e.g. flag
  captures) need no new network work. Movement counters (hook, dash, double jump) are already predicted on
  the client; the builder confirms they count online and routes them through the same channel if not.

## Non-goals

- Boards for the other counters (flags, hooks, …): counters are stored now, boards can be added later.
- Showing the counters in the Profile screen.
- Live-updating boards: data is fetched when the screen opens (and when category/period changes).
- Cheat-proof stats. Totals still come from the player's browser, as XP does today; the server only
  rejects absurd jumps (see Data). Hardening is a later topic.
- Viewing other players' profiles from the board.

## Anti-goals

- The game must not get slower or stall when the cloud is unreachable: boards fail with an inline message
  and a retry button; play is never blocked.
- Guests' local progress and the offline game behave exactly as before.
- No achievement may lose progress or unlock state because of the counter change.

## Data

### Client: counters in the snapshot

- Add a `stats` record (counter name → non-negative integer) to `PlayerSnapshot`, saved in localStorage
  like achievements and XP. `sanitizeSnapshot` accepts only known keys and non-negative integers;
  `mergeSnapshots` takes the per-key **max** (same "never lowers a value" rule as XP and achievements).
- Achievements read their progress from the counters (capped at `maxProgress` for display/unlock), or the
  trackers update both — builder's choice; either way the achievement behaviour must not change.
- Migration of existing progress: when `stats` is missing, seed each counter from the matching achievement's
  stored progress (e.g. kills from `executioner`, capped values are the best we know). **Old kills go to
  bot kills** (online kills were never credited, so every recorded kill was offline vs bots).
  Old wins: none recorded separately → start at 0.

### Kill classification

- Victim `type === 'bot'` → bot kill, `type === 'player'` → kill. Suicides and teammate kills count for
  neither (same rule as score today). Barrel kills count by victim type, with no weapon.
- Offline: credited directly as today. Online: through the general counter channel (see Goals). Builder
  picks the wire format; a client must never be credited for another player's counters, and a reconnect or
  repeated snapshot must never count the same event twice.
- Weapon counters (chainsaw / sniper / explosives) count kills of both bots and players.
- *(Claude's call)* Kill achievements (First Blood … Executioner) and weapon achievements read
  **kills + bot kills**, exactly as today (today every offline bot kill counts). No one loses progress.

### Time counters *(Claude's call)*

- Play time (Veteran): seconds while a match is running and the player is in it, offline and online,
  including respawn waits; not menus, pause or end screens.
- Flag hold (King of the Hill, "hold the flag for 500 s"): seconds the player holds the flag in
  Hold the Flag, plus seconds carrying the enemy flag in CTF.
- `trackFlagCapture` today has no `type === 'player'` check, so a bot's capture is credited to the human
  offline. Fix it; old `flag_capturer` progress is trusted as-is for the migration.

### Win classification

- Use the existing `detectMatchEnd` / `useMatchRewards` path (it already pays XP once per end, offline and
  online). If `won`: count the live humans who took part in the match (`players` with `type === 'player'`
  at match end) — ≥ 2 → match win, otherwise → bot-match win. Draws count for nothing.
- Hunger Games round wins also count as match wins by the same rule and feed the Survivor counter.
- Tournaments won: increment where `tournament_champion` is awarded in `src/tournament/awardTournament.ts`
  (already de-duplicated per tournament id). Tournament duel wins also count as match wins by the human
  rule above.

### Server: period totals (Supabase migration)

- New table `player_stats(user_id, period, period_start, stat, value, updated_at)`,
  `period ∈ {week, month, all}`, primary key `(user_id, period, period_start, stat)`. Week starts Monday
  00:00 UTC, month on the 1st 00:00 UTC; `all` uses a fixed `period_start`.
- A trigger on `player_progress` insert/update reads the new snapshot's `stats` and `xp`, compares each value
  with the stored `all` total, and adds the **positive difference** to the current week, current month and
  all-time rows. Lower values are ignored (another device with an older copy).
- Sanity cap: a single save that raises a counter by more than a per-stat limit (builder sets limits that
  no real session reaches, e.g. a few hundred kills) is clamped to the limit and logged with `raise warning`.
- First save after this release (no `all` rows yet): the current totals become the all-time baseline;
  **nothing** is added to week/month, so existing veterans do not flood the first weekly board.
- No browser write access to `player_stats` (RLS on, no policies for insert/update/delete; trigger is
  `security definer`).
- RPC `leaderboard(p_stat text, p_period text)` (`security definer`, callable by anon and authenticated):
  returns the top 10 `{rank, nickname, value}` for the current period (value > 0 only), plus, when the
  caller is logged in, the caller's own rank and value. Ties: the earlier `updated_at` ranks higher.
  Nickname comes from `profiles.nickname`.
- Owner runs the migration in the SQL editor (as with earlier migrations); add the step to
  `docs/supabase-setup.md`.

## UI

- Components under `src/components/leaderboard/`, strings in a new `src/i18n/leaderboardStrings.ts`
  (EN + RU), Hazard Bay tokens (`bay-*`), Cyrillic font fallback checked.
- Must fit the owner's screen (1512×700) without page scroll; on phones the category list turns into a
  wrapping row of tabs above the table.
- Loading state, empty board ("Nobody on this board yet"), error with retry.
- If Supabase env is missing (accounts hidden), the Top button is hidden too.

## Left to the builder

- Exact counter key names, per-stat sanity limits, how online kills reach the client, component split
  (≤ 200 lines per file), test layout. Unit-test the classification rules and snapshot merge/migration;
  test the SQL trigger and RPC like the existing `supabase/tests`.
