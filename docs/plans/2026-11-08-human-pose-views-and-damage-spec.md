# Human Pose Views and Damage Pilot

Date: 2026-11-08
Status: authorized Human-only 2D pilot; future 3D architecture remains a separate version.
Authorization: user confirmed Human first in current 2D after requesting pose-specific
views, non-smiling injured/dead faces and blood. Do not repeat for all five bases yet.

## Root Problem

V2 completes hidden joint surfaces but uses one projected view for both sides and
all poses. Rotating a flat part cannot expose its sole, heel, back or another face.
Mathematical floor clearance is not visual/anatomical acceptance. The previous
completion claims did not establish correct projected anatomy in bent poses.

## Current Pilot

- Keep approved Human identity, swept brown hair, stubble, cream tank top, dark
  denim shorts, brown work boots and illustrated atompunk rendering.
- Create separate crouch and prone part atlases with distinct near/far upper arms,
  forearms, hands, thighs, shins and boots plus pose-correct torso and pelvis.
- Crouched boots show the appropriate top/side surfaces. Prone boots face backward
  with heel/sole views appropriate to extended legs; do not reuse upright shoes.
- Complete rounded overlaps remain necessary. Avoid baking a second bend into
  parts that the skeleton already bends; author the projected local bone axes.
- Generate Human injured and dead heads preserving identity and scale. Injured
  face shows pain; dead face has relaxed/closed eyes and slack mouth, never a grin.
- Add painted blood, visible wound caps and local splatter for detached Human
  head/arms/legs and a cut waist. Keep blood consistent with the illustrated style.
- Use the same selected pose art for relevant corpse parts. Every dead Human uses
  dead facial artwork, including intact falls; a live wounded Human can use pain art.
- Preserve existing idle/run/flight art for now and keep the other four bases intact.
- Source assets/prompts are versioned and retained. No automatic claim of complete
  arbitrary-view coverage from this finite 2D set.

## Implementation Outline

1. Generate and inspect two pose atlases and a head/damage atlas with built-in ImageGen.
2. Author measured UV regions, pivots, scales and contact edges from actual images.
3. Select Human art by pose without allocating new meshes per animation frame;
   support mixed source/pose/head textures, shared loading, fallback and disposal.
4. Select face by living injury/death state and attach wound caps to severed ends.
5. Check assembled Human crouch/prone, aiming, mirroring, intact fall, gib, waist
   cut and surviving one-leg wound. Fix silhouette/occlusion, not only test numbers.
6. Verify affected render/physics/setup checks, production typecheck/build and
   capture visual comparisons. Stop at Human for assessment before a five-base rollout.

## Future Version: 3D Master Assets

Recommended production source: a styled 3D character with skeleton, weights,
corrective poses, expressions, equipment anchors and prepared separation surfaces.
Render with a fixed orthographic camera to retain the 2D game presentation.
Current illustrations remain appearance references, not a substitute for a mesh.

Options:
1. Hand-painted 2D pose/view variants: smallest current change, finite coverage and
   growing authoring/combination cost.
2. 3D master -> rendered segment/view atlases: consistent perspective/materials and
   keeps the 2D renderer, but orientation bins/occlusion and pose corrections remain.
3. Runtime 3D rig with orthographic presentation: strongest candidate for arbitrary
   ragdoll and body separation; larger rendering/physics/mobile integration scope.

Rendering whole-character frames alone does not preserve independently rotating
ragdoll limbs. A future prototype must compare options 2 and 3 using one Human,
including extreme bends, damaged faces and dismemberment before building five models.
3D is not sufficient by itself: joint limits, skin weights, mesh separation and
art direction require explicit validation. Existing 2D gameplay can remain separate
from the character's 3D presentation; exact integration is not yet selected.

Primary references:
- https://threejs.org/docs/pages/OrthographicCamera.html
- https://threejs.org/docs/pages/SkinnedMesh.html
- https://projects.blender.org/blender/blender-manual/src/branch/main/manual/render/introduction.rst

## Open Decisions for Future Work

- Offline segment atlases versus a runtime 3D character renderer.
- Target device/performance budget and modelling/rigging production method.
- Required camera/view coverage and whether body pieces may rotate out of plane.
- Species-specific fluid treatment (Human blood, robot oil/sparks, Toxic fluid).

## Execution Ledger

- Current renderer confirmed: each V2 limb is shared across near/far slots and one
  projection is reused across poses; corpse head samples the living head artwork.
- User approved Human-only current 2D pilot. No five-base rollout or engine migration.
- Blender application is present locally; no existing .blend/.glb/.fbx character
  assets or runtime 3D dependency found in the repository. This does not establish
  a finished 3D production pipeline.
- Three pilot PNGs generated and inspected: 28 independently painted pose parts,
  injured/dead heads, a profile study and four painted wound caps. Runtime measured
  dimensions are 1254×1254 (poses) and 1536×1024 (damage), not prompt assumptions.
- Crops use measured opaque bounds plus transparent gutters; no PNG pixel edits.
  Assets/prompts/hashes are in `art/characters/atompunk/human-v3/manifest.json`.
- Per-part image override/loader and cached Human pose/expression selection added.
  Dead expressions cover intact falls and gib/cut; other bases retain prior art.
- Prone boots point backward and show distinct heel/sole surfaces. Artist support
  heights move the rendered ankle and shin endpoint together, without moving gameplay.
- Human crouch far thigh is visually foreshortened (6.5/13 segment projection), so
  the knee bends forward above support instead of choosing the old backward bend.
- Painted caps and blood emitter now share the surviving hip wound anchor. Waist
  caps use the actual Human art boundary near -5, not an arbitrary mid-torso point.
- Current corpse events do not retain a full authored pose/view: detached body
  pieces still use base articulated anatomy with dead face and wounds. This pilot
  does not claim full out-of-plane ragdoll view coverage or a completed 3D pipeline.

## Final Verification

- Full client suite: 2387 passed, four existing timer-cleanup failures in
  `timeoutFetch` (2), `tournamentFeed.fallback` (1), `useTakenCheck` (1).
  Server and backup worktrees excluded. No new Human test failed in this run.
- Production source TypeScript check passed. Production build passed (8.13s);
  the existing large-bundle warning remains. Whitespace check clean.
- Actual Human PNG matrix validates crouch/prone with normal/hurt/dead heads,
  eight weapons, three permitted aim angles and four crawl phases at the
  unchanged 0.06 rig-unit floor tolerance. UV gutters, near/far regions,
  backward-pointing prone boot and PNG header sizes are also checked.
- Review findings fixed: blood emission follows the visible hip wound, waist
  caps follow actual painted edges, and damaged heads retain custom colour.
- A cached GL/WGSL head filter tints skin while preserving red blood. GPU
  readbacks verified 0x112233, 0x3b82f6 and identity: WebGL blood
  [147,23,16,252] and WebGPU blood [149,23,16,252] remained unchanged; skin
  RGB changed as requested, alpha253 stayed unchanged and transparent pixels
  remained [0,0,0,0]. No device errors after the WGSL attribute-parser fix.
- Independent scoped re-review found no outstanding Important/Critical issues.
- Human-only viewer, crouch/prone, injured face, whole falls, gibs, waist cuts,
  one-leg survival, mirroring and local-match crouch/prone inspected. Fresh
  browser checks reported no page errors.
- Review board: `art/characters/atompunk/human-v3/review.png`; editable review:
  `review.html`. Interactive local view: `/character-rig.html?body=human`.
- All new/modified Human modules stay below 200 lines. No commit, push,
  publication or engine migration performed.
