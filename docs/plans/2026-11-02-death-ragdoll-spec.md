# Death Ragdolls — How a Fighter Dies Depends on What Killed Them

Status: implemented 2026-11-03 (0.4.12); draft 2026-11-02, written from the brainstorm with the user, builder-checked

Mockup (open in a browser, it plays itself): `docs/plans/2026-11-02-death-ragdoll-mockup.html`.
The user said of it: «да, выглядит уже круче».

## Intent

Today every death, from any weapon, cuts the fighter into 6 unconnected pieces that fly in
random directions and vanish after ~2 s (`createRagdoll` in `systems/effectSpawn.ts`, drawn by
`render/ragdollView.ts`). The user wants deaths that read like the reference game, Soldat 2
(their YouTube clip, frame-checked): a killed fighter goes limp and **falls or is thrown like a
real body**, and only big hits tear it apart. In the user's words: «там короче класный регдолл,
что он отлетает как настоящий человек».

What makes it special: a jointed ragdoll (points linked at the joints, as in Soldat) instead of
loose parts, and the death depends on the weapon.

## Behaviour (what the player sees)

| Killing blow | Death | Decided by |
|---|---|---|
| Machine gun | Always falls as one limp body (knees buckle, falls back from the shots) | user |
| Shotgun, point blank | Body thrown back a couple of metres, tumbles, lands | my call |
| Shotgun, far | Falls, like the machine gun | my call |
| Rocket, the blast only just finished the victim | Whole body thrown and tumbling, limbs flailing | user |
| Rocket, a direct hit **or** the blast was far stronger than the health left ("overkill") | Torn apart: head, torso, arms, legs, with blood | user (chose "overkill", option B; «особенно когда у него мало хп»); threshold my call (below) |
| Grenade | Same as rocket | my call |
| Railgun | Cut in two along the beam: upper half flies along the shot, legs collapse | user («разрывает или разрезает»; cut chosen from the mockup) |
| Chainsaw | Torn apart | my call |
| Plasma | Falls | my call |
| Fall out of the map / Hunger Games zone / any death without a weapon | Falls, like the machine gun | my call (the old 6-loose-pieces death is removed everywhere) |

Common to all:

- The body is drawn **like the living fighter**: same build (helmet, visor, ears, tail, jetpack,
  pattern, badge) and colours, not stick figures (the mockup's sticks are placeholders).
- Joint limits: knees and elbows do not fold flat, legs do not fold into the belly.
- The weapon drops out of the hands and falls as a cosmetic object (cannot be picked up).
- Bodies collide with the real platforms: they land, slide, can slip off an edge.
- A body lies ~3.5 s, then fades over ~1 s (gib pieces: ~3 s). My call.
- **Lying bodies react to later explosions** and are thrown again, as in Soldat (user).
- Blood: a spray in the direction of the hit when killed; torn joints show red ends. Existing
  blood decal on death stays.

Rocket/grenade rule — "overkill" (decided by the user after the builder check):

- Why not "little health": a blast deals at most 65 (rocket) / 60 (grenade) of 100 health, so a blast
  can only kill a fighter who is already low; a "low health → gib" rule would gib almost every
  explosive kill and the user's "thrown" row would never show.
- **Overkill** = the killing hit's damage after armor − the health the victim had right before it.
- Gib when the rocket hit the victim directly (projectile hit), or overkill ≥ **30** (my call, tune
  in play). Otherwise the body is thrown whole.
- Examples: 5 HP left, near blast of 60 → overkill 55 → torn apart. 55 HP left, edge of a blast
  deals 56 → overkill 1 → thrown. 30 HP left, 50 damage → 20 → thrown. 20 HP left, 55 → 35 → torn.

Other thresholds (my calls, tune while building):

- Shotgun "point blank": shooter within ~120 world units.

## Goals

1. Deaths look and move like the mockup, with the real fighter art.
2. The kind of death follows the table above.
3. Identical rules offline and online; cheap on the network.
4. No measurable frame-time cost in a busy match (8 players, explosions).

## Non-goals

- Weapons/medkits dropped on death that can be picked up (the falling weapon is cosmetic only).
- Blood or scorch decals on walls; headshot-specific deaths; killcam.
- Any gameplay change: damage, knockback of living fighters, respawn, scoring stay as they are.
- Server-side ragdoll simulation.

## Anti-goals (a failure even if it "works")

- Bodies that fold into impossible shapes, jitter on the floor, or sink into platforms.
- Every death looking the same again (e.g. everything gibs because thresholds are too loose).
- Corpses that block shots, movement or pickups (they are cosmetic only).
- A visible frame drop when several fighters die at once.

## Constraints

- Cosmetics never live in the simulation: the sim only emits events (`systems/effects.ts`,
  `systems/events.ts`), the display turns them into visuals with `applyEffectEvent`. The server
  never simulates ragdolls; each client simulates its own copy from the `DEATH` event, so bodies
  may land slightly differently per client (acceptable).
- Coordinates: entity `pos` = (centre x, feet y); platforms are top-left rects (`MEMORY`: coordinate system).
- Physics runs at a fixed 120 ticks/s (`systems/fixedStep.ts`); ragdoll stepping must use the same
  tick so it looks the same at any refresh rate.
- Cap: about 12 bodies at once; when exceeded, the oldest fade early.
- Files ≤ 200 lines, one responsibility each (user's global rule).
- Builds coming from the network are sanitized before drawing (`sanitizeBuild`), as today.

## What the builder needs to change (decided)

- **Cause of death in the event.** `applyDamage` (`systems/combat.ts`) does not know the weapon
  today. Its callers do: projectile hit (`physics.ts`, `proj.type`), `createExplosion` (weapon type
  + blast centre), railgun ray (`combat.ts`), chainsaw (`combat.ts`), falling/zone damage
  (`physics.ts`, no weapon). Pass a cause through to the `DEATH` event: weapon (or none), whether it
  was a direct projectile hit, the hit direction / blast centre, and the overkill (damage after
  armor − health before the hit). A direct rocket hit kills in the projectile `applyDamage` before
  its own blast runs, so "direct hit" must be known there. The death *kind*
  (fall / thrown / gib / cut) is decided in the simulation from the table above and sent in the
  event, so all clients agree on the kind; the exact motion is local.
- **New ragdoll model**: jointed points + distance links + "keep-apart" joint limits (verlet, as in
  the mockup's `stepBodies`), replacing the 6 loose `RagdollPart`s for fall/thrown deaths; gibs
  break the joint links; the rail cut removes the waist links.
- **Explosions push lying bodies**: `EFFECT explosion` (already carries position and `size`) applies
  an impulse to nearby ragdoll points on the display side.

## Left to the builder

- How the ragdoll is drawn with the real art. Suggested: build a `FighterPose` from the ragdoll
  points each frame (hip, lean from the spine, limb joints/ends, shoulders, head, head tilt) and
  reuse `drawFighter`; gib pieces and the two rail halves can reuse the existing part shapes in
  `ragdollView.ts`.
- Exact impulses, damping, friction, point layout, joint-limit factors (start from the mockup).
- How gib pieces are modelled (the old random 6-part death itself is removed; its part shapes in
  `ragdollView.ts` may be reused for gib pieces and rail halves).
- Tests: kind-of-death rules per cause (pure function, including the overkill examples above), joint limits hold, bodies rest on a
  platform, explosion pushes a resting body, cap of 12, event carries the cause; plus a visual
  check in the real game at 1512 × 700.

## Release

One feature branch and PR, one version (next 0.4.x), patch note with a before/after pair, per
the release process.
