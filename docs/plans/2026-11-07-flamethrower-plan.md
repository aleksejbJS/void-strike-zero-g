# Flamethrower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flamethrower (stream damage + 5 s burning) whose fuel tank can rarely ignite when its carrier is hit, burn 3 s, and explode — gibbing the carrier (or their corpse) and hurting everyone nearby.

**Architecture:** All rules live in the shared simulation (`src/game/systems`, `src/game/cover`), so offline, Node server and browser host behave the same. New focused modules: `flameConstants.ts` (every tuning number), `flamethrower.ts` (the stream), `burning.ts` (burn over time), `fuelTank.ts` (ignition roll, lit tanks, blast). `combat.ts`/`explosion.ts`/`deathKind.ts` get small hooks only. Clients draw everything from snapshot fields (`burnUntil`, `tankFuseAt`, `lastFired`) and from events (`DEATH.tank`, new `TANK_BLAST`); the simulation never writes cosmetics.

**Tech Stack:** TypeScript, Vite, React, Pixi.js, Vitest. Tests: `npx vitest run <path>`; types: `npx tsc --noEmit`; lint: `npm run lint`.

**Spec:** `docs/plans/2026-11-07-flamethrower-spec.md` — read it first.

## Global Constraints

- Work in a worktree from `origin/main` (0.4.31+) on branch `feature/flamethrower`; never switch branches in the main checkout. The worktree needs a real `npm ci`.
- No file over 200 lines; one responsibility per file; named exports. `combat.ts` (300), `physics.ts` (453), `audio.ts` (309), `renderer.ts` (526) are already over: add only hook lines there, put logic in new modules.
- No silent catches. Code comments/docs in English, commits in English, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Coordinates: fighter `pos = (centerX, bottomY)`; hitbox `{ x: pos.x - width/2, y: pos.y - height, w: width, h: height }`.
- Exact values (all in `src/game/systems/flameConstants.ts`):
  `FLAME_RANGE = 300`, `FLAME_HALF_ANGLE = 8°` (in radians), stream `damage 5` per tick, `fireRate 100` ms, `ammo 100`, `maxAmmo 200`, `recoil 0`, `knockbackForce 0`;
  `BURN_MS = 5000`, `BURN_TICK_MS = 500`, `BURN_DAMAGE = 1`;
  `TANK_FUSE_MS = 3000`, `TANK_RADIUS = 170`, `TANK_DAMAGE = 90`, `TANK_KILL_NAME = 'Fuel Tank'`;
  ignition chance per hit: machine gun 0.02, shotgun pellet 0.01, plasma 0.05, railgun 0.05, chainsaw tick 0.02, flame tick 0.015, smoke 0, rocket/grenade (direct or splash) 0.15, barrel blast 0.15, tank blast 0.15;
  flame cover damage multiplier: wood 2, glass 1, barrel 1, metal 0.25.
- Not in the Gun Game ladder, not in the duel loadout (`duelRules.ts`) — leave both untouched.

## Review Focus

1. **The killing hit lights the tank** (e.g. a rocket kills a carrier): the body must drop in place (`'fall'`, not thrown/gibbed), burn, and gib 3 s later — test in Task 5.
2. **Respawn during or after a fuse**: `RESPAWN_DELAY` is 3000 ms, same as the fuse. A respawned fighter must carry no `burnUntil`/`tankFuseAt`, and the world tank still blows at the death spot — test in Task 5.
3. **Unknown tank id on a client** (corpse already faded, joined late, `MAX_CORPSES` hit): `TANK_BLAST` must not throw and must still let the explosion effect play — test in Task 6.
4. **Round/match reset during a fuse**: lit tanks are cleared with the round, so no blast lands in the next round — test in Task 5.
5. **Burning across death**: a burning fighter who dies stops burning; a medkit heals but does not extinguish — test in Task 3.

---

### Task 1: Weapon definition, constants, labels, network slot cap

**Files:**
- Create: `src/game/systems/flameConstants.ts`
- Modify: `src/types.ts` (`WeaponType.FLAMETHROWER = 'FLAMETHROWER'`), `src/constants.ts` (`WEAPONS_DATA`), `src/game/net/validation.ts` (`MAX_WEAPON_SLOTS = 9`), `src/components/hud/weaponLabel.ts`, `src/i18n/locales.ts` (`'weapon.flamethrower'`: EN `Flamethrower`, RU `Огнемёт`), `src/components/hud/hudIcons.ts`, `src/game/render/fighter/weaponGrips.ts`, `src/game/render/fighter/muzzleEnvelope.ts` (no muzzle flash), `src/game/systems/assets.ts` (texture keys `weapon_flamethrower`, `held_flamethrower` with an SVG data-URI fallback like `chainsawFallback`, until Task 9 adds PNGs)
- Test: `src/game/systems/flameConstants.test.ts`, existing `src/game/net/validation.test.ts`

**Interfaces:**
- Produces: `WeaponType.FLAMETHROWER`; `WEAPONS_DATA[FLAMETHROWER] = { name: 'Flamethrower', damage: 5, fireRate: 100, speed: 0, color: '#f97316', ammo: 100, maxAmmo: 200, recoil: 0, knockbackForce: 0 }`; every constant in Global Constraints exported from `flameConstants.ts`, including `TANK_IGNITE_CHANCE: Record<WeaponType, number>`, `TANK_BLAST_CHANCE = 0.15`, `FLAME_COVER_MULT: Record<CoverKind, number>`.

- [ ] **Step 1:** Write tests: `WEAPONS_DATA[WeaponType.FLAMETHROWER]` has damage 5, fireRate 100, ammo 100, maxAmmo 200; `TANK_IGNITE_CHANCE` has the exact per-weapon values; `validateInput({ ..., weaponIndex: 8 })` keeps 8, `9` is dropped.
- [ ] **Step 2:** Run `npx vitest run src/game/systems/flameConstants.test.ts src/game/net/validation.test.ts` — FAIL.
- [ ] **Step 3:** Add the enum value and fill every `Record<WeaponType, …>` that `tsc` reports (grip: copy the grenade launcher's until the art lands).
- [ ] **Step 4:** Run the tests, `npx tsc --noEmit` — PASS, no errors.
- [ ] **Step 5:** Commit `feat(flamethrower): weapon type, tuning constants, labels`.

### Task 2: The flame stream

**Files:**
- Create: `src/game/systems/flamethrower.ts`, `src/game/systems/flamethrower.test.ts`
- Modify: `src/game/systems/combat.ts` (`fireWeapon`: an early branch `if (p.weapon.type === WeaponType.FLAMETHROWER) { fireFlame(state, p, origin, dir, Date.now()); return; }` after recoil)

**Interfaces:**
- Consumes: `applyDamage`, `isTeammate` (combat.ts), `segmentRectEntry` (utils/math), `firstCoverOnSegment` (cover/coverGeometry.ts), `damageCover` (cover/coverDamage.ts), `igniteBurn` from Task 3 (add the call in Task 3).
- Produces: `fireFlame(state: GameState, p: Entity, origin: Vector2, dir: Vector2, now: number): void`.

Rule: three rays from `origin` at angles −`FLAME_HALF_ANGLE`, 0, +`FLAME_HALF_ANGLE`, each `FLAME_RANGE` long and cut at the first platform or intact cover. Every living enemy (not self, not teammate) whose hitbox any ray enters is hit **once per tick**: `applyDamage(state, tgt, p.id, 5, dir, 0, { weapon: FLAMETHROWER, from: origin })`. Every distinct intact cover piece that stops a ray takes `5 × FLAME_COVER_MULT[kind]` once per tick via `damageCover`. Emit `SOUND { sound: 'flame', subtype: 'spray' }`; no shell, no projectile, no muzzle flash.

- [ ] **Step 1:** Tests: enemy at 250 straight ahead loses 5 HP; enemy at 320 untouched; enemy at 200 behind a platform untouched; two enemies in a line both hit; teammate untouched; enemy at 200 and ~6° off the aim line hit, ~15° off untouched; a wood crate in the way takes 10 and the enemy behind it is untouched; a fighter hit by two rays loses 5, not 10; ammo drops by 1 per `fireWeapon` call.
- [ ] **Step 2:** Run `npx vitest run src/game/systems/flamethrower.test.ts` — FAIL.
- [ ] **Step 3:** Implement `fireFlame` and the `fireWeapon` branch.
- [ ] **Step 4:** Run the test file and `npx vitest run src/game/systems/combat.test.ts` — PASS.
- [ ] **Step 5:** Commit `feat(flamethrower): flame stream hits fighters and cover in a 300 px cone`.

### Task 3: Burning

**Files:**
- Create: `src/game/systems/burning.ts`, `src/game/systems/burning.test.ts`
- Modify: `src/types.ts` (Entity: `burnUntil?: number; burnTickAt?: number; burnBy?: string`), `src/game/systems/deathKind.ts` (`DamageSource.burn?: boolean`), `src/game/systems/combat.ts` (armor skipped when `source.burn`, like bleed; on death call `extinguish(target)`), `src/game/systems/killWeaponName.ts` (`source.burn` → `WEAPONS_DATA[FLAMETHROWER].name`), `src/game/systems/flamethrower.ts` (call `igniteBurn` on each fighter hit), `src/game/systems/physics.ts` (call `tickBurning(state, now)` next to `tickBleeding`), `src/game/net/clock.ts` (shift `burnUntil`, `burnTickAt`)

**Interfaces:**
- Produces: `igniteBurn(target: Entity, by: string, now: number): void` — sets `burnUntil = now + BURN_MS`, `burnBy = by`; sets `burnTickAt = now + BURN_TICK_MS` only if not already burning (a refresh does not delay the next tick). `extinguish(p: Entity): void` — clears all three fields. `isBurning(p: Pick<Entity,'burnUntil'>, now: number): boolean`. `tickBurning(state: GameState, now: number): void` — for each living burning fighter with `now >= burnTickAt`: `applyDamage(state, p, p.burnBy, BURN_DAMAGE, {x:0,y:0}, 0, { weapon: FLAMETHROWER, burn: true })`, `burnTickAt += BURN_TICK_MS`; when `now >= burnUntil`, `extinguish`. Skips while `state.hungerRoundEndsAt` is set (same as bleeding).

- [ ] **Step 1:** Tests (fixed clock, no `Date.now()`): a full burn costs exactly 10 HP over 5000 ms; a refresh at 2500 ms extends to 7500 ms without an extra tick; armor stays untouched by burn ticks; burn death credits `burnBy` with "Flamethrower" in the KILL event; a dead fighter is extinguished and takes no more ticks after respawn; picking up a medkit (`physics.ts` HEALTH pickup) leaves `burnUntil` set; one stream hit in `fireFlame` sets `burnUntil`.
- [ ] **Step 2:** Run `npx vitest run src/game/systems/burning.test.ts` — FAIL.
- [ ] **Step 3:** Implement and wire the hooks.
- [ ] **Step 4:** Run `npx vitest run src/game/systems` — PASS.
- [ ] **Step 5:** Commit `feat(flamethrower): targets burn 1 HP per 0.5 s for 5 s`.

### Task 4: Tank ignition

**Files:**
- Create: `src/game/systems/fuelTank.ts`, `src/game/systems/fuelTank.test.ts`
- Modify: `src/types.ts` (Entity: `tankFuseAt?: number; tankBy?: string`), `src/game/systems/deathKind.ts` (`DamageSource.tank?: boolean`), `src/game/systems/combat.ts` (`applyDamage`: right after `target.health -= dmg`, call `rollTankIgnition(target, attackerId, source, Date.now())`), `src/game/net/clock.ts` (shift `tankFuseAt`)

**Interfaces:**
- Produces: `ignitionChance(source: DamageSource): number` — 0 for `bleed`/`burn`/no weapon and no blast; `TANK_BLAST_CHANCE` for `barrel`, `tank`, rocket or grenade; otherwise `TANK_IGNITE_CHANCE[source.weapon]`. `rollTankIgnition(target: Entity, attackerId: string, source: DamageSource, now: number, rand: () => number = Math.random): boolean` — only when `target.weapon.type === FLAMETHROWER`, `tankFuseAt` unset, `attackerId !== target.id` (blasts excepted: `barrel`/`tank` roll even for the breaker); on success sets `tankFuseAt = now + TANK_FUSE_MS`, `tankBy = attackerId`, emits `SOUND { sound: 'flame', subtype: 'ignite' }`, returns true. The roll happens before the death check, so the killing hit can light the tank.

- [ ] **Step 1:** Tests with an injected `rand`: rand 0.01 lights on a plasma hit, 0.06 does not; a shotgun pellet lights at 0.009 not 0.011; a carrier holding a shotgun (flamethrower only in inventory) never lights; self rocket splash never lights; an already-lit tank keeps its first `tankFuseAt`/`tankBy`; burn and bleed ticks never light; a barrel blast lights at 0.14.
- [ ] **Step 2:** Run `npx vitest run src/game/systems/fuelTank.test.ts` — FAIL.
- [ ] **Step 3:** Implement and add the `applyDamage` hook (one line).
- [ ] **Step 4:** Run `npx vitest run src/game/systems` — PASS.
- [ ] **Step 5:** Commit `feat(flamethrower): hits can light the carrier's fuel tank`.

### Task 5: Lit tanks, the blast, corpse fuse

**Files:**
- Modify: `src/game/systems/fuelTank.ts` (add below), `src/types.ts` (`LitTank { id: string; pos: Vector2; fuseAt: number; by: string }`, `GameState.litTanks?: LitTank[]` — host-only, **not** added to the snapshot pick list in `protocol.ts`), `src/game/systems/events.ts` (`DEATH.tank?: string`; new `{ type: 'TANK_BLAST'; id: string; x: number; y: number }`), `src/game/systems/effects.ts` (`emitDeath`/`deathEvent` take an optional `tank?: string`), `src/game/systems/combat.ts` (death branch, see below; `isSelf` and the Gun Game / `trackKill` checks treat `source.tank` like `source.barrel`), `src/game/systems/explosion.ts` (`ExplosionOpts.tank?: boolean`: hurts everyone like `barrel`, passes `tank: true` in the source), `src/game/systems/deathKind.ts` (`isSplash` true for `tank`; `deathKind` for `tank`: `direct || overkill >= GIB_OVERKILL ? 'gib' : 'thrown'`), `src/game/systems/killWeaponName.ts` (`source.tank` → `TANK_KILL_NAME`), `src/game/systems/physics.ts` (call `tickFuelTanks(state, now)` next to `tickCover`), `src/game/net/roomSetup.ts` (reset `state.litTanks = []` wherever `state.smokes = []` is reset, and in the initial state)
- Test: `src/game/systems/fuelTankBlast.test.ts`

**Interfaces:**
- Consumes: Task 4 fields; `createExplosion` (explosion.ts).
- Produces: `tankPos(p: Entity): Vector2` — the back: `{ x: p.pos.x - (p.facingRight ? 10 : -10), y: p.pos.y - p.height * 0.6 }`. `dropLitTank(state: GameState, p: Entity): string | undefined` — if `p.tankFuseAt` is set: push a `LitTank` (`nextId('tank_')`, `tankPos(p)`, same `fuseAt`/`by`), clear the fighter's fields, return the id. `tickFuelTanks(state: GameState, now: number): void` — (a) each **living** fighter whose `tankFuseAt <= now`: clear the fields, `applyDamage(state, p, by, 9999, {x:0,y:0}, 0, { tank: true, direct: true, from: tankPos(p) })` (always dies, always gibbed), then `createExplosion(state, pos, by, TANK_RADIUS, undefined, p.id, { tank: true, damage: TANK_DAMAGE, now })`; (b) each `LitTank` with `fuseAt <= now`: remove it, emit `TANK_BLAST { id, x, y }`, then the same `createExplosion`.

Death branch in `applyDamage` (replaces the current `emitDeath` line):
`const tankId = dropLitTank(state, target);` → kind is `'fall'` and `blast` false when `tankId` is set, otherwise `deathKind(...)`/`isSplash(...)` as now → `emitDeath(target, kind, source.from, blast, tankId)` → `extinguish(target)`.

- [ ] **Step 1:** Tests (fixed clock, stub `Math.random` or force `tankFuseAt` directly):
  - alive carrier at fuse end dies, DEATH kind `'gib'`, KILL weapon "Fuel Tank" credited to `tankBy`; a fighter 50 px away loses ~`90 × (1 − 50/170)` (after armor); a teammate of the igniter is hurt too;
  - **(Review Focus 1)** a rocket kill that lights the tank: DEATH kind `'fall'` with a `tank` id, `state.litTanks` holds it at the death spot; at fuse end one `TANK_BLAST` with that id and an explosion there;
  - a third fighter finishing a lit carrier gets the carrier's kill; the blast's other kills go to `tankBy`;
  - **(Review Focus 2)** a carrier killed at t=0 with a lit tank respawns at t=3000 with no `tankFuseAt`/`burnUntil`, and the blast happens at the death spot, not the spawn;
  - **(Review Focus 4)** a round reset (`resetHungerRound` or the match restart in `roomSetup.ts`) empties `litTanks`;
  - a tank blast that hits another carrier rolls at 0.15 (chain);
  - igniter no longer in `state.players`: blast still resolves, KILL killer "World", weapon "Fuel Tank".
- [ ] **Step 2:** Run `npx vitest run src/game/systems/fuelTankBlast.test.ts` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npx tsc --noEmit` — all PASS.
- [ ] **Step 5:** Commit `feat(flamethrower): a lit tank explodes after 3 s, even on a corpse`.

### Task 6: Client cosmetics and sounds

**Files:**
- Create: `src/game/systems/ragdoll/corpseTank.ts` (+ test), `src/game/render/fighter/fighterFire.ts` (+ test), `src/game/render/tankWarning.ts`, `src/game/systems/flameAudio.ts`
- Modify: `src/game/systems/ragdoll/corpseBody.ts` (`Corpse.tankId?: string`), `src/game/systems/ragdoll/corpses.ts` (`addCorpse` keeps `e.tank` only when it is a string; `updateCorpses` calls `corpseTankFire(state)`), `src/game/systems/effects.ts` (`applyEffectEvent` case `'TANK_BLAST'` → `gibTankCorpse`), `src/game/render/fighter/fighterAnimator.ts` (drive `fighterFire`), `src/game/render/playerVisual.ts` (draw `tankWarning`), `src/components/GameCanvas.tsx:534` and `src/components/tournament/watch/MatchTile.tsx:96` (route `sound === 'flame'` to `playFlameSound`)

**Interfaces:**
- Produces: `gibTankCorpse(state: GameState, id: string, from: Vector2): void` — find the corpse with `tankId === id`; none → return (no throw). Otherwise remove it and `addCorpse` a `'gib'` corpse seeded from its colours/build/facing/weapon/oneLeg at its current torso position, `from` = blast point, plus 60 blood droplets. `corpseTankFire(state: GameState): void` — fire particles from each corpse with `tankId`. `class FighterFire { jet(...); body(...); tank(...) }` — like `BleedDrips`, rate-limited particles via `createParticles(…, 'fire')`: **jet** while `lastFired` changed within the last 150 ms and the weapon is the flamethrower, particles from `muzzlePoint` along `pose.gunAngle` fast enough to reach ~300 px; **body** while `burnUntil > now`, flames over the whole body; **tank** while `tankFuseAt` is set, a strong jet from the back (distinct colour/size from body flames). `drawTankWarning(g: Graphics, p: Entity, now: number)` — blinking warning triangle above the head while `tankFuseAt` is set, blinking faster as it nears. `playFlameSound(kind: 'spray' | 'ignite', muted: boolean)` — short noise burst (spray, overlapping every 100 ms into a roar) and a rising hiss (ignite), using `sfxOutput()`.

- [ ] **Step 1:** Tests: `gibTankCorpse` with an unknown id leaves `state.corpses` unchanged and does not throw **(Review Focus 3)**; with a known id the corpse becomes kind `'gib'` with the same colours; `addCorpse` ignores a non-string `tank`; `FighterFire.body` spawns nothing when `burnUntil` is in the past.
- [ ] **Step 2:** Run `npx vitest run src/game/systems/ragdoll src/game/render/fighter` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests PASS; check visually (Task 9 step 2).
- [ ] **Step 5:** Commit `feat(flamethrower): flame jet, burning bodies, burning tank, corpse blast`.

### Task 7: Bots

**Files:**
- Modify: `src/game/systems/botWeapons.ts` (`scoreWeaponForDistance`: `FLAMETHROWER` → `dist < FLAME_RANGE - 20 ? 115 - dist * 0.1 : -100`)
- Test: `src/game/systems/botWeapons.test.ts` (create if missing)

- [ ] **Step 1:** Tests: a bot with machine gun + flamethrower picks the flamethrower at 150 px and the machine gun at 500 px; `findWeaponPickup` returns a reachable flamethrower pickup for a bot without one.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run `npx vitest run src/game/systems/bot` — PASS.
- [ ] **Step 5:** Commit `feat(bots): bots use the flamethrower up close`.

### Task 8: Map pickups

**Files:**
- Modify: `src/game/data/level.ts` (`getInitialPickups`: one `ItemType.WEAPON` / `FLAMETHROWER` pickup in each of the tunnels, Hunger Games, Hold the Flag, Deathmatch, Infiltration and CTF lists, in a close-quarters spot on a surface bots can reach)
- Test: `src/game/data/flamethrowerPickups.test.ts`

- [ ] **Step 1:** Tests: each of those lists has exactly one flamethrower pickup and `pickupReachable` is true for it; Gun Game and Duel lists have none.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(flamethrower): one pickup per map`.

### Task 9: Art, check in the browser, release notes

**Files:**
- Create: `public/assets/hud/flamethrower.png` (trimmed side view, ~240 px wide, same style as `chainsaw.png`), `public/assets/items/flamethrower.png` (256×256 pickup) — draw as SVG and rasterise with Playwright (`npx playwright` 1.57); the owner may swap them later
- Modify: `src/game/systems/assets.ts` (PNG paths), `src/game/render/fighter/weaponGrips.ts` (real grip/axis for the picture), `src/game/systems/assets.test.ts`, `CHANGELOG.md`, `src/components/menu/patchNotes.ts` (next free 0.4.x, EN + RU, 3–5 points)

- [ ] **Step 1:** Make the pictures; `npx vitest run src/game/systems/assets.test.ts` — PASS.
- [ ] **Step 2:** Run the game in the worktree (`npm run dev`), viewport 1512×700, offline Deathmatch with bots; temporarily set every ignition chance to 1 locally (do not commit) and screenshot: flame jet, burning enemy with HP dropping, lit tank + warning, gib blast, burning corpse then corpse gib. Restore the chances.
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — all pass.
- [ ] **Step 4:** Commit `chore(release): flamethrower (0.4.x)`, include the spec and this plan.
