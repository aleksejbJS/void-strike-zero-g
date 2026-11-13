# Flame FX — Spec

**Date:** 2026-11-13 · **Status:** approved by owner 2026-11-13 (incl. the proposed defaults)
**Branch:** `feature/flame-fx` (worktree `~/Documents/void-strike-flame`, from `origin/main` 0.4.37)
**Reference:** `docs/plans/flame-fx-reference/qwen-flamethrower-demo.html` (PixiJS v7 demo the owner
brought, class `Flamethrower`, lines 444–1008) and `demo-firing.png` (how it looks while firing).

## Intent

The flamethrower's stream is a string of identical round glows today. The owner wants the "volumetric"
flame of the demo: a dense glowing body that stretches along its flight, curls in turbulence and rises,
a white-blue jet at the nozzle, sparks that fall and bounce, smoke from the tail, light on the
surroundings, and fire that splashes and clings where the stream hits a wall. Burning fighters get the
same flame. The sound of the demo (a roar, a hiss and crackle) replaces ours.

**Looks only.** Damage, range, cone, burn time and the fuel tank do not change. Nothing here runs on the
server or in the simulation; online play needs no server redeploy.

## Owner decisions (2026-11-13)

| Question | Decision |
|---|---|
| How much of the demo | **Option A — full visual port** (all layers + splash fire on surfaces), gameplay untouched |
| Who gets the new flame | **The stream and burning fighters** |
| Sound | **Take the demo's** roar / hiss / crackle |
| Palettes | **Napalm only now**; blue gas / toxic / crimson later as fighter-builder unlocks (the code takes a palette, the builder does not offer it yet) |

## Proposed defaults — owner may override

| Question | Proposal | Why |
|---|---|---|
| How long splash fire burns on a wall/floor/cover | **~1.2 s** after the stream leaves (demo: 3.4 s), then a soot mark that fades over ~8 s | Fire that lingers but does not hurt would mislead players; 1.2 s reads as "splash", not "hazard" |
| Pilot light (small blue flame at the nozzle while holding the flamethrower, not firing) | **Yes** | Cheap, tells at a glance who carries a flamethrower |
| Heat haze and bloom post-filters of the demo | **No** | Full-screen filters cost a lot on weak machines and P2P hosts; the additive glows give most of the look |
| Lit fuel tank jet and the tank's fireball | **Unchanged** (out of scope) | Owner chose stream + fighters; the new engine can take them later with one call (`burst`) |

## Behaviour

### 1. The stream
- Layers, back to front: soot marks → smoke → splash fire on surfaces → tongues of that fire → light
  glows → flame body + nozzle jet + sparks. All additive except smoke and soot.
- **The flame body** follows the demo: soft cores that start round and fast, stretch along their
  velocity, then slow, swell, curl in noise-driven turbulence and rise; colour walks a 64-step ramp
  white-yellow → orange → red → dark ember.
- **Nozzle jet:** short white-blue streaks right at the muzzle.
- **Sparks:** hot dots with a short tail, fall under gravity, bounce up to 2 times on surfaces.
- **Smoke:** dark clouds born from the older part of the flame, rising and drifting.
- **Light:** a glow at the nozzle, a big flickering glow at the flame's front, a flat glow on the
  floor under it.
- **Reach matches damage.** The visible flame ends where the damage ends: at `FLAME_RANGE` (300 px) or
  the first platform / intact cover on the way (`flameReach`, as today). The demo's numbers are scaled
  so the bulk of the flame ends within 300 px ± 10 %; the cone matches `FLAME_HALF_ANGLE` (±8°).
- **Surfaces.** Flame particles collide with platform and intact cover rectangles near the stream and
  slide along them; where they hit, splash fire appears (see table above for how long it lasts).
  Fighters do not stop the flame (as in the simulation).
- Start/stop: the stream fades in over ~0.1 s and out over ~0.25 s (the demo's "power"), driven by
  the same `isSpraying` rule as today (a flame tick less than 150 ms ago).

### 2. Burning fighters
- While `burnUntil` is ahead, the fighter carries a **moving fire patch** — the demo's tongue flames,
  flame mass and ember bed — sized to the body and following it; lying down it is wide and low.
- It throws a few sparks and wisps of smoke; it fades out over ~0.3 s when the burn ends.
- Corpses do not burn today and still will not (only a lit tank burns on a corpse, unchanged).

### 3. Sound (replaces the current `spray` recipe)
- **Roar + hiss:** one continuous loop for the whole match (low band-passed noise + high hiss),
  its volume follows "is anyone spraying": every `SOUND flame/spray` event (already 10 per second
  per stream) keeps it up for 150 ms; more streams at once make it a little louder, capped.
- **Ignite whoomp** when a stream starts; **crackle** ticks while fighters burn.
- The fuel tank's `ignite` sound (fuse hiss up to the blast) stays as it is.
- Mute and the SFX volume apply as to every other sound. One shared roar per page, so the tournament
  watch screen with several match tiles does not stack roars.

### 4. Quality and limits
- One flame engine per game canvas, shared by every fighter on it, with fixed sprite pools
  (≈1800 flame, 300 jet, 400 spark, 300 smoke, 16 splash fires, 24 soot marks). When a pool is full,
  new particles are skipped, never allocated.
- Tiers: `high` on desktop, `medium` on touch devices, `low` in tournament match tiles (fewer
  particles per stream — the demo's `capMult` 1 / 0.68 / 0.34).
- All sprites, no per-frame `Graphics` redraws (the perf baseline found Graphics rebuilds are 86 % of
  client garbage); textures are drawn once on a canvas and shared.

## Code shape (one responsibility per file, ≤ 200 lines)

New folder `src/game/render/flame/`:

| File | Job |
|---|---|
| `flameTuning.ts` | All numbers (scaled demo defaults), quality tiers, pool sizes |
| `flamePalettes.ts` | Napalm (+ the 3 others, unused for now) and the colour look-up tables |
| `flameTextures.ts` | The 7 canvas textures (flame, smoke, core, ember, glow, pool, tongue), made once |
| `particlePool.ts` | Fixed pool of plain particle records (no Pixi), free list |
| `streamEmitter.ts` | Emits flame / jet / spark / smoke / pilot particles for one stream |
| `particleMotion.ts` | Moves and ages each kind: turbulence, lift, drag, surface hits, bounces |
| `firePatches.ts` | Splash fire on surfaces + the moving body fire, with their tongues |
| `scorchMarks.ts` | Soot marks left by splash fire |
| `flameSprites.ts` | Pixi side: copies particle records to pooled sprites (scale, rotation, tint, alpha) |
| `flameGlows.ts` | The nozzle / front / floor light sprites |
| `flameFx.ts` | The per-canvas engine: `stream(id, x, y, angle, firing)`, `bodyFire(id, …)`, `update(dt, surfaces)`, `destroy()` |

Simulation (pure data) and Pixi (sprites) are split so the motion, emission, reach and pool rules are
unit-tested in Node without a renderer.

Changed: `fighterFire.ts` (stream and body fire go to `FlameFx` instead of `state.particles`),
`GameCanvas.tsx` / `MatchTile.tsx` (create, update, destroy one `FlameFx`), `flameAudio.ts`
(continuous roar instead of per-tick bursts). Removed: `flameJet.ts`; the `addFlame` body path.
Kept: `flameParticles.ts` tank jet / fireball, `particleDraw.ts` `flame` kind (they still use them).

Pixi v8 port notes: `blendMode = 'add'`; `Texture.from(canvas)`; destroy containers with
`{ children: true }` but never the shared textures; no `app.destroy(true)` (see pixi-destroy-context).

## Acceptance

1. Spraying in the open: dense stretched flame, white-blue nozzle jet, sparks, smoke and glows; visibly
   ends at ~300 px; looks like `demo-firing.png` at our scale.
2. Spraying at a wall / floor / crate: the flame stops at it, spreads along it, leaves splash fire
   (~1.2 s) and a fading soot mark; nothing passes through.
3. A burning fighter carries tongue flames that follow it, also lying down, and stop when the burn ends.
4. Sound: a steady roar while spraying (no stutter), whoomp at start, crackle on burning fighters;
   mute silences everything; 4 match tiles at once give one roar.
5. Damage, burn and tank behaviour are byte-for-byte unchanged (existing tests pass untouched).
6. Performance: 4 fighters spraying at once at `high` keeps 120 fps on the owner's MacBook; client
   garbage does not rise against the 2026-11-13 baseline method.
7. Online (P2P and dedicated server) and the tournament watch screen show the new flame.
8. Patch note: ships inside the big **0.5.0** release (owner 2026-11-13) as its "Flamethrower" group, with one
   before/after screenshot pair (`public/assets/patch/flame-*.jpg`).

## Out of scope

Heat haze / bloom filters; palette unlocks in the builder; new look for the lit tank jet and fireball;
fire that hurts on the ground (gameplay); the demo's tuning panel, autotests and export dialog.
