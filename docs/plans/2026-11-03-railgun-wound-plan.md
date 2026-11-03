# Railgun Wound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A railgun beam on an armored fighter burns the armor, leaves ≤10 HP, tears off a leg and starts a 10 s bleed that a medkit cures; bleed-outs and self-inflicted deaths of the wounded credit the shooter.

**Architecture:** The wound is server-authoritative state on `Entity` (`wound?: { by }`), decided inside `applyDamage` by pure rules in `wound.ts`; a separate `bleeding.ts` ticks it through `applyDamage` with a `bleed` source. Cosmetics stay event-driven: a new `LIMB` event for the flying leg, `oneLeg` on `DEATH` for the corpse, and the client draws the one-legged fighter and drips from the snapshot.

**Tech Stack:** TypeScript, Vitest, Pixi.js (render), React (HUD).

**Spec:** `docs/plans/2026-11-03-railgun-wound-spec.md`

## Global Constraints

- Wound triggers only for `WeaponType.RAILGUN` on a target with `armor > 0`; armor → `0`, health → `Math.min(health, 10)`.
- Bleed: `1` HP per second, applied per tick as `1 / PHYSICS_TICK_RATE`; never through armor, no knockback, no `DAMAGE` number.
- Wounded ground speed = `PRONE_SPEED` (~60 px/s). Jump, jetpack, hook, crouch, prone, shoot unchanged.
- Bleeding pauses while `state.matchEndsAt` or `state.hungerRoundEndsAt` is set.
- Simulation never writes particles/corpses; it emits events (`effects.ts` header rule).
- `wound` is optional on `Entity` (older hosts never send it).
- Files ≤ 200 lines; `physics.ts` (426) and `combat.ts` (300) only get call sites, logic goes in new modules.
- Commits in English, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Railgun shooter kills the wounded with another gun** → credit and kill-feed weapon are that gun, not "Railgun" (Task 2 test `another weapon by the shooter is credited normally`).
2. **Shooter left the room before the bleed-out** → "World" in the feed, nobody scores, no crash (Task 2 test `shooter gone`).
3. **Hunger round decided while someone bleeds** → their HP stops dropping; next round they spawn unwounded (Task 3 tests `pauses when round decided`, `round reset clears`).
4. **Wounded fighter is beamed again with no armor** → dies cut in half, credited to the second shooter (Task 1 test `second beam without armor kills`).
5. **Online client prediction** → the local wounded player cannot run in prediction either (Task 4: speed rule lives in `applyMovement`, which both host and client call; test on `applyMovement`).

---

### Task 1: Wound state and the hit rule

**Files:**
- Create: `src/game/systems/wound.ts`, `src/game/systems/wound.test.ts`
- Modify: `src/types.ts` (Entity), `src/constants.ts`, `src/game/systems/deathKind.ts` (`DamageSource.bleed`), `src/game/systems/combat.ts` (`applyDamage`), `src/game/systems/events.ts`, `src/game/systems/effects.ts` (`emitLimb`), `src/game/net/roomSetup.ts` (`baseEntity`)

**Interfaces:**
- Produces:
  - `types.ts`: `export interface Wound { by: string }`; `Entity.wound?: Wound` (comment: lost a leg to a railgun through armor; missing = whole).
  - `constants.ts`: `WOUND_HEALTH = 10`, `BLEED_HP_PER_S = 1`.
  - `deathKind.ts`: `DamageSource.bleed?: boolean` (bleeding, not a hit).
  - `wound.ts`: `shouldWound(target: Entity, source: DamageSource): boolean`; `inflictWound(target: Entity, attackerId: string): number` (returns HP lost); `healWound(p: Entity): void`.
  - `events.ts`: `{ type: 'LIMB'; x: number; y: number; facing: 1 | -1; vel: Vector2; from?: Vector2; parts?: RagdollColors }`, `export type LimbEvent`.
  - `effects.ts`: `ragdollColors(e: Entity): RagdollColors` (extracted from `deathEvent`), `emitLimb(e: Entity, from?: Vector2): void`.

- [ ] **Step 1: Write failing tests in `wound.test.ts`** (use `createMockState`/`createMockPlayer`, fire with `fireWeapon` as in `combat.test.ts`)
  - `wounds an armored target`: target armor 100, health 100 → after beam `dead === false`, `armor === 0`, `health === 10`, `wound.by === 'shooter'`.
  - `keeps lower health`: armor 5, health 4 → `health === 4`, wounded.
  - `kills an unarmored target as before`: armor 0 → `dead === true`.
  - `second beam without armor kills`: beam twice (reset `lastFired`) → `dead === true`.
  - `re-wound credits the newest shooter`: wounded by `a`, armor set to 50, beamed by `b` → alive, `wound.by === 'b'`, `armor === 0`.
  - `only the railgun wounds`: `applyDamage` with `{ weapon: MACHINE_GUN }` on armor 100 → no `wound`.
  - `emits LIMB on wound`: spy `gameEvents` → one `LIMB` event at the target.
  - `baseEntity has no wound`: `resetMatch` on a wounded player → `wound === undefined`.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/wound.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement.** In `applyDamage`, after the shield/self checks and before the HTF/armor math: `if (shouldWound(target, source)) { const lost = inflictWound(target, attackerId); emitLimb(target, source.from); /* knockback + emitDamage(lost) as today */ return; }`. Factor today's knockback block into a local `push(...)` so both paths share it. `shouldWound` = railgun, `armor > 0`, not `bleed`. `baseEntity` gains `wound: undefined` so `Object.assign` in `respawnEveryone` clears it.
- [ ] **Step 4: Run** the same test file plus `npx vitest run src/game/systems/combat.test.ts src/game/systems/deathCause.test.ts` — expect PASS.
- [ ] **Step 5: Commit** `feat(combat): railgun wounds instead of killing through armor`.

### Task 2: Kill credit for the wounded

**Files:**
- Modify: `src/game/systems/wound.ts`, `src/game/systems/combat.ts` (kill block of `applyDamage`), `src/game/systems/wound.test.ts` (or `woundCredit.test.ts` if over 200 lines)

**Interfaces:**
- Consumes: `Entity.wound`, `DamageSource.bleed` (Task 1).
- Produces: `killCredit(target: Entity, attackerId: string, source: DamageSource): { attackerId: string; weapon?: WeaponType }` — returns `{ attackerId: target.wound.by, weapon: RAILGUN }` when the target is wounded and (`source.bleed` or `attackerId === ''` or `attackerId === target.id`); otherwise `{ attackerId }`.

- [ ] **Step 1: Failing tests**
  - `bleed death credits the shooter with Railgun`: wounded by `s`, `applyDamage(state, t, 's', 50, {x:0,y:0}, 0, { bleed: true })` → `s.score === 1`, KILL event `weapon === 'Railgun'` while `s.weapon` is MACHINE_GUN.
  - `own rocket splash credits the shooter`: attacker = victim id, `{ weapon: ROCKET_LAUNCHER }` → `s.score === 1`, feed `Railgun`.
  - `falling off the map credits the shooter`: attacker `''`, amount 9999 → `s.score === 1`.
  - `zone damage credits the shooter`: attacker `''`, amount 50 → `s.score === 1`.
  - `another weapon by the shooter is credited normally`: attacker `s`, `{ weapon: MACHINE_GUN }` → feed weapon `s.weapon.name`.
  - `another player's kill goes to them`: attacker `o` → `o.score === 1`, `s.score === 0`.
  - `shooter gone`: wound.by `'gone'` (not in `state.players`), bleed death → KILL `killer === 'World'`, no score, no throw.
  - `bleed death slumps`: DEATH event `kind === 'fall'`.
  - `death clears the wound and DEATH carries oneLeg`: after death `wound === undefined`, DEATH event `oneLeg === true`.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/wound.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** In the death branch compute `const credit = killCredit(target, attackerId, source)` *before* anything changes; use `credit.attackerId` for the killer lookup; kill feed `weapon: credit.weapon ? WEAPONS_DATA[credit.weapon].name : killer.weapon.name`; `trackKill(credit.weapon ?? killer.weapon.type)`. `bleed` source skips HTF ×1.1, armor, knockback and `emitDamage`. Add `oneLeg?: boolean` to the DEATH event type and set it in `deathEvent` from `!!e.wound`; then `target.wound = undefined` after `emitDeath`.
- [ ] **Step 4: Run** `npx vitest run src/game/systems` — expect PASS.
- [ ] **Step 5: Commit** `feat(combat): the railgun shooter keeps the frag of a wounded fighter`.

### Task 3: Bleeding and healing

**Files:**
- Create: `src/game/systems/bleeding.ts`, `src/game/systems/bleeding.test.ts`
- Modify: `src/game/systems/physics.ts` (one call after the Players Logic loop; `healWound(p)` in the HEALTH pickup branch)

**Interfaces:**
- Consumes: `applyDamage`, `healWound`, `BLEED_HP_PER_S`.
- Produces: `tickBleeding(state: GameState): void` — no-op while `state.hungerRoundEndsAt`; for every living wounded fighter `applyDamage(state, p, p.wound.by, BLEED_HP_PER_S / PHYSICS_TICK_RATE, { x: 0, y: 0 }, 0, { bleed: true })`.

- [ ] **Step 1: Failing tests**
  - `drains 1 HP per second`: wounded at 10 HP, 120 ticks → `health ≈ 9` (toBeCloseTo, 5).
  - `bleeds out in about 10 s`: 10 HP, 1200 ticks → dead; 1180 ticks → alive.
  - `ignores armor`: wounded, armor 50, 120 ticks → `armor === 50`, health ≈ 9.
  - `pauses when round decided`: Hunger state with `hungerRoundEndsAt` set → health unchanged.
  - `medkit heals the wound` (via `updatePhysics` pickup, as in `physics.gameplay.test.ts`): wounded on a HEALTH pickup → `wound === undefined`, `health === 35`.
  - `round reset clears`: `resetHungerRound` → no wound.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/bleeding.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `bleeding.ts`; call `tickBleeding(state)` in `updatePhysics` after the players loop (the `matchEndsAt` early return already pauses it); `healWound(p)` next to the HEALTH pickup.
- [ ] **Step 4: Run** `npx vitest run src/game/systems` — expect PASS.
- [ ] **Step 5: Commit** `feat(combat): wounded fighters bleed until a medkit`.

### Task 4: Hopping on one leg

**Files:**
- Modify: `src/game/systems/movement.ts` (ground speed line), `src/game/systems/movement.test.ts`

**Interfaces:**
- Consumes: `Entity.wound`.

- [ ] **Step 1: Failing tests**
  - `wounded fighter hops at crawl speed`: grounded, `wound` set, `inputX: 1`, 200 ticks of `applyMovement` → `vel.x` settles to the same value as a prone fighter's (compare against a prone mock run the same way).
  - `wounded fighter still flies`: `isFlying: true` → `vel.y` decreases like an unwounded fighter.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/movement.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**: `const speed = p.isProne || p.wound ? PRONE_SPEED : ...`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(movement): a wounded fighter cannot run`.

### Task 5: Bots

**Files:**
- Modify: `src/game/systems/botGoals.ts` (medkit rule), `src/game/systems/botPathfinder.ts` (`PathQuery.walkPxPerS?`), `src/game/systems/botRoute.ts` (pass it), tests in `src/game/systems/bot.test.ts` / `botNav.test.ts`

**Interfaces:**
- Produces: `PathQuery.walkPxPerS?: number` (default `RUN_PX_S` 240); wounded bots pass `60`.

- [ ] **Step 1: Failing tests**
  - `wounded flag carrier goes for a medkit`: bot with `hasFlag` set, `wound` set, health 10, a HEALTH pickup in the state → `chooseGoal(...).moveTarget` equals the medkit's pos.
  - `slow walking makes long walks expensive`: on a graph with a long walk route and a jet route of similar run-cost, `findPath` with `walkPxPerS: 60` picks the `jet` edge; with default it picks the walk.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/bot.test.ts src/game/systems/botNav.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**: medkit condition `bot.health < LOW_HEALTH && (bot.hasFlag === Team.NONE || bot.wound)`; `findPath` divides by `q.walkPxPerS ?? RUN_PX_S`; `botRoute` passes `walkPxPerS: bot.wound ? 60 : undefined`.
- [ ] **Step 4: Run** `npx vitest run src/game/systems` — expect PASS (incl. `botBenchmark.test.ts`).
- [ ] **Step 5: Commit** `feat(bots): wounded bots head for a medkit and prefer flying`.

### Task 6: The one-legged fighter, stump, hop and drips

**Files:**
- Create: `src/game/render/fighter/fighterBleed.ts` (+ test) — drip budget like `fighterDust.ts`
- Modify: `fighterView.ts` (`FighterFrame.oneLeg?`; skip back leg, draw stump at `pose.hip`), `fighterAnimator.ts` (set `oneLeg: !!p.wound`, hop bounce while grounded and moving, spawn drips), `fighterViewOrder.test.ts` or a new view test

**Interfaces:**
- Produces: `FighterFrame.oneLeg?: boolean`; `class BleedDrips { spawn(game: GameState, x: number, y: number, now: number): void }` (rate-limited, e.g. one blood particle every ~150 ms, `type: 'blood'`).

- [ ] **Step 1: Failing tests**
  - `one-legged frame draws no back leg`: `drawFighter` with `oneLeg: true` makes fewer `jointedLimb` calls / the back-leg geometry is absent (follow `fighterViewOrder.test.ts` approach).
  - `animator marks a wounded fighter one-legged`: `frame(woundedEntity, ...)` → `oneLeg === true`; whole fighter → falsy.
  - `drips are rate-limited`: `spawn` called every frame for 1 s adds ≤ 8 particles.
- [ ] **Step 2: Run** `npx vitest run src/game/render/fighter` — expect FAIL.
- [ ] **Step 3: Implement.** Hop = small vertical offset of the root while grounded with `|vel.x|` above `MOVE_THRESHOLD`; look of stump/drips is the builder's call (dark red, matches `tornFlesh.ts`).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(render): one-legged wounded fighter with a bleeding stump`.

### Task 7: The torn leg and the one-legged corpse

**Files:**
- Modify: `src/game/systems/effects.ts` (`applyEffectEvent` case `LIMB`), `src/game/systems/ragdoll/corpses.ts` (`addLimb`), `src/game/systems/ragdoll/corpseBody.ts` (`Corpse.only?`, `Corpse.oneLeg?`), `src/game/render/ragdoll/corpsePose.ts` (`piecesOf` filter), `src/game/render/ragdoll/corpseView.ts` + `cutHalves.ts` (skip back leg when `oneLeg`); tests next to each.

**Interfaces:**
- Consumes: `LimbEvent`, `DeathEvent.oneLeg` (Tasks 1–2), `FighterFrame.oneLeg` (Task 6).
- Produces: `addLimb(state: GameState, e: LimbEvent): Corpse` — a `kind: 'gib'` corpse with `only: 'leg-back'`, launched like a shot from `e.from`; `Corpse.only?: CorpsePiece['part']`; `Corpse.oneLeg?: boolean` copied from `DeathEvent.oneLeg` (only a real boolean counts — host data is untrusted).

- [ ] **Step 1: Failing tests**
  - `LIMB adds one leg piece`: `applyEffectEvent(state, limb)` → one corpse, `piecesOf(c)` is exactly `[leg-back]`; blood particles were added.
  - `gib corpse of a one-legged fighter has no back leg`: DEATH `kind: 'gib', oneLeg: true` → `piecesOf` has no `leg-back`.
  - `non-boolean oneLeg is ignored`: `oneLeg: 'yes'` → `corpse.oneLeg` falsy.
  - Whole-body / cut corpse: `createCorpseView` for `oneLeg` corpse draws without the back leg (assert via the frame passed to `drawFighter`, mirroring existing `corpseView.test.ts` style).
- [ ] **Step 2: Run** `npx vitest run src/game/systems/ragdoll src/game/render/ragdoll src/game/systems/effects.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** Unknown event types already fall through `applyEffectEvent`, so older clients ignore `LIMB`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(ragdoll): torn leg piece and one-legged corpses`.

### Task 8: HUD bleeding drop

**Files:**
- Modify: `src/game/systems/renderer.ts:493` (`bleeding: !!p.wound` in `setStats`), stats type in `src/store/uiStore.tsx`, `src/components/hud/GameHud.tsx` → `Vitals.tsx` (`bleeding?: boolean` prop), `src/components/hud/GameHud.test.tsx`

- [ ] **Step 1: Failing test** `shows the bleeding drop`: render HUD with `stats.bleeding: true` → element with `aria-label` from a new i18n key (`hud.bleeding`, RU "Кровотечение", EN "Bleeding") is present; absent when false.
- [ ] **Step 2: Run** `npx vitest run src/components/hud` — expect FAIL.
- [ ] **Step 3: Implement** a pulsing red drop next to the HP number (Hazard Bay tokens; `animate-pulse` or CSS keyframe).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(hud): bleeding indicator`.

### Task 9: Verify and release

- [ ] **Step 1:** `npx vitest run && npx tsc --noEmit -p . && npm run lint` — all green.
- [ ] **Step 2:** Run the game from the worktree (`npx vite --port 3010`), Deathmatch with bots at 1512×700: pick up armor, let a bot railgun you (or beam a bot wearing armor) — leg flies off, one-legged hop, drips, HUD drop, medkit restores, bleed-out after ~10 s credits the shooter in the kill feed. Screenshot before/after.
- [ ] **Step 3:** `git fetch` and take the next free 0.4.x after `origin/main`; patch note (3–4 points, RU/EN) in `src/components/menu/patchNotes.ts` and `CHANGELOG.md`; update `constants.ts` railgun comment (no longer "one-shot through armor").
- [ ] **Step 4: Commit** `docs: 0.4.x release notes`, push branch, open PR (merge only on the owner's "влей").
