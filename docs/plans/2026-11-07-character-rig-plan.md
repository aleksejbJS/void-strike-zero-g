# Illustrated Character Rig Implementation Plan

Goal: animate the five approved appearance samples with the existing
fighter pose and corpse physics, using the same artwork for detached limbs.
Design: `2026-11-07-atompunk-character-bases-spec.md`.
Authorization: the user explicitly requested proceeding to the next stage.

## Architecture

Keep the approved PNG pixels. Define source polygons, pivots and bone
axes for separate textured meshes; share each source texture across its
parts. Map those meshes onto existing pose joints and corpse points.
An optional validated `body` field in FighterBuild identifies the artwork.
Legacy builds remain valid. Five visible presets represent Human,
Female Human, Robot, Toxic and Cat; legacy identifiers stay readable.

## Task 1 — Shared Contracts and Source Geometry

Files: `src/game/build/bodyTypes.ts`,
`src/game/render/characters/artTypes.ts`,
`src/game/render/characters/data/{human,female,robot,toxic,cat}.ts`,
`src/game/render/characters/definitions.ts`,
`public/assets/characters/atompunk/*.png`.

Define 15 body parts plus the cat tail. Each part has a source polygon,
pivot, optional bone endpoint, and colour channel. Copy the approved PNGs;
do not repaint the faces or overwrite the source samples. All coordinates
refer to the 1024×1536 source. Keep joint overlap for bending and complete
hands/feet for detached limbs. Test polygon bounds, nonzero bone lengths,
required parts and provenance hashes.

## Task 2 — Presets, Saved Builds and Setup

Files: `src/game/build/{buildParts,sanitizeBuild,buildPresets,buildStorage}.ts`,
`src/game/build/{characterBases,bodyTypes}.ts`, `src/constants.ts`,
`src/components/setup/builder/useFighterDraft.ts`,
`src/components/setup/CharacterSetup.tsx`,
`src/game/build/botLooks.ts`, relevant i18n/model/setup tests.

Add optional `body: BodyId`, validated against the five IDs. Add free
helmet/visor `none` choices so base faces can be seen. Provide five visible
presets with source-appropriate palettes and localized names. Keep legacy
skin IDs valid; preserve XP, valid selected gear and custom colours.
Body identity must survive save/load, account snapshots and network
sanitization. Compare body identity when detecting edited builds.
Verify invalid IDs, old saves, all presets, repeated selection and bots.

## Task 3 — Texture Loading and Mesh Placement

Files: `src/game/render/characters/{textures,triangulate,mesh,placement}.ts`,
`src/game/render/characters/{rigView,rigTargets}.ts`,
`src/game/systems/assets.ts`, geometry/placement/loader tests.

Load shared textures once; explicitly log failures and retain the existing
renderer as fallback for unavailable artwork. Triangulate source polygons
without changing UVs. Transform bone-aligned limbs between current joints;
head, fists, pelvis and boots retain their authored pivots. Reuse buffers
between frames. Test concave polygons, UV mapping, mirrored facing,
degenerate input, loader retry and part visibility for a one-legged fighter.

## Task 4 — Living Fighter Integration

Files: `src/game/render/fighter/fighterView.ts`, focused legacy helpers,
`src/game/render/characters/{fighterArt,rigView}.ts` and render tests.

Place textured parts around existing weapon, gear and muzzle-light layers.
Keep aiming, locomotion, breathing, recoil, landing squash and hit flash.
Hide generic body drawings only when the illustrated art is available;
keep helmets, jetpacks, badges and other selected equipment functional.
Apply meaningful colour changes while preserving source colours at each
preset's neutral palette. Avoid per-frame texture or geometry allocation.

## Task 5 — Corpse and Detached-Limb Integration

Files: `src/game/render/characters/{corpseArt,corpseTargets}.ts`,
`src/game/render/ragdoll/corpseView.ts`, relevant corpse tests.

Reuse the source meshes for intact falls and detached arms, legs and head.
Detached thighs must reconstruct their free hip end from the knee/ankle
axis, never stretch toward the original torso. Cut halves bind separately
to neck and hip frames. Keep one-leg wounds and absent limbs consistent;
preserve the existing dropped weapon and fade/cleanup behaviour.
Test each base, gib/cut/whole/only-leg cases and disposal of shared textures.

## Task 6 — Visual Motion Verification

Create a local rig inspection view at `/character-rig.html` backed
by the real pose and corpse physics. Inspect all five bases idle, running,
aiming, jumping/flying, crouching, prone and facing both directions. Inspect
whole-body falls, cuts and detached limbs, joint seams and foot placement.
Check actual setup, live menu preview and a local match on desktop/mobile.
Save review screenshots and document any material limitations honestly.

## Task 7 — Completion Gate

Run focused build/renderer/corpse/setup/network tests, production source
type checking, production build and whitespace checks. Request independent
review of the final change and fix confirmed important findings. Keep
changed source files under 200 lines. Preserve unrelated work and package
changes; do not commit, push, publish or alter gameplay statistics.

## Execution Ledger

- Source meshes and five exact source-texture copies implemented; polygon,
  triangulation, UV, bounds and provenance checks pass.
- Five presets, save migration, setup tiles, account merge compatibility,
  bot selection and preview bots implemented. Explicitly saved blue skin
  colours remain custom; only absent legacy head colours use migration fallback.
- Living mesh rendering, shared loading and corpse/detached-piece rendering
  implemented. Existing weapon and foot targets remain unchanged.
- Source-specific shoulder, head and hip attachments share the live pose
  and initial corpse joints. Reach adaptation preserves exact hand/foot targets.
- Desktop and 844×390 / 390×844 setup inspected; all five choices cycle,
  no horizontal overflow, landscape Start remains visible. Female base and
  jetpack verified in a real offline match without browser errors.
- Local inspection workbench uses real fighter rendering and corpse solver;
  motion screenshots are recorded under `.playwright-mcp/character-rig-*`.
- Final review found cross-half thigh-frame coupling and omitted selected
  corpse decorations; both are fixed with regression coverage. Body-aware
  rest angles, selected jetpacks, pattern thumbnails and partial mesh
  creation cleanup are also corrected. Final review found no outstanding
  Critical/Important issues in these changes.
- Visual crouch review found the rear knee bending below planted feet;
  all five regression cases failed before the IK preference fix and pass
  after it. Weapon grips and foot targets still match their prior endpoints.
- Ruling: work in the current checkout to preserve the user's existing
  uncommitted menu and asset work; no branch operations or commits.
- Ruling: source polygon meshes are renderer data, not a new raster edit;
  they preserve approved sample pixels while enabling articulated pieces.

## Final Verification

- Renderer/fighter/corpse/physics: 35 files, 351 tests passed. The final
  jetpack-specific extension subsequently passed all 80 relevant tests.
- Build, network, setup, account migration, preview and final corpse art:
  46 files, 370 tests passed; known unrelated `useTakenCheck` timer test
  excluded from this scoped run.
- Production source type check: exit 0. `npm run build`: passed (6.41s).
  Existing large-bundle warning remains. `git diff --check`: clean.
- Broader run captured four existing timer cleanup failures in
  `timeoutFetch`, `tournamentFeed.fallback` and `useTakenCheck`; six server
  integration cases could not listen on sockets under the sandbox (EPERM).
  It also captured seven new red regression tests while corpse fixes were
  being implemented; those are green in the final scoped runs above.
- Browser: all five preset labels/selection, desktop and phone setup,
  female local match and real jetpack flight, new preview bots, source
  assembly and motion, crouch/prone, cuts/gibs/torn leg and mirrored poses
  inspected. Fresh final workbench reload reported no page errors.
- Review images: `.playwright-mcp/character-rig-five-final.png`,
  `character-rig-{crouch,cut,gib,limb,fall-body}-verified.png`,
  `character-rig-cut-mirrored-final.png`, `character-match-live-final.png`,
  `character-match-flight-final.png`, `character-setup-phone-*.png`.
- Remaining visual limits: a single source pose supplies no hidden joint
  surfaces. Extreme bends can reveal flat seam contours; Cat retains a
  taller visible silhouette. Original sample/reference differences remain
  documented. No claim of pixel-identical reconstructed artwork is made.
- New and extracted modules stay below 200 lines. Pre-existing oversized
  `GameCanvas.tsx` received only the required bot-look compatibility edit.
  All work remains local; no commit, push or publication performed.
