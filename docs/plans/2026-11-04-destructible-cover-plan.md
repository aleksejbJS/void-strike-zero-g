# Destructible Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wooden/metal crates, glass panels and explosive barrels on every platform layout: solid until broken, damaged by every weapon, barrels explode, everything returns after 35 s, bots use them, works offline / Node server / browser host.

**Architecture:** A new `src/game/cover/` module owns the data (layouts, specs), geometry (rects, solidity, segment hits), damage, barrel blasts and the per-tick respawn. The shared simulation calls into it from a few hooks (projectiles, railgun, chainsaw, explosions, applyDamage). `MatterPhysicsEngine` keeps one static body per intact cover, synced from `state.cover` in `syncFromGameState`. The net layer sends the layout once (join) and a compact `coverStatus` per snapshot. Rendering bakes one Pixi texture per kind × stage from canvas code ported from the mockup; a `CoverView` shows them.

**Tech Stack:** TypeScript, Vitest, Pixi.js v8, Matter.js (collision only), socket.io / PeerJS (unchanged).

**Spec:** `docs/plans/2026-11-04-destructible-cover-spec.md` · **Mockup (art source):** `docs/plans/2026-11-04-destructible-cover-mockup.html` (live: https://claude.ai/artifact/4EVuUYbCh3XT4ZmvH5EDc6)

## Global Constraints

- Branch `feature/destructible-cover` from **`origin/main`** (≥ 0.4.29; spawn shield is 0.4.28) in a **git worktree** under the scratchpad. Never switch branches in the main checkout (another session uses it). In the worktree run a real `npm ci` and `npm ci` in `server/`.
- Coordinates: cover `pos = (centerX, bottomY)`; rect `{ x: pos.x - w/2, y: pos.y - h, w, h }`; Matter body centre `(pos.x, pos.y - h/2)`.
- Sizes/HP: wood 50×46 / 150, metal 50×46 / 500, glass 16×90 / 60, barrel 32×46 / 80.
- Explosions vs cover ×3; direct-hit cover takes full `damage × 3` (no falloff). Barrel blast: radius 170, damage 90, hurts **everyone** at full damage. Chain delay 150 ms. Return 35 000 ms, hologram 2 000 ms before, retry 500 ms.
- Stages: `hp > 66%` → 0, `> 33%` → 1, `> 0` → 2, `0` → 3 (destroyed).
- Simulation lives in `src/game/` (server imports it). 120 ticks/s (`FIXED_STEP_MS`). Matter is collision-only.
- Files ≤ 200 lines, one responsibility, named exports, no silent catches. `combat.ts` (320) and `physics.ts` (443) are already over: **add only call sites there**, logic goes to new files (Task 4 moves `createExplosion` out of `combat.ts`).
- Every visible string EN + RU (`src/i18n/locales.ts`).
- Verify with `npm test`, `npx tsc --noEmit`, `npm run build`, and `cd server && npx tsc --noEmit`.
- Commits in English; one PR; release 0.4.x with the patch note from the mockup.

## Review Focus

1. A barrel hit by a bullet and a blast in the same tick explodes **once** (Task 5 test `explodes once when broken twice in one tick`).
2. A dead fighter's body on a returning crate's spot does not block the return; a live one does (Task 3 test `dead fighters do not block a return`).
3. A fighter standing on a crate when it breaks falls; it is not left grounded in the air (Task 2 test `fighter on a crate falls when it breaks`).
4. A client joining while a crate is broken sees it broken and has no body for it; an older host without cover gives an empty list, not a crash (Task 6 tests `join mid-match keeps broken cover broken`, `host without cover`).
5. A match/round reset while a barrel fuse is pending: no explosion after the reset (Task 3 test `reset clears pending fuses`).

---

### Task 1: Cover data, layouts and state wiring

**Files:**
- Create: `src/game/cover/coverTypes.ts`, `src/game/cover/coverLayouts.ts` (data only), `src/game/cover/coverLayout.ts`
- Modify: `src/types.ts` (one field on `GameState`), `src/game/net/roomSetup.ts` (`createRoomState`), `src/components/GameCanvas.tsx` (`initLevel`)
- Test: `src/game/cover/coverLayout.test.ts`

**Interfaces:**
- Produces (`coverTypes.ts`):
  - `type CoverKind = 'wood' | 'metal' | 'glass' | 'barrel'`
  - `interface CoverSpec { w: number; h: number; hp: number; blocksSight: boolean; stopsRail: boolean }` and `COVER_SPECS: Record<CoverKind, CoverSpec>` (sight/rail: wood true/false, metal true/true, glass false/false, barrel true/true)
  - `interface Cover { id: string; kind: CoverKind; pos: Vector2; hp: number; returnsAt?: number; fuseAt?: number; creditId?: string }`
  - `interface CoverStatus { id: string; hp: number; returnsAt?: number }`
  - `type CoverStage = 0 | 1 | 2 | 3`
  - constants `COVER_EXPLOSIVE_MULT = 3`, `COVER_RETURN_MS = 35000`, `COVER_WARN_MS = 2000`, `COVER_RETRY_MS = 500`, `BARREL_RADIUS = 170`, `BARREL_DAMAGE = 90`, `BARREL_CHAIN_MS = 150`
- Produces (`coverLayout.ts`): `layoutKeyFor(mode: GameMode, map: MapId): CoverLayoutKey | null` (mirrors `getPlatforms` branching; `DUEL` → null) and `getCoverLayout(mode: GameMode, map: MapId): Cover[]` (full HP, ids `cover_<key>_<index>`, fresh objects every call).
- Produces: `GameState.cover?: Cover[]` (readers use `state.cover ?? []`).

- [ ] **Step 1: Write the failing tests** in `coverLayout.test.ts`, iterating over every mode × map that `getPlatforms` distinguishes (DM default, DM tunnels, HUNGER, CTF, GUN_GAME, HTF, INFILTRATION, DUEL):
  - `every object stands on a platform top` — bottom `pos.y` equals some platform's `y`, and its rect lies within that platform's `x..x+w`.
  - `no object overlaps a platform or another object` (rect intersection, touching allowed).
  - `no object overlaps a pickup` — use the same pickup collection rect `physics.ts` uses.
  - `barrels keep 400 px from flags and fixed spawns` — straight line to flag pickups/`HTF_FLAG_POS`/`INTEL_POS`; horizontal distance to fixed team spawn x-ranges (`getSpawnPoint` BLUE −400..−200 / RED 2200..2400 for HTF and Infiltration; `ctfSpawnPoint` ranges for CTF).
  - `duel has no cover`, `ids are unique and stable between calls`, `counts per layout` (expected counts after the fixes below).
- [ ] **Step 2: Run** `npx vitest run src/game/cover` — FAIL (module missing).
- [ ] **Step 3: Implement.** Data in `coverLayouts.ts` is the spec's table with the spec's "Known fixes" applied; for the four "slide per the rule" entries (CTF/HtF metal −230/2230 on y 500, HtF wood 880,550, Infiltration wood 830,350 and 1420→1430,500) pick the smallest slide along the platform that passes the pickup test, sliding the mirror partner by the same amount. Add `cover: getCoverLayout(mode, map)` to `createRoomState`, and `gameState.current.cover = getCoverLayout(gameMode, effectiveMap)` in `GameCanvas.initLevel` next to `platforms`.
- [ ] **Step 4: Run** `npx vitest run src/game/cover` and `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(cover): cover kinds, per-map layouts and state field`

### Task 2: Solid cover in collision and grounding

**Files:**
- Create: `src/game/cover/coverGeometry.ts`
- Modify: `src/game/physics/MatterEngine.ts`, `src/game/net/room.ts` (`syncBodies`), `src/game/net/clientSession.ts` (`predict`, body pruning in `applySnapshot`)
- Test: `src/game/cover/coverGeometry.test.ts`, `src/game/physics/MatterEngine.test.ts`

**Interfaces:**
- Produces (`coverGeometry.ts`): `coverRect(c: Cover): Rect`, `isIntact(c: Cover): boolean` (`hp > 0`), `coverStage(c: Cover): CoverStage`, `intactCover(state: Pick<GameState,'cover'>): Cover[]`, `firstCoverOnSegment(state, a: Vector2, b: Vector2, filter?: (c: Cover) => boolean): { cover: Cover; t: number } | null` (uses `segmentRectEntry`), `sightBlocks(state, a, b): boolean` (any intact cover with `blocksSight` crossed), `blastBlocks(state, a, b, exceptId?: string): boolean` (platforms or any intact cover crossed).
- Produces (MatterEngine): `syncFromGameState(state: { players: Entity[]; cover?: Cover[] })` also adds a static body (via the `addPlatform` recipe, id = cover id) for each intact cover without one and removes bodies of broken cover; `syncGameState(state: { platforms; players; cover? })` counts intact cover rects as platform tops in `standsOnPlatform`.

- [ ] **Step 1: Write failing tests:** `coverStage` thresholds for wood (hp 150 → 0, 100 → 0, 99 → 1, 50 → 1, 49 → 2, 1 → 2, 0 → 3); `firstCoverOnSegment` returns nearest and honours `filter`; `sightBlocks` true through wood, false through glass, false through broken wood. MatterEngine: `fighter lands on a crate` (drop a player above wood, step ~120 ticks with the Force Pipeline's gravity simulated as in `grounding.test.ts`, feet end at crate top ±4, `isGrounded`), `fighter on a crate falls when it breaks` (set hp 0, sync, step: body removed, player falls below crate top, not grounded mid-air).
- [ ] **Step 2: Run** `npx vitest run src/game/cover src/game/physics` — FAIL.
- [ ] **Step 3: Implement** the geometry helpers and the MatterEngine sync. In `room.syncBodies` keep cover ids; in `ClientSession.predict` pass `cover: state.cover` to both `syncFromGameState` calls and to `syncGameState`; in `applySnapshot` body pruning keep ids present in `state.cover`.
- [ ] **Step 4: Run** the same tests + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(cover): cover is solid for fighters and counts as ground`

### Task 3: Damage, breaking, return and resets

**Files:**
- Create: `src/game/cover/coverDamage.ts`, `src/game/cover/coverTick.ts`
- Modify: `src/game/systems/events.ts` (one event variant), `src/game/systems/physics.ts` (one call: `tickCover(state, now)` after the projectile loop), `src/game/net/roomSetup.ts` (`resetMatch`, `resetHungerRound`)
- Test: `src/game/cover/coverDamage.test.ts`, `src/game/cover/coverTick.test.ts`

**Interfaces:**
- Produces: event `{ type: 'COVER'; action: 'hit' | 'break' | 'restore'; kind: CoverKind; x: number; y: number }` and sound event `{ type: 'SOUND'; sound: 'cover'; subtype: \`${CoverKind}:${'hit' | 'break'}\` }`.
- Produces (`coverDamage.ts`): `damageCover(state: GameState, cover: Cover, amount: number, creditId: string, now: number, viaBlast = false): void` — no-op if not intact or `amount <= 0`; lowers hp (min 0); on 0: `returnsAt = now + COVER_RETURN_MS`, emits `break`; a barrel also gets `fuseAt = now + (viaBlast ? BARREL_CHAIN_MS : 0)` and `creditId` (first breaker wins); otherwise emits `hit`.
- Produces (`coverTick.ts`): `tickCover(state: GameState, now: number): void` — explodes barrels whose `fuseAt <= now` (calls `explodeBarrel` from Task 5; until then a stub that only clears `fuseAt`), returns cover whose `returnsAt <= now` when no **live** fighter overlaps its rect (else `returnsAt = now + COVER_RETRY_MS`), emits `restore`; `restoreAllCover(state: GameState): void` — full HP, clears `returnsAt`/`fuseAt`/`creditId`.

- [ ] **Step 1: Write failing tests:** `breaks at zero and schedules the return`, `extra damage on broken cover is ignored`, `barrel broken by a shot fuses now, by a blast 150 ms later`, `first breaker keeps the credit`, `returns after 35 s at full hp`, `a live fighter on the spot delays the return by 500 ms`, `dead fighters do not block a return`, `reset clears pending fuses` (`restoreAllCover` then `tickCover` far in the future: no explosion event), `resetMatch and resetHungerRound restore cover`.
- [ ] **Step 2: Run** `npx vitest run src/game/cover` — FAIL.
- [ ] **Step 3: Implement**; call `restoreAllCover` from `resetMatch` and `resetHungerRound`.
- [ ] **Step 4: Run** tests + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(cover): cover takes damage, breaks and comes back`

### Task 4: Weapons hit cover

**Files:**
- Create: `src/game/systems/explosion.ts` (moved `createExplosion`), `src/game/cover/coverHits.ts`
- Modify: `src/game/systems/combat.ts` (remove `createExplosion`, re-export it from `explosion.ts` so imports keep working; railgun and chainsaw call sites), `src/game/systems/physics.ts` (projectile loop call site)
- Test: `src/game/cover/coverHits.test.ts` (table), existing `combat.test.ts` / `physics.*.test.ts` must stay green

**Interfaces:**
- Consumes: `damageCover`, `firstCoverOnSegment`, `blastBlocks`.
- Produces (`explosion.ts`): `createExplosion(state, pos, ownerId, radius, weaponType?, directId?, opts: { directCoverId?: string; barrel?: boolean; damage?: number } = {})` — fighters' line-of-sight test uses `blastBlocks` (platforms + intact cover); after the fighter loop calls `blastCover`.
- Produces (`coverHits.ts`): `blastCover(state, pos: Vector2, radius: number, damage: number, creditId: string, now: number, directCoverId?: string): void` (direct cover: `damage × 3`; others in radius whose centre the blast reaches past platforms: `damage × 3 × (1 − dist/radius)`; `viaBlast = true`), `railThroughCover(state, origin, end, closestT, shooterId, now): number` (returns the new stop `t`: nearest `stopsRail` cover before `closestT`; damages every non-stopping cover crossed before the stop and the stopping one, 200 each), `chainsawCover(state, attackPos, shooterId, now): void` (cover whose rect is within 40 px of `attackPos`, 30 per tick).
- Projectile loop: an intact cover on `prevPos → pos` counts as a wall (nearest of platform/cover entry wins); explosives call `createExplosion(..., { directCoverId })`; non-explosive, non-smoke projectiles call `damageCover(state, cover, WEAPONS_DATA[type].damage, ownerId, now)`; smoke rounds do no damage.

- [ ] **Step 1: Write the failing table test** `shots to break match the mockup`: for each weapon × kind fire repeatedly at a fresh cover (using real `fireWeapon`/projectile stepping or the hit helpers) and assert hit counts — MG wood 25 / metal 84 / glass 10 / barrel 14; shotgun (6 pellets × 5, all hitting at point blank) 5 / 17 / 2 / 3; plasma 11 / 36 / 5 / 6; rocket 1 / 3 / 1 / 1; grenade 1 / 3 / 1 / 1; railgun 1 / 3 / 1 / 1; chainsaw ticks 5 / 17 / 2 / 3; smoke launcher never breaks anything. Plus: `rail passes wood and glass and hits the fighter behind`, `rail stops in metal`, `blast behind a platform does not reach cover`, `a fighter behind an intact crate is shielded from a blast`, `grapple hook passes through cover` (`castRay` stays platforms-only).
- [ ] **Step 2: Run** `npx vitest run src/game/cover src/game/systems` — FAIL.
- [ ] **Step 3: Implement** (move `createExplosion` first and run the existing suite before adding cover logic).
- [ ] **Step 4: Run** `npm test` + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(cover): bullets, blasts, railgun and chainsaw damage cover`

### Task 5: Barrel explosions and kill credit

**Files:**
- Create: `src/game/cover/barrel.ts`
- Modify: `src/game/systems/deathKind.ts` (`DamageSource.barrel?: boolean`; `isSplash` and `deathKind` treat `barrel` like a rocket splash), `src/game/systems/combat.ts` (`applyDamage`: 4 small conditions), `src/game/cover/coverTick.ts` (replace the stub), `src/components/hud/weaponLabel.ts`, `src/i18n/locales.ts`
- Test: `src/game/cover/barrel.test.ts`

**Interfaces:**
- Produces: `explodeBarrel(state: GameState, barrel: Cover, now: number): void` — clears `fuseAt`, calls `createExplosion(state, barrelCentre, barrel.creditId ?? '', BARREL_RADIUS, undefined, undefined, { barrel: true, damage: BARREL_DAMAGE })`. With `opts.barrel`: no teammate skip, `source.barrel = true`; blast on cover passes `creditId` so chains keep the first breaker.
- `applyDamage` with `source.barrel`: no self-damage/knockback halving; KILL event `weapon: BARREL_KILL_NAME` (`'Barrel'`); score only when `killer.id !== target.id && !isTeammate(killer, target)` (applies to every source); no `handleGunGameKill`, no `trackKill`.
- `weaponLabel(t, 'Barrel')` → key `'weapon.barrel'`: EN `Barrel`, RU `Бочка`.

- [ ] **Step 1: Write failing tests:** `blast hurts teammates and the breaker at full damage`, `kill is credited to the breaker and shown as Barrel`, `chain of two barrels credits the first breaker, second explodes 150 ms later`, `explodes once when broken twice in one tick`, `team kill and self kill by barrel give no score`, `gun game ladder does not advance on a barrel kill`, `barrel kill does not count for weapon achievements`.
- [ ] **Step 2: Run** `npx vitest run src/game/cover src/game/systems` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(cover): explosive barrels hurt everyone and credit the breaker`

### Task 6: Network sync

**Files:**
- Create: `src/game/cover/coverNet.ts`
- Modify: `src/game/net/protocol.ts` (`Snapshot`, `JoinAccepted`, `WatchAccepted`, `buildSnapshot`), wherever JoinAccepted/WatchAccepted are built (`roomHost.ts`), `src/game/net/clock.ts`, `src/game/net/clientSession.ts` (`setupWorld`, `applySnapshot`), `src/game/net/spectatorSession.ts`
- Test: `src/game/cover/coverNet.test.ts`, extend `src/game/net/clock.test.ts`, `src/game/net/roomHost.test.ts`

**Interfaces:**
- Produces: `Snapshot` gains `coverStatus?: CoverStatus[]` (not a `GameState` key, so `Object.assign(state, shared)` must not copy it — destructure it out); `JoinAccepted.cover?: Cover[]`, `WatchAccepted.cover?: Cover[]`.
- Produces (`coverNet.ts`): `coverStatusOf(cover: Cover[]): CoverStatus[]`, `applyCoverStatus(cover: Cover[], status: CoverStatus[] | undefined): void` (by id; unknown ids ignored; missing status leaves cover as it is).
- `toLocalClock` shifts each `coverStatus[i].returnsAt`.
- Client: `setupWorld` sets `state.cover = info.cover ?? []` (bodies come from Task 2's sync).

- [ ] **Step 1: Write failing tests:** `snapshot carries hp and returnsAt only`, `join mid-match keeps broken cover broken` (room with a broken crate → JoinAccepted + snapshot → client state has hp 0 and the client MatterEngine has no body for it), `host without cover` (`info.cover` undefined → `state.cover` is `[]`, no throw), `clock shifts returnsAt`, `unknown ids are ignored`.
- [ ] **Step 2: Run** `npx vitest run src/game/cover src/game/net` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `cd server && npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(cover): send cover layout on join and its state in snapshots`

### Task 7: Look, effects and sound

**Files:**
- Create in `src/game/render/cover/`: `coverArtKit.ts` (helpers the mockup adds on top of `scene/canvasKit.ts`: `streaks`, `bevel`, `split`, `radialCracks`, `lin`, `poly`, `jaggedPts`, `contact`), `woodArt.ts`, `metalArt.ts`, `glassArt.ts`, `barrelArt.ts` (each `draw<Kind>(ctx, cx, fy, stage: CoverStage, seed: number)`, `barrelArt.ts` also `barrelVent(g: Graphics, cx, fy, t)`), `coverTextures.ts`, `coverView.ts`; `src/game/systems/coverAudio.ts`; `src/game/systems/coverEffects.ts`
- Modify: `src/game/systems/renderer.ts` (`syncVisuals`: create/sync `CoverView` before fighters are drawn), `src/game/systems/effects.ts` (`applyEffectEvent` delegates `COVER` to `coverEffects`), `src/components/GameCanvas.tsx` (visual cache field, `restartRound` + teardown clear like `smokeView`, SOUND `cover` → `playCoverSound`), `src/game/render/matchView/matchViewCache.ts` + `matchView.ts`, `src/components/menu/preview/previewRenderer.ts` only if it builds the same cache
- Test: `src/game/render/cover/coverView.test.ts`, `src/game/systems/coverEffects.test.ts`

**Interfaces:**
- Art source: port `drawWood/drawMetal/drawGlass/drawBarrel`, the `*Debris` functions, `barrelVent`, `holo` and the bake recipe `sprite()` (grain via `overlayNoise`, soft cast shadow offset (+7, −3), blur 5) from the mockup file (lines ~356–670). Reuse `rnd`, `makeCanvas`, `noise`, `overlayNoise`, `glow`, `stencil`, `bolts`, `wornHazard` from `src/game/render/scene/canvasKit.ts` — do not copy them.
- Produces (`coverTextures.ts`): `coverTexture(kind: CoverKind, stage: CoverStage, res: number): { texture: Texture; anchorX: number; anchorY: number }` — baked once per kind × stage × res and cached; `destroyCoverTextures(): void`.
- Produces (`coverView.ts`): `class CoverView { constructor(layer: Container); sync(cover: readonly Cover[], now: number): void; clear(): void }` — one Sprite per cover id with the texture of its stage; destroyed cover shows its stage-3 remains; from `returnsAt − COVER_WARN_MS` a blinking dashed hazard-yellow outline with a progress ring (Graphics); a stage-2 barrel adds the animated vent. Destroy Graphics with `{ children: true, context: true }`.
- Produces: `applyCoverEvent(state: GameState, e: CoverEvent): void` (debris/chips/sparks/shards/dust with existing `ParticleKind`s and material colours from the mockup; `break` of a barrel adds nothing — the blast has its own effect), `playCoverSound(kind: CoverKind, action: 'hit' | 'break', muted: boolean): void` (Web Audio synth like `audio.ts`: wood crack, metal clang, glass shatter, barrel hiss on stage 2).

- [ ] **Step 1: Write failing tests:** CoverView `one sprite per cover`, `stage change swaps the texture`, `hologram only in the last 2 s`, `clear removes everything`; coverEffects `break spawns debris particles`, `hit spawns chips`. Mock textures the way `smokeView.test.ts` mocks Pixi.
- [ ] **Step 2: Run** `npx vitest run src/game/render/cover src/game/systems/coverEffects.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` + `npx tsc --noEmit` — PASS; then a browser check (playwright 1.57 script from memory, window 1512×700): Default map shows the crates; shoot a crate through all stages; blow a barrel; watch the hologram and the return. Screenshot each stage.
- [ ] **Step 5: Commit** `feat(cover): draw cover, debris and sounds`

### Task 8: Bots use cover

**Files:**
- Create: `src/game/systems/botCover.ts`
- Modify: `src/game/systems/botSenses.ts` (`botHasLineOfSight` also fails on `sightBlocks`), `src/game/systems/botAim.ts` (aim at cover/barrel when chosen), `src/game/systems/botCombatMoves.ts` (move to a cover spot)
- Test: `src/game/systems/botCover.test.ts`, extend `botSenses` tests, run `botBenchmark.test.ts`

**Interfaces:**
- Produces (`botCover.ts`):
  - `findCoverSpot(state, bot: Entity, threat: Entity): Vector2 | null` — nearest intact wood/metal crate within 400 px of the bot whose rect lies between bot and threat horizontally; spot = crate side away from the threat (`pos.x ∓ (w/2 + 18)`, same floor y). Never a barrel, never within 120 px of an intact barrel.
  - `coverToShoot(state, bot: Entity, target: Entity): Cover | null` — first intact cover on muzzle → target: wood or glass always; metal only if the bot's weapon is rocket/grenade; with a railgun, wood/glass are ignored (rail goes through).
  - `barrelToShoot(state, bot: Entity): Cover | null` — an intact barrel the bot can see with an enemy within `BARREL_RADIUS` of its centre, and no teammate and not the bot itself within `BARREL_RADIUS + 20`.
- Combat rule: when the bot has been hit in the last 1.5 s or its target is visible and closer than its preferred range, it heads for `findCoverSpot` and crouches there, standing to fire (`wantsDown` off while `aimAndFire` shoots). Aim priority: `barrelToShoot` → `coverToShoot` → target.

- [ ] **Step 1: Write failing tests:** `glass does not block sight, wood does`, `findCoverSpot picks the far side of the nearest crate`, `findCoverSpot skips barrels and spots near barrels`, `coverToShoot ignores metal for a machine gun but not for a rocket launcher`, `railgun ignores wood`, `barrelToShoot refuses when a teammate or the bot is in the radius`.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/botCover.test.ts src/game/systems/botSenses*` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` (incl. `botBenchmark.test.ts`; add a case: 2-minute bots-only Deathmatch on Default and Tunnels — no bot stays within 10 px for > 2 s while `moving`) + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(cover): bots take cover, shoot through it and use barrels`

### Task 9: Release

**Files:**
- Modify: `src/components/menu/patchNotes.ts`, `CHANGELOG.md`
- Test: full suite

- [ ] **Step 1:** Next free 0.4.x on `origin/main` at release time (fetch first). Patch note `points` (EN + RU) = the mockup's "Текст для патча"; full detail in `CHANGELOG.md`.
- [ ] **Step 2: Run** `npm test`, `npx tsc --noEmit`, `npm run build`, `cd server && npx tsc --noEmit` — all PASS; one manual online check (browser host + second tab): break a crate on the host, the guest sees it break and walks through the gap.
- [ ] **Step 3: Commit** `chore(release): 0.4.x destructible cover`; open the PR with the git-workflow skill (body ends with the Claude Code line).
