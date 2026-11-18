# Smoke Sim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smoke grenade clouds and flamethrower soot drawn as small real air grids with the CFD demo's shading, reacting to shots, blasts, flame and fighters, without changing gameplay.

**Architecture:** A pure TypeScript air grid (`AirGrid`) steps stable fluids; a cloud shaper keeps each grenade cloud inside its gameplay circle; a stir collector turns projectiles, explosions, beams, flame streams and fighters into pushes. A Pixi layer uploads each grid as a small texture to a shader quad. `SmokeView` keeps its public role (top effect view + own-fighter outline) and falls back to the old circles if the shader cannot run. Soot plumes reuse the same grid and quad, fed by the flame engine's smoke particles, which are no longer drawn.

**Tech Stack:** TypeScript, PixiJS 8.14 (WebGL `Shader.from({ gl })`, `Mesh`, `MeshGeometry`, `BufferImageSource`), Vitest.

**Spec:** `docs/plans/2026-11-18-smoke-sim-spec.md`. Reference look: branch `spike/smoke-shader` commit 7059622, files `src/game/render/effects/smoke{Sim,Stirs,Clouds,Shader}.ts` (worktree `~/Documents/void-strike-smokefx`). Read the spike before Tasks 1–5; it is the look to match, not code to copy (its loops are too slow and its stirs depend on frame rate).

## Global Constraints

- Looks only: no change to `systems/smoke.ts`, `smokeVisibility.ts`, bots, server, protocol, snapshots.
- Gameplay cloud: radius `SMOKE_RADIUS` 110, `SMOKE_DURATION_MS` 10000, shrink over the last `SMOKE_FADE_MS` 2000 via `smokeRadiusAt`; cloud `pos` is the circle centre.
- Fighters and cover use `pos = (centerX, bottomY)`; platforms are top-left `{ x, y, w, h }`; `coverRect(c)` gives a cover rect, `isIntact(c)` says it is solid.
- Camera `state.camera` is the view centre; the visible world rect is `camera ± view.w/2, view.h/2` (`Viewport` in `render/viewport.ts`).
- Smoke colour is one parameter, white `[0.86, 0.87, 0.89]` now; soot colour `[0.05, 0.045, 0.04]` (near-black, owner ruling 2026-11-18).
- Budget: smoke ≤ 1.5 ms CPU per frame on average with four clouds on `high`, no frame > 3 ms on smoke; 120 fps on the owner's MacBook is the binding rule.
- Cuts when over budget, in this order: fast flat loops → one pressure solve and fewer iterations → 30 Hz stepping → smaller grid on `high`.
- At most four clouds step at full rate per frame (nearest the camera centre), others at half rate, clouds outside the view + 200 px margin do not step.
- Randomness from `seededRandom(id)` only (no `Math.random` in `src/game/render/smoke/`).
- No per-frame work when there are no clouds and no soot.
- Stirs are frame-rate independent: each stir is a rate per second applied as `w = 1 - exp(-rate * dt)`.
- Files ≤ 200 lines, one responsibility per file, named exports, no silent catches (log once, then fall back).
- Pixi: destroy each `Mesh`, its `Shader` and its `Texture` (with source) when a cloud or plume goes; `Graphics.destroy({ children: true, context: true })`; never `app.destroy(true)`.
- English code comments; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A guest or late joiner first sees a cloud already 5 s old: it must show full at once, not burst from nothing (Task 2 test `prefills a cloud first seen after its burst`).
2. A cloud whose circle crosses the floor or a crate: no smoke drawn inside or under solids (Task 1 test `solid cells stay empty`, Task 2 test `cloud on a floor keeps the floor empty`).
3. Cover broken or restored while a cloud lives: the solid cells follow within a frame (Task 5 test `refreshes solids when cover changes`).
4. A frame hitch (tab back after 10 s, `dt` huge) or `dt = 0`: at most 3 steps catch up, no NaN in any field (Task 1 test `no NaN after extreme stirs`, Task 5 test `caps catch-up steps`).
5. A cloud removed early (cap of 12 pushes the oldest out, R on the range, map change): its mesh, shader and texture are destroyed that frame (Task 4 and Task 5 tests).

---

### Task 1: Air grid core

**Files:**
- Create: `src/game/render/smoke/seededRandom.ts`, `src/game/render/smoke/airGrid.ts`, `src/game/render/smoke/smokeTuning.ts`
- Modify: `src/game/render/effects/smokePuffs.ts` (import `seededRandom` instead of its private copy)
- Test: `src/game/render/smoke/airGrid.test.ts`

**Interfaces:**
- Produces:
  - `seededRandom(id: string): () => number` (FNV-1a + mulberry32, moved from `smokePuffs.ts`).
  - `type Box = { x: number; y: number; w: number; h: number }`.
  - `type Stir = { x: number; y: number; r: number; vx: number; vy: number; radial?: boolean; rate: number; heat?: number; soot?: number; carve?: number }` — `rate` per second; `heat`, `soot`, `carve` are amounts per second at the centre.
  - `class AirGrid { constructor(n: number, x0: number, y0: number, size: number); readonly n; readonly x0; readonly y0; readonly size; readonly cell; readonly d: Float32Array; readonly t: Float32Array; readonly s: Float32Array; readonly solid: Uint8Array; markSolids(boxes: readonly Box[]): void; stir(st: Stir, dt: number): void; step(dt: number): void; mass(): number; }` — `step` = vorticity confinement → project → advect u,v → project → advect d,t,s; damping, cooling, buoyancy inside; does not shape clouds.
  - `smokeTuning.ts`: `type SmokeQuality = 'high' | 'medium' | 'low'`; `GRID_N: Record<SmokeQuality, number>` = `{ high: 48, medium: 32, low: 24 }`; `STEP_HZ = 60`; `MAX_CATCHUP_STEPS = 3`; `PRESSURE_ITERS = 18`; `VORTICITY = 3.5`; `BUOYANCY = 260`; `DAMP_PER_S = 0.9`; `COOL_PER_S = 3.2`; spike starting values for every other number, each with a one-line comment.

- [ ] **Step 1: Write failing tests** in `airGrid.test.ts`:
  - `seededRandom gives the same sequence for the same id and a different one for another id`.
  - `a push moves density along it`: grid 32 over 320 px at (0,0); put density 1 in a 3×3 block at the centre; `stir({ x:160, y:160, r:60, vx:300, vy:0, rate:20 }, 1/60)` then 30 × `step(1/60)`; the density-weighted mean x is > 160 + 20.
  - `hot air rises`: heat 1 and density 1 at the centre block, 30 steps; mean y of density < 160 - 10.
  - `solid cells stay empty`: `markSolids([{ x:0, y:200, w:320, h:120 }])`, density 1 everywhere above, push down at 400 px/s for 60 steps; `d`, `t`, `s` are 0 in every solid cell.
  - `heat cools`: heat 1 everywhere, 60 steps of 1/60 s, max heat < 0.1.
  - `no NaN after extreme stirs`: stirs with `vx: 1e6`, `rate: 1e6`, `carve: 1e6`, then 10 steps and one `step(0)`; every field finite.
- [ ] **Step 2: Run** `npx vitest run src/game/render/smoke/airGrid.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the three files. Inner loops are flat index loops over typed arrays with no closures and no per-cell `Math.hypot`/`atan2`; pressure is Gauss-Seidel with solid neighbours taking the centre value (Neumann) and an open box edge (pressure 0). `stir` blends velocity toward `(vx, vy)` (outward for `radial`) by `w = (1 - dist/r) * (1 - exp(-rate*dt))`, adds `heat*dt*w` (cap 1.5), `soot*dt*w` (cap 1), multiplies `d` by `max(0, 1 - carve*dt*w)`.
- [ ] **Step 4: Run** the test file and `npx vitest run src/game/render/effects` — Expected: PASS.
- [ ] **Step 5: Add** `airGrid.bench.test.ts` (skipped unless `SMOKE_BENCH=1`) that times 240 steps of four 48-grids and logs ms per step; record the number in the commit message.
- [ ] **Step 6: Commit** `feat(smoke): air grid core for smoke clouds`.

### Task 2: Cloud shaper

**Files:**
- Create: `src/game/render/smoke/cloudShape.ts`
- Test: `src/game/render/smoke/cloudShape.test.ts`

**Interfaces:**
- Consumes: `AirGrid`, `seededRandom`, `smokeRadiusAt` and `SmokeCloud`.
- Produces: `class CloudShaper { constructor(grid: AirGrid, cloud: SmokeCloud); prefill(now: number): void; apply(dt: number, now: number): void }`. Per-cell distance and angle from the cloud centre are precomputed once. `apply` does: burst (outward push while young), refill toward `1.15 * (1 - q²)` with a three-wave lobed outline (phases from `seededRandom(cloud.id)`, slowly moving), fade outside the live radius, seeded churn stirs. Refill rate 8 /s while the age < 0.6 s, then 1.7 /s; outside fade 3.5 /s; full size reached in about 0.6 s.

- [ ] **Step 1: Write failing tests**: `grows to the live radius within 0.7 s` (density-weighted radius of the 0.1 contour ≥ 0.8 × 110 at age 0.7 s); `stays inside the circle at rest` (after 4 s, mass outside 1.2 × radius < 5 % of total); `shrinks with the fade` (at `endsAt - 500`, mass < 40 % of mass at age 4 s); `prefills a cloud first seen after its burst` (new grid, `prefill(bornAt + 5000)` then mass ≥ 80 % of a settled cloud's mass); `cloud on a floor keeps the floor empty` (floor box from centre y down, solids marked, 2 s of `apply`+`step`, solid cells 0); `same id, same shape` (two shapers with the same id and steps give identical `d`).
- [ ] **Step 2: Run** `npx vitest run src/game/render/smoke/cloudShape.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `cloudShape.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(smoke): cloud shaper keeps the air grid in the gameplay circle`.

### Task 3: Stir collector

**Files:**
- Create: `src/game/render/smoke/smokeStirs.ts`, `src/game/render/smoke/flameAir.ts`
- Modify: `src/game/render/flame/flameFx.ts` (add `air(): FlameAir`)
- Test: `src/game/render/smoke/smokeStirs.test.ts`

**Interfaces:**
- Produces:
  - `flameAir.ts`: `interface FlameAir { streams(): Iterable<{ x: number; y: number; angle: number; firing: boolean; power: number }>; soot(): Iterable<{ x: number; y: number }> }` (`soot()` yields live flame smoke particles, used by Task 7).
  - `FlameFx.air(): FlameAir` reading `this.sim.streams` and `this.sim.pools.smoke`.
  - `class SmokeStirs { collect(state: GameState, flame: FlameAir | null, out: Stir[]): void }` — clears and fills `out`. Projectiles: a stir chain from the last seen position to the current one (rockets and grenades r 16, speed 650, heat 15/s, carve 21/s; others r 10, speed 480, carve 15/s; rate 40/s). New `'ring'` particle: radial r = 70 × max(0.6, size/12), speed 950, rate 60/s, heat 55/s, carve 40/s. New beam: chain r 13, speed 700, rate 45/s, heat 12/s, carve 33/s. Firing flame stream: chain over 260 px, r 12 → 38, speed 520, rate 27/s, heat 30/s, soot 7/s, carve 9/s. Living fighter faster than 40 px/s (vel × 60): r 26, rate 24/s. Chains space stirs 7 px. Start values; Task 8 tunes them.
- [ ] **Step 1: Write failing tests**: one test per source (projectile chain direction and spacing; a ring stirs once, not on later frames; a beam stirs once; a non-firing stream stirs nothing; a fighter under 40 px/s stirs nothing); `forgets projectiles that are gone` (internal map size returns to 0).
- [ ] **Step 2: Run** `npx vitest run src/game/render/smoke/smokeStirs.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; reuse one `out` array per frame (no per-frame allocation of the array).
- [ ] **Step 4: Run** plus `npx vitest run src/game/render/flame` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(smoke): stirs from shots, blasts, beams, flame and fighters`.

### Task 4: Shader and smoke quad

**Files:**
- Create: `src/game/render/smoke/smokeShader.ts`, `src/game/render/smoke/smokeQuad.ts`
- Test: `src/game/render/smoke/smokeQuad.test.ts`

**Interfaces:**
- Consumes: `AirGrid`.
- Produces: `class SmokeQuad { constructor(grid: AirGrid, colour: readonly [number, number, number]); readonly mesh: Mesh; upload(time: number, fade: number): void; destroy(): void }` — the quad spans the grid box (`x0, y0, size`), the texture is RGBA8 (r = d/1.5, g = t/1.5, b = s), linear filtering. `SMOKE_VERTEX` passes `aUV`; `SMOKE_FRAGMENT` is the spike's final shader (CFD `cfdFS` look: fbm moved by the density slope, top light, heat glow `smoothstep(0.08, 0.9, heat) * 0.9`, soot mix toward the soot colour, grid-edge fade `smoothstep(0, 0.14, edge)`), with the colour as `uSmokeColor`.
- [ ] **Step 1: Write failing tests**: `uploads the grid into the texture bytes` (set `d[k] = 1.5` → byte 255); `destroy frees mesh, shader and texture` (each `destroyed` flag true, mesh has no parent).
- [ ] **Step 2: Run** `npx vitest run src/game/render/smoke/smokeQuad.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(smoke): CFD-look shader quad for an air grid`.

### Task 5: Cloud field (scheduling and lifetime)

**Files:**
- Create: `src/game/render/smoke/cloudField.ts`
- Test: `src/game/render/smoke/cloudField.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `type SmokeFrame = { state: GameState; flame: FlameAir | null; view: Box; quality: SmokeQuality }`; `class CloudField { readonly layer: Container; sync(smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null): void; destroy(): void }`. Per cloud: grid box = centre ± 1.5 × `SMOKE_RADIUS`, `GRID_N[quality]`, `prefill` when first seen, fixed `STEP_HZ` with at most `MAX_CATCHUP_STEPS`, the four clouds nearest the view centre step every frame, others every second frame, off-view (+200 px) none. Solids from platforms + intact cover; re-marked when the set of intact cover ids inside the box changes. Without a `frame` (tests, previews) clouds still shape and step with no stirs.
- [ ] **Step 1: Write failing tests**: `one quad per cloud, destroyed when the cloud goes`; `does not step off-view clouds` (mass unchanged after 30 frames); `steps only four clouds at full rate` (six clouds in view, count steps per cloud over 10 frames: four get 10, two get 5); `caps catch-up steps` (one `sync` 10 s after the last: at most 3 steps); `refreshes solids when cover changes` (break a crate in the box: its cells stop being solid next frame); `does nothing without clouds` (no allocation, layer empty).
- [ ] **Step 2: Run** `npx vitest run src/game/render/smoke/cloudField.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(smoke): cloud field steps, schedules and frees smoke grids`.

### Task 6: SmokeView, renderer wiring and fallback

**Files:**
- Modify: `src/game/render/effects/smokeView.ts`, `src/game/systems/renderer.ts:480-497` (smoke quality reuses `cache.flameQuality`: `high` game screen, `medium` touch, `low` tournament tiles)
- Test: `src/game/render/effects/smokeView.test.ts` (keep the stacking test passing; add tests)

**Interfaces:**
- Consumes: `CloudField`, `SmokeFrame`, `FlameFx.air()`.
- Produces: `SmokeView.sync(smokes, now, silhouette, frame: SmokeFrame | null = null)`. The renderer passes `{ state, flame: cache.flameFx?.air() ?? null, view: <visible world rect>, quality: cache.flameQuality ?? 'high' }`. Order in `SmokeView`: cloud layer, then the silhouette `Graphics` on top; `raise()` keeps both at the top of the layer. If building the first shader quad throws, log once with `console.error('Smoke shader failed, drawing simple clouds:', err)` and draw `cloudCircles` from then on.
- [ ] **Step 1: Write failing tests**: `the outline stays above the clouds` (top child is the outline Graphics, the one below it is the cloud layer); `falls back to circles when the shader fails` (force the factory to throw; `console.error` called once over two frames; the outline Graphics has fill instructions); keep `stays the topmost child …` passing (update its private-field access if the field name changes).
- [ ] **Step 2: Run** `npx vitest run src/game/render/effects/smokeView.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the wiring.
- [ ] **Step 4: Run** `npx vitest run` (whole suite) — Expected: PASS except the known real-time flake `server/src/session.e2e.test.ts`, which must pass when run alone.
- [ ] **Step 5: Check in the browser** on `#range` at 1512×700 (dev server `npx vite --host --port 3008 --strictPort`): key 7 makes a cloud that looks like the spike; 1, 3 and 9 react as in the spike (screenshots via the Playwright script pattern in `test-range` memory). Note in the report what differs from the spike.
- [ ] **Step 6: Commit** `feat(smoke): smoke clouds drawn by the air grid`.

### Task 7: Soot plumes replace the flame's smoke

**Files:**
- Create: `src/game/render/smoke/sootPlumes.ts`
- Modify: `src/game/render/flame/flameFx.ts` (stop drawing `this.smoke` sprites on `high` and `medium`; `low` keeps them), `src/game/render/effects/smokeView.ts` (own a `SootPlumes` next to the `CloudField`)
- Test: `src/game/render/smoke/sootPlumes.test.ts`, extend `src/game/render/flame/flameSim.test.ts` if the smoke-sprite change touches it

**Interfaces:**
- Consumes: `FlameAir.soot()`, `AirGrid`, `SmokeQuad` (soot colour), `SmokeFrame`.
- Produces: `class SootPlumes { readonly layer: Container; sync(now: number, frame: SmokeFrame | null): void; destroy(): void }`. Each live flame smoke particle deposits soot 2.5 /s and heat 1 /s into the plume whose box holds it; if none, a new plume (box 180 px, emission point at 70 % of its height so soot rises inside it, grid `ceil(GRID_N[quality] / 2)`) unless the cap is reached (`high` 6, `medium` 3, `low` 0). Plumes have no gameplay circle; density decays at 0.6 /s; a plume with no deposit for 1 s and mass < 0.5 is destroyed. Plumes are stirred by the same stirs as clouds.
- [ ] **Step 1: Write failing tests**: `a soot point makes one plume, nearby points share it`; `soot rises` (mean y of soot goes up over 1 s); `a plume dies about 3 s after the fire stops` (gone by 4 s, alive at 1 s); `respects the cap per quality`; `low quality makes no plumes`.
- [ ] **Step 2: Run** `npx vitest run src/game/render/smoke/sootPlumes.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; FlameFx keeps simulating its smoke pool (it is now the soot source) but adds its sprites to the stage only on `low`.
- [ ] **Step 4: Run** `npx vitest run src/game/render` — Expected: PASS.
- [ ] **Step 5: Check in the browser**: flame into a wall and on a dummy (range, key 9): dark soot rises and fades; no brown sprite smoke.
- [ ] **Step 6: Commit** `feat(smoke): flamethrower soot plumes replace the flame's brown smoke`.

### Task 8: Budget check and tuning on the range

**Files:**
- Create: `src/game/render/smoke/smokeMeter.ts` (dev-only rolling average of `SmokeView.sync` time, exposed as `window.__smokeMs` only when `import.meta.env.DEV`)
- Modify: `smokeTuning.ts` and stir numbers as the measurements require
- Test: `src/game/render/smoke/smokeMeter.test.ts`

- [ ] **Step 1: Write failing test** `averages the last 120 samples and ignores calls when disabled`.
- [ ] **Step 2: Implement** and wire into `SmokeView.sync`.
- [ ] **Step 3: Measure** in Chrome on `#range` at 1512×700: four clouds (7 four times), machine gun and flame through them for 5 s. Pass: `__smokeMs` average ≤ 1.5 ms, max ≤ 3 ms, page frame time median ≤ 8.6 ms. If over, apply the Global Constraints cuts in order and re-measure; record each attempt in the report.
- [ ] **Step 4: Check merging**: two smoke rounds side by side; save a screenshot for the owner.
- [ ] **Step 5: Run** `npx vitest run` and `npm run build` — Expected: PASS / built.
- [ ] **Step 6: Commit** `perf(smoke): budget measured and tuned (<numbers>)`.

### Task 9: Release notes and pictures

**Files:**
- Modify: `src/components/menu/patchNotes.ts` (0.5.0 entry, en and ru: a new group after "Flamethrower"), `CHANGELOG.md` (0.5.0: `### 💨 Smoke`)
- Create: `public/assets/patch/smoke-before.jpg`, `public/assets/patch/smoke-after.jpg` (560 × 480, the panel crops to 7:6 with object-cover; before = `release/0.5.0` dev server on :3005, after = this branch)
- Test: existing `patchNotes` tests

- [ ] **Step 1:** Group text (en): title "Smoke", points: smoke grenades now make real rolling smoke that lies on the floor and flows around crates; bullets, rockets, blasts and the flamethrower punch through it, push it and light it up, and the holes close again; the flamethrower leaves dark soot that rises and fades. Russian with the same meaning. Pictures via `shots('smoke')` like `FLAME`.
- [ ] **Step 2:** CHANGELOG section with spec path, the grid, reactions, soot, tiers, fallback and the measured budget.
- [ ] **Step 3: Run** `npx vitest run src/components/menu` and check "What's new" in en and ru with the whatsnew Playwright script — Expected: PASS, the group shows with both pictures uncropped.
- [ ] **Step 4: Commit** `docs(release): 0.5.0 notes for the new smoke`.
