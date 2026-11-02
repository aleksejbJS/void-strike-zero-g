# Projectiles, Hits and Fighter — Visual Polish Spec

Status: implemented 2026-11-02

## Problem

The fighter got a jointed rig (0.4.0), but everything that flies and explodes is still
placeholder art: every projectile is a 4 px filled circle in the weapon's colour (rocket
and grenade included), sparks and smoke are filled squares, the muzzle flash is a yellow
disc, the jetpack flame two triangles. The fighter itself is flat: one fill per part plus
an outline, no highlights, no small gear. Side by side with the new map art it looks
unfinished.

Decided 2026-11-02 from animated mockups (`.superpowers/brainstorm/*/content/visuals.html`):

- Projectiles: option A, "tracers and light".
- Fighter: option A "volume and light" **and** option B "bigger silhouette and liveliness".

## Goals

1. Every projectile reads as what it is at game scale and speed: a tracer, a pellet, a
   plasma orb, a rocket with exhaust, a spinning grenade, a rail beam.
2. Hits and explosions have weight: flash, sparks that fall, smoke that rises, scorch marks.
3. The fighter has volume (highlights, visor reflection, straps, pads), a slightly bigger
   silhouette that reads from far away, and small life: landing squash, dust under the
   feet, shell casings, head bob, a flash when hit.
4. Identical look offline and online. The simulation does not change; all of this is
   display code driven by state and effect events (see `effects.ts`).
5. Runs at 120 Hz with 12 fighters and a few dozen projectiles without new per-frame
   allocations in the steady state.

## Non-goals

- No gameplay change: hitboxes, speeds, damage, fire rates, projectile life stay as they are.
- No new image files; everything is drawn by code (weapon pictures stay as they are).
- Map scenes are not touched.
- The one-off "black world" render crash seen on 2026-11-01 is a separate task.

## Anti-goals (would make this a failure even if it "works")

- A plain filled dot left anywhere in the projectile set.
- Glow that hides fighters: additive effects must stay small (glow radius ≤ 34 px for a
  muzzle flash, ≤ 46 px for a fireball) and short-lived (flash ≤ 0.12 s).
- The fighter's drawing growing past its hitbox by more than 6 px on any side, so that a
  shot which visibly hits never misses. Hitbox: 30 × 72 px around `pos` (centre-x, feet-y).
- Frame-time regressions: the F3 overlay must still show ~120 physics ticks/s and the
  display's refresh rate for frames with 12 fighters firing.

## Constraints

- Pixi v8 (8.14). `Graphics` are pooled already (`renderer.ts`); `blendMode = 'add'` is
  available on any display object (used by `stationLights.ts`). Soft glows should be
  **baked canvas textures** (`render/scene/canvasKit.ts`, `bakedTextures.ts`) on sprites,
  not per-frame gradient fills.
- Snapshots carry a projectile whole: `id, type, pos, vel, life` (ticks left, counted down
  from `PROJECTILE_MAX_LIFE`, 60 for grenades) — no rotation. Spin and pulsing are derived
  from the age `maxLife − life`, so every client agrees without memory; trails (ghost orbs)
  need remembered positions, kept in a per-id memory like `FighterAnimator` does and
  forgotten when the id disappears.
- Cosmetic state lives in `GameState.particles` / `decals` (shared types in `types.ts`),
  moved by `systems/particles.ts`; events become particles in `effects.ts applyEffectEvent`.
  New particle kinds are added to `Particle.type` there.
- The simulation announces cosmetics through `EFFECT` events (`effects.ts`), which the
  server already forwards to clients. Today it emits `spark` (colour, count) on *every*
  projectile and rail hit — wall or fighter alike — and on chainsaw swings; `explosion`
  for rockets/grenades; `blood` only for chainsaw hits; `shell` on machine-gun, shotgun,
  rocket and grenade shots (at the aim origin); `respawn`. Rail shots create `state.beams`.
  Rocket smoke comes from `projectileTrail` (50 % chance per tick); jetpack trail from
  `jetpackTrail`.
- **Change to the announcements (my call, see Decisions 5):** where the simulation already
  knows what was hit (`physics.ts` projectile loop, `combat.ts` rail shot), it emits
  `blood` at the impact point for a fighter and `spark` for a wall, instead of `spark` for
  both. No gameplay or protocol change: same event type, same transport.
- Files ≤ 200 lines, one responsibility each, named exports (CLAUDE.md). `renderer.ts` is
  already far over that limit: new work goes into new modules and `renderer.ts` only
  *calls* them (its projectile/particle/beam blocks are replaced by calls, not extended).
- Colours stay the weapon colours in `WEAPONS_DATA` so pickups, HUD and effects agree.

## Design

### 1. Projectiles (per weapon)

Sizes are world px at game scale. "Strip" = a baked 64 × 8 gradient texture (transparent
tail → opaque bright head), drawn as a sprite rotated along the velocity, blend `add`.
"Glow" = a baked radial gradient (white centre → transparent) tinted per use, blend `add`.

| Weapon | Look |
|---|---|
| Machine gun | strip 24 × 3, yellow → white head; glow r 9 at the head |
| Shotgun | 6 strips 10 × 2.2, orange → white; one grey muzzle puff (r 5 → 13, 0.35 s) on the shot |
| Plasma | white core r 4, blue glow r 14 pulsing ±15 % at ~4.5 Hz; three ghost orbs at remembered positions (every 2nd of the last 7), fading |
| Rocket | drawn body: grey capsule 15 × 5, red nose cone, two grey fins, a highlight line; exhaust cone 10–16 px flickering (white → orange → transparent) with a glow r 14; the existing smoke puffs keep their rate but get the new puff look (§3) |
| Grenade | dark-green ball r 4.5, lime band, highlight; spins 0.25 rad per tick from first-seen; sim gravity unchanged |
| Railgun | beam from `state.beams`: white core 2.5 px, light-blue 7 px, blue glow 18 px (`add`), all fading with the beam's life; impact burst as in §2 in the rail colour plus white |
| Chainsaw | no projectile; its `spark` events become streak sparks (§2) |

### 2. Hits

- **Projectile hits a wall** (`spark` event): a glow flash r 16 in the weapon colour
  (0.12 s); 8 streak sparks (lines along their velocity, length ∝ speed, additive,
  yellow-white, gravity, 0.3–0.6 s); a scorch mark (dark circle r 2–3.5, alpha 0.6 fading
  over ~4 s). The spark point is up to one tick of travel *inside* the wall (the sim uses
  `prevPos` only for explosions), so the mark is placed at the spark point projected onto
  the nearest edge of the platform that contains it; no containing platform → no mark.
  Marks are drawn on a new layer between the platform art and the fighters (the existing
  `decalLayer` sits under the platform art, so a mark written there would be hidden). The
  existing decals (death pools) stay where and how they are.
- **Fighter hit** (`blood` event, now emitted at the impact point — see Constraints):
  droplets (circles r 1.5–2.5, red, gravity, 0.4–0.7 s) instead of squares, and a **hit
  flash**: for 80 ms after the fighter's health drops, its look colours are lightened ×1.7
  (clamped) — detected client-side from the health value.
- **Explosion** (`explosion` event): white flash disc r 40 for 80 ms; fireball (glow
  sprite, orange, r 12 → 46 over 0.55 s, fading); shockwave ring (stroke, r 10 → 80 over
  0.5 s, alpha 0.6 → 0); 14 embers (streak sparks with gravity, 0.5–0.8 s); 6 smoke puffs
  rising and growing (0.9 s); scorch decal r 18. Screen shake stays as it is.
- **Death**: ragdoll unchanged; its blood burst uses droplets.

### 3. Particles (replacing the squares)

| Kind | Look | Motion |
|---|---|---|
| spark / ember | streak: line from the position back along the velocity, additive | gravity |
| fire (jetpack trail) | small additive ember dot | as today |
| smoke / puff | soft circle, alpha 0.35 → 0, grows ×1 → ×2.6 | drifts up slowly |
| blood | droplet circle, non-additive | gravity, stops on platforms |
| shell | brass rectangle 4 × 2 with a highlight line, rotating | bounce as today |
| dust (new) | grey-beige puff r 2–3.5, growing ×1.5, alpha 0.45 → 0, 0.6 s | drifts backwards |

If more than 500 particles are alive, smoke and dust are not spawned (graceful degrade).

### 4. Muzzle flash and light

A 4-point star (length 7 × k) with a white ellipse core at the muzzle, plus a warm glow
sprite r 22 (×1.5 for shotgun, rocket, rail: 33, within the anti-goal's 34) that overlaps
the fighter — the "light on the fighter". Shipped rule: the strength `k` is a linear fade
`1 − since / 120 ms` over the first 120 ms of a shot (recoil itself keeps its curve), with
the light centred 10 rig units behind the muzzle so it overlaps the hands. (Today the flash is drawn only
while k > 0.55, i.e. ~21 ms — that is why it is barely seen; the new one fades over 120 ms.)
Blend `add`. Applies to every fighter, including remote players and bots (recoil is derived
from `lastFired` already; for remote players it leads the interpolated body by ~100 ms, as
today — accepted, it is a flash).

### 5. Fighter: volume (A)

Same joint lengths and `RIG_SCALE`. On top of today's parts:

- Limbs: a highlight stroke along the upper side (white 22 %, width 30 % of the limb,
  inset 15 % from both ends). Plates: a top-edge highlight line (white 28 %).
- Torso: chest-plate highlight (white 16 %) on the upper-front quarter; a diagonal strap
  from the back shoulder to the front hip (belt colour, 1.8 wide, thin highlight); a dark
  pouch on the lower back of the torso.
- Knee pads (r 2.6 front / 2.4 back) and elbow pad (r 2.0) in the glove colour; gloves get
  a small highlight dot; boots get a sole line.
- Head: specular ellipse (white 35 %) upper-left; visor gets a gradient (sky-blue 55 % →
  8 % → white 25 %) over the dark visor; the glint line stays.
- Jetpack: nozzle dot (orange, bright while flying); the flame gets a white inner tongue
  and a glow sprite r 16–20 (`add`).
- Robot, beast and alien skins keep their features (antenna, ears, tails, accent band);
  highlights apply the same way.

### 6. Fighter: silhouette and liveliness (B)

- Proportions: head radius 7 → 8.6 (robot head box scaled the same ×1.23); torso width
  ×1.25; limb thickness ×1.35; boots 10 × 5; a shoulder pad on the front shoulder; a helmet
  ridge line. Resulting width ≈ 22 px against the 30 px hitbox (anti-goal respected).
  Crouched, the hitbox is 30 × 45: the crouch pose must keep the bigger head inside the
  6 px margin too (lower the crouch head position if it does not).
- Landing squash: scale (1 + 0.18 s, 1 − 0.16 s) anchored at the feet for 180 ms, `s`
  easing 1 → 0. The landing is detected from the **drawn position** (feet were moving down
  faster than 3 px/frame on the previous frames and have now stopped), not from
  `isGrounded`: remote fighters are drawn ~100 ms in the past (`interpolation.ts` rewrites
  only `pos`), so a flag-based squash would fire while the body is still in the air. Same
  rule offline, so both look identical (goal 4).
- Dust: one puff at the front foot on each foot plant while running (run phase crossing
  the plant point); six puffs on landing (same detection as the squash). At most 12 live
  dust puffs per fighter.
- Shell casings: the sim already emits one per machine-gun, shotgun, rocket and grenade
  shot (plasma, rail and chainsaw have none — correct); they get the §3 look.
- Head bob while running: ±0.05 rad at twice the run phase.
- Hit flash (§2).
- Ragdoll parts (`ragdollView.ts`) take the same proportions and highlights so a body
  flies apart looking like the fighter it was.

### 7. Patch notes

- "What's new" gets a second before/after pair, "Shots and explosions" (dots → tracers),
  and the fighter pair's "after" picture is retaken with the new look.
- EN/RU note lines and a CHANGELOG entry under 0.4.0.

## Files (proposed; the builder may split differently, under 200 lines each)

| File | Responsibility |
|---|---|
| `src/game/render/effects/glowTextures.ts` | bake and cache the strip and radial-glow textures. They live for the whole session: **not** through `bakedTexture()`'s scene registry, which `releaseBakedTextures()` destroys on every map change |
| `src/game/render/effects/marksLayer.ts` | scorch marks: placement on the platform edge, fade, cap; its layer is added in `GameCanvas.tsx` between the platform art and `gameLayer` |
| `src/game/render/projectiles/projectileView.ts` | one display object per projectile id, memory (first seen, last positions), forget on removal |
| `src/game/render/projectiles/projectileLooks.ts` | per-weapon drawing (§1) |
| `src/game/render/projectiles/beamView.ts` | rail beam (§1) |
| `src/game/render/effects/particleView.ts` | drawing per particle kind (§3) |
| `src/game/render/effects/explosionView.ts` | flash / fireball / ring timeline (§2) if not done as particles |
| `src/game/render/fighter/muzzleFlash.ts` | star, core and light (§4) |
| `src/game/render/fighter/fighterParts.ts` (+ split) | proportions and highlights (§5, §6) |
| `src/game/render/fighter/fighterAnimator.ts` | landing, head bob, hit flash, dust events |
| `src/game/render/fighter/fighterDust.ts` | dust spawning with the per-fighter cap |
| `src/game/systems/effects.ts`, `systems/particles.ts` | new particle kinds, compositions, motion |
| `src/game/systems/physics.ts`, `systems/combat.ts` | emit `blood` for a fighter hit and `spark` for a wall hit (projectiles and rail); nothing else changes |
| `src/game/systems/renderer.ts` | replace its projectile / particle / beam blocks with calls |
| `src/game/render/ragdollView.ts` | match the new proportions |

## Testing

- Unit: `applyEffectEvent` compositions (an explosion yields the expected kinds and counts;
  a blood event yields droplets); particle motion for the new kinds (gravity on sparks and
  droplets, growth on smoke, dust cap); animator events (landing detected only after a real
  fall, head bob only while running, hit flash window 80 ms); projectile memory is forgotten
  when an id disappears (no leak over a 60 s bots-only run — reuse `src/test/botBench.ts`).
- Visual: Playwright screenshots of each weapon mid-flight and at impact, and of the
  fighter running / flying / landing, compared by eye against the mockup; the pictures go
  into `public/assets/patch/`.
- Performance: F3 overlay during a 3-bot Deathmatch with a rocket fight: ≥ 115 ticks/s and
  frame rate at the display's refresh.

## Decisions

1. Projectiles: tracers and light (2026-11-02).
2. Fighter: volume and light + bigger silhouette and liveliness, both (2026-11-02).
3. Everything stays code-drawn; glows are baked textures on sprites (my call: cheapest at
   120 Hz, and the scene already bakes its art the same way).
4. Cosmetics stay client-side; gameplay and the network protocol do not change (my call:
   keeps offline and online identical).
5. The simulation's cosmetic announcements may be refined through the existing `EFFECT`
   channel: `blood` for a fighter hit, `spark` for a wall hit (my call, after the builder's
   check: the client cannot tell the two apart otherwise, and the sim already knows).
6. Scorch marks get their own layer above the platform art; old decals are left alone (my
   call: the alternative, lifting the whole decal layer, would also reveal today's hidden
   death pools — a change nobody asked for).
7. Landing squash and dust are detected from the drawn position, not `isGrounded` (my
   call: remote fighters are drawn 100 ms in the past; this keeps offline and online the
   same without touching the net code).
8. Muzzle glow capped at 33 px and the flash fades over ~100 ms (my call: resolves the
   conflict between §4 and the anti-goal, and fixes the ~21 ms flash that nobody sees).

## Builder's check (2026-11-02)

A fresh reviewer read this document against the code. Findings and how they were settled:
the sim never emitted `blood` for gun hits (→ Decision 5); muzzle glow size contradicted
the anti-goal (→ 8); the decal layer is hidden under the platform art and wall-hit points
lie inside the wall (→ 6, §2); remote fighters' flags lead their drawn body (→ 7, §4);
projectile `life` is in snapshots, so age needs no memory (→ Constraints); shells are not
emitted for plasma/rail/chainsaw (→ §6); the crouch hitbox is 30 × 45 (→ §6); glow
textures must not go through the scene's baked-texture registry (→ Files).

## Open questions

None blocking.
