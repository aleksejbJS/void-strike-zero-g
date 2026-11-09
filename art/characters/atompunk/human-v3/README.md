# Human Pose Views and Damage — Pilot V3

This Human-only pilot addresses the projection limits of a single upright part set.
It is not an all-base rollout and does not claim continuous 3D view coverage.

Runtime pictures, copied unchanged from built-in ImageGen output:
- `public/assets/characters/atompunk/human-v3/crouch.png` — 14 independent near/far parts.
- `public/assets/characters/atompunk/human-v3/prone.png` — 14 parts, backward-pointing boots with heel/sole views.
- `public/assets/characters/atompunk/human-v3/damage.png` — injured/dead heads and blood end caps.

`manifest.json` records exact prompts, references, generated source paths, sizes and hashes.
The additional profile head and splatter study are retained in the atlas; the runtime
currently selects the injured/dead three-quarter heads and four wound surfaces.

Source metadata under `src/game/render/characters/data/human*.ts` uses measured UV
bounds, transparent gutters, bone pivots and artist support heights. Near/far pieces
are not the same source region. Original PNG pixels have not been rewritten.

`review.html` / `review.png` present the pilot. The local `/character-rig.html?body=human`
viewer opens prone and exposes crouch, pain, falling, gibs, cuts and a wounded survivor.

Heads preserve custom colour through a cached blood-preserving GL/WGSL filter; blood
caps remain untinted. Surviving wound emitters use the painted socket anchor, and waist
caps match measured torso/pelvis edges. Existing corpse events still lack a full posed
view snapshot, so torn body pieces use base anatomy with dead head/blood surfaces.
A future 3D source rig is discussed in the linked specification rather than implemented.

Specification: `docs/plans/2026-11-08-human-pose-views-and-damage-spec.md`.
