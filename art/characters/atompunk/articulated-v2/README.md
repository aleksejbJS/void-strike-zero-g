# Articulated Character Parts — Version 2

The user rejected the assembled-pose cutouts in prone and other bent poses.
These five new transparent 1536×1024 atlases supply eight complete painted
parts each: torso, pelvis, upper arm, forearm, hand, thigh, shin and foot.
Near/far limbs share the corresponding complete part. Rounded hidden
joint surfaces replace cut polygons containing neighbouring clothes.

The runtime assets are in `public/assets/characters/atompunk/articulated-v2/`.
The original samples, faces and Cat tail are preserved. Generated prompts,
references and source paths are recorded in `manifest.json`; the built-in
`image_gen.imagegen` tool produced all five atlases. No raster pixels were
rewritten by scripts. Mesh UVs isolate each transparent cell and authored
pivots/pixel scales map each part onto the existing animation/physics rig.

`src/game/render/characters/data/articulatedAtlases.ts` defines the source
regions and pivots. `runtimeDefinitions.ts` keeps atlas pixel coordinates
separate from original anatomical anchors. Source textures and atlases
are shared and loaded independently; an unavailable atlas retains the
source-rendering fallback and can retry without destroying shared assets.

The repair also corrects grounded arm support and the prone pose itself.
Floor checks must cover painted silhouettes, not only skeleton joints.
The local `/character-rig.html` view uses the real fighter/corpse renderer.
