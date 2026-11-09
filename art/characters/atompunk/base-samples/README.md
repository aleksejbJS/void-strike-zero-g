# Atompunk Character Base Samples

Status: approved appearance samples, version 1. These assembled PNGs are
also the unchanged source textures for the articulated game renderer.

Version 2 now uses newly painted complete body-part atlases for the body
and limbs; these originals still supply faces, Cat tail and loading fallback.
See `../articulated-v2/README.md` and its prompt/provenance manifest.

## Files

- `human-base-v1.png`
- `human-female-base-v1.png`: additional adult female human appearance.
- `robot-base-v1.png`
- `toxic-base-v1.png`
- `cat-base-v1.png`
- `reference-comparison-v1.png`: rendered comparison with the source board.
- `manifest.json`: built-in ImageGen prompts, references and file provenance.

Each character image is 1024×1536 RGBA with transparent pixels. The human
sample was also inspected on a light browser background to check its
silhouette and transparency. The comparison renders the original board
and sample files without modifying either image.

## Fidelity Review

The samples are generated reconstructions, not literal pixel extractions
or certified 100% copies. The following visible differences remain:

- Human: hair, stubble and muscular shading are more detailed.
- Robot: chest and limb proportions and corrosion details differ.
- Toxic: stronger musculature, more raised orange spots and larger claws.
- Cat: cheek/muzzle treatment, fur shading and stripe shapes differ.

The source board provides only one pose and does not supply hidden joint
surfaces or animation frames. Runtime articulation preserves visible
sample pixels; it does not claim an exact copy of unseen poses.

## Animation and Ragdoll Requirement

The female human sample matches the male sample's pose, scale, palette
and rendering style. It is a newly commissioned appearance rather than
an exact extraction of a female figure from the source board. The
original four-character comparison remains available as version 1.

The approved direction is illustrated body parts driven by the existing
rig and corpse system. Production art needs separate front/back upper
arms, forearms, hands, thighs, shins and feet, plus head and torso; the
cat also needs a separate tail. Joint overlaps and attachment pivots
must match the existing poses. Living fighters, ragdolls and detached
limbs use the same character art. The runtime now defines polygons,
pivots and bone axes in `src/game/render/characters/data/` and serves
byte-identical PNG copies from `public/assets/characters/atompunk/`.
Shared pose joints drive setup, living fighters and corpse pieces.

Open `/character-rig.html` on the local Vite server to inspect all five
appearances, motion, mirroring, falls, cuts and detached limbs. Source
polygons are renderer data, not repainted raster parts. Extreme bends
can reveal flat seam contours because hidden anatomy is not supplied.

See `docs/plans/2026-11-07-atompunk-character-bases-spec.md` for scope,
compatibility requirements and acceptance criteria.
