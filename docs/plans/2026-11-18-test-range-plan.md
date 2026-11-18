# Test Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hidden `#range` offline mode: a closed room with the four cover kinds and five still dummies (one per base), god mode with all nine weapons, stance / armour / hit-zone / reset keys and a damage readout, counting nowhere.

**Architecture:** A new `GameMode.RANGE` runs the ordinary offline match loop. Everything range-specific lives in `src/game/range/` (pure logic), `src/game/render/range/` (Pixi overlay) and `src/components/range/` (React legend, route). Shared code gets three one-line hooks: dummies skip the bot brain (`physics.ts`), an invulnerable fighter takes only knockback (`combat.ts`), and the stats/XP hooks skip the range mode.

**Tech Stack:** TypeScript, React, PixiJS v8, Matter.js, Vitest.

**Spec:** `docs/plans/2026-11-18-test-range-spec.md` (approved 2026-11-18).

## Global Constraints

- Every file at most 200 lines; one responsibility per file; named exports; no silent catches.
- Fighters and cover: `pos = (centerX, bottomY)`. Platforms: top-left `{ x, y, w, h }`.
- Pixi: `Graphics.destroy({ children: true, context: true })`; never `app.destroy(true)`.
- Offline only. RANGE never in the mode menu (`MODE_ORDER`), the server's `ONLINE_MODES`, tournaments or the host.
- Nothing counts: no XP, achievements, lifetime stats, leaderboards, cloud pushes, match result screen, ads.
- English only. Desktop only.
- `GameCanvas.tsx` gains thin calls only (target: under +25 lines).
- Keys: C stance (stand → crouch → prone), K armour (0 ↔ 100), H hit-zone outlines, R reset, Esc exit. All are free today.
- Dummy return delay: 3000 ms. Readout window: 3000 ms.
- Work in `~/Documents/void-strike-range` on `feature/test-range`; run `npx vitest run <file>` per task and the full suite before the last commit.

## Review Focus

1. **Leaving and re-entering:** Esc from the range goes to the menu and clears `#range`, so the menu does not bounce straight back; opening `#range` again starts one fresh range (Task 9 test).
2. **The player's own blasts:** a rocket at the feet, a grenade, a barrel or a lit tank never kill or ignite the invulnerable player, but still push them (rocket jumps work) (Task 4 test).
3. **Reset during the 3 s hold:** pressing R while a dummy is dead revives it once, at its spot, in the current stance; no second revive 3 s later (Task 5 test).
4. **Armoured railgun:** with K on, the railgun wounds (leg lost) and the bleed shows in the 3 s total; reset clears the wound (Tasks 5, 6 tests).
5. **No leak into a normal match:** a Deathmatch started after the range has no dummies, no invulnerable player, a following camera and counts stats again (Tasks 4, 9 tests).

---

### Task 1: The RANGE mode exists and is hidden everywhere

**Files:**
- Modify: `src/types.ts` (enum `GameMode`; `Entity`; `GameState`)
- Modify: `src/components/menu/modeInfo.ts`, `src/components/menu/ModePreview.tsx` (exhaustive records, like `DUEL`)
- Modify: `server/src/config.ts:23` (`ONLINE_MODES` also drops RANGE)
- Modify: `src/game/render/scene/mapLook.ts` (theme `'range'`)
- Create: `src/game/render/scene/themes/rangeTheme.ts`
- Create: `src/game/range/rangeState.ts` (+ `rangeState.test.ts`)
- Test: `src/game/render/scene/mapLook.test.ts` (add), `server/src/config.test.ts` (add or create), `src/components/menu/modeInfo.test.ts` (add or create)

**Interfaces:**
- Produces: `GameMode.RANGE = 'RANGE'`; `Entity.dummy?: boolean`; `Entity.invulnerable?: boolean`; `GameState.range?: RangeState`; `MapTheme` gains `'range'`; `rangeTheme(): SceneTheme`.
- Produces from `rangeState.ts`: `type DummyStance = 'stand' | 'crouch' | 'prone'`; `interface RangeState { stance: DummyStance; armored: boolean; showHitZones: boolean; resetRequested: boolean; diedAt: Record<string, number> }`; `createRangeState(): RangeState` (stand, false, false, false, {}); `nextStance(s: DummyStance): DummyStance`; `DUMMY_RETURN_MS = 3000`.

- [ ] **Step 1: Tests:** `nextStance` cycles stand → crouch → prone → stand; `MODE_ORDER` does not contain `GameMode.RANGE`; server `ONLINE_MODES` contains neither `DUEL` nor `RANGE`; the theme picked for `GameMode.RANGE` is `'range'` and `rangeTheme().adPlaces` is `[]` and `.decor` is `[]`.
- [ ] **Step 2:** Run them; they fail.
- [ ] **Step 3:** Add the enum value and the three fields (comments: `dummy` = range target without a bot brain, `invulnerable` = takes knockback only, `range` = client-only range settings). Add RANGE records in `modeInfo.ts` (EN and RU: `name: 'Range'`, internal note that it is never offered) and `ModePreview.tsx` (reuse `DeathmatchScene`). `rangeTheme` = `pitTheme()` with `adPlaces: []`, `decor: []`. Map `GameMode.RANGE → 'range'` in `mapLook.ts`.
- [ ] **Step 4:** Tests pass; `npx tsc --noEmit -p .` shows only the 3 errors `main` already has.
- [ ] **Step 5:** Commit `feat(range): hidden RANGE mode, no ads, never online`.

### Task 2: The range room

**Files:**
- Create: `src/game/range/rangeMap.ts`
- Modify: `src/game/data/level.ts` (`getPlatforms`, `getInitialPickups`)
- Modify: `src/game/cover/coverLayouts.ts` (key `'range'`), `src/game/cover/coverLayout.ts` (`layoutKeyFor`)
- Modify: `src/game/net/roomSetup.ts:22` (`spawnPointFor`)
- Test: `src/game/range/rangeMap.test.ts`

**Interfaces:**
- Produces from `rangeMap.ts`:
  - `RANGE_PLATFORMS: Omit<Platform,'id'>[]`; closed box, interior x 0..1500, y 0..800, floor top y 800, walls 200 thick (as `PIT_WALLS`), plus a dummy shelf `{ x: 1000, y: 520, w: 480, h: 30 }`.
  - `RANGE_SPAWN: Vector2 = { x: 150, y: 800 }`
  - `RANGE_CAMERA: Vector2 = { x: 750, y: 400 }` (the room centre; the view is 1600 × 900)
  - `RANGE_COVER: CoverEntry[]` = wood 500, metal 650, glass 800, barrel 1000, all at y 800.
  - `DUMMY_SPOTS: { skinId: string; pos: Vector2 }[]` = `base-human` 1060, `base-female` 1140, `base-robot` 1220, `base-toxic` 1300, `base-cat` 1380, all at y 520.
- `getPlatforms(GameMode.RANGE)` → `RANGE_PLATFORMS`; `getInitialPickups(GameMode.RANGE)` → `[]`; `layoutKeyFor(RANGE, any)` → `'range'`; `spawnPointFor(RANGE)(team)` → copy of `RANGE_SPAWN`.

- [ ] **Step 1: Tests:**
  - every dummy spot and cover lies inside the interior;
  - the interior fits the view: width ≤ 1500 and height ≤ 800, so with the camera at `RANGE_CAMERA` everything is on screen;
  - exactly one cover of each `CoverKind`;
  - each `DUMMY_SPOTS` `skinId` is a `BODY_PRESETS` id, all five present;
  - line of sight: the segment from (150, 750) to each dummy's chest (pos.y − 40) crosses no cover rect (`COVER_SPECS` sizes) and no platform other than the walls;
  - `getInitialPickups(GameMode.RANGE)` is empty; `getCoverLayout(GameMode.RANGE, MapId.DEFAULT)` has 4 pieces with ids `cover_range_0..3`.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement the data and the four one-branch additions.
- [ ] **Step 4:** Pass, plus `src/game/cover` and `src/game/data` suites still green.
- [ ] **Step 5:** Commit `feat(range): the range room, cover row and dummy shelf`.

### Task 3: Dummies and the player's loadout

**Files:**
- Create: `src/game/range/rangeSetup.ts`
- Test: `src/game/range/rangeSetup.test.ts`

**Interfaces:**
- Consumes: `DUMMY_SPOTS` (Task 2), `BODY_PRESETS` and `presetBuild` (`src/game/build`), `WEAPONS_DATA`, `createRangeState()` (Task 1).
- Produces:
  - `createDummies(): Entity[]`: one per spot, `id: 'dummy_<skinId>'`, `type: 'bot'`, `dummy: true`, `team: Team.NONE`, preset palette and `build: presetBuild(skinId)` (no random parts), `facingRight: false`, `aim: Math.PI` (pointing at the spawn), machine gun held, health 100, armour 0, width 30, height 72.
  - `rangeLoadout(): Weapon[]`: a fresh copy of every `WeaponType`, in enum order (9 weapons).
  - `setupRange(state: GameState, local: Entity): void`: sets `local.invulnerable = true`, `local.inventory = rangeLoadout()`, `local.weapon = local.inventory[0]`, pushes `createDummies()`, sets `state.range = createRangeState()`.

- [ ] **Step 1: Tests:** 5 dummies with the five preset ids, all `dummy: true`, `type: 'bot'`, standing on their spots; loadout has 9 distinct weapon types and is a fresh copy (mutating ammo does not change `WEAPONS_DATA`); `setupRange` marks only the local player invulnerable.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat(range): dummies per base and the nine-weapon loadout`.

### Task 4: Shared hooks: no bot brain, invulnerable

**Files:**
- Modify: `src/game/systems/physics.ts` (~line 201, the bot branch)
- Modify: `src/game/systems/combat.ts` (`applyDamage`)
- Create: `src/game/range/dummyControls.ts`
- Test: `src/game/range/dummyControls.test.ts`, `src/game/systems/invulnerable.test.ts`

**Interfaces:**
- Produces: `dummyControls(p: Entity, range: RangeState | undefined): { inputX: 0; wantsJump: false; wantsDown: boolean; wantsProne: boolean; isFlying: false }`: `wantsDown` for `'crouch'`, `wantsProne` for `'prone'` from `range.stance` (default stand).
- physics.ts: in the bot branch, `p.dummy` → `controls = dummyControls(p, state.range); applyStance(p, controls);`, no `updateBotAI`, no grapple.
- combat.ts `applyDamage`: after `push` is defined and before the wound / damage code: `if (target.invulnerable) { push(); return; }`. Move the existing `rollTankIgnition` call below this check; nothing else moves.

- [ ] **Step 1: Tests:**
  - `updatePhysics` over 120 ticks with a dummy and no other input: the dummy fires nothing (`state.projectiles` empty) and keeps its x within ±1;
  - with `state.range.stance = 'prone'` the dummy is prone after one tick (`isProne`, `PRONE_HEIGHT`);
  - an invulnerable target hit for 9999 and for a railgun beam through armour keeps health, armour, no `wound`, no `burnUntil` from ignition, is not dead, and **does** get velocity from the knockback;
  - regression: the same calls on a normal fighter still damage and kill.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement the two hooks and `dummyControls`.
- [ ] **Step 4:** Pass, plus the full `src/game/systems` suite.
- [ ] **Step 5:** Commit `feat(range): dummies skip the bot brain, invulnerable fighters take knockback only`.

### Task 5: Range state, keys, tick and reset

**Files:**
- Create: `src/game/range/rangeKeys.ts`, `src/game/range/rangeTick.ts`, `src/game/range/rangeReset.ts`
- Test: one `.test.ts` beside each

**Interfaces:**
- Consumes: `RangeState`, `nextStance`, `DUMMY_RETURN_MS` (Task 1).
- `rangeKeys.ts`: `applyRangeKey(code: string, range: RangeState): boolean`: KeyC → next stance, KeyK → toggle armoured, KeyH → toggle outlines, KeyR → `resetRequested = true`; returns true when handled.
- `rangeTick.ts`: `tickRange(state: GameState, localId: string, now: number): void`, called every fixed step **before** `updatePhysics`. In order:
  1. if `resetRequested`: `resetRange(state, now)` and clear the flag;
  2. local player: every inventory weapon `ammo = maxAmmo`, `jetpackFuel = maxFuel`;
  3. dummies: a dead dummy not yet in `diedAt` → record `now` and set `respawnTimer = Number.MAX_SAFE_INTEGER` (so the normal respawn never takes it); one dead for ≥ `DUMMY_RETURN_MS` → `reviveDummy`;
  4. living dummies: `armor` follows the toggle (100 or 0) when it changes. Keep the last applied value in a module `WeakMap<RangeState, boolean>` or a field; refill to 100 only on a toggle or a revive, not every tick, so armour damage stays visible.
- `rangeReset.ts`:
  - `reviveDummy(state: GameState, d: Entity, now: number): void`: alive at its `DUMMY_SPOTS` position, health 100, armour per toggle, `vel` 0, no `wound`, extinguished, `delete diedAt[id]`;
  - `resetRange(state: GameState, now: number): void`: every cover `hp = COVER_SPECS[kind].hp`, `returnsAt` and `fuseAt` cleared; every dummy revived (dead or alive); projectiles, beams, smokes, particles, decals, corpses and floating texts emptied; the local player extinguished and back at full health.

- [ ] **Step 1: Tests:**
  - key mapping;
  - ammo and fuel refilled after a shot;
  - a killed dummy stays dead 2999 ms and is alive at its spot at 3000 ms; the normal respawn (`updatePhysics`) never moves it to the player spawn;
  - **R during the hold:** revived at once and not revived again at +3 s (Review Focus 3);
  - a dummy killed prone comes back prone after the next physics tick;
  - armour toggle sets 100 on all living dummies once; damage then lowers it and the next tick does not refill;
  - reset restores a broken glass pane (hp 60, no `returnsAt`) and clears a wound (Review Focus 4).
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat(range): stance, armour, outline and reset keys; dummies return after 3 s`.

### Task 6: Damage readout

**Files:**
- Create: `src/game/range/rangeReadout.ts`
- Test: `src/game/range/rangeReadout.test.ts`

**Interfaces:**
- `interface ReadoutMemory { last: Record<string, number>; hits: Record<string, { at: number; amount: number }[]> }`; `createReadoutMemory(): ReadoutMemory`.
- `trackRangeDamage(memory: ReadoutMemory, state: GameState, now: number): void`, called after `updatePhysics` each step. For each dummy, value = health + armour; for each cover, value = hp. A drop since the last step is logged. For cover only, `emitText(x, y − h − 10, String(Math.round(drop)), '#facc15')`, because fighters already get the game's own damage number. A rise (revive, reset, return) just updates `last`. Entries older than 3000 ms are dropped.
- `recentDamage(memory: ReadoutMemory, id: string, now: number): number`: the sum of the last 3000 ms, rounded.

- [ ] **Step 1: Tests:** two hits 1 s apart sum; at +3.5 s the first is gone; burn damage (applied via `applyDamage` with `{ burn: true }`) counts; an armoured railgun wound's bleed counts (Review Focus 4); a cover hit emits one floating text with the drop; a revive does not log negative damage.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat(range): per-target damage log and cover damage numbers`.

### Task 7: On-world overlay (bars, totals, hit zones)

**Files:**
- Create: `src/game/render/range/rangeOverlay.ts`
- Test: `src/game/render/range/rangeOverlay.test.ts`

**Interfaces:**
- `class RangeOverlay { constructor(layer: Container); sync(state: GameState, memory: ReadoutMemory, now: number): void; destroy(): void }`
  - One `Graphics` (cleared each sync) and one pooled `Text` per target id (created once, reused, hidden when its target is gone).
  - Per living dummy: health bar 40 × 4 px above `hitRect(d).y − 12`; armour bar above it when armour > 0; the 3 s total as text above the bars when > 0.
  - Per intact cover: hp bar over the piece; 3 s total when > 0.
  - `state.range.showHitZones`: a 1 px outline of `hitRect(d)` for each living dummy.
  - `destroy()` uses `{ children: true, context: true }`.

- [ ] **Step 1: Tests** (headless, like other render tests): with `showHitZones` false no outline rect is drawn; with it true one rect per living dummy, equal to `hitRect`; a dummy with `recentDamage` 0 has a hidden text; `destroy` leaves no children.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat(range): health, armour and damage readout over targets, hit-zone outlines`.

### Task 8: Legend, route and the "nothing counts" guard

**Files:**
- Create: `src/components/range/RangeLegend.tsx`, `src/components/range/useRangeRoute.ts`
- Modify: `src/App.tsx` (call `useRangeRoute`), `src/components/hud/useStatsCollector.ts`, `src/components/hud/useMatchRewards.ts`
- Test: `src/components/range/RangeLegend.test.tsx`, `src/components/range/useRangeRoute.test.ts`, guard tests in the two hooks' test files

**Interfaces:**
- `RANGE_HASH = '#range'`.
- `useRangeRoute(hash: string, isPlaying: boolean, actions: { startGame(mode: GameMode): void }): void`: when the hash becomes `#range` and nothing is playing → `startGame(GameMode.RANGE)` (network mode stays OFFLINE). When a RANGE game ends (`isPlaying` goes false), `history.replaceState` drops the hash.
- `RangeLegend({ range }: { range: RangeState })`: a small fixed panel, bottom left, with the lines `1–9 weapons`, `C stance: <stance>`, `K armour: on/off`, `H hit zones: on/off`, `R reset`, `Esc exit`.
- Guard: both hooks return early (credit nothing, no reward) when `state.current.mode === GameMode.RANGE`.

- [ ] **Step 1: Tests:**
  - hash `#range` while not playing → one `startGame(RANGE)`; the same hash on re-render → no second call;
  - after the game ends the hash is cleared, so the menu stays (Review Focus 1);
  - the legend shows current values;
  - with mode RANGE and kills in `playerStats`, the collector adds nothing and the reward is null; with mode DEATHMATCH it still credits (Review Focus 5).
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat(range): #range route, key legend; the range counts nowhere`.

### Task 9: Wire it into GameCanvas, check in the browser, release notes

**Files:**
- Modify: `src/components/GameCanvas.tsx`
- Create: `src/game/range/rangeCamera.ts` (`pinRangeCamera(state: GameState): void`, sets `state.camera.x/y` to `RANGE_CAMERA`)
- Modify: `CHANGELOG.md`
- Test: `src/game/range/rangeCamera.test.ts`, `src/game/range/rangeMatch.test.ts`

**Interfaces / wiring** (all guarded by `gameMode === GameMode.RANGE`):
- `initLevel`: after the local player is pushed, `setupRange(state, local)`; the bot loop does not run.
- Fixed step (offline branch): `tickRange(state, 'player', now)` before `updatePhysics`; after it `pinRangeCamera(state)` and `trackRangeDamage(memory, state, now)`, then the existing `syncFromGameState`.
- `onKeyDown`: `applyRangeKey(e.code, state.range)` before the normal handling (number keys and Esc unchanged).
- Layers: a `RangeOverlay` on the world container next to `botPathLayer`, synced each frame, destroyed in cleanup.
- JSX: `<RangeLegend range={state.range} />` when RANGE.

- [ ] **Step 1: Test** `rangeMatch.test.ts`: build a state like `initLevel` does for RANGE (`getPlatforms`, `getCoverLayout`, `setupRange`) and run 600 ticks of `tickRange` + `updatePhysics` + `pinRangeCamera` with the player firing the rocket launcher at their own feet. The player is alive at full health, the camera stays at `RANGE_CAMERA`, no `bot_*` ids exist (Review Focus 2). A Deathmatch state built the same way has no `dummy` and no `invulnerable` (Review Focus 5).
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Wire GameCanvas as listed.
- [ ] **Step 4:** Full suite `npx vitest run`, server suite, `npm run build`, `npx tsc --noEmit -p .` (only the 3 old errors).
- [ ] **Step 5: Browser check** (Playwright 1.57, 1512×700, dev server on :3006):
  - open `#range`: all targets on screen;
  - each weapon at each target;
  - C, K (railgun takes a leg off), H, R;
  - burning and bleed totals;
  - Esc → menu and stays there;
  - a normal Deathmatch afterwards has bots and counts XP.

  Screenshots in the scratchpad. No page errors.
- [ ] **Step 6:** CHANGELOG: a `### 🎯 Test range (internal)` section under the next unreleased version, with no "What's new" point for players. Commit `feat(range): wire the test range into the game loop`.
