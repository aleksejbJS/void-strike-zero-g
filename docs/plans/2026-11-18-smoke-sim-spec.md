# Smoke Sim — Spec

**Date:** 2026-11-18 · **Status:** approved by the owner 2026-11-18
**Branch:** `feature/smoke-sim` (worktree `~/Documents/void-strike-smokesim`, from `release/0.5.0` c5e435b).
Ships inside 0.5.0 (owner, 2026-11-18).
**Reference look:** the spike on branch `spike/smoke-shader` (commit 7059622, worktree
`~/Documents/void-strike-smokefx`, files `src/game/render/effects/smoke{Sim,Stirs,Clouds,Shader}.ts`).
The owner saw it on the test range and said it looks "100 times better". The clean version must look
and react at least as well. The shading comes from the owner's CFD demo `~/Desktop/cfd_webgl.html`
(fragment shader `cfdFS`, lines ~784–860).

## Intent

Smoke grenade clouds are drawn today as 16 flat grey circles (`smokePuffs.ts`, `SmokeView`). The owner
finds them toy-like and wants real smoke: billows that roll and rise, a lit top and a shaded bottom,
torn edges, and smoke that **reacts to the world**: bullets cut through it, blasts blow it apart, the
flamethrower heats it, lights it from inside and blackens it, fighters drag it along. Holes close again.

**Looks only.** The gameplay cloud stays as it is: a circle of radius 110 (`SMOKE_RADIUS`), 10 s, the
last 2 s shrinking (`smokeRadiusAt`); anyone whose body centre is inside is hidden by
`fighterSmokeVisibility`, and bots cannot see through it (`smokeHides`). Nothing runs on the server or
in the simulation; online play needs no server redeploy. Because hiding is decided by the circle, not
by how dense the picture is, a hole punched in the visible smoke never reveals a fighter.

## Owner decisions (2026-11-18)

| Question | Decision |
|---|---|
| Look | The CFD demo's shading (option A), and then **option 2: a small real air simulation per cloud** (the owner asked for smoke that reacts after seeing a shader-only version) |
| Colour | **Smoke is always white.** A future gas will be another colour, so the colour is one parameter, not hard-coded |
| One big cloud? | Asked why not one grid for the whole map. Answer given: one grid costs all the time and the camera moves; per-cloud grids cost only where smoke is, and nearby clouds merge on screen. If merging looks bad, one shared grid around all clouds is the fallback |
| Where checked | On the hidden test range (`#range`, keys 7 smoke, 1 machine gun, 3 rocket, 9 flamethrower) |
| Release | Inside 0.5.0, as a group in the 0.5.0 "What's new" with before/after pictures |
| Flamethrower smoke | **Replace** the 0.5.0 flamethrower's faint brown smoke with dark soot plumes from the new smoke system (option 1 of the open question, 2026-11-18) |

## Goals

1. **Air grid per cloud.** Each live cloud has a square grid (spike: 48 × 48 over 1.5 × the full
   radius around the centre, ~6.9 px per cell) holding air velocity, smoke density, heat and soot.
   It steps at a fixed rate (spike: 60 Hz, stable fluids: forces → vorticity confinement → project →
   advect velocity → project → advect density/heat/soot). The step is pure TypeScript with no Pixi,
   so it can be tested.
2. **Shape follows the gameplay circle.** Inside the live radius the density refills toward a dense
   middle with an uneven, slowly changing outline (spike: three angular waves); outside it the density
   fades. The birth is a fast burst outward (spike: full size in ~0.6 s). During the fade the visible
   cloud shrinks with `smokeRadiusAt`. Visible smoke may stray past the circle briefly (pushed by a
   blast or a flame) but fades there within about a second.
3. **Walls.** Platforms and intact cover are solid cells: smoke lies on the floor, flows around crates
   and never shows inside or under them. Cover that breaks or comes back updates the solid cells.
4. **Reactions** (all read from what the screen already has, so offline, host and guest look alike):
   - projectiles in flight push the air along their path and thin a narrow tunnel; rockets and
     grenades also heat it;
   - an explosion (its `'ring'` particle) blows the smoke outward, heats it and clears the middle;
   - a fresh railgun beam cuts a straight tunnel;
   - a flamethrower stream pushes the air along its reach, heats it strongly and adds soot;
   - a moving fighter (living, faster than a walk threshold) drags the air with it.
   Holes refill in 1–2 s (spike refill rate 1.7 /s).
5. **Shading** as the demo: fbm noise moved by the density slope makes the billows; light from above
   (lit top, shaded bottom); a brief orange glow where the air is hot (heat cools in well under a
   second); soot darkens the smoke towards near-black; the grid edge fades out so no straight cut
   ever shows. Colour comes from one parameter (white now).
6. **Flamethrower soot plumes** (owner decision): the flame engine's smoke particles (`STREAM.smokeRate`
   in `flameStream.ts`, the wisps from `firePatches.ts`, drawn by `FlameFx` as `ParticleSprites` with
   `tex.smoke`) are no longer drawn. The places they rise from (the older flame along the stream, a
   splash of fire on a wall or floor, a burning fighter) instead feed dark soot into small plume grids
   of the same system: no gameplay circle, a source that lives while the fire burns, soot that rises
   with the heat, spreads and fades out within ~3 s after the fire stops. Plumes near each other share
   one grid; their number is capped (builder's call) and they count against the same budget. A stream
   that passes through a smoke cloud still heats and blackens that cloud (goal 4).
7. **Quality tiers**, matching the flame (`FlameFx` quality per view): `high` on the game screen,
   `medium` on touch devices (coarser grid), `low` in tournament match tiles and the menu preview
   (coarsest grid or no reactions). Clouds far outside the camera do not step.
8. **Fallback.** If the shader cannot run (no WebGL, compile error), the current circle drawing is
   used and the error is logged once (no silent catch).
9. **Tests:** the grid step (mass stays inside the circle at rest, a push moves density the right way,
   solids stay empty, heat cools, the burst reaches the radius), the stir collection from a state
   (projectile, ring, beam, flame stream, fighter), quality settings, and that `SmokeView` creates
   and destroys one GPU resource set per cloud (no leaks over many clouds).

## Non-goals

- Any gameplay change: hiding, bot sight, radius, duration, the smoke launcher.
- Server, protocol, snapshots. Each player's swirls may differ; that is fine (looks only).
- Gas or coloured smoke (later; only the colour parameter now).
- One shared grid for the whole map (fallback only, if merging looks bad).
- Smoke pushing the flame or bullets back (one-way: the world moves the smoke).

## Anti-goals (a failure even if it works)

- A frame drop on the owner's MacBook at 120 Hz: four clouds on screen while fighters shoot and spray
  through them must keep 120 fps. That is the binding rule; the budget below serves it.
- A cloud that looks emptied for long while the circle still hides (holes must refill in 1–2 s).
- Straight edges, visible grid cells, a square outline, or smoke drawn inside platforms or cover.
- GPU memory growing over a match (textures, shaders and geometry are freed with each cloud).
- Different look on the range than in a real match (the range runs the same code).

## Constraints

- Project rules: files at most 200 lines, one responsibility per file, named exports, no silent catches.
- Pixi v8 (8.14): `Graphics.destroy({ children: true, context: true })`; never `app.destroy(true)`;
  a texture made from a buffer is destroyed with its source. The app uses the default WebGL renderer.
- Coordinates: cloud `pos` is the circle centre; fighters and cover use `pos = (centerX, bottomY)`;
  platforms are top-left `{ x, y, w, h }` (`coverRect` gives cover rects).
- The smoke stays the top effect view (`SmokeView.raise`), with the local fighter's outline drawn over it.
- No extra per-frame work when there is no smoke.
- Stirs must not depend on the frame rate (a 60 Hz and a 144 Hz screen look alike).

## Approaches considered

1. **Shader only over faked density** (lumps that roll). Built as the first spike; the owner found it
   still toy-like and dead (no reaction to shots). Rejected.
2. **Shader + per-cloud air grid** (chosen). Real flow at small cost; reactions for free.
3. **One full-map grid with gameplay following the real smoke** (the CFD demo as-is). Too costly on
   large maps, needs determinism across server and clients, changes bots and the network. Rejected.

## Budget and how the cost is held *(builder's calls, 2026-11-18)*

A builder check measured the spike's grid in Node: about 1 ms per cloud per step (48 × 48, two
pressure solves of 18 iterations, closures and `Math.hypot` in the inner loops), so four clouds cost
~4 ms on a stepping frame. The spike still held 120 fps in the browser with one cloud.

- **Budget:** smoke costs at most **1.5 ms CPU per frame on average** with four clouds on `high`,
  measured in the browser on the test range, and no single frame spends more than 3 ms on smoke.
- **Order of cuts when over budget:** first make the inner loops fast (flat typed-array loops, no
  closures or per-cell `Math.hypot`/`atan2`, precomputed per-cell distances and angles); then one
  pressure solve per step and fewer iterations; then a lower step rate (30 Hz with interpolated
  upload is acceptable); the grid size on `high` is cut last. The look is judged against the spike
  on the range.
- **Many clouds:** at most four clouds step per frame at full rate (those nearest the camera centre);
  the rest step at half rate; clouds outside the camera view (plus a margin) do not step at all.
- **Main thread, CPU.** A Worker is allowed only if the cuts above are not enough. GPU solving is out
  of scope (goal 1 wants a pure, testable step).
- **Randomness** (outline phases, churn) comes from a PRNG seeded by the cloud id (as `smokePuffs`
  does), so tests are repeatable.

## Delivery *(builder's calls)*

- **Merging:** two overlapping clouds are drawn one over another (as in the spike) and checked on the
  range by firing two smoke rounds side by side; the owner judges. The shared-grid fallback is **not**
  built in this plan; the code only must not block a later composite pass.
- **This branch writes** the 0.5.0 "What's new" group (en + ru) with before/after pictures at
  560 × 480 (`public/assets/patch/smoke-{before,after}.jpg`) and the CHANGELOG 0.5.0 section, and
  is merged into `release/0.5.0` locally after the owner's OK, like the test range.
- **Soot plumes** (goal 6) are the last phase of the plan, so the grenade smoke can ship even if the
  plumes need more tuning.

## Left to the builder

- Grid size per tier, step rate, iteration counts and all tuning numbers, within the budget section above.
- How the flame streams reach the smoke (the spike used a module-level map written by `FighterFire`;
  `FlameOrders.streams` already carries the same data).
- Texture format and upload (the spike uploads RGBA8 every frame).
- Whether clouds that overlap are drawn one over another (spike) or summed in one pass, as long as
  they look like one cloud.
