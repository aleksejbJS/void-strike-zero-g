# Tournament Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1-on-1 single-elimination tournaments for up to 8 players. Matches run in parallel and are browser-hosted. The bracket lives in Supabase, spectators can watch in a split screen, and three achievements reward a run.

**Architecture:**
- **Duel match.** A new hidden `GameMode.DUEL` on a new `MapId.PIT` runs in the existing `GameRoom`. It is first to 10, uses a fixed loadout, has no auto-restart, and adds sudden death.
- **Spectators.** Spectators are a new connection role in `RoomHost`: they get snapshots and events only, never an entity.
- **Coordination.** All tournament coordination happens in Postgres: tables plus `security definer` RPCs. Every bracket transition is one transaction, so the browsers never race each other.
  - Browsers only read (Realtime on `tournaments` and `tournament_matches`, plain selects for seats) and call RPCs that carry a per-seat secret.
- **Watching.** The split screen is a stand-alone watch screen. Each tile owns its own Pixi `Application`, `GameState` and `SpectatorSession`. `GameCanvas` is left untouched apart from the tournament-match hook.

**Tech Stack:** TypeScript, React 19, Pixi.js 8, Matter.js, PeerJS, Supabase (Postgres, PostgREST RPC, Realtime) and Vitest. SQL tests run with `psql` against a throwaway local cluster (`pg_ctl` is installed).

**Spec:** `docs/plans/2026-11-04-tournament-spec.md`. Read it before any task.

## Global Constraints

- Work in a git worktree on branch `feature/tournament` cut from `origin/main`. Never switch branches in the main checkout, because other sessions share it.
- No file may exceed 200 lines. That includes new tests: split them by topic, as `src/account/*.test.ts` does.
- One responsibility per file. Use named exports.
- No silent catches. Every `catch` logs with a `[tournament]` prefix or surfaces the error to the UI.
- Every UI string has EN and RU in a new `src/i18n/tournamentStrings.ts`, wired the same way as `accountStrings.ts`.
- UI uses the Hazard Bay tokens (`bay-*` colours, `font-display`, `font-body`). Test layouts at 1512×700.
- Existing modes must behave exactly as before. Every new `RoomConfig` field is optional, and its default is today's behaviour.
- Spec values, copied exactly:
  - Duel score limit **10**.
  - Match time cap **10 min** (the existing `MATCH_TIME_LIMIT`), with sudden death on a tie.
  - No-show and disconnect timeout **60 s**.
  - Spectator cap **6** per match.
  - Bracket size **4** for 2–4 humans and **8** for 5–8. At least **2** humans are needed to start.
  - An unstarted lobby expires after **30 min**. A finished tournament stays listed for **10 min**.
- Loadout on every spawn: MG (999 ammo), shotgun, railgun, rocket launcher, grenade launcher, smoke launcher, chainsaw, each with its `WEAPONS_DATA` ammo. **No plasma.**
- Pit pickups: health, armor and ammo only. **No weapon pickups.**
- Achievements:
  - `tournament_champion` (legendary)
  - `tournament_finalist` (epic)
  - `tournament_flawless` (rare)
  - Champion and Finalist need at least one played (non-walkover) win. Flawless counts only a played 10:0 win.
  - Achievement names stay English-only, matching the existing defs, which are not localized today.
- Walkovers give no XP. That is automatic, because XP is only paid by `useMatchRewards` when a duel actually ends in `GameCanvas`.
- Ads:
  - Pit ad places are `pit.wall-poster-a` and `pit.wall-poster-b` (300x250).
  - Split-screen tiles show no ads unless the tile is expanded.

## Review Focus

1. **A fighter reloads the tab mid-tournament.** They must get their seat back, because the secret is kept in `localStorage` per tournament. If their match is still live they rejoin it, and they must not be treated as a new sign-up. Test: Task 7 (`seatStore`) and Task 10 (`myTurn` returns `join` again for a fresh client holding the same ticket).
2. **Both fighters are gone, or the host vanishes before publishing a peer id.** The bracket must still move, which `resolve_stale` covers. Test: Task 6 SQL cases "both stale → random walkover" and "host never published → guest wins after 60 s".
3. **Two reports for one match.** For example, the host reports a result while `resolve_stale` decides a walkover in the same second. The first decision wins and the second is a no-op, so nobody advances twice. Test: Task 6 "report after walkover is ignored".
4. **The creator double-clicks Start, or presses it with 1 human.** One start at most, and a clear error with 1 human. Test: Task 6.
5. **A spectator opens a tile for a match that has just ended, or whose host is gone.** The tile shows "match over" or "host left" and never throws or hangs. Test: Task 5 (`SpectatorSession` disconnect callback) and Task 12 (tile state).

---

## Stage A: the duel match

### Task 1: The Pit map and its scene

**Files:**
- Modify: `src/types.ts`. Add `GameMode.DUEL = 'DUEL'` and `MapId.PIT = 'pit'`.
- Create: `src/game/data/pitMap.ts`, with platforms, pickups, waypoints and the two spawn points.
- Modify: `src/game/data/level.ts`. `getPlatforms`, `getWaypoints` and `getInitialPickups` branch on `GameMode.DUEL` and delegate to `pitMap.ts`.
- Create: `src/game/render/scene/themes/pitTheme.ts`, which is `stationTheme()` with `adPlaces: PIT_AD_PLACES`.
- Modify:
  - `src/game/render/scene/mapLook.ts`: `MapTheme` gets `'pit'`, and `themeFor` returns `'pit'` for `GameMode.DUEL`.
  - `src/components/ads/adsDraft.ts`: add `PIT_AD_PLACES` to `AD_PLACES`.
  - `public/ads.json`: add both pit places, disabled, with empty code.
- Modify:
  - `src/components/menu/modeInfo.ts` and `src/components/menu/ModePreview.tsx`: add DUEL entries required by `Record<GameMode,…>`. Use short EN/RU text and reuse the deathmatch scene.
  - `src/components/menu/ModeList.tsx`: filter `GameMode.DUEL` out, because DUEL is tournament-only.
- Test: `src/game/data/pitMap.test.ts`.

**Interfaces:**
- Produces:
  - `PIT_PLATFORMS: Omit<Platform,'id'>[]`
  - `PIT_PICKUPS: Pickup[]`
  - `PIT_WAYPOINTS: Vector2[]`
  - `PIT_SPAWNS: readonly [Vector2, Vector2]` (left, right; feet position)
  - `PIT_AD_PLACES: AdPlace[]`

Layout, from approved sketch A in `.superpowers/brainstorm/84054-1793777213/content/arena-layouts.html`:
- A closed box, about 2600×1400. The interior is x 0..2600 and y 0..1400. Walls and ceiling are 200 thick, and the floor top is at y 1300.
- It is mirrored about x 1300. Each side has a tower with ledges at about y 1050 and y 750. There are stacked centre platforms at about y 1100, y 850 and y 600, and two small high ledges at about y 400.
- Pickups are health 25, armor 50 and ammo, at the centre platforms. Fighters are 30×72.

- [ ] **Step 1: Write the failing tests** in `pitMap.test.ts`:
  - `it('is mirrored about x=1300')`: for every platform `p` there is a `q` with `q.x === 2600 - p.x - p.w && q.y === p.y && q.w === p.w && q.h === p.h`.
  - `it('fits a 2600x1400 box')`: every platform lies within x −200..2800 and y −200..1600, and the floor top is at `1300`.
  - `it('has no weapon pickups')`: `PIT_PICKUPS.every(p => p.type !== ItemType.WEAPON)`, and the types include HEALTH, ARMOR and AMMO.
  - `it('spawns stand on the floor at mirrored x')`: `PIT_SPAWNS[0].y === 1300`, and `PIT_SPAWNS[1].x === 2600 - PIT_SPAWNS[0].x`.
  - `it('getPlatforms(DUEL) returns the pit')`: `getPlatforms(GameMode.DUEL, MapId.PIT).length === PIT_PLATFORMS.length`.
  - `it('themeFor(DUEL) is pit')`.
- [ ] **Step 2:** Run `npx vitest run src/game/data/pitMap.test.ts`. Expect FAIL (module not found).
- [ ] **Step 3:** Implement the data and the hooks listed under Files. Waypoints are each platform's top centre minus 20, plus floor points every 300 px, following the `getWaypoints` pattern.
- [ ] **Step 4:** Run the same command, then `npx tsc --noEmit`. Expect PASS and no type errors.
- [ ] **Step 5:** Run `npm run dev`. Open the browser console and temporarily start an offline DUEL by calling `actions.startGame(GameMode.DUEL)` from React devtools. Check that the Pit draws with the station look and both house posters. Then commit with `feat(tournament): add The Pit duel arena`.

### Task 2: Duel rules in the simulation

**Files:**
- Create: `src/game/systems/duelRules.ts`.
- Modify:
  - `src/game/net/roomSetup.ts`: `spawnPointFor(DUEL)` and `baseEntity` use the duel loadout. `createBots(mode, count?)` defaults to 0 for DUEL.
  - `src/game/systems/physics.ts:49-66`: respawn uses `duelLoadout()` and `duelSpawnPoint(...)` when `state.mode === GameMode.DUEL`.
  - `src/game/systems/matchRound.ts`: `SCORE_LIMIT[DUEL] = 10`. On time with a tie in DUEL, return without ending (sudden death).
  - `src/game/net/room.ts`: `RoomConfig` gets `bots?: number` and `restartMatches?: boolean`. The constructor uses `createBots(config.mode, config.bots)`. In `tick`, the `isMatchOver → resetMatch` step runs only when `config.restartMatches !== false`.
  - `src/game/net/validation.ts:15`: `MAX_WEAPON_SLOTS = 7`.
  - `src/components/GameCanvas.tsx:821`: number keys go `1..7`.
- Test: `src/game/systems/duelRules.test.ts`, `src/game/systems/matchRound.duel.test.ts`, `src/game/net/room.duel.test.ts`.

**Interfaces:**
- Produces:
  - `duelLoadout(): Weapon[]`, in this order: MG, shotgun, railgun, rocket, grenade, smoke, chainsaw. These are fresh copies of `WEAPONS_DATA`.
  - `duelSpawnPoint(state: GameState, playerId: string): Vector2`: the one of `PIT_SPAWNS` farther from the nearest living opponent. With no opponent alive, it alternates by player index.
  - `RoomConfig.bots?: number`
  - `RoomConfig.restartMatches?: boolean`

- [ ] **Step 1: Write the failing tests:**
  - `duelLoadout` has 7 weapons, no `PLASMA_GUN`, MG ammo `999`, and every other weapon's ammo equals `WEAPONS_DATA[type].ammo`. Two calls return different objects, so ammo is never shared.
  - `duelSpawnPoint` puts the fighter on the right spawn when the opponent stands at x 300, and on the left spawn when the opponent is at x 2300.
  - matchRound DUEL:
    - A score of 10 ends the match with `matchEndReason === 'score'`.
    - At `MATCH_TIME_LIMIT` with a 4:4 tie, `matchEndsAt` stays undefined.
    - After that, going to 5:4 ends it with reason `'time'` and the leader as winner.
    - DEATHMATCH with a tie at the time limit still ends with `matchWinner === null`, which is a regression guard.
  - room DUEL:
    - `new GameRoom({mode: DUEL, map: PIT, maxPlayers: 2, restartMatches: false})` has 0 bots. With `bots: 1` it has 1.
    - A joined player's inventory equals the duel loadout.
    - Once a match ends and `MATCH_RESTART_DELAY` passes, scores are **not** reset when `restartMatches: false`.
    - A DEATHMATCH room with no flag still resets, which is a regression guard. Drive time with `vi.useFakeTimers()` and `vi.setSystemTime`, as `room.test.ts` does.
- [ ] **Step 2:** Run `npx vitest run src/game/systems/duelRules.test.ts src/game/systems/matchRound.duel.test.ts src/game/net/room.duel.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement. Bots in DUEL keep their normal AI. The bot looks come from `ffaBotLooks(count)` as before.
- [ ] **Step 4:** Run `npm test`. The full suite must pass, because existing modes must be unchanged.
- [ ] **Step 5:** Commit with `feat(tournament): duel rules — fixed loadout, first to 10, sudden death`.

---

## Stage B: spectators

### Task 3: Spectator connections in RoomHost

**Files:**
- Modify:
  - `src/game/net/protocol.ts`: `MSG.WATCH = 'watch'` and `MSG.WATCHING = 'watching'`. `JoinRejected.reason` gets `'spectators_full'`. Add `export const SPECTATOR_CAP = 6`.
  - `src/game/net/roomHost.ts`: a `spectators: Set<string>`. `WATCH` from a link that has not joined adds it if the set is below `SPECTATOR_CAP`, and replies `WATCHING` with a `WatchAccepted`. Otherwise it rejects with `'spectators_full'`. `update()` sends events and the snapshot to joined links **and** spectators. `disconnect` removes the link from both.
- Test: `src/game/net/roomHost.spectators.test.ts`.

**Interfaces:**
- Produces:
  - `interface WatchAccepted { mode: GameMode; map: MapId; platforms: GameState['platforms']; snapshot: Snapshot }`
  - `RoomHost.spectatorCount: number`

- [ ] **Step 1: Write the failing tests:**
  - A spectator gets `WATCHING` and then snapshots, and `room.state.players` gets no new entity.
  - The 7th watcher gets `JOIN_REJECTED {reason:'spectators_full'}`.
  - `INPUT` from a spectator is ignored, and the room receives no `pushInput`.
  - After a spectator disconnects, a new watcher fits again.
  - A spectator does not count toward `humanCount`.
- [ ] **Step 2:** Run `npx vitest run src/game/net/roomHost.spectators.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expect PASS.
- [ ] **Step 5:** Commit with `feat(net): spectator connections`.

### Task 4: SpectatorSession (client side)

**Files:**
- Create: `src/game/net/spectatorSession.ts`.
- Test: `src/game/net/spectatorSession.test.ts`, using a fake `SessionSocket` built on `EmitterSocket`, like `clientSession` tests do.

**Interfaces:**
- Consumes: `MSG.WATCH`, `MSG.WATCHING`, `WatchAccepted` (Task 3), `SnapshotBuffer` and `interpolateRemotePlayers`, `applyEffectEvent`, `followCamera`.
- Produces:

```ts
export interface SpectatorCallbacks {
    onWatching: (info: WatchAccepted) => void;
    onRejected: (reason: JoinRejected['reason']) => void;
    onEnded: (why: 'disconnected' | 'connection_error') => void;
    onSound: (e: GameEvent) => void; // the caller decides whether this tile is audible
}
export class SpectatorSession {
    constructor(socket: SessionSocket, callbacks: SpectatorCallbacks);
    followId: string | null;                 // null = follow the score leader
    tick(state: GameState, now: number): void; // interpolate everyone, advance cosmetics, move camera
    dispose(): void;
}
```

- Behaviour:
  - It emits `WATCH` on `connect`. On `WATCHING` it fills `state.platforms` and applies the snapshot.
  - Events go straight to `applyEffectEvent(state, e)`, and `SOUND` events go to `onSound`. It **never** emits on the global `gameEvents` bus, because several tiles exist at once.
  - All players are interpolated, with no local prediction. It uses no Matter engine.
- [ ] **Step 1: Write the failing tests:**
  - Emits `watch` on connect.
  - On `watching`, `state.platforms` equals `info.platforms`.
  - An `EFFECT` event adds particles to *this* state and does not fire a `gameEvents` listener.
  - A `SOUND` event calls `onSound`.
  - Disconnect after `watching` calls `onEnded('disconnected')`.
  - With `followId = null`, the camera moves toward the player with the highest score.
- [ ] **Step 2:** Run `npx vitest run src/game/net/spectatorSession.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit with `feat(net): spectator session`.

### Task 5: MatchView, a self-contained renderer for one watched match

**Files:**
- Create: `src/game/render/matchView/matchView.ts`.
- Create: `src/components/tournament/watch/MatchTile.tsx`, the React wrapper that owns a `PeerSocket`, a `SpectatorSession` and a `MatchView`.
- Test: `src/components/tournament/watch/MatchTile.test.tsx`. Mock `matchView` and `PeerSocket`, and test only the tile's states.

**Interfaces:**
- Consumes: `SpectatorSession` (Task 4), `syncVisuals` (`src/game/systems/renderer.ts:410`), `createMapLook`, `createAdsController`, `generateAssets`, `destroyApp`, `viewportOf`.
- Produces:

```ts
export interface MatchView {
    render(state: GameState, now: number): void;
    setAdsEnabled(on: boolean): void;
    destroy(): void;
}
export const createMatchView = (host: HTMLElement): Promise<MatchView>;

export type TileStatus = 'connecting' | 'live' | 'full' | 'ended' | 'host_left';
export interface TileScore { name: string; score: number }
export const MatchTile: React.FC<{ peerId: string; audible: boolean; expanded: boolean; onStatus?: (s: TileStatus) => void; onScore?: (players: TileScore[]) => void }>;
// onScore fires only when a score changes (compare joined "name:score" keys)
```

- `createMatchView`:
  - It creates its own `Application` with `resizeTo: host`, and builds layers the same way as `GameCanvas.tsx:449-492`.
  - It passes `null` for every React setter in `syncVisuals`, plus a throwaway `shakeRef`.
  - It does **not** draw scorch marks, because `marks.ts` is a global list.
  - Ads are only attached while `setAdsEnabled(true)`.
  - Teardown uses `destroyApp(app)`. It must never call `app.destroy(true)` (see memory: pixi-destroy-context).
- `MatchTile` runs its own `requestAnimationFrame` loop of `session.tick` → `view.render`. It plays a `SOUND` through `playSound` only while `audible`. Its status follows the session callbacks.
- [ ] **Step 1: Write the failing tests:**
  - The status moves `connecting` → `live` on `onWatching`.
  - `onRejected('spectators_full')` → `full`.
  - `onEnded('disconnected')` while the last snapshot has `matchEndsAt` set → `ended`. Without it → `host_left`. Neither throws.
  - Unmount calls `view.destroy()` and `session.dispose()` exactly once.
  - `audible={false}` never calls `playSound`.
- [ ] **Step 2:** Run `npx vitest run src/components/tournament/watch/MatchTile.test.tsx`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests, then do a manual check:
  - Host a normal Deathmatch in one tab.
  - Mount `<MatchTile peerId=…>` from a temporary dev route.
  - The match is visible and moves, and closing the host tab shows `host_left`.
  - Remove the temporary route before committing.
- [ ] **Step 5:** Commit with `feat(tournament): match tile renderer for spectators`.

---

## Stage C: the bracket in Supabase

### Task 6: Migration and SQL tests

**Files:**
- Create: `supabase/migrations/20261104000000_tournaments.sql`. Like the accounts file, it is idempotent and safe to run more than once.
- Create: `supabase/tests/tournaments.test.sql`.
- Create: `scripts/test-sql.sh`. It runs `initdb` for a temp cluster in `$TMPDIR`, starts it on port 54329, creates the roles `anon` and `authenticated`, enables `pgcrypto`, loads the migration, runs the test file with `psql -v ON_ERROR_STOP=1`, and stops the cluster on exit using `trap`.

**Schema:**
- `tournaments`
  - Columns: `id uuid pk default gen_random_uuid()`, `name text` (1–32 chars), `status text` (`lobby|running|finished|expired`), `size int null` (4 or 8), `creator_seat int`, `created_at`, `started_at`, `finished_at`, `champion_seat int null`.
- `tournament_seats`
  - Columns: `(tournament_id, seat)` pk, where `seat` is 0..7 in sign-up order and bots get the seats after the humans. `nickname text` (1–16), `is_bot bool`, `bracket_pos int null` (set at start), `secret_hash bytea`, `joined_at`.
- `tournament_matches`
  - Columns: `id uuid pk`, `tournament_id`, `round int` (0 = first), `slot int`, unique `(tournament_id, round, slot)`, `seat_a int null`, `seat_b int null`, `host_seat int null`, `host_peer_id text null`, `status text` (`waiting|ready|done`), `score_a int default 0`, `score_b int default 0`, `winner_seat int null`, `decided_by text null` (`played|walkover|bot`), `ready_at timestamptz null`, `a_seen_at timestamptz null`, `b_seen_at timestamptz null`.
- RLS is enabled on all three tables.
  - `select` is granted to `anon` and `authenticated`. For seats, use column-level grants that **exclude** `secret_hash`.
  - There are no insert, update or delete grants. All writes go through the RPCs below, which are `security definer` with `set search_path = public`.
- Realtime: add only `tournaments` and `tournament_matches` to `supabase_realtime`, guarded so that the publication is skipped when it does not exist (local test cluster). `tournament_seats` stays out, because it holds the seat secrets; every seat change bumps `tournaments.updated_at` instead.

**RPCs:**
- Secrets are 32 random bytes, returned hex-encoded once, and stored as `digest(secret,'sha256')`.
- Every write that needs one checks `seat` plus `secret` and raises `'bad_ticket'` on a mismatch.

| RPC | Effect |
|---|---|
| `create_tournament(p_name, p_nickname) returns json {id, seat, secret}` | First deletes tournaments older than 24 h. The creator gets seat 0. |
| `join_tournament(p_id, p_nickname) returns json {seat, secret}` | Raises `'not_open'` if the status is not lobby or `created_at` is older than 30 min, and `'full'` at 8 seats. |
| `leave_tournament(p_id, p_seat, p_secret)` | Lobby only. Deletes the seat. If it was the creator, `creator_seat` becomes the earliest remaining `joined_at`. With no seats left, the status becomes `expired`. |
| `start_tournament(p_id, p_seat, p_secret)` | Raises `'not_creator'`, `'not_open'` or `'not_enough_players'` (fewer than 2). Sets the size (4 or 8), adds bot seats (nickname `Bot-1`…), shuffles `bracket_pos` with `order by random()`, and creates all matches of every round. Round 0 gets its seats filled. Then it calls `settle(p_id)`. |
| `match_seen(p_match, p_seat, p_secret)` | Heartbeat. Sets `a_seen_at` or `b_seen_at` to `now()`. |
| `publish_host(p_match, p_seat, p_secret, p_peer_id)` | Only `host_seat` may call it. |
| `report_result(p_match, p_seat, p_secret, p_score_a, p_score_b)` | Only `host_seat`, and only when the status is `ready`; otherwise it is a no-op (first decision wins). Sets winner = higher score and `decided_by='played'`, then calls `settle`. |
| `resolve_stale(p_id)` | Callable by anyone. For each `ready` match older than 60 s, a side counts as stale when its `*_seen_at` is null or older than 60 s; bots are never stale. If exactly one human side is stale, the other wins. If both are stale, the winner is random. Uses `decided_by='walkover'`, then calls `settle`. |

- `settle(p_id)` is internal and not granted. It loops until nothing changes:
  - For every `done` match, it fills the winner into the next match `(round+1, slot/2)`, as seat a for an even slot and seat b for an odd slot.
  - A match with both seats set and status `waiting` becomes `ready`, with `ready_at = now()` and `host_seat` = the lower seat number among its human seats.
  - A `ready` match where both seats are bots becomes `done` with a random winner and `decided_by='bot'`.
  - When the final is `done`, the tournament gets `status='finished'`, `finished_at` and `champion_seat`.

- [ ] **Step 1: Write `tournaments.test.sql`** as `do $$ … assert … $$` blocks. Each case starts from a fresh `create_tournament`. Cases:
  - Create, join ×2 and start: the size is 4, there are 4 seats (2 bots), and there are 3 matches.
    - The round-0 matches are `ready`.
    - A bot-vs-bot round-0 match is `done` with `decided_by='bot'`, and its winner is already in round 1.
  - Start with 1 human raises `not_enough_players`. A second start raises `not_open`. Start by a non-creator raises `not_creator`. A wrong secret raises `bad_ticket`.
  - Join after start raises `not_open`. Joining a lobby whose `created_at` is 31 min old raises `not_open`. A 9th join raises `full`.
  - 5 humans give a size-8 bracket with 3 bots and 7 matches.
  - A creator leaving the lobby moves `creator_seat` to the next earliest. The last person leaving gives `expired`.
  - `report_result` by the non-host raises `bad_ticket`. A report by the host sets `played` and advances the winner. A second report is a no-op.
  - `resolve_stale`:
    - Host never seen and guest seen within 60 s, with `ready_at` set 61 s back: the guest wins by `walkover`.
    - Both never seen: a random winner by `walkover`.
    - A match that is only 30 s old is untouched.
    - A `report_result` after a walkover is ignored.
  - Playing a full bracket of 4 to the end gives `finished` and `champion_seat` set.
  - As role `anon`: `select secret_hash from tournament_seats` fails with a permission error, and `insert into tournaments` fails.
- [ ] **Step 2:** Run `bash scripts/test-sql.sh`. Expect FAIL, because the migration is missing.
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Run `bash scripts/test-sql.sh`. Expect all asserts to pass and exit code 0.
- [ ] **Step 5:** Commit with `feat(tournament): bracket tables and RPCs with SQL tests`.

### Task 7: Client API and seat tickets

**Files:**
- Create:
  - `src/tournament/types.ts`
  - `src/tournament/tournamentApi.ts`
  - `src/tournament/seatStore.ts`
  - `src/tournament/tournamentFeed.ts` (Realtime subscription with a polling fallback)
- Test: `src/tournament/tournamentApi.test.ts`, `src/tournament/seatStore.test.ts`, `src/tournament/tournamentFeed.test.ts`. Mock `getSupabase()` the same way `src/account/accountApi.test.ts` does.

**Interfaces:**
- Produces (`types.ts`, camelCase mirrors of the SQL rows):

```ts
export type TournamentStatus = 'lobby' | 'running' | 'finished' | 'expired';
export type MatchStatus = 'waiting' | 'ready' | 'done';
export type DecidedBy = 'played' | 'walkover' | 'bot';
export interface TournamentRow { id: string; name: string; status: TournamentStatus; size: 4 | 8 | null; creatorSeat: number; createdAt: string; startedAt: string | null; finishedAt: string | null; championSeat: number | null }
export interface SeatRow { seat: number; nickname: string; isBot: boolean; bracketPos: number | null; joinedAt: string }
export interface MatchRow { id: string; round: number; slot: number; seatA: number | null; seatB: number | null; hostSeat: number | null; hostPeerId: string | null; status: MatchStatus; scoreA: number; scoreB: number; winnerSeat: number | null; decidedBy: DecidedBy | null; readyAt: string | null }
export interface TournamentSnapshot { tournament: TournamentRow; seats: SeatRow[]; matches: MatchRow[] }
export interface SeatTicket { tournamentId: string; seat: number; secret: string }
export type TournamentErrorCode = 'not_open' | 'full' | 'not_creator' | 'not_enough_players' | 'bad_ticket' | 'offline' | 'unknown';
export class TournamentError extends Error { constructor(readonly code: TournamentErrorCode, message?: string) }
```

- `tournamentApi.ts`: one function per RPC.
  - `createTournament(name, nickname): Promise<SeatTicket>`, `joinTournament(id, nickname): Promise<SeatTicket>`, `leaveTournament(t: SeatTicket)`, `startTournament(t)`, `matchSeen(matchId, t)`, `publishHost(matchId, t, peerId)`, `reportResult(matchId, t, scoreA, scoreB)`, `resolveStale(id)`.
  - Readers: `listOpen(): Promise<TournamentRow[]>`, `loadSnapshot(id): Promise<TournamentSnapshot>`.
  - `listOpen` returns lobbies under 30 min old, running tournaments started under 3 h ago, and finished ones under 10 min old, newest first.
  - Postgres errors map to `TournamentError` by the raised message. A missing client (`getSupabase()` is null) gives `TournamentError('offline')`.
- `seatStore.ts` uses localStorage key `tournamentTickets`.
  - Functions: `saveTicket(t)`, `ticketFor(tournamentId): SeatTicket | null`, `forgetTicket(tournamentId)`.
  - Storage failures are logged and fall back to memory, following the `achievements.ts` storage shim.
- `tournamentFeed.ts`:
  - `watchTournament(id, onSnapshot: (s: TournamentSnapshot) => void): () => void` subscribes to `postgres_changes` on `tournaments` (filtered by `id`) and `tournament_matches` (filtered by `tournament_id`). Seats are not in Realtime: a seat change bumps `tournaments.updated_at`, and the reload reads the seats with a normal select.
  - On any change it reloads with `loadSnapshot`, debounced by 200 ms.
  - If the channel reports `CHANNEL_ERROR` or `TIMED_OUT`, it falls back to polling every 5 s.
  - The returned function unsubscribes and clears timers.
- [ ] **Step 1: Write the failing tests:**
  - Each RPC wrapper passes the exact parameter names (`p_id`, `p_seat`, `p_secret`, …).
  - `'not_open'` from Postgres becomes `TournamentError('not_open')`.
  - A null client gives `'offline'`.
  - The `listOpen` query applies the three time filters.
  - `saveTicket` then `ticketFor` round-trips, and still works after a re-import, which simulates a reload.
  - A throwing `localStorage` still works in memory and logs a warning.
  - The feed debounces a burst of 5 changes into 1 load, switches to polling on `CHANNEL_ERROR`, and the unsubscribe stops both.
- [ ] **Step 2:** Run `npx vitest run src/tournament`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/tournament`. Expect PASS.
- [ ] **Step 5:** Commit with `feat(tournament): client API, seat tickets, live feed`.

### Task 8: Pure bracket logic for the client

**Files:**
- Create: `src/game/tournament/bracketView.ts`, `src/game/tournament/myTurn.ts`, `src/game/tournament/awards.ts`.
- Test: one `*.test.ts` file next to each.

**Interfaces:**
- Consumes: the `types.ts` from Task 7.
- Produces:

```ts
// bracketView.ts — columns for the bracket screen
export interface BracketCell { match: MatchRow; a: SeatRow | null; b: SeatRow | null; live: boolean }
export const bracketColumns = (s: TournamentSnapshot): BracketCell[][]; // [round][slot]; live = status 'ready' && hostPeerId !== null
export const roundName = (round: number, size: 4 | 8): 'quarterfinal' | 'semifinal' | 'final';

// myTurn.ts — what this browser should do now
export type MyTurn =
    | { kind: 'lobby' }
    | { kind: 'host'; match: MatchRow; withBot: boolean }
    | { kind: 'join'; match: MatchRow; peerId: string }
    | { kind: 'wait-host'; match: MatchRow }          // my match is ready, host has not published yet
    | { kind: 'wait-round' }                           // I won, next opponent not decided yet
    | { kind: 'eliminated' }
    | { kind: 'champion' }
    | { kind: 'spectator' };                           // no ticket for this tournament
export const myTurn = (s: TournamentSnapshot, mySeat: number | null): MyTurn;

// awards.ts
export interface TournamentAwards { champion: boolean; finalist: boolean; flawlessMatchIds: string[] }
export const tournamentAwards = (s: TournamentSnapshot, mySeat: number): TournamentAwards;
```

- [ ] **Step 1: Write the failing tests:**
  - `bracketColumns` for size 8 gives column lengths `[4,2,1]`. For size 4 it gives `[2,1]`.
  - `roundName(0,8)` is `'quarterfinal'`, `roundName(0,4)` is `'semifinal'`, and `roundName(2,8)` is `'final'`.
  - `myTurn`:
    - A ready match where I am `hostSeat` returns `host`. `withBot` is true when the other seat `isBot`.
    - A ready match where I am the guest and `hostPeerId` is set returns `join` with that id. Without the id it returns `wait-host`.
    - A lost `done` match returns `eliminated`. Winning the final returns `champion`. A null seat returns `spectator`.
    - The same snapshot gives the same answer for a fresh call, which is the reload case.
  - `tournamentAwards`:
    - A champion whose every win was a `walkover` gets `champion: false, finalist: false`.
    - A played semifinal win followed by a walkover final win gets `champion: true, finalist: true`.
    - A played 10:0 win is listed in `flawlessMatchIds`, while a `walkover` 0:0 is not and a played 10:3 is not.
- [ ] **Step 2:** Run `npx vitest run src/game/tournament`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/game/tournament`. Expect PASS.
- [ ] **Step 5:** Commit with `feat(tournament): bracket view, next-step and awards logic`.

---

## Stage D: screens and the match flow

### Task 9: Navigation, list and lobby

**Files:**
- Modify:
  - `src/store/uiStore.tsx`: add `tournamentNav: TournamentNav | null` with actions `openTournaments()`, `openTournament(id)` and `closeTournaments()`. Add `tournamentMatch: TournamentMatchRun | null` with `startTournamentMatch(run)` and `endTournamentMatch()`.
    - `startTournamentMatch` sets `isPlaying: true`, `selectedMode: DUEL` and `selectedMap: PIT`.
    - `endTournamentMatch` sets `isPlaying: false` and returns to `{ view: 'tournament', id }`.
  - `src/App.tsx`:
    - `?tournament=<uuid>` → `openTournament(id)`.
    - When `tournamentNav` is set and the player is not playing, render `<TournamentScreens />` instead of the menu.
  - `src/components/menu/PlayPanel.tsx`: a **Tournaments** button. It is hidden when `getSupabase()` is null.
- Create:
  - `src/components/tournament/TournamentScreens.tsx`, the router for list, tournament and watch.
  - `TournamentList.tsx`
  - `CreateTournamentForm.tsx`
  - `TournamentLobby.tsx`
  - `src/tournament/useTournament.ts`: the hook over `watchTournament`, plus a `resolveStale` call every 15 s while it is mounted and the status is `running`.
  - `src/i18n/tournamentStrings.ts`
- Test: `TournamentList.test.tsx`, `TournamentLobby.test.tsx`, and `src/store/uiStore.tournament.test.tsx`.

**Interfaces:**
- Produces:

```ts
export type TournamentNav = { view: 'list' } | { view: 'tournament'; id: string } | { view: 'watch'; id: string };
export interface TournamentMatchRun { ticket: SeatTicket; matchId: string; role: 'host' | 'guest'; peerId?: string; withBot: boolean }
export const useTournament: (id: string) => { snapshot: TournamentSnapshot | null; error: TournamentError | null };
```

- The screens follow the approved mockup `.superpowers/brainstorm/84054-1793777213/content/tournament-screens.html`.
- **List:**
  - Rows show the name, the creator nickname and `n/8`, with **Sign up**. Running tournaments show the current round with **Watch**.
  - The list polls `listOpen` every 10 s.
  - **+ Create** asks for a name.
- **Nickname:**
  - Use the logged-in account nickname if there is one, otherwise `state.playerName`.
  - If the name is empty, send the player to the existing customization screen first.
- **Lobby:**
  - 8 tiles, with empty ones reading "free → bot".
  - The rules line reads 1v1 · first to 10 · The Pit.
  - **Copy link** produces `origin + pathname + ?tournament=<id>`.
  - **Start** is shown only to `creatorSeat === myTicket.seat`, and is disabled with fewer than 2 humans.
  - **Leave** calls `leaveTournament` and `forgetTicket`.
  - Errors show their `tournament.error.<code>` string.
- [ ] **Step 1: Write the failing tests:**
  - With a null Supabase client, the Tournaments button is absent.
  - With `listOpen` mocked to 2 rows, the list renders both, and Sign up calls `joinTournament` and saves the ticket.
  - A `'full'` error shows the full message.
  - The lobby shows Start only to the creator, and disables it with 1 human.
  - Copy link writes the `?tournament=` URL.
  - The uiStore round-trip goes `startTournamentMatch` → `isPlaying` → `endTournamentMatch` → back on the tournament view.
  - Every key in `tournamentStrings` exists in both EN and RU.
- [ ] **Step 2:** Run `npx vitest run src/components/tournament src/store/uiStore.tournament.test.tsx`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expect PASS. Then run a manual check at 1512×700 against the real Supabase project with **local** env vars only: create, join from a second browser profile, see both seats, and start. Ask the owner before running the migration on the real project. Until then, check against the local SQL cluster with mocked API responses.
- [ ] **Step 5:** Commit with `feat(tournament): menu entry, list and lobby`.

### Task 10: Bracket screen and running your match

**Files:**
- Create:
  - `src/components/tournament/BracketScreen.tsx`
  - `BracketMatch.tsx`
  - `src/components/tournament/useMyTurn.ts`, which turns `myTurn` into actions
- Create: `src/components/hud/useTournamentMatch.ts`. It is used by `GameCanvas` only when `tournamentMatch` is set.
- Modify: `src/components/GameCanvas.tsx`, in the online setup at `:365-413`.
  - When `state.tournamentMatch` is set, a `host` role creates `HostSession({ mode: DUEL, map: PIT, maxPlayers: 2, bots: withBot ? 1 : 0, restartMatches: false }, …)`. Its `onInviteReady` calls `publishHost`.
  - A `guest` role uses `new PeerSocket(peerId)`.
  - Everything else stays unchanged.
- Test: `useMyTurn.test.tsx`, `useTournamentMatch.test.ts`, `BracketScreen.test.tsx`.

**Interfaces:**
- Consumes: `myTurn` (Task 8), the API (Task 7), and `startTournamentMatch` / `endTournamentMatch` (Task 9).
- Produces: `useTournamentMatch(gameState: MutableRefObject<GameState>, localId: MutableRefObject<string>, run: TournamentMatchRun | null): void`

- **`useMyTurn`:**
  - It acts only on a change of kind or match. `host` → `startTournamentMatch({role:'host', …})`. `join` → `startTournamentMatch({role:'guest', peerId, …})`.
  - While in `wait-host` and `wait-round`, it sends `matchSeen` every 10 s for the ready match, so a waiting guest is never counted as stale.
- **`useTournamentMatch`:**
  - It calls `matchSeen` every 10 s while connected: the host from start, the guest after `onJoined`.
  - When `matchEndsAt` first appears, the host calls `reportResult` with the scores of `seatA` and `seatB`. The host's own entity (`localId`) is `hostSeat`, and the only other entity (human or bot) is the other seat. So `scoreA` is the local score if `hostSeat === seatA`, otherwise the opponent's score.
  - 8 s after the end screen appears, it calls `endTournamentMatch()`.
  - If the opponent's entity is missing for 60 s, it calls `resolveStale` and then `endTournamentMatch()`.
  - On host disconnect, the guest's `onDisconnected` also leads to `endTournamentMatch()`. The bracket's `resolveStale` loop then settles the match.
  - Any API error is logged and shown in the existing `netError` banner. It is never swallowed.
- **BracketScreen:**
  - Columns are quarterfinal, semifinal, final and 🏆.
  - The winner is shown in hazard yellow and the loser struck through.
  - A live match shows a LIVE tag. The database only learns the score at the end, so the bracket screen shows finished scores only. Live scores are shown in the watch screen strip, where they come from `MatchTile.onScore`.
  - The player's own match is outlined.
  - A **Watch** button opens `{view:'watch'}`.
  - Champion and eliminated states show a banner.
- [ ] **Step 1: Write the failing tests:**
  - `useMyTurn` starts a host run exactly once for a stable snapshot. It starts a guest run when `hostPeerId` appears, and starts nothing for `eliminated`.
  - `useTournamentMatch` (fake timers): the host reports `reportResult(id, ticket, 10, 7)` once when `matchEndsAt` is set. `endTournamentMatch` runs 8 s later. A missing opponent for 60 s calls `resolveStale`. A rejected `reportResult` is logged and shown, not thrown.
  - BracketScreen renders 4/2/1 cells for size 8 and outlines my match.
- [ ] **Step 2:** Run `npx vitest run src/components/tournament src/components/hud/useTournamentMatch.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expect PASS. Then the manual test, with 3 browser profiles (2 fighters plus 1 bot seat, so a bracket of 4):
  - Both humans auto-enter their duel.
  - The bot-vs-bot semifinal is already decided.
  - Playing to 10 returns both players to the bracket.
  - The final starts.
  - Closing one fighter's tab mid-match makes the other advance about 60 s later.
- [ ] **Step 5:** Commit with `feat(tournament): bracket screen and automatic match flow`.

### Task 11: Achievements

**Files:**
- Modify: `src/game/systems/achievementDefsMore.ts`. Add the three defs under `SPECIAL_ACHIEVEMENTS`, or under a new `TOURNAMENT_ACHIEVEMENTS` export appended to `ACHIEVEMENTS` in `achievements.ts`.
- Create: `src/tournament/awardTournament.ts`.
- Modify: `BracketScreen.tsx` calls `awardTournament(snapshot, ticket.seat)` whenever the snapshot changes and a ticket exists.
- Test: `src/tournament/awardTournament.test.ts`.

**Interfaces:**
- Consumes: `tournamentAwards` (Task 8), `achievementManager.updateProgress`, `notifyProgressChanged`.
- Produces: `awardTournament(s: TournamentSnapshot, seat: number): void`, which is idempotent through localStorage key `tournamentAwarded` (a set of `champion:<tid>`, `finalist:<tid>` and `flawless:<matchId>`).

- Definitions follow the `survivor` shape:
  - `tournament_champion`: 'Champion', 'Win a tournament', 🏆, legendary, `reward.xp` 1000
  - `tournament_finalist`: 'Finalist', 'Reach a tournament final', 🥈, epic, 400
  - `tournament_flawless`: 'Flawless', 'Win a tournament match 10:0', 🧊, rare, 300
  - All three have category `'special'` and `maxProgress: 1`.
- [ ] **Step 1: Write the failing tests:**
  - A played final win unlocks Champion and Finalist, and calls `notifyProgressChanged` once.
  - Calling it again with the same snapshot changes nothing.
  - An all-walkover champion unlocks nothing.
  - A played 10:0 unlocks Flawless.
  - A throwing `localStorage` still awards once per session and logs a warning.
- [ ] **Step 2:** Run `npx vitest run src/tournament/awardTournament.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expect PASS. Also open the Profile and check that the three achievements are listed.
- [ ] **Step 5:** Commit with `feat(tournament): champion, finalist and flawless achievements`.

### Task 12: Split-screen watch screen

**Files:**
- Create:
  - `src/components/tournament/watch/WatchScreen.tsx`
  - `watchLayout.ts`
  - `WatchStrip.tsx`, the top strip with the bracket and live scores
- Test: `watchLayout.test.ts`, `WatchScreen.test.tsx`. Mock `MatchTile`.

**Interfaces:**
- Consumes: `MatchTile` (Task 5), `useTournament`, `bracketColumns`.
- Produces:

```ts
export type WatchLayout = { cols: 1 | 2; rows: 1 | 2 };
export const layoutFor = (tiles: number, phone: boolean): WatchLayout; // 1→1×1, 2→2×1, 3–4→2×2; phone always 1×1
```

- **Selection:** by default the screen shows every live match (`hostPeerId` set and status `ready`), up to 4. Checkboxes in the strip pick a subset.
- **Expand:** clicking a tile expands it to full screen. Click again, or press Esc, to return.
- **Sound:** exactly one tile is `audible`: the expanded one, otherwise the most recently clicked, otherwise the first.
- **Ads:** `expanded` is passed through, and `MatchView.setAdsEnabled(expanded)`.
- **Phone** (`isTouchDevice()` and height ≤ 500, the same `phone:` breakpoint): one tile, and a horizontal swipe of more than 60 px switches between the selected matches.
- The strip shows each watched match's live score from `MatchTile.onScore`. Matches that are not being watched show LIVE only.
- A tile whose match has finished is replaced with the next live one when the snapshot updates.
- **Back** returns to the bracket.
- [ ] **Step 1: Write the failing tests:**
  - `layoutFor(1,false)` is `{cols:1,rows:1}`, `(2,false)` is `{2,1}`, `(3,false)` and `(4,false)` are `{2,2}`, and `(4,true)` is `{1,1}`.
  - WatchScreen with 3 live matches renders 3 tiles, and exactly one is `audible`.
  - Clicking tile 2 makes it `expanded` and `audible`, and the others are unmounted or hidden. Esc restores the grid.
  - A swipe on phone moves to the next match.
- [ ] **Step 2:** Run `npx vitest run src/components/tournament/watch`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expect PASS. Then the manual test: with 4 browser profiles, run a bracket of 8 (4 humans plus 4 bots). From a 5th profile, Watch it.
  - 2 human matches are visible at once.
  - Expanding a tile shows the pit posters.
  - The frame rate stays playable on the MacBook (F3 stats in a fighter's tab must stay near 120 tps while 4 spectators watch).
  - Record the measured host upload with 6 spectators in the PR. If a fighter's tick rate drops, lower `SPECTATOR_CAP`.
- [ ] **Step 5:** Commit with `feat(tournament): split-screen watching`.

### Task 13: Release

**Files:**
- Modify:
  - `src/components/menu/patchNotes.ts` and `CHANGELOG.md`: the next free `0.4.x`. Check `git fetch && git show origin/main:src/components/menu/patchNotes.ts` first. The patch note has 3–5 points, EN and RU.
  - `docs/supabase-setup.md`: a "Tournaments" section with the owner steps. Run `supabase/migrations/20261104000000_tournaments.sql` in the SQL Editor, then confirm that Realtime is on for ONLY `tournaments` and `tournament_matches` (Database → Publications → `supabase_realtime`) and that `tournament_seats` is off.
  - The spec status becomes `approved 2026-11-04`.
- [ ] **Step 1:** Run `npm test && npx tsc --noEmit && npm run lint && bash scripts/test-sql.sh && npm run build`. Expect everything green.
- [ ] **Step 2:** Run `find src -name '*.ts*' -newer docs/plans/2026-11-04-tournament-plan.md | xargs wc -l | awk '$1>200'`. Expect no output, except the pre-existing `GameCanvas.tsx`.
- [ ] **Step 3:** Commit, push the branch, and open the PR (git-workflow skill). The PR body includes the owner's SQL steps and the measured spectator upload.
  - Merging needs the owner's explicit go-ahead.
  - The owner must run the migration **before** merging, because merging is the release.
