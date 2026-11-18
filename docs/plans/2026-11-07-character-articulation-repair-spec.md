# Character Articulation Repair

Date: 2026-11-07
Authorization: user explicitly requested redrawing hidden joint surfaces and fixing the poor prone/other poses.

## Observed Defects

The original assembled-pose cutouts contain neighbouring clothing/limb pixels.
Hard polygon ends remain exposed when rotated. Prone elbows are solved below
the planted hands/floor. These are visible defects, not acceptable production art.

## Design

Create a separate transparent eight-part atlas for each of the five appearances:
torso, pelvis, upper arm, forearm, hand, thigh, shin and foot. Draw complete rounded
joint ends and clean hidden surfaces. Reuse the original head and Cat tail to
preserve identity. Near/far limbs can share a complete part with appropriate layering.
Keep the original samples and runtime fallback intact; new art is versioned.

Alternatives: adjusting only old clipping polygons is smaller but cannot supply
missing joint surfaces. Full per-pose animation sheets can improve individual poses
but multiply equipment and ragdoll work. Complete illustrated parts on the existing
rig address the actual defects while retaining aiming and detached limbs.

Use the built-in imagegen tool for raster work; record prompts and provenance.
Allow a part to choose its atlas and authored pixel scale. Keep source rig anchors
independent from atlas UV coordinates. Make grounded/prone arm IK choose elbows
above support, retain weapon grips and gameplay collision/statistics.

## Verification

Inspect idle, run, jump, crouch, prone and ragdoll for all five bases and both facings.
No stray pixels from adjacent parts, hard rectangular ends, floor-piercing elbows
or stretched body fragments. Detached arms/legs retain complete art. Check equipment,
source texture loading/fallback and cleanup. Add regression checks for the pose and
atlas mapping, then run affected render/physics tests, source typecheck and build.
Save before/after motion screenshots. Do not claim visual completion until checked.

## Execution

1. Record prone defect screenshot and root cause (done).
2. Generate and inspect complete part atlases, beginning with Human.
3. Add atlas-aware mesh source contracts/loading and map inspected parts.
4. Correct support-aware arm poses without moving weapon grips.
5. Verify all bases and update the rig workbench and documentation.

No commit, push, publication, or unrelated UI changes requested.

## Execution Ledger

- All five transparent 1536×1024 eight-part atlases generated with built-in
  imagegen and stored in `public/assets/characters/atompunk/articulated-v2/`.
  Prompts/source paths/hashes: `art/characters/atompunk/articulated-v2/manifest.json`.
- Atlas-aware UV/texture/pixel-scale mapping implemented with source fallback;
  original anatomy anchors, heads and Cat tail remain unchanged.
- Prone recipe now raises the torso six units and extends feet six units
  backward; weapon assembly raises minimally when a grip would bury a fist.
  Existing aim directions and gameplay statistics/collision boxes are retained.
- Grounded elbows/knees account for painted joint radius. Foot soles remain
  flat on support; free corpse feet retain their physical orientation.
- Painted-edge regression reads original RGBA alpha in memory, computes
  opaque convex hulls and transforms actual painted edges. All five bases,
  eight weapons, three valid prone aim angles and four crawl phases (480
  poses) pass; idle/crouch/prone soles and loose corpse foot checks pass.
- Visual recheck found a distinct corpse-physics defect: point-only contact
  stops head/limb centres at the floor, burying their painted volume. Body-aware
  ragdoll contact thickness now keeps heads and joints above support; legacy
  no-body contacts stay unchanged. Initially embedded bodies escape gently.
- Top-contact flags plant resting corpse boots and fold Cat tail above support;
  airborne feet retain free rotation. The view cache redraws contact-only changes.
- Local inspection zoom adjusted so extended prone legs remain fully visible.

## Final Verification

- Five atlases inspected; Human alpha also checked against a white background.
  Original head/tail PNGs are unchanged; each new asset is a byte-identical copy
  of the recorded built-in ImageGen output, not a script-edited image.
- Final character/ragdoll/physics run: 27 files, 276 tests passed. Tests cover
  opaque silhouettes, mixed atlas/source UVs, fallback/retry, resting/thin-floor
  collision, gentle embedding escape, contact flags and redraw invalidation.
- Full client suite: 2318 passed, 4 existing timer-cleanup failures in
  `timeoutFetch` (2), `tournamentFeed.fallback` (1) and `useTakenCheck` (1).
  This run preceded the final contact-flag/boot/tail extension; the final scoped
  suite above covers that extension. Server and backup worktrees excluded.
- Production source TypeScript check: exit 0. Production build passed; existing
  large-bundle warning remains. Whitespace check clean. New/extracted modules
  and modified character/physics source files stay below 200 lines.
- Independent final review found no outstanding Critical/Important issues.
  An additional 2400 intermediate prone samples checked by visible-pixel hulls
  stayed within the same support tolerance, without weakening assertions.
- Browser inspected all five bases idle/run/jump/flight/crouch/prone, intact
  falls, gibs, waist cuts and torn legs; mirrored prone/crouch/fall checked.
  Female prone/jetpack also exercised in a real local match. No fresh page errors.
- Final images: `.playwright-mcp/character-*-v2-final.png`,
  `character-*-v2-surface-final.png`, `character-*-v2-mirrored-final.png` and
  `character-match-prone-v2.png`. Same-scale comparison and its editable HTML:
  `art/characters/atompunk/articulated-v2/prone-before-after.png` and
  `pose-comparison.html`.
- No commit, push, publication, hitbox/stat changes or unrelated UI edits.
