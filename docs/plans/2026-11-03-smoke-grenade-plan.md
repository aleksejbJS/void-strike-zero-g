# Smoke Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A smoke grenade launcher whose round leaves a 10 s cloud that hides fighters from players and bots.

**Architecture:** Clouds are gameplay state (`GameState.smokes`), created and expired by the
authoritative simulation and sent in snapshots. One module (`systems/smoke.ts`) answers "is
this point in smoke" and "does smoke hide B from A"; bot vision and bot chasing ask it, the
renderer draws clouds above everything and hides fighters inside them.

**Tech Stack:** TypeScript, Pixi.js v8, Vitest, React HUD.

**Spec:** `docs/plans/2026-11-03-smoke-grenade-spec.md`

## Global Constraints

- Work in a git worktree on branch `feat/smoke-launcher` (another session may share the main checkout; never switch branches there).
- Files ≤ 200 lines, one responsibility, named exports, no silent catches. `physics.ts` (424 lines) and `renderer.ts` (513) only get call sites, no new logic.
- Code comments and commits in English.
- Values: duration 10000 ms, fade 2000 ms, radius 110 px, max 12 clouds, damage 1, knockback 0, ammo 4 / max 8, fire rate 1500 ms, colour grey `#9ca3af`, fuse and gravity as the grenade (life 60 ticks, `vel.y += 0.25`).
- `GameState.smokes` is optional; every reader uses `state.smokes ?? []`.
- Bots never pick up or fire the smoke launcher; not in `GUN_GAME_LADDER`.
- Walls keep today's bot behaviour: only smoke hides a position.
- Run `npm test`, `npx tsc --noEmit` and `npm run lint` before each commit.

## Review Focus

- A bot standing inside a cloud must still see and shoot an enemy outside it (test in Task 3).
- A round fired straight down at your own feet bursts on the floor at once and the cloud covers you (test in Task 2).
- Online client: clouds come only from snapshots, so a client never spawns or expires its own (test in Task 2: snapshot carries `smokes`; client code adds no spawn).
- Without any smoke, bot behaviour is bit-for-bit unchanged — existing bot tests and `botBenchmark.test.ts` pass untouched (Task 4).
- A cloud in its fade: hiding radius shrinks with the drawn cloud, so a fighter at the edge reappears for bots when they reappear on screen (test in Task 1 + shared `smokeRadiusAt` in Tasks 3 and 5).

---

### Task 1: Weapon data and smoke cloud model

**Files:**
- Modify: `src/types.ts` (WeaponType, SmokeCloud, GameState)
- Modify: `src/constants.ts` (WEAPONS_DATA, smoke constants)
- Create: `src/game/systems/smoke.ts`
- Test: `src/game/systems/smoke.test.ts`

**Interfaces:**
- Produces:
  - `WeaponType.SMOKE_LAUNCHER = 'SMOKE_LAUNCHER'`
  - `interface SmokeCloud { id: string; pos: Vector2; radius: number; bornAt: number; endsAt: number }`; `GameState.smokes?: SmokeCloud[]`
  - constants `SMOKE_DURATION_MS = 10000`, `SMOKE_FADE_MS = 2000`, `SMOKE_RADIUS = 110`, `MAX_SMOKES = 12`
  - `spawnSmoke(state: GameState, pos: Vector2, now: number): SmokeCloud` — creates `state.smokes` if missing, drops the oldest when at `MAX_SMOKES`
  - `updateSmokes(state: GameState, now: number): void` — removes clouds with `now >= endsAt`
  - `smokeRadiusAt(cloud: SmokeCloud, now: number): number` — full radius until `endsAt - SMOKE_FADE_MS`, then linear to 0 at `endsAt`
  - `insideSmoke(state: GameState, point: Vector2, now: number): boolean`
  - `smokeHides(state: GameState, from: Vector2, to: Vector2, now: number): boolean` — true if `to` is inside a cloud, or segment `from→to` crosses a cloud that does not contain `from`

- [ ] **Step 1: Write failing tests** in `smoke.test.ts`:
  - `spawnSmoke` on a state without `smokes` → one cloud, `radius 110`, `endsAt - bornAt === 10000`
  - 13 spawns → 12 clouds, the first id gone
  - `smokeRadiusAt` at `bornAt + 7000` → 110; at `bornAt + 9000` → 55; at `endsAt` → 0
  - `updateSmokes` at `bornAt + 9999` keeps it, at `bornAt + 10000` removes it
  - `insideSmoke` true at centre and at 100 px, false at 120 px
  - `smokeHides`: target inside → true; line through a cloud between them → true; line passing 150 px beside a cloud → false; `from` inside the cloud, `to` outside beyond it → false; no clouds → false
- [ ] **Step 2:** `npx vitest run src/game/systems/smoke.test.ts` → FAIL (module missing)
- [ ] **Step 3:** Add the types, `WEAPONS_DATA[SMOKE_LAUNCHER]` (name `'Smoke Launcher'`, values from Global Constraints, speed 14 like the grenade), constants, and `smoke.ts` (segment-to-circle distance helper local to the file).
- [ ] **Step 4:** Test passes. `npx tsc --noEmit` now lists every `Record<WeaponType, …>` missing the new key — add minimal entries so it compiles: `weaponGrips.ts` (copy the grenade grip), `hudIcons.ts` (`assets/hud/smoke_launcher.svg`), `weaponLabel.ts` (`'weapon.smokeLauncher'` + EN "Smoke Launcher" / RU "Дымовой гранатомёт" in `src/i18n/locales.ts`). The icon file itself is Task 5.
- [ ] **Step 5:** Commit `feat(smoke): smoke launcher weapon and smoke cloud model`

### Task 2: Simulation — fire, burst, expire, sync

**Files:**
- Modify: `src/game/systems/combat.ts:282` (fuse life), `src/game/systems/physics.ts:22-27, 328-345` (gravity, burst, per-tick `updateSmokes`)
- Modify: `src/game/net/protocol.ts` (Snapshot + buildSnapshot), `src/game/net/roomSetup.ts:51`, `src/components/GameCanvas.tsx:232` (`smokes: []` in fresh states)
- Modify: `src/game/render/projectiles/projectileMemory.ts:67` (grenade life total for smoke too)
- Test: `src/game/systems/smoke.physics.test.ts`, extend `src/game/net/room.test.ts` or protocol test

**Interfaces:**
- Consumes: `spawnSmoke`, `updateSmokes` (Task 1)

- [ ] **Step 1: Write failing tests** (build state like `physics.hits.test.ts` does):
  - smoke round hitting a wall → projectile gone, one cloud at the near side of the wall, no explosion (no fighter loses more than 0 HP, no `EFFECT` explosion event)
  - direct hit on an enemy at 100 HP, no armor → 99 HP, velocity unchanged, one cloud
  - round in open air → cloud after 60 ticks
  - fired straight down (aim +90°) from a grounded fighter → cloud within 3 ticks, `insideSmoke` true at the fighter's centre
  - `updatePhysics` with a cloud whose `endsAt` has passed → removed
  - a machine-gun round fired through a cloud still hits the enemy behind it
  - `buildSnapshot(state).smokes` equals `state.smokes`
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement. In the hit block: smoke rounds call `spawnSmoke(state, impact, now)` instead of `createExplosion`, no spark; keep blood on a fighter hit. `moveProjectile` gives smoke the grenade gravity; the fuse check covers both types. Burst sound: reuse an existing soft sound (builder's call).
- [ ] **Step 4:** Run → PASS; full `npm test` green
- [ ] **Step 5:** Commit `feat(smoke): smoke rounds burst into synced clouds`

### Task 3: Bots cannot see through smoke

**Files:**
- Modify: `src/game/systems/botSenses.ts` (`canSee`)
- Test: `src/game/systems/botSenses.smoke.test.ts`

**Interfaces:**
- Consumes: `smokeHides` (Task 1)
- Produces: `canSee(state, bot, other, now = Date.now())` — existing checks `&& !smokeHides(state, muzzleOf(bot), centerOf(other), now)`

- [ ] **Step 1: Write failing tests:** open floor, bot and enemy 300 px apart:
  - no smoke → `canSee` true
  - cloud between them → false
  - cloud on the enemy → false
  - cloud on the bot only → true (sees out)
  - cloud past its `endsAt` → true
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement
- [ ] **Step 4:** Run → PASS (bot aim stops firing through `botAim.ts` with no change there)
- [ ] **Step 5:** Commit `feat(smoke): bots cannot see through smoke`

### Task 4: Bots lose a hidden fighter's position; bots ignore the weapon

**Files:**
- Modify: `src/game/systems/botMemory.ts` (`lastSeen: Map<string, Vector2>`, initialised to `new Map()`)
- Create: `src/game/systems/botSearch.ts`
- Modify: `src/game/systems/botGoals.ts` (hunt, CTF defend, HTF enemy holder ×2, Infiltration carrier)
- Modify: `src/game/systems/botWeapons.ts`
- Test: `src/game/systems/botSearch.test.ts`, extend `bot.test.ts` for weapons

**Interfaces:**
- Consumes: `smokeHides` (Task 1)
- Produces:
  - `SEARCH_REACHED = 48` (px)
  - `chasePoint(state: GameState, bot: Entity, mem: BotMemory, target: Entity, now = Date.now()): Vector2 | null` — if smoke does not hide `target` from `muzzleOf(bot)`: store `{...target.pos}` in `mem.lastSeen` and return `target.pos`. Otherwise return the stored spot while the bot is farther than `SEARCH_REACHED` from it; once reached, delete it and return `null`.

- [ ] **Step 1: Write failing tests:**
  - no smoke → returns `target.pos` (same object values), records it
  - target behind a wall (no smoke) → `target.pos` (walls unchanged)
  - target seen at A, then moves to B inside a cloud → returns A, not B
  - bot standing on A (≤ 48 px) → `null`, entry deleted
  - target in smoke never seen before → `null`
  - goals: in CTF with the enemy carrier hidden in smoke, the goal's `moveTarget` is the last-seen spot, not the carrier's position; in Deathmatch `fightOrRoam` with the target hidden and no last-seen spot → `mem.state === 'roam'`
  - weapons: `pickBestWeapon` with machine gun (any ammo) + smoke launcher full → keeps machine gun at every distance 0–1000; `findWeaponPickup` with only a smoke pickup → `null`
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement. In each goal that uses an enemy's `pos`, use `chasePoint`; on `null` skip that branch (fall through to the next objective or `fightOrRoam`'s roam). In `fightOrRoam` the target stays the aim target even while roaming. `scoreWeaponForDistance` returns `-1000` for smoke; `findWeaponPickup` skips smoke pickups.
- [ ] **Step 4:** Run → PASS; whole suite including `botBenchmark.test.ts` green with no edits to existing tests
- [ ] **Step 5:** Commit `feat(smoke): bots search the last-seen spot of a fighter hidden in smoke`

### Task 5: Rendering and HUD

**Files:**
- Create: `src/game/render/effects/smokeView.ts`, `src/game/render/smokeVisibility.ts`, `public/assets/hud/smoke_launcher.svg`
- Modify: `src/game/systems/renderer.ts` (SmokeView after `beamView`, pickup drawing next to the grenade one at :339)
- Modify: `src/game/render/playerVisual.ts` (visibility), `src/game/render/projectiles/projectileLooks.ts` (smoke round)
- Test: `src/game/render/smokeVisibility.test.ts`

**Interfaces:**
- Consumes: `smokeRadiusAt`, `insideSmoke` (Task 1)
- Produces:
  - `fighterSmokeVisibility(inSmoke: boolean, isLocal: boolean): 'shown' | 'hidden' | 'silhouette'`
  - `class SmokeView { constructor(layer: Container); sync(smokes: readonly SmokeCloud[], now: number, silhouette: { x: number; y: number; h: number } | null): void; clear(): void }` — follows `BeamView`: one Graphics, `keepOnTop` every frame so it sits above fighters, projectiles, particles and beams

- [ ] **Step 1: Write failing test** for `fighterSmokeVisibility`: (false, *) → shown; (true, false) → hidden; (true, true) → silhouette
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement:
  - `playerVisual.ts`: fighter centre in smoke → other fighters `c.visible = false` (hides body, rope, carried flag); local fighter stays drawn normally (covered by the cloud).
  - `SmokeView`: per cloud an opaque core (radius × 0.75, alpha ≈ 0.95) plus ~10 grey puffs at offsets seeded from the cloud id, gently drifting with `now`; whole cloud scaled by `smokeRadiusAt / radius` and alpha fading in the last 2 s. The silhouette is a faint white outline of the local fighter's hitbox drawn on top of the clouds.
  - `renderer.ts`: create and sync SmokeView last, passing the local fighter as silhouette only when it is in smoke.
  - Grey grenade-style projectile; grey pickup sprite; SVG icon in the HUD icon style (grey launcher with a puff).
- [ ] **Step 4:** Tests pass; `npm run dev`, Deathmatch with bots at 1512×700: pick up the launcher, fire at your feet, check you show as an outline, a bot inside a cloud disappears, the cloud thins out after ~8 s and is gone at 10 s. Screenshot for the PR.
- [ ] **Step 5:** Commit `feat(smoke): draw smoke clouds and hide fighters inside them`

### Task 6: Maps and release notes

**Files:**
- Modify: `src/game/data/level.ts` (`getInitialPickups`)
- Modify: `src/components/menu/patchNotes.ts`, `CHANGELOG.md`
- Test: `src/game/data/smokePickups.test.ts`

- [ ] **Step 1: Write failing test:** for every `GameMode` except `GUN_GAME` (and Deathmatch on each `MapId` it supports) `getInitialPickups` has exactly one `SMOKE_LAUNCHER` weapon pickup, and it is not inside a platform of that layout; Gun Game has none.
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Add one pickup per layout near cover or a flag (ids `*_smoke`). Patch note (EN + RU) for the next free 0.4.x: "Smoke launcher: fire a smoke cloud anywhere and hide for 10 seconds — from players and bots". CHANGELOG entry with the technical detail.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green
- [ ] **Step 5:** Commit `feat(smoke): place smoke launchers on the maps (0.4.x)`; push and open the PR
