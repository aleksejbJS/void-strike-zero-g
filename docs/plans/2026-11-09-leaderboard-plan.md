# Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lifetime counters for every achievement direction (counted online and offline), server-side week/month/all-time
totals, and a "Top" screen with six boards (top 10 + your own place).

**Architecture:** The simulation (offline game, Node server, browser host — all run `src/`) writes per-player counters into
`GameState.playerStats`, which online travels in every snapshot. A client hook reads *its own* entry, credits only new
increases (high-water mark per stats session) into a local lifetime store that also drives achievement progress. The
lifetime counters ride in the existing cloud snapshot; a Postgres trigger turns increases into week/month/all rows and a
`leaderboard` RPC serves the boards.

**Tech Stack:** TypeScript, React 18, Tailwind (Hazard Bay tokens), Vitest + Testing Library, Supabase (Postgres 15, RLS, RPC).

**Spec:** `docs/plans/2026-11-07-leaderboard-spec.md` — read it first.

**Workspace:** a worktree on branch `feature/leaderboards` from `origin/main` (another session may use the main checkout).
In the worktree drop the `node_modules` symlink and run `npm ci` (+ `npm ci` in `server/`), or account tests fail to load.

## Global Constraints

- No file over 200 lines; one responsibility per file; named exports. Existing oversized files (`physics.ts` 453,
  `combat.ts` 300, `GameCanvas.tsx` 1050) only get one-line call sites — new logic goes into new files under `src/game/stats/`.
- No silent catches: every caught error is logged (`console.warn`/`console.error`) or rethrown.
- Every UI string EN + RU; Hazard Bay tokens (`bay-*`, `font-display`, `font-body`); check Cyrillic rendering.
- Week starts Monday 00:00 UTC, month on the 1st 00:00 UTC.
- Boards: `xp`, `kills`, `botKills`, `wins`, `botWins`, `tournamentsWon`; periods `week`, `month`, `all`.
- A win is `wins` if ≥ 2 live humans (`type === 'player'`) are in `state.players` at the match end, else `botWins`.
- Only registered players are ranked; values of 0 are never listed.
- Acrobatic (double jump) and Speed Demon (dash) are **out of scope**: the game has neither mechanic. Do not touch them.

## Review Focus

1. Online reconnect / repeated snapshots must never credit the same increase twice → `collectDeltas` same-session test (Task 3).
2. Client prediction bumps `hookUses` locally, then the server snapshot rolls it back → no double count → high-water test (Task 3).
3. Offline "play again" builds a new state → counting restarts from 0 without losing anything → new-session test (Task 3).
4. Hidden tab / laptop sleep must not add play time → `playTimeDelta` cap + visibility test (Task 3).
5. An old build's snapshot without `stats`, or a lower value from another device, must never lower or erase server totals → SQL cases (Task 6).

---

### Task 1: Lifetime counters store + achievement mapping

**Files:**
- Create: `src/game/stats/statKeys.ts`, `src/game/stats/statAchievements.ts`, `src/game/stats/lifetimeStats.ts`
- Test: `src/game/stats/statAchievements.test.ts`, `src/game/stats/lifetimeStats.test.ts`

**Interfaces:**
- Produces:
  - `STAT_KEYS = ['kills','botKills','chainsawKills','railgunKills','rocketKills','flagCaptures','flagHoldTicks','hungerWins','hookUses','itemPickups','playMs','wins','botWins','tournamentsWon'] as const`
  - `type StatKey = typeof STAT_KEYS[number]`, `type Stats = Partial<Record<StatKey, number>>`
  - `SIM_STAT_KEYS: readonly StatKey[]` = kills, botKills, chainsawKills, railgunKills, rocketKills, flagCaptures, flagHoldTicks, hookUses, itemPickups
  - `achievementIncrements(key: StatKey, before: number, after: number): Array<[achievementId: string, increment: number]>`
  - `seedStatsFromAchievements(p: AchievementProgress): Stats`
  - `STATS_KEY = 'lifetimeStats'`; `loadStats(): Stats`; `addStats(delta: Stats): void`; `exportStats(): Stats`;
    `replaceStats(s: Stats): void` (silent, no achievement updates); `clearStats(): void`

Mapping (`achievementIncrements`): `kills` and `botKills` → first_blood, killer, slayer, executioner (increment = after − before);
`chainsawKills` → chainsaw_master; `railgunKills` → sniper; `rocketKills` → demolition_expert; `flagCaptures` → flag_capturer;
`hookUses` → hook_master; `itemPickups` → collector, hoarder; `hungerWins` → survivor;
`flagHoldTicks` → king_of_hill with increment `floor(after/PHYSICS_TICK_RATE) − floor(before/PHYSICS_TICK_RATE)`;
`playMs` → veteran with `floor(after/1000) − floor(before/1000)`; `wins`, `botWins`, `tournamentsWon` → none. Zero increments are dropped.

Seeding (used when `lifetimeStats` is absent): `botKills` = max progress of first_blood/killer/slayer/executioner,
`chainsawKills` = chainsaw_master, `railgunKills` = sniper, `rocketKills` = demolition_expert, `flagCaptures` = flag_capturer,
`flagHoldTicks` = king_of_hill × 120, `hungerWins` = survivor, `hookUses` = hook_master, `itemPickups` = max(collector, hoarder),
`playMs` = veteran × 1000, `tournamentsWon` = tournament_champion unlocked ? 1 : 0; `kills`, `wins`, `botWins` = 0.

- [ ] **Step 1: Write failing tests**
  - `statAchievements.test.ts`: `achievementIncrements('botKills', 99, 101)` → contains `['executioner', 2]` and `['first_blood', 2]`;
    `achievementIncrements('flagHoldTicks', 119, 121)` → `[['king_of_hill', 1]]`; `achievementIncrements('playMs', 1500, 1900)` → `[]`;
    `achievementIncrements('wins', 0, 5)` → `[]`; seeding `{ executioner: {progress: 100, unlocked: true}, veteran: {progress: 7, unlocked: false} }`
    → `botKills: 100, kills: 0, playMs: 7000`.
  - `lifetimeStats.test.ts` (reset `localStorage` + `achievementManager.reset()` in `beforeEach`): `addStats({ kills: 3 })` twice → `exportStats().kills === 6`
    and `killer` progress 6; counters keep growing past the target (`addStats({ kills: 150 })` → kills 150, executioner progress capped at 100);
    `replaceStats({ kills: 9 })` changes no achievement progress; first `loadStats()` with stored executioner 40 and no `lifetimeStats` →
    `botKills: 40` and the seed is written to storage; corrupt JSON in `lifetimeStats` → warns, re-seeds.
- [ ] **Step 2:** `npx vitest run src/game/stats` → FAIL (modules missing).
- [ ] **Step 3:** Implement the three files. Storage through `readStored` / `writeStored` / `removeStored` from `src/store/playerStorage`.
  `addStats` ignores non-positive/non-finite values, saves once, then applies increments via `achievementManager.updateProgress`.
- [ ] **Step 4:** `npx vitest run src/game/stats` → PASS.
- [ ] **Step 5:** Commit `feat(stats): lifetime counters that keep counting past achievement targets`.

### Task 2: Per-player counters in the simulation

**Files:**
- Create: `src/game/stats/playerStats.ts`, `src/game/stats/creditKill.ts`, `src/game/stats/flagHold.ts`
- Modify: `src/types.ts` (GameState), `src/game/systems/combat.ts:183-186`, `src/game/systems/physics.ts:9,289,308-310` (+ one `tickFlagHold` call near the HTF scoring tick ~line 385),
  `src/game/systems/playerControl.ts:53`, `src/game/systems/achievements.ts:148-196` (delete all `track*` helpers),
  `src/game/net/protocol.ts` (Snapshot + `buildSnapshot`), `src/game/net/roomSetup.ts` (`createRoomState`), `src/components/GameCanvas.tsx:227` (`makeInitialState`)
- Test: `src/game/stats/creditKill.test.ts`, `src/game/stats/flagHold.test.ts`, extend `src/game/net/room.test.ts`

**Interfaces:**
- Consumes: `StatKey`, `Stats` (Task 1)
- Produces: `GameState.playerStats?: Record<string, Stats>`; `GameState.statsSession?: string`;
  `bumpStat(state: GameState, playerId: string, key: StatKey, n?: number): void`; `newStatsSession(): string`;
  `creditKill(state: GameState, killer: Entity, target: Entity, weapon: WeaponType | undefined): void`; `tickFlagHold(state: GameState): void`;
  `Snapshot` now includes `playerStats` and `statsSession`.

Rules: `creditKill` does nothing unless `killer.type === 'player'`; bumps `botKills` if `target.type === 'bot'` else `kills`; plus
CHAINSAW → `chainsawKills`, RAILGUN → `railgunKills`, ROCKET_LAUNCHER → `rocketKills` (barrel passes `undefined`). It is called where
`trackKill` was (already inside the "not suicide, not teammate" branch). Flag capture and item pickup bump only for `p.type === 'player'`
(this fixes bot captures credited to the human). `tickFlagHold` adds 1 `flagHoldTicks` per tick for each alive human holding:
Hold the Flag `p.hasFlag === p.team && p.team !== Team.NONE`; CTF `p.hasFlag !== Team.NONE && p.hasFlag !== p.team`.
Confirm `updatePhysics` runs once per fixed tick (120/s) both offline and in `GameRoom`. `resetMatch` / `resetHungerRound` must
leave `playerStats` and `statsSession` untouched.

- [ ] **Step 1: Write failing tests**
  - `creditKill.test.ts`: human kills bot with RAILGUN → `playerStats[killer.id]` = `{ botKills: 1, railgunKills: 1 }`; human kills human → `{ kills: 1 }`;
    bot kills human → `playerStats` has no entry for the bot; barrel (`undefined`) → only `kills`/`botKills`.
  - `flagHold.test.ts`: HTF holder ticks 3× → `flagHoldTicks: 3`; dead holder → nothing; CTF carrying own team's flag → nothing; a bot holder → nothing.
  - `room.test.ts`: `room.snapshot(now).statsSession` is a non-empty string and stays the same after the room resets a match;
    a kill inside the room appears in `snapshot.playerStats[killerId]`.
- [ ] **Step 2:** `npx vitest run src/game/stats src/game/net/room.test.ts` → FAIL.
- [ ] **Step 3:** Implement; replace the `track*` call sites; delete the `track*` helpers and update any test that imported them.
- [ ] **Step 4:** `npx vitest run` (whole suite) → PASS; `npx tsc --noEmit` → no errors; `cd server && npx tsc --noEmit` → no errors.
- [ ] **Step 5:** Commit `feat(stats): the simulation counts kills, captures, pickups, hooks and flag time per player`.

### Task 3: Client collector (sim counters + play time)

**Files:**
- Create: `src/game/stats/statsCollector.ts`, `src/components/hud/useStatsCollector.ts`
- Modify: `src/components/GameCanvas.tsx:116` (one hook call next to `useMatchRewards`)
- Test: `src/game/stats/statsCollector.test.ts`, `src/components/hud/useStatsCollector.test.ts`

**Interfaces:**
- Consumes: `SIM_STAT_KEYS`, `addStats` (Task 1); `GameState.playerStats/statsSession` (Task 2); `detectMatchEnd` (`src/game/build/matchOutcome.ts`)
- Produces: `interface CollectorMemory { session: string | null; seen: Stats }`;
  `collectDeltas(mem: CollectorMemory, session: string | undefined, current: Stats | undefined): Stats`;
  `playTimeDelta(elapsedMs: number, active: boolean): number`;
  `useStatsCollector(state: MutableRefObject<GameState>, localId: MutableRefObject<string>): void`

Algorithm (`collectDeltas`): `session` undefined → `{}` (an older server). A different session → `mem.session = session; mem.seen = {}`.
For each `SIM_STAT_KEYS` key: `v = current?.[key] ?? 0`; if `v > (mem.seen[key] ?? 0)` → delta `v − seen`, `seen = v`. `seen` never decreases.
`playTimeDelta`: 0 when not active, else `min(elapsedMs, 1000)`.
The hook polls every 250 ms (like `useMatchRewards`): credits `collectDeltas` for `state.players`' local entry, plus `playMs` while
the local player is in `state.players`, `detectMatchEnd` is null and `document.visibilityState === 'visible'`. Calls `addStats` only for a
non-empty delta. On unmount, if anything was credited since mount, calls `notifyProgressChanged()` (leaving mid-match still syncs).

- [ ] **Step 1: Write failing tests** — `statsCollector.test.ts`:
  - same session, `{kills: 2}` then `{kills: 2}` → second call `{}` (reconnect / repeated snapshot);
  - `{hookUses: 3}` then `{hookUses: 2}` (prediction rolled back) then `{hookUses: 3}` → `{hookUses: 3}`, `{}`, `{}`;
  - session `a` `{kills: 5}` then session `b` `{kills: 1}` → second call `{kills: 1}` (offline play again);
  - session undefined → `{}`;
  - `playTimeDelta(250, true) === 250`, `playTimeDelta(30000, true) === 1000`, `playTimeDelta(250, false) === 0`.
  - `useStatsCollector.test.ts` (fake timers): a state whose local player gains `botKills` 1 → `exportStats().botKills` grows by 1 once;
    with `matchEndsAt` set, `playMs` stops growing; hidden document → no `playMs`.
- [ ] **Step 2:** `npx vitest run src/game/stats/statsCollector.test.ts src/components/hud/useStatsCollector.test.ts` → FAIL.
- [ ] **Step 3:** Implement both files and wire the hook in `GameCanvas`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(stats): credit the local player's counters and play time, online and offline`.

### Task 4: Wins, Hunger Games wins, tournaments won

**Files:**
- Create: `src/game/stats/matchWinStats.ts`
- Modify: `src/components/hud/useMatchRewards.ts:31-33`, `src/tournament/awardTournament.ts:52-65`
- Test: `src/game/stats/matchWinStats.test.ts`, extend the existing `awardTournament` tests

**Interfaces:**
- Consumes: `MatchEnd` (`matchOutcome.ts`), `addStats` (Task 1)
- Produces: `matchWinStats(state: GameState, end: MatchEnd): Stats`

Rules: `{}` unless `end.won`; humans = `state.players.filter(p => p.type === 'player').length`; `{ wins: 1 }` if humans ≥ 2 else
`{ botWins: 1 }`; also `hungerWins: 1` when `end.key` starts with `hunger:`. In `useMatchRewards` call `addStats(matchWinStats(...))`
right after `addMatchXp`, before `notifyProgressChanged`. In `awardTournament`, each *fresh* `tournament_champion` award also does
`addStats({ tournamentsWon: 1 })`, and the cloud is notified whenever any award was fresh (not only on unlock — the champion
achievement unlocks only once, but every title counts).

- [ ] **Step 1: Write failing tests**: 1 human + 3 bots, won → `{ botWins: 1 }`; 2 humans, won → `{ wins: 1 }`; lost → `{}`;
  hunger key won, solo → `{ botWins: 1, hungerWins: 1 }`; second tournament title (achievement already unlocked) → `tournamentsWon` 2 and
  `notifyProgressChanged` called; same tournament snapshot twice → counted once.
- [ ] **Step 2:** run the two test files → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(stats): count match wins, bot-match wins and tournament titles`.

### Task 5: Counters in the cloud snapshot

**Files:**
- Modify: `src/account/snapshot.ts`, `src/account/localSnapshot.ts`
- Test: extend `src/account/snapshot.test.ts`, `src/account/localSnapshot.test.ts`, `src/account/forwardCompat.test.ts`

**Interfaces:**
- Consumes: `Stats`, `exportStats`, `replaceStats`, `clearStats`, `STATS_KEY` (Task 1)
- Produces: `PlayerSnapshot.stats: Stats`

`sanitizeSnapshot` keeps `stats` entries whose key matches `/^[a-zA-Z]{1,40}$/` (safe-key check as for achievements, max 60 keys —
forward compatible like achievements) with finite non-negative values, floored; missing → `{}`. `mergeSnapshots` takes the per-key max.
`readLocalSnapshot` adds `stats: exportStats()`; `writeLocalSnapshot` calls `replaceStats(clean.stats)`; `clearLocalSnapshot` calls `clearStats()`.

- [ ] **Step 1: Write failing tests**: sanitize drops `{ kills: -1, botKills: 'x', __proto__: 5 }` and floors `2.7` → 2; snapshot without
  `stats` → `stats: {}`; merge `{kills: 5, wins: 1}` + `{kills: 3, botWins: 2}` → `{kills: 5, wins: 1, botWins: 2}`; unknown key
  `futureStat` survives sanitize; write → read round-trip keeps stats; clear removes `lifetimeStats`.
- [ ] **Step 2:** `npx vitest run src/account` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/account` → PASS.
- [ ] **Step 5:** Commit `feat(account): lifetime counters travel with the cloud snapshot`.

### Task 6: Supabase — period totals, trigger, `leaderboard` RPC

**Files:**
- Create: `supabase/migrations/20261109000000_leaderboards.sql`, `supabase/tests/auth-stub.sql`, `supabase/tests/leaderboards.test.sql`
- Modify: `scripts/test-sql.sh` (run the existing tournaments suite unchanged, then a second fresh database: auth stub →
  `20261103000000_accounts.sql` → `20261105000000_account_hardening.sql` → leaderboards migration twice (idempotent) → leaderboards tests),
  `docs/supabase-setup.md` (owner step: run the new migration in the SQL editor)

**Interfaces:**
- Produces (SQL): table `public.player_stats(user_id uuid references auth.users on delete cascade, period text check in ('week','month','all'),
  period_start date, stat text, value bigint not null default 0, updated_at timestamptz not null default now(), primary key (user_id, period, period_start, stat))`;
  index on `(stat, period, period_start, value desc, updated_at)`;
  trigger function `public.record_player_stats()` (security definer, `search_path = public`), `after insert or update of data on public.player_progress`;
  `public.leaderboard(p_stat text, p_period text) returns json` →
  `{ "top": [{ "rank": int, "nickname": text, "value": bigint }], "me": { "rank": int, "value": bigint } | null }`.

Trigger rules: ranked stats = `xp` (from `data->'xp'`) and `kills, botKills, wins, botWins, tournamentsWon` (from `data->'stats'`); a missing
or non-numeric value is skipped. No `all` row yet for (user, stat) → insert `all` = value, **no** week/month rows (baseline). Otherwise
`delta = value − all.value`; `delta ≤ 0` → skip; clamp to the per-save limit (`xp` 1000, `kills` 300, `botKills` 600, `wins` 30, `botWins` 30,
`tournamentsWon` 5) with `raise warning`; add the (clamped) delta to the `all`, current `week` (`date_trunc('week', now() at time zone 'utc')::date`)
and current `month` (`date_trunc('month', …)::date`) rows, setting `updated_at = now()`. `all` uses `period_start = '2000-01-01'`.
RLS on, no policies; `revoke all on public.player_stats from anon, authenticated`.
RPC: unknown stat → `raise exception 'bad_stat'`, unknown period → `'bad_period'`; top 10 of the current period with `value > 0`, ordered
`value desc, updated_at asc`, nickname from `profiles.nickname`; `me` only when `auth.uid()` is set and has a row with `value > 0`
(rank = 1 + rows ahead by the same ordering). `grant execute … to anon, authenticated`.
Auth stub: schema `auth`, table `auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, …)` with whatever columns the two
account migrations touch, and `auth.uid()` reading `current_setting('request.jwt.claim.sub', true)::uuid`.

- [ ] **Step 1: Write failing SQL cases** (one DO block each, like `tournaments.test.sql`):
  first save `{xp: 500, stats: {kills: 10}}` → `all` 500/10, no week/month rows; second save kills 13 → all 13, week 3, month 3;
  then kills 11 (other device) → unchanged; save without `stats` → kills rows unchanged; kills +5000 → +300 everywhere; a week row
  dated last week is not on this week's board; 12 users with kills 1..12 → `top` has 10 rows starting with value 12, caller with value 1
  gets `me.rank = 12`; tie broken by earlier `updated_at`; anon caller → `me` null; `leaderboard('nope','week')` raises `bad_stat`;
  `set role authenticated; select * from player_stats` fails (no privilege).
- [ ] **Step 2:** `bash scripts/test-sql.sh` → leaderboards suite FAILS (migration missing); tournaments suite still passes.
- [ ] **Step 3:** Write the migration, auth stub and script changes.
- [ ] **Step 4:** `bash scripts/test-sql.sh` → both suites pass.
- [ ] **Step 5:** Commit `feat(db): weekly, monthly and all-time leaderboards`.

### Task 7: Leaderboard client API

**Files:**
- Create: `src/leaderboard/leaderboardApi.ts`
- Test: `src/leaderboard/leaderboardApi.test.ts`

**Interfaces:**
- Produces: `type RankedStat = 'xp'|'kills'|'botKills'|'wins'|'botWins'|'tournamentsWon'`; `type Period = 'week'|'month'|'all'`;
  `interface BoardRow { rank: number; nickname: string; value: number }`; `interface Board { top: BoardRow[]; me: { rank: number; value: number } | null }`;
  `parseBoard(data: unknown): Board`; `fetchBoard(stat: RankedStat, period: Period): Promise<Board>`;
  `class LeaderboardError extends Error { code: 'offline' | 'network' | 'unknown' }`

`fetchBoard` loads `getSupabase` with a dynamic `import('../account/supabaseClient')` (keeps supabase-js out of the first bundle);
no client → `LeaderboardError('offline')`; RPC error or thrown fetch → logged with `console.error` and rethrown as `network`/`unknown`.
`parseBoard` drops malformed rows and returns `me: null` for anything malformed.

- [ ] **Step 1: Write failing tests**: `parseBoard` on a valid payload, on `null` (→ `{ top: [], me: null }`), on a row with a string value (dropped);
  `fetchBoard` with a mocked client calls `rpc('leaderboard', { p_stat: 'kills', p_period: 'week' })`; RPC error → rejects with `LeaderboardError`.
- [ ] **Step 2:** `npx vitest run src/leaderboard` → FAIL.  **Step 3:** implement.  **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(leaderboard): client for the leaderboard RPC`.

### Task 8: Top screen (layout B) + menu button

**Files:**
- Create: `src/components/leaderboard/LeaderboardScreen.tsx`, `CategoryList.tsx`, `PeriodSwitch.tsx`, `BoardTable.tsx`, `useBoard.ts`,
  `boardCategories.ts`; `src/components/menu/TopButton.tsx`; `src/i18n/leaderboardStrings.ts`
- Modify: `src/i18n/locales.ts` (merge strings), `src/components/menu/MainMenu.tsx` (prop `onOpenLeaderboard`, `TopButton` before `ProfileButton`),
  `src/App.tsx` (`showingLeaderboard`, same overlay pattern as Profile)
- Test: `src/components/leaderboard/LeaderboardScreen.test.tsx`, extend `src/components/menu/MainMenu.test.tsx`

**Interfaces:**
- Consumes: `fetchBoard`, `Board`, `RankedStat`, `Period` (Task 7); `useAccount()` (`status`, `nickname`)
- Produces: `LeaderboardScreen: React.FC<{ onBack: () => void; onRegister: () => void }>`; `TopButton: React.FC<{ onOpen: () => void; t: Translate }>`

Behaviour (mockup B, `.superpowers/brainstorm/16795-1794050422/content/leaderboard-layout.html`): back button, title, hazard stripe;
category list left (6 rows, order XP, Kills, Bot kills, Wins, Wins vs bots, Tournaments), period switch above the table (default **Week**),
table rank / player / value with places 1–3 tinted (gold `bay-hazard`, white `bay-chalk`, bronze). Logged-in and `me.rank ≤ 10` → own row
highlighted in place (match by nickname); `me.rank > 10` → `· · ·` gap + highlighted `lb.you` row; logged in but `me` null → `lb.unranked`
row; guest → `lb.guest` text + button calling `onRegister` (App closes the Top screen and opens Profile, where sign-up lives — Claude's call).
Loading, empty and error-with-retry states; a stale response (category switched meanwhile) is ignored. `phone:` variant: category list becomes a
wrapping row of tabs above the table. Fits 1512×700 without page scroll. `TopButton` hidden when `status === 'disabled'`.
Strings (EN / RU): `lb.menu` Top / Топ; `lb.title` Top players / Топ игроков; `lb.back` ← Menu / ← Меню; `lb.cat.xp` XP / XP;
`lb.cat.kills` Kills / Убийства; `lb.cat.botKills` Bot kills / Убийства ботов; `lb.cat.wins` Wins / Победы; `lb.cat.botWins` Wins vs bots / Победы над ботами;
`lb.cat.tournamentsWon` Tournaments / Турниры; `lb.period.week` This week / Неделя; `lb.period.month` This month / Месяц; `lb.period.all` All time / Всё время;
`lb.col.player` Player / Игрок; `lb.you` You · {0} / Вы · {0}; `lb.unranked` Not ranked yet / Пока нет в рейтинге;
`lb.guest` Register to get on the board / Зарегистрируйтесь, чтобы попасть в топ; `lb.guest.button` Register / Зарегистрироваться;
`lb.empty` Nobody on this board yet / Здесь пока никого нет; `lb.error` Could not load the board. / Не удалось загрузить топ.;
`lb.retry` Retry / Повторить; `lb.loading` Loading… / Загрузка….

- [ ] **Step 1: Write failing tests** (mock `fetchBoard`): 10 rows + `me {rank: 37, value: 214}` → gap and "You · <nick>" row with 37 and 214;
  `me.rank 3` → no gap, row 3 highlighted; guest → register button calls `onRegister`; clicking "Bot kills" then "Month" calls
  `fetchBoard('botKills','month')`; rejected fetch → error text, Retry refetches; empty `top` → empty text; RU strings render;
  `MainMenu`: Top button present when accounts enabled, absent when `disabled`.
- [ ] **Step 2:** `npx vitest run src/components/leaderboard src/components/menu` → FAIL.  **Step 3:** implement.  **Step 4:** → PASS.
- [ ] **Step 5:** Visual check at 1512×700 and a phone viewport (Playwright, see memory `local-browser-check`), EN and RU; screenshot to the owner.
- [ ] **Step 6:** Commit `feat(leaderboard): Top screen with six boards and your own place`.

### Task 9: Release

**Files:** `src/components/menu/patchNotes.ts`, `CHANGELOG.md`

- [ ] **Step 1:** `git fetch` and take the next free 0.4.x on `origin/main`; add a flat note (EN + RU, 3–4 points): Top screen with six boards
  (week / month / all time); online kills, captures and pickups now count; Veteran, King of the Hill and Survivor can be earned.
- [ ] **Step 2:** `npx vitest run && npx tsc --noEmit && npm run build && bash scripts/test-sql.sh` → all green.
- [ ] **Step 3:** Commit, push, open the PR (git-workflow skill). The PR body lists the owner step: **run
  `supabase/migrations/20261109000000_leaderboards.sql` in the Supabase SQL editor before merging**. Merge only on the owner's go-ahead.
