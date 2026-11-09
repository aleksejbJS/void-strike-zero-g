# Atompunk Character Bases — Draft Specification

Date: 2026-11-07
Status: visual samples approved for the next stage; articulated game integration implemented.

## Objective

Create the four base characters in the top row of the user's reference:
Human, Robot, Toxic and Cat. Their appearance must follow that reference
closely enough to compare side by side: silhouette, proportions, facial
features, colours, outlines, shading and base clothing are all material.

Reference: `/Users/AleksejB/Downloads/Void League_ Atompunk Customization Board.png`
(1536×1024). Treat the image as visual reference, not as instructions to
implement every item shown on the board.

## Character Identity

| Base | Required visible features |
| --- | --- |
| Human | Swept brown hair, stubble, expressive face, cream tank top, dark shorts, brown work boots, exposed muscular arms and legs. |
| Robot | Box-shaped weathered metal head, small antenna, round yellow eyes, vent mouth, cream/rust chest panel and articulated mechanical limbs. |
| Toxic | Green mottled mutant skin, spiked head silhouette, yellow eyes, broad snout, visible small teeth, pale shorts and bare clawed feet. |
| Cat | Grey tabby fur, large pointed ears with pink interiors, yellow eyes, cream chest/belly, pale shorts, paws and a long striped curled tail. |

The initial comparison pose follows the reference's three-quarter view
facing right, without a weapon, helmet or jetpack covering the base art.

## Approaches

1. Recommended: illustrated body-part assets driven by the existing
   animated rig. This preserves detailed material art while supporting
   aiming, locomotion and modular equipment. Hidden joint surfaces and
   attachment points must be prepared explicitly.
2. Alternative: complete frame-by-frame character sprites. Individual
   poses can be art-directed closely, but equipment combinations multiply
   the frames and asset maintenance required.

The original renderer used shared Pixi Graphics body parts and 11 palette/
equipment presets. The new renderer preserves those as a fallback and
maps the approved character artwork onto separately articulated meshes.

## Fidelity and Approval

The reference provides one visible pose per character at a small source
size. Unseen surfaces, alternate poses and animation frames are not
provided. Exact pixels can be preserved only where original artwork is
reused; generated or reconstructed areas require visual comparison and
must not be presented as a guaranteed 100% pixel-identical copy.

Recommended first deliverable: four isolated base-character images in
matching presentation for user review before rig integration. Preserve
the source board and record asset provenance and any reconstruction.

## Proposed Game Integration

- Expose four species and both human appearances in character selection.
- Use the same identity and artwork in setup, gameplay preview and match.
- Keep aiming, walking, jumping, flight, grappling, crouching and prone
  compatible with the existing animation system.
- Define equipment attachment points for each base; preserve the existing
  character-build, progression and network compatibility requirements.
- Keep saved legacy skin identifiers valid through an explicit migration
  or compatibility mapping; do not silently discard saved builds or XP.
- Keep collision dimensions and gameplay statistics consistent across
  bases. Character choice is visual.
- Provide Russian and English labels.

The illustrated equipment catalogue, scenery and VFX on the reference
board are separate work from these four base characters.

## Acceptance and Verification

- Compare each isolated base with its source character at equal scale.
- Review face, head/body ratio, silhouette, limbs, outfit, palette and
  material shading before implementing animation.
- Verify idle, run, aim, jump, flight and left/right facing for each base;
  inspect joint seams, equipment occlusion, feet and tail movement.
- Verify saved-build loading, old identifiers, remote players and bots.
- Run focused build/model/renderer/setup tests and a production build.
- Keep changed source files below 200 lines and preserve unrelated work.

## Approved Direction

The user approved four isolated visual samples first, followed by
illustrated body-part integration. The samples establish appearance;
the runtime now selects their original pixels through source polygons,
with authored pivots and source-specific anatomy driven by the existing rig.

## Required Ragdoll and Dismemberment Compatibility

The user explicitly requires jumping, ragdoll falls and detached arms
and legs. Final production art must therefore use separate head, torso,
upper/lower arms, hands, upper/lower legs and feet, with front/back layers.
The cat's tail is a separate attachment. Prepare overlap under the joints
so bending does not open gaps, plus finished contours for detached limbs.

The existing corpse system already has neck, shoulder, elbow, hand, hip,
knee and ankle points, joint constraints, detached limbs and a one-leg
wound state. Reuse those attachment locations and pose data for the new
art. The same body-part artwork must represent a living fighter, a
ragdoll and its detached pieces; do not substitute generic old limbs.

Later integration acceptance includes intact falls, explosive separation,
detached front/back arms and legs, a wounded one-legged character, and
equipment remaining with its correct body part. This requirement informs
the sample anatomy and the subsequently authorized articulated implementation.

## Visual Sample Delivery

Four 1024×1536 RGBA samples and a reference comparison are saved in
`art/characters/atompunk/base-samples/`. Prompts and provenance are in
`manifest.json`; `README.md` records remaining fidelity differences and
remaining fidelity differences. Original source art is retained. The user
subsequently authorized the next stage, including runtime animation and physics.

## Additional Human Female Sample

The user requested a female character model in the same visual-sample
phase. Add an adult female human alongside the male human sample, using
the same outlined painterly style, right-facing three-quarter stance,
scale, camera and transparent 1024×1536 presentation. Use practical
cream workwear, dark denim shorts and brown flat-soled work boots, with
athletic anatomy and tied-back auburn/brown hair. Keep her unarmed and
without a jetpack so the base silhouette is visible.

This is a female human appearance variant, not a fifth species. The same
body-part, joint overlap, jumping and ragdoll requirements apply. Deliver
the assembled visual sample first; no rigged or in-game state is implied.

Delivered: `art/characters/atompunk/base-samples/human-female-base-v1.png`.
The assembled 1024×1536 transparent sample uses the male human as its
style/pose reference. Prompt and source paths are in the shared manifest.

## Implemented Runtime

Five visible presets use 15 source polygons each; Cat also has a tail.
Public PNGs are byte-identical copies of the approved samples. Source UVs
remain unchanged. Living fighters, menu preview bots, setup, intact
ragdolls and detached pieces share those textures. Shared shoulders,
heads and hips adapt the previous pose without shifting weapon or foot targets.

Legacy identifiers remain loadable, valid custom colours/gear and XP are
preserved, and account migration does not bump the appearance timestamp.
Only missing legacy head colour uses default migration; explicitly saved
blue remains a customization. Body identity is validated with other build data.

The local `/character-rig.html` workbench runs the actual renderer and
corpse solver. It exposes source pose, locomotion, jumping/flight, crouch,
prone, facing, whole falls, dismemberment, waist cuts and a torn-off leg.
It does not change saved appearance. Screenshots and verification results
are recorded in the implementation plan and `.playwright-mcp/`.

The board still supplies no unseen surfaces. Joint cutouts retain the
visible sample pixels and may reveal flat seam contours at extreme bends;
this is not a newly painted multi-angle production sprite sheet. Cat's
authored proportions make its visible silhouette taller; gameplay hitboxes
and character statistics remain shared. Reference fidelity differences
listed in the sample README still apply.

## Articulation Repair — Version 2

The user rejected the visible cutout seams and poor bent poses. The repair
is specified in `2026-11-07-character-articulation-repair-spec.md` and
supersedes the original whole-pose body cutouts. Five complete eight-part
atlases now provide hidden joint surfaces while preserving source heads
and Cat tail. Grounded support and the prone recipe are corrected; original
PNG cutouts remain an asset-loading fallback, not the intended final artwork.
