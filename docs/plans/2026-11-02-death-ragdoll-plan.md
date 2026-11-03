# Death Ragdolls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A killed fighter falls, is thrown, is torn apart or is cut in two depending on the killing blow, as a jointed ragdoll drawn with the real fighter art.

**Architecture:** The simulation decides the *kind* of death from the damage source (pure `deathKind`) and sends it in the `DEATH` event; it never simulates bodies. Every display (offline game, online client, menu preview) turns the event into a `Corpse`: verlet points + links + joint limits stepped at the physics tick rate, pushed again by later explosions. Whole bodies are drawn by building a `FighterPose` from the points and calling `drawFighter`; torn pieces and rail halves reuse the part shapes in `ragdollView.ts`.

**Tech Stack:** TypeScript, Pixi.js 8, Vitest (jsdom), Vite.

**Spec:** `docs/plans/2026-11-02-death-ragdoll-spec.md` (mockup: `docs/plans/2026-11-02-death-ragdoll-mockup.html`, its `stepBodies`, `LIMITS` and scene impulses are the starting values).

## Global Constraints

- Death kinds: machine gun, plasma, no weapon (zone, fall) → `fall`; shotgun within 120 world units of the shooter → `thrown`, farther → `fall`; rocket/grenade direct hit or overkill ≥ 30 → `gib`, else `thrown`; railgun → `cut`; chainsaw → `gib`.
- Overkill = the killing hit's damage after armor − the victim's health right before the hit.
- A body lies 3.5 s then fades 1 s; gib pieces lie 2 s then fade 1 s. At most 12 corpses; a 13th starts the oldest one's fade.
- Lying corpses are pushed by later `EFFECT explosion` events.
- Cosmetics never live in the simulation; the server never steps corpses. Each client simulates its own from the event.
- Fixed 120 ticks/s (`FIXED_STEP_MS`); corpses step in the same tick as particles. `GRAVITY` = 0.36 per tick².
- Entity `pos` = (centre x, feet y); platforms are top-left `{x, y, w, h}`.
- Builds from the network go through `sanitizeBuild` before drawing.
- Files ≤ 200 lines, one responsibility, named exports, no silent catches.
- Pixi: destroy Graphics with `{ children: true, context: true }`.
- Mockup values are for a 136 px fighter at 60 fps; the game fighter is 72 units at 120 ticks/s: start from mockup lengths × 0.53 and velocities × 0.53 / 2, then tune by eye.

## Review Focus

1. A fighter killed while touching or inside a platform (against a wall, under a low ceiling): the corpse must slide out, not explode or jitter. → Task 3 test `corpse born inside a platform is pushed out calmly`.
2. A fighter killed far below the map (fall death at y > 2500) or with no platforms around: points stay finite and the corpse is removed at the end of its life. → Task 4 test `corpse with nothing under it is removed on time`.
3. A `DEATH` event from an older host without `kind`/`from`: draw a plain fall, never throw an error. → Task 4 test `DEATH without kind falls`.
4. Round restart or leaving a match while corpses lie: every corpse view is destroyed and the next match starts clean. → Task 5 test `views of removed corpses are destroyed`.
5. A suicide by your own rocket (rocket jump into a wall): kind follows the same overkill rule, the body is launched away from the blast. → Task 2 test `self-inflicted rocket death still follows overkill`.

---

### Task 1: Kind of death from the damage source

**Files:**
- Create: `src/game/systems/deathKind.ts`
- Test: `src/game/systems/deathKind.test.ts`

**Interfaces:**
- Produces:
  - `export type DeathKind = 'fall' | 'thrown' | 'gib' | 'cut'`
  - `export interface DamageSource { weapon?: WeaponType; direct?: boolean; from?: Vector2; shooterDist?: number }` (`direct`: the projectile itself hit the victim; `from`: blast centre, shooter muzzle or beam origin)
  - `export const GIB_OVERKILL = 30`, `export const SHOTGUN_POINT_BLANK = 120`
  - `export const deathKind = (source: DamageSource, overkill: number): DeathKind`

- [ ] **Step 1: Write the failing tests** — `it.each` over the Global Constraints table, including the spec's examples:

```ts
expect(deathKind({}, 50)).toBe('fall');                                            // zone / fall
expect(deathKind({ weapon: WeaponType.MACHINE_GUN }, 90)).toBe('fall');
expect(deathKind({ weapon: WeaponType.PLASMA_GUN }, 90)).toBe('fall');
expect(deathKind({ weapon: WeaponType.SHOTGUN, shooterDist: 100 }, 5)).toBe('thrown');
expect(deathKind({ weapon: WeaponType.SHOTGUN, shooterDist: 300 }, 5)).toBe('fall');
expect(deathKind({ weapon: WeaponType.ROCKET_LAUNCHER, direct: true }, 1)).toBe('gib');
expect(deathKind({ weapon: WeaponType.ROCKET_LAUNCHER }, 55)).toBe('gib');      // 5 HP, blast 60
expect(deathKind({ weapon: WeaponType.ROCKET_LAUNCHER }, 1)).toBe('thrown');    // 55 HP, edge 56
expect(deathKind({ weapon: WeaponType.GRENADE_LAUNCHER }, 20)).toBe('thrown');  // 30 HP, 50
expect(deathKind({ weapon: WeaponType.GRENADE_LAUNCHER }, 35)).toBe('gib');     // 20 HP, 55
expect(deathKind({ weapon: WeaponType.RAILGUN }, 0)).toBe('cut');
expect(deathKind({ weapon: WeaponType.CHAINSAW }, 0)).toBe('gib');
```

- [ ] **Step 2: Run** `npx vitest run src/game/systems/deathKind.test.ts` — Expected: FAIL (module not found)
- [ ] **Step 3: Implement `deathKind`** — a switch on `source.weapon`; overkill compared with `>= GIB_OVERKILL`; shotgun with no `shooterDist` counts as far.
- [ ] **Step 4: Run** the same command — Expected: PASS
- [ ] **Step 5: Commit** `feat: decide the kind of death from the damage source`

### Task 2: Send the cause of death in the DEATH event

**Files:**
- Modify: `src/game/systems/combat.ts` (`applyDamage`, `createExplosion`, railgun and chainsaw branches of `fireWeapon`)
- Modify: `src/game/systems/physics.ts` (projectile hit ~line 321; zone and fall calls stay without a source)
- Modify: `src/game/systems/effects.ts` (`deathEvent`, `emitDeath`)
- Modify: `src/game/systems/events.ts` (`DEATH` event, `RagdollColors`)
- Test: `src/game/systems/deathCause.test.ts`

**Interfaces:**
- Consumes: Task 1 `DamageSource`, `deathKind`, `DeathKind`.
- Produces:
  - `applyDamage(state, target, attackerId, amount, knockback, knockbackForce = 0, source: DamageSource = {})`
  - `DEATH` event gains `kind?: DeathKind` (optional: older hosts), `from?: Vector2`, `vel: Vector2` (victim velocity), `facing: 1 | -1`, `weapon?: WeaponType` (the victim's held weapon, for the dropped gun)
  - `RagdollColors` gains `jet?: string`
  - `export type DeathEvent = Extract<GameEvent, { type: 'DEATH' }>` (events.ts)
  - `deathEvent(e: Entity, kind: DeathKind = 'fall', from?: Vector2)`; `emitDeath(e, kind, from)` (the menu preview keeps calling `deathEvent(p)` and gets `fall`)
- Callers: projectile hit passes `{ weapon: proj.type, direct: true, from: prevPos, shooterDist }` (distance from the owner's `pos` to the victim's `pos`, if the owner is found); `createExplosion` passes `{ weapon: weaponType, from: pos }`; railgun `{ weapon: RAILGUN, from: origin }`; chainsaw `{ weapon: CHAINSAW, from: origin }`. Overkill is computed inside `applyDamage` from the health before `target.health -= dmg`.

- [ ] **Step 1: Write the failing tests** (event bus listener as in `effects.test.ts`):
  - `machine-gun kill sends kind fall`: 10 HP victim, projectile-style call with `{ weapon: MACHINE_GUN, direct: true }` → `DEATH.kind === 'fall'`.
  - `direct rocket kill sends gib`: `{ weapon: ROCKET_LAUNCHER, direct: true }`, 40 HP, 65 damage → `gib`.
  - `edge of a blast sends thrown`: `createExplosion` 140 units away from a victim with 3 HP → `thrown`, `from` equals the blast centre.
  - `near blast on a low fighter sends gib`: blast 10 units away, victim 5 HP → `gib`.
  - `armor counts before overkill`: 30 HP + 100 armor, 60 blast damage → no death (armor absorbs), no `DEATH`.
  - `railgun sends cut, chainsaw sends gib` via `fireWeapon`.
  - `zone damage sends fall` (`applyDamage(state, p, '', 6, {x:0,y:0})` on a 5 HP fighter).
  - `self-inflicted rocket death still follows overkill`: owner = victim, 4 HP, blast at the feet → `gib`; 30 HP after a weak edge → `thrown`.
  - `event carries vel, facing, weapon and jet colour`.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/deathCause.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement** the signature change, the overkill, the call sites and the event fields above.
- [ ] **Step 4: Run** `npx vitest run src/game/systems` — Expected: all PASS (existing `effects.test.ts` death tests still pass)
- [ ] **Step 5: Commit** `feat: send the kind and cause of death with the DEATH event`

### Task 3: Corpse body and its physics step

**Files:**
- Create: `src/game/systems/ragdoll/corpseBody.ts` (types, point layout, links, joint limits, `createCorpse`)
- Create: `src/game/systems/ragdoll/corpseStep.ts` (verlet step, links, limits, platform collision)
- Test: `src/game/systems/ragdoll/corpseStep.test.ts`

**Interfaces:**
- Consumes: `solvePose` and `RIG_SCALE` (`render/fighter/fighterPose.ts`), `gripPoints` (`weaponGrips.ts`), Task 2 `DEATH` event, `GRAVITY`.
- Produces:
  - `export type CorpsePointId = 'hip' | 'neck' | 'head' | 'shF' | 'elF' | 'haF' | 'shB' | 'elB' | 'haB' | 'knF' | 'anF' | 'knB' | 'anB' | 'gunA' | 'gunB'`
  - `export interface CorpsePoint { x: number; y: number; px: number; py: number }`
  - `export interface CorpseLink { a: CorpsePointId; b: CorpsePointId; len: number; joint?: boolean; waist?: boolean; min?: boolean }` (`joint`: torn by a gib; `waist`: cut by the railgun; `min`: joint limit, only pushes apart)
  - `export interface Corpse { id: string; kind: DeathKind; facing: 1 | -1; points: Record<CorpsePointId, CorpsePoint>; links: CorpseLink[]; age: number; fadeAt: number; removeAt: number; colors?: RagdollColors; weapon?: WeaponType }` (ages in ticks)
  - `export const createCorpse = (e: DeathEvent): Corpse` — points from an idle `solvePose` (shoulders, hip, head, limb joints/ends; neck = `upperPoint(frame, 0, -19)`; gun points along `gunTopLeft`/`gunAngle`), converted to world: `x = e.x + facing * RIG_SCALE * px`, `y = e.y + RIG_SCALE * py`. Links: torso triangle hip–neck–shoulders rigid, head–neck (`joint`), shoulders–elbows–hands, hip–knees–ankles, shoulder/hip attachments (`joint`), hip–neck and hip–shoulders also `waist`; gun A–B. Limits as the mockup's `LIMITS` (factors 0.62 / 0.55 / 0.8 / 0.9). `fadeAt` = 420, `removeAt` = 540 (gib: 240 / 360).
  - `export const stepCorpse = (c: Corpse, platforms: Platform[]): void` — one 120 Hz tick: verlet with 0.995 damping and `GRAVITY`, 8 relaxation passes over links (`min` links only when shorter), platform collision pushing a point out of a rect through the nearest side, ground friction on the top side (keep 25% of the vertical, 75% of the horizontal speed as in the mockup), then `age++`.
  - `export const speedOf = (c: Corpse): number` (largest point speed, for tests and rest checks)

- [ ] **Step 1: Write the failing tests**:
  - `a fresh corpse matches the standing fighter`: `createCorpse` at (100, 500) facing 1 → head above hip by 25–35 units, feet within 3 units of y 500.
  - `joint limits hold`: drop a corpse from 200 units onto a platform; every 10 ticks for 600 ticks, hip–ankle ≥ 0.6 × its rest length and shoulder–hand ≥ 0.5 ×.
  - `a body comes to rest on a platform`: after 480 ticks, every point y ≤ platform top + 0.5 and `speedOf(c) < 0.05`.
  - `a body slides off an edge`: corpse on the last 10 units of a platform with velocity +2 x → after 240 ticks the hip is below the platform top.
  - `corpse born inside a platform is pushed out calmly`: hip 10 units inside a wall rect → after 60 ticks no point is inside the rect and `speedOf(c) < 8`.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/ragdoll` — Expected: FAIL
- [ ] **Step 3: Implement** `corpseBody.ts` and `corpseStep.ts` as above.
- [ ] **Step 4: Run** the same command — Expected: PASS
- [ ] **Step 5: Commit** `feat: jointed corpse body with joint limits and platform collision`

### Task 4: Launch by kind, explosion push, lifetime and cap — replace the old ragdoll

**Files:**
- Create: `src/game/systems/ragdoll/corpseLaunch.ts` (`launchCorpse`, `pushCorpses`)
- Create: `src/game/systems/ragdoll/corpses.ts` (`addCorpse`, `updateCorpses`, cap)
- Modify: `src/types.ts` (`GameState.ragdollParts: RagdollPart[]` → `corpses: Corpse[]`; delete `RagdollPart`)
- Modify: `src/game/systems/effects.ts` (`DEATH` → `addCorpse`; `EFFECT explosion` → `pushCorpses`)
- Modify: `src/game/systems/effectSpawn.ts` (delete `createRagdoll`), `src/game/systems/particles.ts` (delete `updateRagdolls`)
- Modify: every `ragdollParts` / `updateRagdolls` user: `physics.ts` (2), `net/clientSession.ts`, `net/roomSetup.ts`, `components/GameCanvas.tsx` (2), `components/menu/preview/previewWorld.ts`, `previewDirector.ts`, `previewDirector.test.ts`, `test/mocks.ts`, `test/botFixtures.ts`
- Test: `src/game/systems/ragdoll/corpses.test.ts`, update `src/game/systems/effects.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `export const launchCorpse = (c: Corpse, from: Vector2 | undefined, vel: Vector2): void` — sets point velocities by `c.kind`, from the mockup scenes (scaled per Global Constraints): `fall` buckles knees and tips the upper body away from `from`; `thrown` pushes every point away from `from` with falloff plus lift; `gib` removes `joint` links and `min` links, then scatters pieces; `cut` removes `waist` links and limits touching the hip, throws the upper half along `from`→hip, lets the legs collapse. All kinds add the victim's `vel`.
  - `export const pushCorpses = (corpses: Corpse[], x: number, y: number, size = 1): void` — impulse away from (x, y) for points within 150 × size, strength falling to 0 at the edge; resting corpses wake up.
  - `export const MAX_CORPSES = 12`
  - `export const addCorpse = (state: GameState, e: DeathEvent): Corpse` — `createCorpse` + `launchCorpse` (missing `kind` → `'fall'`); when the cap is reached, the oldest corpse gets `fadeAt = min(fadeAt, age)`.
  - `export const updateCorpses = (state: GameState): void` — `stepCorpse` each, drop those with `age >= removeAt`.
  - The `DEATH` branch of `applyEffectEvent` keeps the decal, sprays the 40 blood droplets away from `from` (as today when `from` is missing), sanitizes `parts.build`, then calls `addCorpse`.

- [ ] **Step 1: Write the failing tests** (`corpses.test.ts`, one corpse on a floor platform unless noted):
  - `fall ends lying down`: after 480 ticks |neck.y − hip.y| < |neck.x − hip.x|.
  - `thrown flies away from the blast`: `from` 40 units right of the hip → after 30 ticks the hip moved left by > 20 units and up at some tick.
  - `gib separates the pieces`: after 30 ticks head–neck distance > 2 × their link length; no `joint` links remain.
  - `cut separates the halves`: no `waist` links remain; after 60 ticks head is > 30 units from where it started and the ankles moved < 10.
  - `explosion pushes a lying body`: rested corpse, `pushCorpses` 30 units away → `speedOf > 1`; a corpse 400 units away stays at rest.
  - `the cap fades the oldest`: add 13 → the first one has `fadeAt <= age`.
  - `corpse with nothing under it is removed on time`: no platforms, 540 ticks of `updateCorpses` → `state.corpses` empty and no `NaN` seen on the way.
  - `DEATH without kind falls` (effects.test): event without `kind`/`from` → one corpse of kind `fall`, no throw.
  - `blood flies away from the hit` (effects.test): `from` 50 units right of the victim → the mean `vel.x` of the blood particles is < 0.
  - Replace the old effects.test ragdoll assertions (`ragdollParts`) with `corpses` and the build check on `corpse.colors.build`.
- [ ] **Step 2: Run** `npx vitest run src/game/systems/ragdoll src/game/systems/effects.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement** the two modules, the `GameState` field change and every call site listed above.
- [ ] **Step 4: Run** `npx tsc --noEmit -p . 2>&1 | grep "^src/"` — Expected: no output; then `npx vitest run` — Expected: all PASS
- [ ] **Step 5: Commit** `feat: corpses launched by kind of death and pushed by explosions`

### Task 5: Draw corpses with the real fighter art

**Files:**
- Create: `src/game/render/ragdoll/corpsePose.ts` (`poseFromCorpse`)
- Create: `src/game/render/ragdoll/corpseView.ts` (create / update / destroy one corpse view)
- Modify: `src/game/render/fighter/fighterView.ts` (`FighterFrame.weaponless?: boolean`: hide the weapon sprite and skip `drawFallbackGun`)
- Modify: `src/game/render/ragdollView.ts` (draw a piece from a `CorpsePiece` instead of a `RagdollPart`; keep the shapes)
- Modify: `src/game/systems/renderer.ts` (ragdoll block → corpse views in `cache.corpses`), `src/components/GameCanvas.tsx` (`restartRound` clears `cache.corpses`)
- Test: `src/game/render/ragdoll/corpsePose.test.ts`, `src/game/render/ragdoll/corpseView.test.ts`, update `src/game/render/ragdollView.test.ts`

**Interfaces:**
- Consumes: Tasks 3–4 (`Corpse`, `CorpsePointId`), `drawFighter`, `createFighterView`, `lookFromSetup`, `IDLE_PARTS`, `heldWeaponKey`, `gripPoints`.
- Produces:
  - `export const poseFromCorpse = (c: Corpse): { pose: FighterPose; origin: Vector2 }` — `origin` = world hip; rig point = `((x − origin.x) × facing / RIG_SCALE, (y − origin.y) / RIG_SCALE)`; `lean = atan2(neck.x − hip.x, −(neck.y − hip.y))` in rig space, `lift = 0`; limbs from shoulder/elbow/hand and hip/knee/ankle points; `headTilt` from neck→head minus lean; gun fields unused.
  - `export interface CorpsePiece { part: 'head' | 'torso' | 'upper' | 'legs' | 'arm-front' | 'arm-back' | 'leg-front' | 'leg-back'; at: Vector2; rotation: number }` and `export const piecesOf = (c: Corpse): CorpsePiece[]` (`gib`: head, torso, two arms, two legs; `cut`: `upper` = torso top + head + arms, `legs` = hip + both legs)
  - `export interface CorpseView { root: Container; fighter?: FighterView; pieces?: Graphics[]; gun: Sprite }`
  - `export const createCorpseView = (c: Corpse, textures: Record<string, Texture | undefined>): CorpseView`, `export const updateCorpseView = (v: CorpseView, c: Corpse): void` (alpha = 1 until `fadeAt`, then linear to 0 at `removeAt`), `export const destroyCorpseView = (v: CorpseView): void`
- Whole bodies (`fall`, `thrown`): `drawFighter` with `{ pose, look: lookFromSetup(colors, build), facing, grip, weaponless: true, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0, weaponType }`, root at `origin`. Torn bodies (`gib`, `cut`): one Graphics per piece from `ragdollView` shapes, red ends at torn joints. Gun: the held-weapon texture stretched between `gunA` and `gunB`.

- [ ] **Step 1: Write the failing tests**:
  - `a fresh corpse poses like the idle fighter`: `poseFromCorpse(createCorpse(event))` vs idle `solvePose` → every joint within 0.5 rig units, `lean` within 0.02.
  - `a corpse lying on its back has lean near ±π/2`.
  - `weaponless frame shows no weapon`: `drawFighter` with `weaponless: true` → `view.weapon.visible === false` and the front Graphics has no fallback-gun polygon (compare instruction count with and without a weapon, as `ragdollView.test.ts` compares drawings).
  - `gib draws six pieces, cut draws two`.
  - `views of removed corpses are destroyed`: run the renderer's corpse sync with one corpse, then with `state.corpses = []` → the view's root is destroyed (`root.destroyed === true`) and `cache.corpses.size === 0`.
- [ ] **Step 2: Run** `npx vitest run src/game/render` — Expected: FAIL
- [ ] **Step 3: Implement** the modules and the renderer / GameCanvas changes above.
- [ ] **Step 4: Run** `npx vitest run` and the `tsc` check — Expected: all PASS, no `src/` errors
- [ ] **Step 5: Commit** `feat: draw corpses with the fighter art, pieces for torn bodies`

### Task 6: Tune in the real game, release notes

**Files:**
- Modify: values in `corpseLaunch.ts` / `corpseStep.ts` only (tuning)
- Modify: `src/components/menu/patchNotes.ts`, `CHANGELOG.md`; add `public/assets/patch/death-before.jpg`, `death-after.jpg`
- Modify: `docs/plans/2026-11-02-death-ragdoll-spec.md` (status line)

- [ ] **Step 1: Run the game** (`npx vite --port <free port>` from the worktree) at 1512 × 700 and produce each kind next to the local player by emitting `DEATH` events through the dev-served `/src/game/systems/events.ts` (camera from the `GameCanvas` state ref, as done for 0.4.9): machine gun, shotgun close, rocket edge, rocket overkill, railgun, chainsaw, then an explosion next to a lying body.
- [ ] **Step 2: Compare with the mockup** frame by frame (screenshots every 100 ms); tune impulses, damping and friction until each kind reads like the mockup scene; check 8 simultaneous deaths keep 120 fps.
- [ ] **Step 3: Patch note** next free 0.4.x (check `origin/main` first), EN + RU, one before/after pair; CHANGELOG entry; spec status "implemented".
- [ ] **Step 4: Run** `npx vitest run` and the `tsc` check — Expected: all PASS
- [ ] **Step 5: Commit** `docs: patch notes for weapon-dependent deaths`, push the branch, open the PR (merge only on the user's word).
