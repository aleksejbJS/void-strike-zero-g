# Visual Polish (Projectiles, Hits, Fighter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder projectile/effect art with tracers, light and real impacts, and give the fighter volume, a bigger silhouette and small life — without changing gameplay or the network protocol.

**Architecture:** The simulation keeps announcing cosmetics as `EFFECT` events; `applyEffectEvent` turns them into typed particles in `GameState.particles` (new kinds for flash, fireball, ring, ember, dust, puff) plus client-side scorch marks. Display modules under `src/game/render/` draw those by kind with pooled Pixi `Graphics`/`Sprite`s (additive glows from two baked textures); `renderer.ts` only calls them. The fighter rig is unchanged; its parts get proportions and highlights, and `FighterAnimator` derives landing/squash/dust/hit-flash from what is drawn, so offline and online look the same.

**Tech Stack:** TypeScript, Pixi.js 8.14 (`Graphics`, `Sprite`, `blendMode: 'add'`), Vitest (jsdom; no canvas → render modules are tested through their pure logic), Playwright MCP for visual checks.

**Spec:** `docs/plans/2026-11-02-visual-polish-spec.md`

## Global Constraints

- No gameplay change: hitboxes (30 × 72 standing, 30 × 45 crouched), speeds, damage, fire rates, projectile life untouched; the network protocol untouched.
- No new image files; everything code-drawn. Map scenes untouched.
- Every file ≤ 200 lines, one responsibility, named exports; `renderer.ts` (649 lines) only loses code, never gains.
- Glows: muzzle ≤ 34 px radius (use 22, ×1.5 for shotgun/rocket/rail = 33); fireball ≤ 46 px; flashes ≤ 0.12 s.
- Fighter drawing ≤ 6 px beyond the hitbox on any side, in every pose including crouch.
- Simulation announcements may change only inside the existing `EFFECT` event channel (`blood` for a fighter hit, `spark` for a wall hit).
- Glow/strip textures live for the whole session: never registered through `bakedTexture()` (`render/scene/bakedTextures.ts`), whose `releaseBakedTextures()` destroys on map change.
- Particle budget: when `state.particles.length > 500`, smoke, puff and dust are not spawned; sparks, embers, droplets still are.
- Lifetimes in **physics ticks (120/s)** — decay per tick: flash 0.1 (80 ms), fireball 0.015 (0.55 s), ring 0.017 (0.5 s), ember 0.010–0.017 (0.5–0.8 s), smoke 0.009 (0.9 s), puff 0.024 (0.35 s), dust 0.014 (0.6 s), spark 0.014–0.028 (0.3–0.6 s), blood droplet 0.012–0.021 (0.4–0.7 s).
- Tests: `npx vitest run <file>`; commit only after a full `npx vitest run` with 0 FAIL. Commit messages `type: description`, present tense, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch: `fix/gameplay-bugs` (PR #1). Dev server: `http://localhost:3000`.

## Review Focus

1. A projectile id that vanishes between two frames (dropped snapshot, hit) — its display object returns to the pool and its memory is forgotten; no growth over a 60 s match (Task 6).
2. A `spark` event at a point inside no platform (chainsaw swing in mid-air, hit on a fighter's edge) — no scorch mark, no crash (Task 4).
3. A particle flood (three bots with shotguns in a corridor) — sparks keep appearing, smoke/dust stop, the array stays bounded (Task 2).
4. A remote fighter teleports (respawn, zone reset): the drawn position jumps 1000 px in one frame — the landing detector must not fire a squash or dust burst from that jump (Task 10).
5. Health goes *up* (medkit, respawn to 100) — no hit flash; only a decrease flashes, once per decrease (Task 10).

---

## Phase 1 — Simulation announcements and particle logic (pure, testable)

### Task 1: `blood` for fighter hits, `spark` for wall hits

**Files:**
- Modify: `src/game/systems/physics.ts:319-327` (projectile hit block)
- Modify: `src/game/systems/combat.ts:224-227` (rail shot)
- Test: `src/game/systems/physics.hits.test.ts` (add cases; see its existing projectile fixtures at lines 34 and 51)

**Interfaces:**
- Produces: events `{ type: 'EFFECT', effect: 'blood', x, y, color: '#ef4444', count: 6 }` at the impact point for a fighter hit (projectile or rail); `{ effect: 'spark', color: <weapon colour>, count: 8 }` only for wall hits (rail: `'#38bdf8'`, count 10). Explosions unchanged.

- [ ] **Step 1: Write the failing tests** (collect events with `gameEvents.on`, unsubscribe in `afterEach`):

```ts
it('a bullet hitting a fighter announces blood at the impact point, not sparks', () => {
    // fixture as in the existing 'does not pierce' test: shooter at x 0, victim at x 100, MG projectile at 60 flying +60/tick
    const effects = events.filter(e => e.type === 'EFFECT');
    expect(effects.map(e => e.effect)).toEqual(['blood']);
    expect(effects[0]).toMatchObject({ color: '#ef4444', count: 6 });
    expect(effects[0].x).toBeGreaterThanOrEqual(85); // victim's hitbox left edge
});
it('a bullet hitting a wall announces sparks in the weapon colour', () => {
    expect(effects.map(e => e.effect)).toEqual(['spark']);
    expect(effects[0]).toMatchObject({ color: WEAPONS_DATA[WeaponType.MACHINE_GUN].color, count: 8 });
});
it('a rail shot into a fighter announces blood; into a wall, blue sparks', () => { /* two cases via fireWeapon with RAILGUN */ });
```

- [ ] **Step 2: Run** `npx vitest run src/game/systems/physics.hits.test.ts` — expect the new cases to FAIL (today both emit `spark`).
- [ ] **Step 3: Implement** — in `physics.ts` the hit block already knows `wall` (truthy for a platform hit): emit `blood` at `impact` (the near-side point for walls is irrelevant; for fighters use `proj.pos`) when `!wall`, else `spark`. In `combat.ts` emit `blood` when `hitPlayer`, else the existing spark. Explosions keep their spark too (unchanged).
- [ ] **Step 4: Run** the file — PASS; then `npx vitest run` — 0 FAIL (the existing kill-feed/sound tests must not change).
- [ ] **Step 5: Commit** `feat: announce blood for fighter hits and sparks for wall hits`

### Task 2: Particle kinds, motion and budget

**Files:**
- Modify: `src/types.ts:122-132` (`Particle.type` union)
- Modify: `src/game/systems/particles.ts:7-33` (`updateParticles`)
- Modify: `src/game/systems/effectSpawn.ts:63-80` (`createParticles` + budget)
- Test: `src/game/systems/particles.test.ts` (new)

**Interfaces:**
- Produces: `Particle['type']` = `'blood' | 'spark' | 'smoke' | 'fire' | 'shell' | 'ember' | 'dust' | 'flash' | 'fireball' | 'ring' | 'puff'`; `createParticles(state, x, y, count, color, type, overrides?: Partial<Pick<Particle, 'decay' | 'size' | 'vel'>>)` (existing signature plus an optional overrides object); `export const PARTICLE_BUDGET = 500`.

- [ ] **Step 1: Write the failing tests** (`createMockState` from `src/test/mocks.ts`; platforms `{ x: 0, y: 100, w: 200, h: 50 }` where needed):

```ts
it('sparks and embers fall and lose speed', () => { /* spark with vel {4,0}: after 10 ticks vel.y > 1, vel.x < 4 */ });
it('smoke rises slowly and never falls', () => { /* smoke vel {0,0}: after 30 ticks pos.y < 0 */ });
it('blood droplets fall and stop on a platform', () => { /* droplet above the platform: after 60 ticks pos.y === 100 and vel.y === 0 */ });
it('flash, fireball, ring and puff only fade, in place', () => { /* pos unchanged after 5 ticks; life decreased by 5 * decay */ });
it('dust drifts with its velocity and fades', () => {});
it('over the budget, smoke/puff/dust are skipped but sparks still spawn', () => {
    state.particles = Array.from({ length: 501 }, (_, i) => ({ id: `p${i}`, pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, life: 1, decay: 0.01, color: '#fff', size: 2, type: 'spark' as const }));
    createParticles(state, 0, 0, 3, '#fff', 'smoke'); expect(state.particles).toHaveLength(501);
    createParticles(state, 0, 0, 3, '#fff', 'spark'); expect(state.particles).toHaveLength(504);
});
```

- [ ] **Step 2: Run** `npx vitest run src/game/systems/particles.test.ts` — FAIL (types/behaviour missing).
- [ ] **Step 3: Implement.** Motion per kind in `updateParticles`: `spark`/`ember`: `vel.y += GRAVITY * 0.6`, `vel.x *= 0.96`, `vel.y *= 0.96`; `blood`: `vel.y += GRAVITY`, stop (`vel = 0`, `pos.y = plat.y`) when entering a platform from above; `smoke`: `vel.y -= 0.02` then `vel *= 0.98`, clamp `vel.y ≤ 0`; `dust`: `vel *= 0.94`; `flash`/`fireball`/`ring`/`puff`: no motion; `fire`/`shell`: as today. Decay per kind in `createParticles` (Global Constraints table; random within ranges), sizes: ember 2–4, dust 2–3.5, droplet 1.5–2.5. Budget check at the top of `createParticles` for smoke/puff/dust.
- [ ] **Step 4: Run** the file — PASS; `npx vitest run` — 0 FAIL.
- [ ] **Step 5: Commit** `feat: particle kinds with their own motion and a budget`

### Task 3: Effect compositions

**Files:**
- Modify: `src/game/systems/effects.ts:39-80` (`applyEffectEvent`)
- Test: `src/game/systems/effects.test.ts` (exists; add a `describe('compositions')`)

**Interfaces:**
- Consumes: Task 2 kinds and `createParticles` overrides.
- Produces: `explosion` → 1 `flash` (size 40), 1 `fireball` (size 12; the view grows it to 46 by life), 1 `ring` (size 10 → 80 by life), 14 `ember`, 6 `smoke` (size 6–12, vel `{±0.6, −0.3…−0.9}`); `spark` → 1 `flash` (size 16, event colour, decay 0.07) + `count` `spark` streaks (vel 1–6 px/tick, random directions); `blood` → `count` `blood` droplets (vel `{±3, −4…0}`); `respawn` unchanged; `shell` unchanged; `DEATH` blood burst → 40 droplets. Also calls `addMark` (Task 4) for `spark`.

- [ ] **Step 1: Write the failing tests** — count kinds after one event:

```ts
it('an explosion is a flash, a fireball, a ring, embers and smoke', () => {
    applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 10, y: 20 });
    const kinds = count(state.particles); // { flash: 1, fireball: 1, ring: 1, ember: 14, smoke: 6 }
    expect(kinds).toEqual({ flash: 1, fireball: 1, ring: 1, ember: 14, smoke: 6 });
    expect(state.particles.find(p => p.type === 'flash')!.size).toBe(40);
});
it('a wall spark is a coloured flash and streaks', () => { /* { flash: 1, spark: 8 }, flash.color === event colour */ });
it('a fighter hit is droplets', () => { /* { blood: 6 } */ });
```

- [ ] **Step 2: Run** `npx vitest run src/game/systems/effects.test.ts` — FAIL.
- [ ] **Step 3: Implement** the compositions in `applyEffectEvent` (keep the file ≤ 200 lines: move the composition bodies into `src/game/systems/effectCompositions.ts` exporting `explosionAt(state, x, y)`, `sparkAt(state, x, y, color, count)`, `bloodAt(state, x, y, count)` if needed).
- [ ] **Step 4: Run** the file — PASS; `npx vitest run` — 0 FAIL.
- [ ] **Step 5: Commit** `feat: explosion, spark and blood compositions`

### Task 4: Scorch marks (logic)

**Files:**
- Create: `src/game/systems/marks.ts`
- Modify: `src/game/systems/effects.ts` (call `addMark` on `spark`)
- Test: `src/game/systems/marks.test.ts`

**Interfaces:**
- Produces: `export interface Mark { x: number; y: number; r: number; bornAt: number }`; `export const MARK_LIFE_MS = 4000`, `MARK_CAP = 50`; `placeMark(platforms: Platform[], x: number, y: number): Vector2 | null` (point projected onto the nearest edge of the platform that contains it; `null` if none contains it); `addMark(platforms, x, y, now = Date.now()): void` (r random 2–3.5, drops the oldest past the cap); `liveMarks(now): Mark[]` (alpha is `0.6 * (1 − age / MARK_LIFE_MS)`, computed by the view); `clearMarks(): void`.

- [ ] **Step 1: Write the failing tests:**

```ts
it('projects a point inside a wall onto its nearest edge', () => {
    expect(placeMark([{ id: 'w', x: 100, y: 0, w: 40, h: 300, color: '' }], 103, 150)).toEqual({ x: 100, y: 150 });
    expect(placeMark([floor], 50, 104)).toEqual({ x: 50, y: 100 }); // floor { x: 0, y: 100, w: 200, h: 50 }
});
it('makes no mark where no platform contains the point', () => { expect(placeMark([floor], 50, 50)).toBeNull(); });
it('keeps at most 50 marks and drops the oldest', () => {});
it('forgets marks older than 4 s', () => {});
```

- [ ] **Step 2: Run** `npx vitest run src/game/systems/marks.test.ts` — FAIL.
- [ ] **Step 3: Implement** `marks.ts` (module-level list; pure, no Pixi) and the `addMark(state.platforms, e.x, e.y)` call in the `spark` case of `applyEffectEvent`.
- [ ] **Step 4: Run** — PASS; `npx vitest run` — 0 FAIL.
- [ ] **Step 5: Commit** `feat: scorch marks placed on the wall edge, capped and fading`

## Phase 2 — Drawing (Pixi; verified by eye)

### Task 5: Glow textures and particle view

**Files:**
- Create: `src/game/render/effects/glowTextures.ts`
- Create: `src/game/render/effects/particleView.ts`
- Modify: `src/game/systems/renderer.ts:13-37` (remove the particle pool) and `:545-564` (replace the particle block with `cache.particleView.sync(state.particles)`)
- Modify: `src/components/GameCanvas.tsx:91-100` (cache gets `particleView: null as ParticleView | null`) and `:472-482` (clear it on map change)

**Interfaces:**
- Produces: `glowTexture(): Texture` (64 × 64 radial, white centre → transparent, cached for the session), `stripTexture(): Texture` (64 × 8, transparent tail → white head). `class ParticleView { constructor(layer: Container); sync(particles: Particle[]): void; clear(): void }` — one pooled display object per particle id; `Sprite` with `blendMode = 'add'` for `flash`/`fireball`/`ring`-glow, `Graphics` otherwise.
- Drawing per kind (world px): `spark`/`ember`: line from `pos` back along `vel × 1.6`, width 1.5 (ember: size × 0.6), colour yellow-white (ember: orange shifting to red as life drops), `add`; `fire`: additive dot r 2; `smoke`/`puff`: circle r `size × (1 + (1 − life) × 1.6)`, alpha `0.35 × life` (puff 0.25); `blood`: circle r `size`, alpha 1; `shell`: 4 × 2 brass rect + a 1 px highlight line, rotated; `dust`: circle r `size × (1 + (1 − life) × 0.5)`, colour `#beb4a0`, alpha `0.45 × life`; `flash`: glow sprite scaled to `size` radius, alpha `life`, tinted `color`; `fireball`: glow sprite tinted orange, radius `12 + (1 − life) × 34`, alpha `life`; `ring`: `Graphics` circle stroke r `10 + (1 − life) × 70`, width `2 + (1 − life) × 3`, alpha `0.6 × life`, `add`.

This task and Tasks 7, 9 and 11 are drawing only: jsdom has no canvas, so they carry no unit test and are verified by screenshots; `npx vitest run` still runs before each commit.

- [ ] **Step 1: Implement `glowTextures.ts`** with `makeCanvas` from `render/scene/canvasKit.ts` and `Texture.from(canvas, true)` directly (not `bakedTexture`); module-level cache.
- [ ] **Step 2: Implement `ParticleView`** (two pools, max 100 pooled objects each; objects for ids no longer present return to their pool).
- [ ] **Step 3: Wire** `renderer.ts` and `GameCanvas.tsx` as listed; delete the old particle pool code.
- [ ] **Step 4: Verify:** `npx tsc --noEmit -p .` (ignore the pre-existing `vitest.config.ts` and `server/src/tunneling.ts` errors); `npx vitest run` — 0 FAIL; open a Deathmatch vs bots in Playwright and screenshot a rocket explosion and a wall hit: fireball + ring + embers visible; no squares anywhere.
- [ ] **Step 5: Commit** `feat: particle drawing by kind with additive glows`

### Task 6: Projectile memory, looks and view; rail beam

**Files:**
- Create: `src/game/render/projectiles/projectileMemory.ts` (pure)
- Create: `src/game/render/projectiles/projectileLooks.ts`
- Create: `src/game/render/projectiles/projectileView.ts`
- Create: `src/game/render/projectiles/beamView.ts`
- Modify: `src/game/systems/renderer.ts:28-37, 511-543, 574-592` (remove projectile pool; replace projectile and beam blocks with `cache.projectileView.sync(state.projectiles, now)` / `cache.beamView.sync(state.beams)`)
- Modify: `src/components/GameCanvas.tsx` cache/map-change as in Task 5
- Test: `src/game/render/projectiles/projectileMemory.test.ts`

**Interfaces:**
- Produces: `class ProjectileMemory { remember(id: string, pos: Vector2): void; trail(id: string): Vector2[] /* newest first, ≤ 7 */; forgetMissing(live: Set<string>): void; get size(): number }`; `projectileAge(p: Projectile): number` = `(p.type === GRENADE_LAUNCHER ? 60 : PROJECTILE_MAX_LIFE) − (p.life ?? PROJECTILE_MAX_LIFE)` ticks; `drawProjectile(view: ProjectileSprite, p: Projectile, trail: Vector2[], age: number, nowMs: number): void` where `ProjectileSprite = { root: Container; strip: Sprite; glow: Sprite; body: Graphics }`; `class ProjectileView { constructor(layer: Container); sync(projectiles: Projectile[], nowMs: number): void; clear(): void }`; `class BeamView { constructor(layer: Container); sync(beams: Beam[]): void; clear(): void }`.
- Looks (spec §1): MG strip 24 × 3 yellow→white + glow r 9; shotgun strip 10 × 2.2 orange→white; plasma core r 4 + glow r 14 × (1 + 0.15 sin(age × 2π × 4.5 / 120)) + 3 ghost orbs (trail indices 2, 4, 6; r 5 × (1 − i/8); alpha 0.25 × (1 − i/7)); rocket body (grey capsule 15 × 5, red nose, two fins, highlight line) + exhaust cone 10–16 px flicker + glow r 14; grenade ball r 4.5 dark green, lime band, highlight, rotation `age × 0.25`; rail beam: three strokes (white 2.5 px; `#7dd3fc` 7 px alpha 0.7; `#38bdf8` 18 px alpha 0.25) × `beam.life`, `add`.
- Shotgun muzzle puff: `ProjectileView.sync` returns `newlySeen: Projectile[]` (ids seen for the first time this frame); `renderer.ts` spawns one `puff` particle (size 5) at the first shotgun pellet per `ownerId` in that list, through `createParticles(state, x, y, 1, '#c8c8c8', 'puff')`. The view itself never touches `state`.

- [ ] **Step 1: Write the failing tests:**

```ts
it('keeps at most 7 remembered positions, newest first', () => {});
it('forgets ids that are no longer live and reports size 0', () => {
    for (let i = 0; i < 200; i++) m.remember(`p${i}`, { x: i, y: 0 });
    m.forgetMissing(new Set()); expect(m.size).toBe(0);
});
it('derives a grenade age from its remaining life', () => { expect(projectileAge({ type: WeaponType.GRENADE_LAUNCHER, life: 45 } as Projectile)).toBe(15); });
```

- [ ] **Step 2: Run** `npx vitest run src/game/render/projectiles/projectileMemory.test.ts` — FAIL.
- [ ] **Step 3: Implement** `projectileMemory.ts`, `projectileLooks.ts`, `projectileView.ts` (pool of `ProjectileSprite`, `forgetMissing` each sync), `beamView.ts`; wire `renderer.ts`/`GameCanvas.tsx`; delete the projectile pool.
- [ ] **Step 4: Verify:** tests PASS; `npx tsc --noEmit -p .`; `npx vitest run` — 0 FAIL; Playwright screenshots mid-flight for each weapon (pick up weapons with keys `1`–`6` as in the earlier close-up script, or spawn them through a Gun Game match) — compare with the mockup's "Трассеры и свет" card. Drawing has no unit test (jsdom has no canvas); the memory and age logic do.
- [ ] **Step 5: Commit** `feat: tracer, plasma, rocket, grenade and rail looks for projectiles`

### Task 7: Scorch marks view

**Files:**
- Create: `src/game/render/effects/marksView.ts`
- Modify: `src/components/GameCanvas.tsx:427-441` (new `marksLayer = new Graphics()` added to `worldContainer` **after** the map look's platform host and before `gameLayer`; see `createMapLook` at `:445` — add the layer after that call so it sits above the platform art), `:472-482` (`clearMarks()` on map change), and the frame loop next to `drawBotPaths` (`:634`): `drawMarks(marksLayer, Date.now())`.

**Interfaces:**
- Consumes: `liveMarks(now)` from Task 4.
- Produces: `drawMarks(g: Graphics, now: number): void` — clears and draws each mark as a filled circle `#0a0c10`, alpha `0.6 × (1 − age / MARK_LIFE_MS)`.

- [ ] **Step 1: Implement and wire.**
- [ ] **Step 2: Verify:** shoot the floor and a wall in Playwright; marks sit on the surface (not hidden), fade within 4 s; `npx vitest run` — 0 FAIL.
- [ ] **Step 3: Commit** `feat: scorch marks on walls and floors`

## Phase 3 — Fighter

### Task 8: Proportions and crouch bound

**Files:**
- Create: `src/game/render/fighter/fighterStyle.ts` (constants)
- Modify: `src/game/render/fighter/fighterParts.ts` (widths, head radius, boots, shoulder pad, helmet ridge), `fighterView.ts` (limb widths × `LIMB_W`), `fighterPose.ts:76-77` (crouch), `ragdollView.ts` (same constants)
- Test: `src/game/render/fighter/fighterPose.test.ts` (add `describe('stays inside the hitbox')`)

**Interfaces:**
- Produces: `export const LIMB_W = 1.35, HEAD_R = 8.6, TORSO_W = 1.25, BOOT = { w: 10, h: 5 }, HITBOX = { halfW: 15, standing: 72, crouched: 45, margin: 6 }` in `fighterStyle.ts`; `bodyExtents(pose: FighterPose): { left: number; right: number; top: number }` in `fighterPose.ts` (rig units; `left`/`top` are negative: min/max over head ± `HEAD_R`, shoulders ± `7.6 × TORSO_W`, feet ± `BOOT.w / 2`, and the jetpack's back corners `upperPoint(pose, -12.5, -17)` / `upperPoint(pose, -12.5, -3)`); crouch pose becomes `hip = { x: -3, y: -12 }`, `lean = 0.40` (with these, the crouched head is 20.5 px from the centre and 50.5 px above the feet against limits of 21 and 51).

- [ ] **Step 1: Write the failing test:**

```ts
it.each(['idle', 'run', 'fly', 'fall', 'crouch'] as FighterState[])('%s pose stays within 6 px of the hitbox', state => {
    const phases = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
    for (const phase of phases) {
        const e = bodyExtents(pose(state, { phase }));
        const height = state === 'crouch' ? HITBOX.crouched : HITBOX.standing;
        expect(e.right * RIG_SCALE).toBeLessThanOrEqual(HITBOX.halfW + HITBOX.margin);
        expect(-e.left * RIG_SCALE).toBeLessThanOrEqual(HITBOX.halfW + HITBOX.margin);
        expect(-e.top * RIG_SCALE).toBeLessThanOrEqual(height + HITBOX.margin);
    }
});
```

- [ ] **Step 2: Run** `npx vitest run src/game/render/fighter/fighterPose.test.ts` — FAIL (crouch head sits ~25 px from centre; `bodyExtents` missing).
- [ ] **Step 3: Implement** constants, `bodyExtents`, the crouch change, and apply the proportions in `fighterParts.ts` / `fighterView.ts` / `ragdollView.ts` (robot head box × 1.23; shoulder pad plate on the front shoulder `U(0.5,-21)…U(9,-15.5)` in `shade(torso, 0.9)`; helmet ridge arc r `HEAD_R − 2.2` from 1.15π to 1.75π in the outline colour).
- [ ] **Step 4: Run** — PASS; `npx vitest run` — 0 FAIL; Playwright close-up: bigger silhouette, crouch head inside the body.
- [ ] **Step 5: Commit** `feat: bigger fighter silhouette within the hitbox`

### Task 9: Volume — highlights, visor, gear, flame glow

**Files:**
- Create: `src/game/render/fighter/fighterDetails.ts` (highlights, strap, pouch, pads, visor gradient, specular, nozzle)
- Modify: `fighterParts.ts` (`limb`/`plate`/`hand`/`boot` call the highlight helpers), `fighterView.ts` (pads at joints, flame glow sprite from `glowTexture()` as a child of `root` behind `body`, r 16–20, `add`, visible only with the flame), `ragdollView.ts` (parts drawn through the same primitives pick the highlights up; add the knee/elbow pad to the limb parts)

**Interfaces:**
- Produces: `limbHighlight(g, a, b, width)`, `plateHighlight(g, points)`, `drawStrap(g, pose, look)`, `drawPouch(g, pose)`, `drawPad(g, p, r)`, `drawVisor(g, r)`, `drawSpecular(g, r)`, `drawNozzle(g, pose, lit: boolean)`; `FighterView` gains `flameGlow: Sprite`. Values from spec §5 (white 22 % / 28 % / 16 % / 35 %; visor gradient sky-blue 55 % → 8 % → white 25 % — use a 3-step layered fill, not a gradient fill).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify:** `npx tsc --noEmit -p .`; `npx vitest run` — 0 FAIL (`fighterPose.test` unchanged); Playwright close-ups (run, fly, crouch) at zoom via `page.screenshot({ clip })` compared with the mockup's "Объём и свет" card; all four skin styles in character setup (`Marine`, `Cyborg-01`, `Hammy`, `Toxic`) still show antenna/ears/tail.
- [ ] **Step 3: Commit** `feat: fighter highlights, visor, gear and flame glow`

### Task 10: Liveliness logic — landing, bob, hit flash, dust budget

**Files:**
- Create: `src/game/render/fighter/fighterMotion.ts` (pure)
- Create: `src/game/render/fighter/fighterDust.ts`
- Modify: `src/game/render/fighter/fighterAnimator.ts` (use `FighterMotion`; extend `FighterFrame`)
- Modify: `src/game/render/fighter/fighterView.ts` (`FighterFrame` gains `squash`, `headBob`, `hitFlash`; apply squash as `root.scale` × `(1 + 0.18 s, 1 − 0.16 s)` with the pivot at the feet, head rotation `+ headBob`, look lightened × `1 + 0.7 × hitFlash` through `shade`)
- Test: `src/game/render/fighter/fighterMotion.test.ts`

**Interfaces:**
- Produces: `class FighterMotion { observe(feetY: number, health: number, nowMs: number): { landed: boolean; squash: number; hitFlash: number } }` with: fall speed = previous frame's `Δy` (px per 1/60 s normalised: `Δy / (Δt × 60)`); `landed` is true for exactly one frame when the fall speed was > 3 for the last 2 frames and `Δy` is now < 0.5; a `|Δy| > 60` jump resets the history and never counts as landing; `squash` = `max(0, 1 − (now − landedAt) / 180)`; `hitFlash` = `1` for 80 ms after `health` decreased, else `0` (an increase never flashes). `headBob(state: FighterState, phase: number): number` (also in `fighterMotion.ts`) = `state === 'run' ? sin(2 × phase) × 0.05 : 0`. `class DustBudget { spawnStep(state, x, y, dir): void; spawnLanding(state, x, y): void }` keeps the refs it spawned and spawns only while fewer than 12 are alive (`life > 0`); step puff: one `dust` at the front foot, vel `{ −dir × 0.8, −0.3 }`; landing: six, vel `{ ±2.2, −0.2…−0.8 }`. `FighterAnimator.frame` returns the new fields and calls the dust budget on `landed` and on a foot plant (`cos(phase)` crossing from < 0.98 to ≥ 0.98 while running).

- [ ] **Step 1: Write the failing tests:**

```ts
it('lands once after a real fall and not after a slow descent', () => {
    // feed y: 0,4,8,12,16,20,20,20 at 60 fps → landed exactly once (on the first 20)
    // feed y: 0,2,4,6,8,8 → never
});
it('ignores a teleport', () => { /* y: 0,4,8, then 1000, 1000 → never landed */ });
it('squash eases from 1 to 0 over 180 ms', () => {});
it('flashes for 80 ms after a health drop and not after a gain', () => {
    expect(m.observe(0, 100, 0).hitFlash).toBe(0); expect(m.observe(0, 80, 16).hitFlash).toBe(1);
    expect(m.observe(0, 80, 100).hitFlash).toBe(0); expect(m.observe(0, 100, 116).hitFlash).toBe(0);
});
it('bobs the head only while running', () => { expect(headBob('idle', 1)).toBe(0); expect(headBob('run', Math.PI / 4)).toBeCloseTo(0.05); });
it('spawns at most 12 live dust puffs per fighter', () => { /* 3 landings in a row → 12 particles, not 18 */ });
```

- [ ] **Step 2: Run** `npx vitest run src/game/render/fighter/fighterMotion.test.ts` — FAIL.
- [ ] **Step 3: Implement** `fighterMotion.ts`, `fighterDust.ts`, extend the animator (it gets `state` for dust: change `FighterAnimator.frame(p, aim, now, textures, state: GameState)` and `updatePlayerVisual` to pass `state` through — `renderer.ts:508` has it) and the view.
- [ ] **Step 4: Run** — PASS; `npx vitest run` — 0 FAIL (update `bot.test`/fixtures only if `updatePlayerVisual`'s signature change breaks a call site); Playwright: jump from a platform → squash and a dust burst on landing; run → puffs at the feet.
- [ ] **Step 5: Commit** `feat: landing squash, dust, head bob and hit flash for fighters`

### Task 11: Muzzle flash and light

**Files:**
- Create: `src/game/render/fighter/muzzleFlash.ts`
- Modify: `fighterView.ts:80-86` (replace the yellow circle with `drawMuzzle`), `fighterAnimator.ts:62-63` (`muzzleFlash` = recoil for the first 120 ms of a shot, no 0.55 threshold)

**Interfaces:**
- Produces: `drawMuzzle(front: Graphics, light: Sprite, muzzle: Vector2, angle: number, k: number, weapon: WeaponType): void` — 4-point star length `7 × k` (×1.6 for shotgun/rocket/rail) in `#ffecaa` alpha `k`, white ellipse core `4 × k × big` by `1.6 × k`, light sprite = `glowTexture()` tinted `#ffc85a`, radius 22 (×1.5 big), alpha `0.5 × k`, `add`, placed at the muzzle. `FighterView` gains `light: Sprite` (child of `root`, above `body`, below `front`).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify:** `npx tsc --noEmit -p .`; `npx vitest run` — 0 FAIL; Playwright: hold fire with the machine gun — the flash is visible in most captured frames (take 10 screenshots 30 ms apart: ≥ 6 show it); with the shotgun the glow reaches the fighter's chest.
- [ ] **Step 3: Commit** `feat: muzzle flash with light on the fighter`

### Task 12: Patch notes, pictures, changelog

**Files:**
- Modify: `src/components/menu/patchNotes.ts` (0.4.0 `comparisons`: add `{ caption: 'Shots and explosions', ...shots('shots') }` / `'Выстрелы и взрывы'`; retake `fighter-after.png`), `CHANGELOG.md` (0.4.0: a "🎇 Shots, Hits and Fighter Polish" section: tracers per weapon, impacts, explosion, blood/hit flash, muzzle light, fighter volume + silhouette + liveliness, hitbox note, blood/spark announcement change), `public/assets/patch/shots-before.jpg`, `shots-after.jpg`, `fighter-after.png`

- [ ] **Step 1: Capture pictures** with Playwright: "before" from a worktree of the commit before Task 5 (`git worktree add … <sha>`, `npx vite --port 5180`), "after" from the dev server; same seed, same moment (a rocket mid-flight next to a fighter firing the machine gun); crop to the 7:6 aspect used by `WhatsNew.tsx`; remove the worktree afterwards (`git worktree remove --force`).
- [ ] **Step 2: Write** the notes (EN/RU) and the changelog entry.
- [ ] **Step 3: Verify:** `npx vitest run` — 0 FAIL (`MainMenu.test.tsx` covers the panel); open "What's new" in Playwright and screenshot the new pair.
- [ ] **Step 4: Commit** `docs: shots and fighter polish in the notes and changelog`

### Task 13: Final check and push

- [ ] **Step 1:** `npx vitest run > <scratchpad>/vt-last.log 2>&1; grep -c FAIL` → `0`; `npx tsc --noEmit -p .` clean apart from the two pre-existing errors.
- [ ] **Step 2:** Performance: Deathmatch vs 3 bots with a rocket launcher, F3 overlay: physics ≥ 115 ticks/s, frames at the display rate; a 2-minute bots-only match in the browser shows no growing memory in `performance.memory.usedJSHeapSize` (±20 %).
- [ ] **Step 3:** `git push` to `origin/fix/gameplay-bugs`; report in Russian with before/after pictures.
