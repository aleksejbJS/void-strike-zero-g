# Fighter Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players build a fighter from parts (helmet, visor, ears, tail, jetpack, flame, pattern, badge), parts open one per level from match XP, and every client draws everyone's build.

**Architecture:** A pure data layer in `src/game/build/` (part lists, presets, sanitising, unlocks, XP) is shared by client, server and browser host. `Entity.build` carries the build through the existing snapshot (players are sent whole). `FighterLook` swaps today's `style`/`accent` for `build` plus two colours; drawing moves into focused modules under `src/game/render/fighter/parts/`. Animated parts (tail, floppy ears, lamp, wings) read a spring-smoothed `PartMotion` kept per fighter in the animator.

**Tech Stack:** TypeScript 5.8, Pixi.js 8 (Graphics), React 19, Tailwind (Hazard Bay tokens), Vitest + jsdom.

**Spec:** `docs/plans/2026-11-02-fighter-builder-spec.md`

## Global Constraints

- No file over 200 lines; one responsibility per file; named exports. Files already over 200 (`GameCanvas.tsx`, `uiStore.tsx`) get at most a few lines each; new logic goes in new files.
- Handle every error explicitly; no silent `catch {}`. Storage failures: `console.warn` with the key and fall back to defaults.
- Code comments and docs in English; every new player-facing label in both `en` and `ru`.
- Rig-space drawing, outline via `OUTLINE`/`OUTLINE_W`, fills via `plate`/`outlinedPoly`/`dot`/`limb`, as in `fighterParts.ts`.
- `Graphics.destroy` always with `{ children: true, context: true }`.
- XP: `MATCH_XP = 20`, `WIN_XP = 30`, `XP_PER_LEVEL = 50`, level = 1 + floor(xp / 50). Achievements give no level XP.
- Item *k* (1-based) of `UNLOCK_ORDER` opens at level *k* + 1; 30 items.
- The host validates part ids but never checks unlocks.
- Base branch: create `feature/fighter-builder` from `feature/seamless-limbs` (it already changes `fighterView.ts`/`fighterParts.ts`/`ragdollView.ts`).
- Test command: `npx vitest run <path>`; full suite `npx vitest run`; types `npx tsc --noEmit -p .` (3 errors in `vitest.config.ts` and `server/src/tunneling.ts` pre-exist and are not ours).

## Review Focus

1. A returning player (saved `selectedSkin` + custom colours, no saved build) opens the game: they get that skin's preset parts and keep their custom colours. → Task 1 test `migrates a saved skin into its preset build`.
2. Browser storage blocked or holding garbage JSON: setup screen and match start still work with defaults, a warning is logged. → Task 1 test `falls back to the default build on bad JSON`, Task 2 test `reads 0 XP when storage throws`.
3. An old client (or bot) sends no `build`, or a build with unknown ids / a number like 1e9: the host keeps them in the game with a sane build. → Task 9 tests in `validation.test.ts`.
4. The end of a match is seen on many frames, and a new match starts afterwards: XP is given exactly once per match end, and again for the next one. → Task 2 tests `awards once per end key`.
5. A fighter facing left (mirrored) or running backwards: the tail trails behind the body, not ahead of it. → Task 5 test `tail lifts the same way when facing left`.

---

### Task 1: Build data model, presets, sanitising, saved build

**Files:**
- Create: `src/game/build/buildParts.ts`, `src/game/build/buildPresets.ts`, `src/game/build/sanitizeBuild.ts`, `src/game/build/buildStorage.ts`
- Test: `src/game/build/buildPresets.test.ts`, `src/game/build/sanitizeBuild.test.ts`, `src/game/build/buildStorage.test.ts`

**Interfaces:**
- Produces (`buildParts.ts`):
  ```ts
  export const HELMETS = ['round', 'box', 'dome', 'angular'] as const;
  export const VISORS = ['strip', 'glass', 'slit', 't', 'eyes'] as const;
  export const EARS = ['none', 'cat', 'antennae', 'wolf', 'bunny', 'round', 'horns', 'ram', 'lamp', 'crest'] as const;
  export const TAILS = ['none', 'cat', 'tentacle', 'lizard', 'mech'] as const;
  export const JETPACKS = ['pack', 'tanks', 'rocket', 'wings', 'scrap'] as const;
  export const FLAMES = ['fire', 'blue', 'green', 'purple', 'white'] as const;
  export const PATTERNS = ['none', 'band', 'stripes', 'hazard', 'camo', 'split'] as const;
  export const BADGES = ['none', 'chevron', 'number', 'emblem'] as const;
  export const EMBLEMS = ['skull', 'star', 'bolt'] as const;
  export type HelmetId = typeof HELMETS[number]; // …same for VisorId, EarsId, TailId, JetpackId, FlameId, PatternId, BadgeId, EmblemId
  export const SLOTS = { helmet: HELMETS, visor: VISORS, ears: EARS, tail: TAILS, jetpack: JETPACKS, flame: FLAMES, pattern: PATTERNS, badge: BADGES } as const;
  export type Slot = keyof typeof SLOTS;
  export interface FighterBuild {
      helmet: HelmetId; visor: VisorId; ears: EarsId; tail: TailId; jetpack: JetpackId; flame: FlameId;
      pattern: PatternId; badge: BadgeId; badgeNumber: number; emblem: EmblemId;
      visorColor: string; patternColor: string; // '#rrggbb'
  }
  export const DEFAULT_BUILD: FighterBuild; // round, strip, none, none, pack, fire, none, none, 7, 'skull', '#7fd3ff', '#e5e7eb'
  ```
- Produces: `presetBuild(skinId: string): FighterBuild` (unknown id → `DEFAULT_BUILD`); `sanitizeBuild(raw: unknown, fallback?: FighterBuild): FighterBuild`; `loadBuild(): FighterBuild`, `saveBuild(b: FighterBuild): void` (key `fighterBuild`).

- [ ] **Step 1: Write failing tests**
  - `buildPresets.test.ts`:
    - `human skins get round helmet, strip, no ears, no tail` — `presetBuild('classic')` matches `{ helmet: 'round', visor: 'strip', ears: 'none', tail: 'none', pattern: 'none', visorColor: '#7fd3ff' }`.
    - `robots get the box and the chest band in their accent` — `presetBuild('cyborg')` → `helmet 'box'`, `pattern 'band'`, `patternColor '#8b5cf6'`, `visorColor '#8b5cf6'`.
    - `beasts get cat ears and a cat tail, Hammy has no tail` — `presetBuild('wolf').tail === 'cat'`, `.ears === 'cat'`; `presetBuild('hamster').tail === 'none'`.
    - `aliens get antennae and the tentacle` — `presetBuild('toxic')` → `ears 'antennae'`, `tail 'tentacle'`.
    - `every preset uses only free parts` — for each `SKINS` id, every slot value is in `FREE_PARTS` (import from Task 2 is not available yet: hard-code the free list in the test: helmet round|box, visor strip, ears none|cat|antennae, tail none|cat|tentacle, jetpack pack, flame fire, pattern none|band, badge none).
  - `sanitizeBuild.test.ts`:
    - `keeps a valid build` — round-trips a full valid build unchanged.
    - `replaces unknown ids slot by slot` — `{ ...valid, ears: 'laser', tail: 42 }` → ears/tail from fallback, other slots kept.
    - `clamps the badge number to 0..99 integers` — `1e9 → 99`, `-5 → 0`, `3.7 → 3`, `'x' → fallback.badgeNumber`.
    - `rejects bad colours` — `visorColor: 'red; x'` → fallback colour.
    - `returns the fallback for non-objects` — `null`, `'x'`, `[]`.
  - `buildStorage.test.ts`:
    - `saves and loads a build` (jsdom localStorage).
    - `migrates a saved skin into its preset build` — no `fighterBuild`, `selectedSkin = 'wolf'` → `loadBuild()` equals `presetBuild('wolf')`.
    - `falls back to the default build on bad JSON` — `fighterBuild = '{oops'` → `DEFAULT_BUILD`, and `console.warn` called (spy).
- [ ] **Step 2:** `npx vitest run src/game/build` → FAIL (modules missing).
- [ ] **Step 3: Implement** the four files. Preset table from the spec: human → round/strip/none/none, visorColor `#7fd3ff`; robot → box/strip/none/none/pattern `band`; beast → round/strip/cat/cat (Hammy `hamster` → tail none); alien → round/strip/antennae/tentacle. Non-human `visorColor` and every `patternColor` = the skin's `accent` (fallback `#e5e7eb`). `loadBuild`: parse `fighterBuild` → `sanitizeBuild`; if absent, `presetBuild(localStorage.selectedSkin ?? 'classic')`. Wrap storage access in try/catch that `console.warn`s.
- [ ] **Step 4:** `npx vitest run src/game/build` → PASS.
- [ ] **Step 5: Commit** `feat: add the fighter build model, presets and saved build`

### Task 2: Unlocks, XP progress, match end detection

**Files:**
- Create: `src/game/build/unlocks.ts`, `src/game/build/progress.ts`, `src/game/build/matchOutcome.ts`
- Test: `src/game/build/unlocks.test.ts`, `src/game/build/progress.test.ts`, `src/game/build/matchOutcome.test.ts`

**Interfaces:**
- Consumes: `Slot`, `SLOTS`, `FighterBuild` (Task 1).
- Produces:
  ```ts
  export interface UnlockItem { slot: Slot; id: string; source: 'level'; level: number }
  export const UNLOCK_ORDER: UnlockItem[];            // 30 items, order from the spec, level = index + 2
  export const FREE_PARTS: Record<Slot, readonly string[]>;
  export const XP_PER_LEVEL = 50;
  export const levelForXp: (xp: number) => number;    // 1 + floor(xp / XP_PER_LEVEL)
  export const unlockLevel: (slot: Slot, id: string) => number; // 1 for free parts
  export const isUnlocked: (slot: Slot, id: string, level: number) => boolean;
  export const unlockedBetween: (fromLevel: number, toLevel: number) => UnlockItem[];
  export const enforceUnlocks: (b: FighterBuild, level: number) => FighterBuild; // locked slot → DEFAULT_BUILD's value
  // progress.ts — key 'fighterXp'
  export const MATCH_XP = 20, WIN_XP = 30;
  export interface Reward { gained: number; levelBefore: number; levelAfter: number; unlocked: UnlockItem[] }
  export const loadXp: () => number;
  export const addMatchXp: (won: boolean) => Reward;
  // matchOutcome.ts
  export interface MatchEnd { key: string; won: boolean }
  export const detectMatchEnd: (state: GameState, localId: string) => MatchEnd | null;
  ```
- [ ] **Step 1: Write failing tests**
  - `unlocks.test.ts`: `has 30 items` · `first item is wolf ears at level 2, last is crest at level 31` · `every slot id in the order exists in SLOTS and none is free` · `levelForXp(0)=1, (49)=1, (50)=2, (1500)=31` · `unlockedBetween(1, 3)` returns wolf ears and full-glass visor · `enforceUnlocks swaps a locked tail for none at level 1 and keeps it at level 4` (lizard = item 3).
  - `progress.test.ts`: `a loss gives 20, a win 50` · `reports the parts opened by the level-up` (start at 40 XP, win → levelBefore 1, levelAfter 2, unlocked = [wolf ears]) · `reads 0 XP when storage throws` (stub `localStorage.getItem` to throw; expect 0 and a `console.warn`).
  - `matchOutcome.test.ts` (build minimal `GameState` objects with only the fields read):
    - `null while nothing has ended`.
    - `free-for-all: won when matchWinner.playerId is the local id` · `team modes: won when matchWinner.team is the local player's team` · `draw: not won`.
    - `Hunger Games: won when hungerWinnerId is the local id; no survivors: not won` (key uses `hungerRoundEndsAt`).
    - `Gun Game: won when gunGameWinnerId is the local id` (key uses `matchStartedAt` + winner id).
    - `awards once per end key` — two calls on the same state return the same `key`; a state with a new `matchEndsAt` returns a different key.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Key formats: `match:${matchEndsAt}`, `hunger:${hungerRoundEndsAt}`, `gun:${matchStartedAt}:${gunGameWinnerId}`. Check `matchEndsAt` first, then Hunger, then Gun Game. Storage as in Task 1 (warn, never silent).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat: add part unlocks by level and match XP`

### Task 3: FighterLook carries the build; extents per helmet

**Files:**
- Modify: `src/types.ts` (Entity: `build?: FighterBuild`), `src/game/render/fighter/fighterLook.ts`, `src/game/render/fighter/fighterPose.ts:136-164`, `src/game/render/fighter/fighterPose.test.ts:91-104`, `src/components/setup/characterArt.ts`
- Test: `src/game/render/fighter/fighterLook.test.ts` (create)

**Interfaces:**
- Consumes: `FighterBuild`, `presetBuild`, `HELMETS`, `HelmetId`.
- Produces:
  ```ts
  export interface FighterLook { head: number; torso: number; arm: number; leg: number; jet: number; visor: number; pattern: number; build: FighterBuild }
  export const lookFromEntity: (p: Pick<Entity, 'color'|'headColor'|'torsoColor'|'armColor'|'legColor'|'jetpackColor'|'skinId'|'build'>) => FighterLook; // build ?? presetBuild(skinId)
  export const lookFromSetup: (colors: SetupColors, build: FighterBuild) => FighterLook;
  export const bodyExtents: (pose: FighterPose, helmet?: HelmetId) => { left: number; right: number; top: number };
  ```
  `FighterStyle` is deleted; `flashLook` also lightens `visor` and `pattern`. `CharacterLook` in `characterArt.ts` becomes `{ build: FighterBuild; torso; head; arms; legs; jetpack }` (no `skin`).
- [ ] **Step 1: Failing tests** — `lookFromEntity uses the entity build when present` · `falls back to the skin preset when build is missing` (`skinId 'cyborg'` → `build.helmet === 'box'`, `pattern` = `0x8b5cf6`) · `visor and pattern come from the build colours`. In `fighterPose.test.ts` iterate `HELMETS` instead of styles.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** `headOutline` per helmet: round/dome/angular use the round radius box (dome and angular are drawn inside `HEAD_R`), box keeps the rotated corners. Update every reader of `look.style`/`look.accent` so the project compiles; drawing keeps today's look until Tasks 4–8 replace it (map: robot ⇔ `build.helmet === 'box'`, beast ears ⇔ `build.ears === 'cat'`, alien antennae ⇔ `'antennae'`, robot band ⇔ `pattern === 'band'`, accent ⇔ `look.pattern` for tail/band and `look.visor` for glints).
- [ ] **Step 4:** `npx vitest run src/game/render` and `npx tsc --noEmit -p .` → PASS / only the 3 known errors.
- [ ] **Step 5: Commit** `refactor: drive the fighter look by the build instead of the skin style`

### Task 4: Head — helmets, visors, ears

**Files:**
- Create: `src/game/render/fighter/parts/helmets.ts`, `parts/visors.ts`, `parts/ears.ts`
- Modify: `src/game/render/fighter/fighterParts.ts` (move `drawHead`, `helmetRidge` out), `src/game/render/fighter/fighterView.ts` (new `ears: Graphics` layer under `head`; `headKey`), `src/game/render/ragdollView.ts` (import path only)
- Test: `src/game/render/fighter/parts/head.test.ts`

**Interfaces:**
- Consumes: `FighterLook`, `PartMotionFrame` (defined here as a type, filled by Task 5): `export interface PartMotionFrame { tailLift: number; tailBend: number; tailWave: number; earFlop: number; lampOn: boolean; wingsOpen: number }` in `src/game/render/fighter/parts/partMotionFrame.ts`, plus `export const IDLE_PARTS: PartMotionFrame` (all 0 / false).
- Produces: `drawHead(g: Graphics, look: FighterLook): void` (helmet + visor, cached by `headKey`); `drawEars(g: Graphics, look: FighterLook, m: PartMotionFrame): void` (redrawn every frame, drawn behind the head, same position/rotation as head); `drawVisor(g, visor: VisorId, helmet: HelmetId, color: number): void`; `helmetRidge(g)` re-exported from `helmets.ts`. `FighterView` gains `ears: Graphics`; `headKey` = all of `helmet, visor, ears, head colour, visor colour`.
- [ ] **Step 1: Failing tests** — for every `HELMETS × VISORS` pair `drawHead` adds instructions without throwing; for every `EARS` value `drawEars` with `IDLE_PARTS` and with `{ ...IDLE_PARTS, earFlop: 1, lampOn: true }` does the same; `'none'` ears draws nothing (`g.context.instructions.length === 0`).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** following the mockup shapes (`.superpowers/brainstorm/*/content/ears-v2.html`, `helmets.html`) scaled to `HEAD_R`. Strip visor on `box` = today's solid panel in `look.visor`; on round/dome/angular = today's dark glass + glint line in `look.visor`. Dome: collar plate, translucent bubble (`alpha 0.25`), simple face (circle in `look.head`, one eye dot). Bunny ears rotate back by `earFlop * 0.5` rad; lamp glows (`alpha 1`) when `lampOn`, dim (`0.35`) otherwise. Ears stay out of `bodyExtents`.
- [ ] **Step 4:** run → PASS; `npx tsc --noEmit -p .`.
- [ ] **Step 5: Commit** `feat: draw helmet shapes, visor shapes and ears from the build`

### Task 5: Part motion (tail, ears, lamp, wings)

**Files:**
- Create: `src/game/render/fighter/parts/partMotion.ts`
- Modify: `src/game/render/fighter/fighterAnimator.ts` (keep a `PartMotion` in `AnimMemory`; frame field `parts: PartMotionFrame` replaces `tailSwing`), `src/game/render/fighter/fighterView.ts` (`FighterFrame.parts`), `src/components/setup/characterArt.ts` (idle frame: `IDLE_PARTS` with a slow `tailWave = t`)
- Test: `src/game/render/fighter/parts/partMotion.test.ts`

**Interfaces:**
- Produces: `class PartMotion { update(dt: number, localVel: Vector2, state: FighterState, firedAgoMs: number): PartMotionFrame }` and `localVelocity(vel: Vector2, facing: number): Vector2` (px/s, x multiplied by `facing`, so "forward" is +x for both facings). The animator must pass `localVelocity(p.vel * 60, facing)`, never the world velocity.
- [ ] **Step 1: Failing tests** — `idle settles to a resting tail` (100 updates of 1/120 s at zero velocity → `tailLift` and `tailBend` within 0.02 of 0) · `running forward bends the tail back` (`localVel.x = 300` → `tailBend > 0.3`) · `tail lifts the same way when facing left` (`localVelocity({x: -5, y: 0}, -1)` equals `localVelocity({x: 5, y: 0}, 1)`; and running backwards, `localVelocity({x: -5, y: 0}, 1).x < 0`, bends the tail forward: `tailBend < 0`) · `falling lifts the tail, jetpack flight lowers it` (sign of `tailLift` for `vel.y > 0` vs state `'fly'`) · `the lamp is on for 120 ms after a shot` · `wings open in flight and fold on the ground` (`wingsOpen` → 1 after 0.5 s of `'fly'`, → 0 after 0.5 s of `'idle'`) · `no value jumps more than 0.2 between two 1/120 s frames` (stability).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** with critically damped springs (`value += vel*dt; vel += (k*(target-value) - c*vel)*dt`, k ≈ 60, c ≈ 2·√k); targets from velocity and state; `tailWave` advances with time faster while running.
- [ ] **Step 4:** run → PASS; existing `fighterMotion`/`fighterPose` tests still pass.
- [ ] **Step 5: Commit** `feat: spring-driven motion for tails, ears, lamp and wings`

### Task 6: Tails

**Files:**
- Create: `src/game/render/fighter/parts/tails.ts`
- Modify: `src/game/render/fighter/fighterParts.ts` (delete old `drawTail`), `src/game/render/fighter/fighterView.ts` (call new one)
- Test: `src/game/render/fighter/parts/tails.test.ts`

**Interfaces:**
- Produces: `tailPoints(tail: TailId, root: Vector2, m: PartMotionFrame): Vector2[]` (pure, the bent centre line) and `drawTail(g: Graphics, pose: FighterPose, look: FighterLook, m: PartMotionFrame): void`. Root = `upperPoint(pose, -6, -1)` as today; colour = `look.pattern` (lizard spikes `look.visor`, mech links `GLOVE`-grey with a `look.visor` light).
- [ ] **Step 1: Failing tests** — `none draws nothing` · `cat tail is longer than 20 rig units and ends above its root at rest` · `bending back moves the tip further behind` (`tailBend 1` tip.x < `tailBend 0` tip.x) · `lizard and mech draw without throwing for extreme motion values (±1)`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** shapes from `tails.html` mockup: cat = 8-point S-curve stroked with `limb`-style outline, tentacle = thinner wavy line with a glowing tip dot, lizard = tapering outlined polygon with 4 spikes, mech = 5 outlined links + tip light.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat: cat, tentacle, lizard and mechanical tails`

### Task 7: Jetpacks and flame colours

**Files:**
- Create: `src/game/render/fighter/parts/jetpacks.ts`, `src/game/render/fighter/parts/flamePalette.ts`
- Modify: `src/game/render/fighter/fighterParts.ts` (move `drawJetpack`, `drawFlame`, `FLAME_BASE`, `flameLength` out), `src/game/render/fighter/fighterView.ts` (flame glow tint from palette; glow per nozzle centre), `src/game/systems/effects.ts` (`jetpackTrail` particle colour from `p.build?.flame`)
- Test: `src/game/render/fighter/parts/jetpacks.test.ts`

**Interfaces:**
- Produces: `FLAME_PALETTE: Record<FlameId, { outer: number; mid: number; core: number; glow: number; particle: string }>` (fire = today's `0xff8a1e / 0xffe27a / WHITE / 0xff9a3c / '#fbbf24'`); `jetpackNozzles(jetpack: JetpackId): Vector2[]` (upper-body frame; pack/rocket/wings one, tanks/scrap two); `drawJetpack(g, pose, look, flame: boolean, m: PartMotionFrame)`; `drawFlame(g, pose, look, flicker)`.
- [ ] **Step 1: Failing tests** — `fire keeps today's colours` · `tanks and scrap have two nozzles, the rest one` · `every jetpack × flame draws without throwing, wings with wingsOpen 0 and 1`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** shapes from `jetpacks-v2.html`; body colour `look.jet`; keep the jetpack inside today's x range (−12.5…−5) except wings, which may stick out (excluded from extents like ears).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat: jetpack bodies and flame colours`

### Task 8: Torso patterns and shoulder badges

**Files:**
- Create: `src/game/render/fighter/parts/patterns.ts`, `src/game/render/fighter/parts/badges.ts`, `src/game/render/fighter/parts/segmentDigits.ts`
- Modify: `src/game/render/fighter/fighterParts.ts` (`drawTorso` calls `drawPattern` after the shade and before the belt; `shoulderPad` followed by `drawBadge`; robot band line removed)
- Test: `src/game/render/fighter/parts/patterns.test.ts`, `parts/segmentDigits.test.ts`

**Interfaces:**
- Produces: `drawPattern(g: Graphics, at: (x: number, y: number) => Vector2, look: FighterLook): void` and `drawBadge(g, at, look)` — `at` maps torso-frame points like `shoulderPad` does, so the ragdoll can reuse them. `digitSegments(n: number): Array<[Vector2, Vector2]>` (two digits, seven-segment, unit box).
- [ ] **Step 1: Failing tests** — `none draws nothing` for pattern and badge · `every pattern stays inside the torso quad` (collect polygon points from `g.context.instructions` or have `drawPattern` built on a pure `patternShapes(pattern): Vector2[][]` and assert every point is inside x −6.6…7.6, y −20…0.5) · `digitSegments(7)` = segments of "07" (top + right two for 7, six for 0 → 9 segments) · `digitSegments(88)` has 14.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** in `look.pattern`: band = today's robot band; stripes = two vertical stripes; hazard = black band with yellow diagonals at the bottom; camo = 6 blobs in `shade(look.torso, 0.7)` and `look.pattern`; split = diagonal half. Badge on the pad (`at(0.5,-21)…at(9,-15.5)`): chevron, number via `digitSegments(build.badgeNumber)`, emblem by `build.emblem` (skull, star, bolt polygons).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat: torso patterns and shoulder badges`

### Task 9: Online join and ragdolls carry the build

**Files:**
- Modify: `src/game/net/protocol.ts` (`JoinRequest.build: FighterBuild`), `src/game/net/validation.ts`, `src/game/net/roomSetup.ts` (`createJoinedPlayer` copies `build`; bots keep none), `src/components/GameCanvas.tsx` (offline player and join request: `build: enforceUnlocks(loadBuild(), levelForXp(loadXp()))`), `src/game/systems/events.ts` (`RagdollColors` + `build?: FighterBuild`), `src/game/systems/effects.ts` (`emitDeath` adds `build: e.build`), `src/game/systems/effectSpawn.ts` + `src/types.ts` (`RagdollPart.build?: FighterBuild`), `src/game/render/ragdollView.ts` (head: `drawHead` + `drawEars(IDLE_PARTS)`; torso: `drawPattern` + `drawBadge`)
- Test: `src/game/net/validation.test.ts`, `src/game/net/room.test.ts`, `src/game/systems/effects.test.ts` (create if absent)

**Interfaces:**
- Consumes: `sanitizeBuild`, `presetBuild`, `drawHead`, `drawEars`, `drawPattern`, `drawBadge`, `IDLE_PARTS`.
- [ ] **Step 1: Failing tests** — `validation.test.ts`: `keeps a valid build` · `an old client without build gets its skin preset` (`skinId 'wolf'`, no `build` → `build.tail === 'cat'`) · `cleans a hostile build` (unknown ids, `badgeNumber 1e9`). `room.test.ts`: `a joined player carries the build into the snapshot`. `effects.test.ts`: `DEATH carries the build to every ragdoll part`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** `validateJoin`: `build: sanitizeBuild(raw.build, presetBuild(skinId))`. Ragdoll parts without `build` draw `DEFAULT_BUILD`.
- [ ] **Step 4:** `npx vitest run src/game/net src/game/systems` → PASS; `npx tsc --noEmit -p .`.
- [ ] **Step 5: Commit** `feat: send the build online and keep it on ragdolls`

### Task 10: Setup screen — presets, tabs, tiles, XP bar

**Files:**
- Create: `src/components/setup/builder/BuilderTabs.tsx`, `builder/PartTiles.tsx`, `builder/XpBar.tsx`, `builder/builderSlots.ts`, `src/i18n/builderStrings.ts`
- Modify: `src/components/setup/CharacterSetup.tsx`, `src/components/setup/colorPresets.ts` (`BodyPart` + `'visor' | 'pattern'`), `src/components/setup/CharacterPreview.tsx` (new `CharacterLook`), `src/i18n/locales.ts` (merge `builderStrings`), `src/components/setup/CharacterSetup.test.tsx`
- Test: `src/components/setup/CharacterSetup.test.tsx`

**Interfaces:**
- Consumes: `loadBuild`, `saveBuild`, `presetBuild`, `isUnlocked`, `unlockLevel`, `levelForXp`, `loadXp`, `XP_PER_LEVEL`, `SLOTS`.
- Produces: `builderSlots.ts` — `TABS: { id: 'head'|'body'|'jetpack'|'colours'; slots: Slot[] }[]` = head: helmet, visor, ears · body: tail, pattern, badge · jetpack: jetpack, flame. `PartTiles` props `{ slot: Slot; value: string; level: number; thumbs?: Record<string, string>; onPick(id: string): void }`. i18n keys `cs.tab.<id>`, `cs.slot.<slot>`, `cs.part.<slot>.<id>`, `cs.emblem.<id>`, `cs.lockedAt` (`'Lvl {0}'` / `'Ур. {0}'`), `cs.level` (`'Level {0} · {1} XP to the next part'` / `'Уровень {0} · до следующей детали {1} опыта'`), `cs.allOpen`, `cs.changed`, `cs.badgeNumber`, `cs.visor`, `cs.pattern`.
- [ ] **Step 1: Failing tests** (React Testing Library, existing file pattern):
  - `shows four tabs and the head slots by default`.
  - `locked tiles are disabled and show their level` (fresh XP 0 → wolf ears button `disabled`, text `Lvl 2`).
  - `picking a free part updates the build and marks the preset as changed`.
  - `the preset arrows replace the whole build and colours` (next preset from `classic` → `red`, name `Red Baron`, no "(changed)").
  - `Start saves the build` (spy `saveBuild` or read `localStorage.fighterBuild`).
  - `the number field appears only for the number badge and keeps 0..99`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** per spec "Setup screen" (Hazard Bay classes as in today's `CharacterSetup`): left = preview + preset arrows + `XpBar`; right = name + `BuilderTabs` + buttons. Selected tile `border-bay-hazard`; locked `opacity-45` + lock icon + `cs.lockedAt`. `CharacterSetup.tsx` stays under 200 lines; tile grid and tabs live in `builder/`.
- [ ] **Step 4:** `npx vitest run src/components/setup src/i18n` → PASS.
- [ ] **Step 5: Commit** `feat: build the fighter from parts on the setup screen`

### Task 11: Tile pictures

**Files:**
- Create: `src/components/setup/builder/partThumbnails.ts`, `builder/usePartThumbnails.ts`
- Modify: `builder/BuilderTabs.tsx` (pass `thumbs`)
- Test: `src/components/setup/builder/partThumbnails.test.ts`

**Interfaces:**
- Produces: `thumbnailBuilds(slot: Slot, base: FighterBuild): Array<{ id: string; build: FighterBuild }>` (pure: the base build with that slot swapped, one per option); `usePartThumbnails(slot: Slot, base: FighterBuild, colors: SetupColors): Record<string, string>` — one offscreen Pixi `Application` (96×96, shared, created once), draws head-only for head slots and the whole idle fighter otherwise, `renderer.extract.base64`, debounced 150 ms; on failure `console.warn` and return `{}` (tiles fall back to text only).
- [ ] **Step 1: Failing test** — `thumbnailBuilds('tail', base)` returns 5 builds differing from `base` only in `tail`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement**; destroy the app on unmount with `{ children: true, context: true }`.
- [ ] **Step 4:** run → PASS; manual check in Task 13.
- [ ] **Step 5: Commit** `feat: picture tiles for every part`

### Task 12: XP after a match

**Files:**
- Create: `src/components/hud/useMatchRewards.ts`, `src/components/hud/RewardPanel.tsx`, `src/i18n/rewardStrings.ts`
- Modify: `src/components/GameCanvas.tsx` (call the hook with `gameState` and `localIdRef`, pass `reward` into `GameHud`: ≤ 4 lines), `src/components/hud/GameHud.tsx` (prop `reward: Reward | null`), `src/components/hud/MatchResult.tsx`, `src/components/hud/ModeHud.tsx` (Hunger result and Gun Game winner show `RewardPanel`), `src/i18n/locales.ts`
- Test: `src/components/hud/useMatchRewards.test.ts`, `src/components/hud/GameHud.test.tsx`

**Interfaces:**
- Consumes: `detectMatchEnd`, `addMatchXp`, `Reward`.
- Produces: `useMatchRewards(state: MutableRefObject<GameState>, localId: MutableRefObject<string>): Reward | null` — polls every 250 ms; on a new `MatchEnd.key` calls `addMatchXp(won)` once and returns the reward; returns `null` again once `detectMatchEnd` is `null`. i18n: `rw.gained` (`'+{0} XP'`), `rw.level` (`'Level {0}!'` / `'Уровень {0}!'`), `rw.unlocked` (`'New part: {0}'` / `'Новая деталь: {0}'`).
- [ ] **Step 1: Failing tests** — hook with fake timers: `gives XP once while the result stays on screen` (state ended for 3 s → `localStorage.fighterXp === '20'`) · `gives XP again for the next match` · `a win gives 50`. `GameHud.test.tsx`: `the results screen shows the XP and the opened part`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Part name via `cs.part.<slot>.<id>`.
- [ ] **Step 4:** `npx vitest run src/components/hud` → PASS.
- [ ] **Step 5: Commit** `feat: show match XP and opened parts on every end screen`

### Task 13: Patch notes and full verification

**Files:**
- Modify: `src/components/menu/patchNotes.ts` (new entry at the top, same shape as the 0.4.0 notes, RU + EN: fighter builder, 30 parts by level, new tails)

- [ ] **Step 1:** `npx vitest run` → all pass. `npx tsc --noEmit -p .` → only the 3 known errors. `npx eslint src` (or `npm run lint`) → no new errors in touched files.
- [ ] **Step 2:** Check file sizes: `wc -l` on every created/modified file except `GameCanvas.tsx`/`uiStore.tsx` → all ≤ 200.
- [ ] **Step 3:** Run the app (`npx vite --port 5199`) and screenshot with Playwright: setup screen (each tab), a preset with every free part, and an offline match (run, jump, fly) to confirm tails move, flames recolour, ragdoll keeps the parts.
- [ ] **Step 4: Commit** `docs: patch notes for the fighter builder`
