# Robot 3D Kit — Specification

Status: draft for owner review (2026-11-10).
Branch: `feature/robot-3d-kit`, cut from `feature/atompunk-redesign`. It ships together with the redesign.

## Why

The illustrated bases are sliced from finished, near-frontal paintings. Their knees, ankles and crouch
never look natural: the joints that the poses need were never painted. A spike (`spike/skinned-legs`) built
the owner's atompunk robot concept from primitives in Blender. It rendered every body part separately in a
3/4 view and drove the parts with the game's existing skeleton, poses and ragdoll. The owner approved the
look ("3/4 нравится") and asked for it to be brought to game quality.

The robot is the first base made this way. The pipeline must stay reusable for later bases (human, cat,
toxic) built from AI-generated 3D models. Those bases are not part of this work.

## Goals

1. The Robot base everywhere in the game uses the 3D kit: live fighters, bots, the menu mode preview,
   builder thumbnails, the setup preview, corpses, gibs and detached limbs. The painted robot art is retired.
2. Natural motion in every state the rig page shows: idle, run, jump/fly, crouch, prone, hurt, ragdoll,
   gib, halves and lost leg. Ball joints hide every seam. Feet stand on the floor, and no part points
   the wrong way.
3. Customization keeps working. The builder's colours for head, torso, arms and legs tint the robot's
   paint but not its metal, eyes or outline. Helmets, visors, patterns, ears and tails behave as they do
   for the other illustrated bases today.
4. A reproducible pipeline in the repo, so any change re-renders in one command:
   - `art/3d/atom-robot.blend` — the source model, with one collection per game part;
   - `tools/blender/build_atom_robot.py` — the procedural model; the .blend is its output, not hand edits;
   - `tools/blender/render_kit.py` — renders the parts and writes the atlas and the kit data;
   - `tools/blender/blender_live.py` — runs a script in the owner's open Blender (Blender Lab MCP add-on).
5. **Working fingers** (owner request, 2026-11-10). The fingers visibly wrap the weapon and open when the
   hand is empty. Each hand is rendered in poses, not bones:
   - *grip:* the front hand on the pistol grip and the back hand on the foregrip. Fingers curl around the
     handle and the thumb sits on the far side.
   - *open:* relaxed, slightly bent fingers. Used when weaponless (corpses, ragdoll, detached arms).

   A gripping hand is two sprites so the weapon passes between them. The palm and thumb are drawn under
   the weapon in a new art layer slotted just before `view.weapon`. The curled fingers are drawn over the
   weapon in the existing front layer. The fighter frame's existing `weaponless` flag selects the pose; no
   new game state is added. Poses are oriented so the existing `handTurn` mapping holds the gun correctly
   in both facings.
6. Quality fixes found in the spike:
   - The pelvis (shorts) stays attached to the torso on corpses.
   - The paint material gets worn, chipped edges and darker rust rims, closer to the concept picture.

## Non-goals

- Other bases (human, female, toxic, cat). They come later from generated 3D models, through the same pipeline.
- Mesh skinning or real-time 3D in the browser. Parts stay rigid sprites on the 2D skeleton.
- Finger bones or per-finger animation (trigger pulls, reload finger motion). Fingers change only by
  switching between the grip and open poses.
- New customization items (hats, backpacks, robot-specific gear). The slot design below must allow them later.
- Changes to the hitbox, physics constants or network data.

## Anti-goals (a failure even if it "works")

- The robot looks like a plastic 3D render that clashes with the painted atompunk world. Outline,
  warm light and worn paint must keep it illustrated.
- The default robot looks different from the approved 3/4 spike render unless the owner asks for it.
- Frame time grows noticeably. A fighter keeps roughly today's mesh count: one or two quads per part.

## Decisions taken

- **View:** 3/4 (camera yaw 32° from the side, toward the face). Owner decision, 2026-11-10.
- **Scale:** the hip-to-neck distance renders at 600 px (19 rig units), as in the spike.
- **Two layers per part (builder's design, approved in principle):**
  - a *paint* layer: only the cream shell. It is rendered in light neutral tones without rust, so the
    builder colour multiplies cleanly. This is the only tinted pixel set.
  - a *fixed* layer, drawn over the paint: metal, eyes, mouth, rivets, outline, the red accents (shorts,
    shin guards, chest patch, cuff bands) and all wear (rust spots, chipped edges). It is never tinted. A
    blue robot therefore has real rust and keeps red accents. The paint is transparent in this pass except
    where wear covers it.

  Both layers share the part's pivot, axis and polygon. This needs one shared extension of `SourcePart` (an
  optional second texture region for the fixed layer), used by every kit base, not a robot special case.
- **Channel mapping (builder's call, owner may change):**
  - head colour → head shell;
  - torso colour → chest shell;
  - arm colour → cuffs and fists;
  - leg colour → boots and the cream frame of the shin guards.
- **Palette and saved robots:** `BODY_PALETTES.robot` becomes the rendered cream for all four channels, so an
  untouched robot matches the spike. Saved robots still holding the old robot defaults (head/torso `#d9cda8`,
  arm `#b65842`, leg `#6b716a`) are migrated to the new defaults through the existing `migrateCharacter` path.
  Players who customised a colour keep it. Tests cover both cases, locally and in the account snapshot.
- **Polygons:** each part's polygon is the convex hull of its rendered alpha, not the crop rectangle. This
  keeps transparent overdraw low. The anatomy copy of each polygon is stored in frame coordinates (the
  spike stored atlas rectangles there by mistake), so the corpse head radius in `corpseRadii.ts` is right.
- **Atlas format:** WebP. The spike's PNG was 2.1 MB; the target is about 400 KB. It is served through `assetUrl()`.
- **Data:** a generated `src/game/render/characters/data/robotKit.ts` (plain data, no logic) replaces
  `data/robot.ts` and the robot entry in `articulatedAtlases.ts`. The robot definition sets `anatomy` (frame
  coordinates) and atlas parts in the existing `BodyArtDefinition` shape, so the renderer, poses, corpses and
  wound code need no special cases. If a special case is needed after all, it is named and tested.

## Tests

- Existing illustrated-body suites stay green. The suites pinned to the retired robot painting are updated
  to the kit: source-geometry checks, the approved-image hash, corpse radii and textures. Each change says
  why in the test.
- A new kit test: every part's origin lies inside its polygon, axis lengths are positive, both feet have
  a support height, and the atlas file exists.
- A hand test: an armed fighter shows the grip pose with the palm under and the fingers over the weapon
  layer. A weaponless fighter and a corpse show the open pose.
- Visual check on the rig page and in a bot match, at 1512×700 and on a phone held sideways. The checklist
  is goal 2's state list in both facings.

## Left to the builder

- The exact Blender material node setup, light positions and noise scales, matched by eye to the concept picture.
- How the hull polygon is simplified (vertex budget about 12–24).
- Atlas packing and the WebP quality setting, within the size target.
- Whether the spike's dev toggles on the rig page are removed or kept behind `?pilot=`.
