# Robot Damage (Wires, Sparks, Oil) — Specification and Build Order

Status: owner chose option C on 2026-11-10 ("смешать"): a torn metal flange rendered in Blender, plus live
procedural cables, and sparks and oil instead of blood. This work is on branch `feature/robot-3d-kit`, on top of
the robot 3D kit (`2026-11-10-robot-3d-kit-spec.md`).

## Why

When the 3D-kit robot loses a leg or is blown apart, it shows the human blood stump and red droplets. A robot
should show torn sockets with cables sticking out, spark, and leak dark oil.

## Goals

1. **Torn sockets.** Wherever the robot is torn, a torn metal flange sits on the joint and a bundle of cables
   sticks out of it. This happens on the body and on the torn-off piece:
   - a live robot that has lost a leg: the back hip;
   - a detached leg (LIMB): its hip end;
   - a gib: the neck (body and head), both shoulders (body and arms) and both hips (body and legs);
   - a cut: the waist, on both halves.
2. **Cables.**
   - 5 per socket: red, yellow, blue, black and green insulation, with bare copper tips.
   - Each cable is a curve 4–9 rig units long, pointing out of the socket along the missing limb.
   - They sway with time and with the fighter's or piece's motion, and have a soft ink outline.
3. **Sparks.**
   - A live one-legged robot sparks from a random cable tip every 0.6–1.2 s.
   - Fresh torn sockets on corpses spark for their first 2 s.
4. **Oil instead of blood**, for robot victims only:
   - a bullet hit throws sparks plus a few dark oil drops instead of red blood;
   - a death throws oil drops and leaves a dark oil puddle decal instead of red;
   - a torn leg throws oil and a spark burst;
   - the one-legged stump drips oil.

## Non-goals

- Dents or scorch decals on intact parts. Damage on other bodies. Sounds.
- New network event types or fields. The simulation keeps sending `EFFECT`/`DEATH`/`LIMB`. Robot hits use
  the existing `spark` and `blood` effects with an oil colour, and the client picks robot looks from
  `parts.build.body`, which those events already carry.

## Decisions

- **One flange picture** is rendered by `tools/blender` into the robot kit atlas as kit extra `woundFlange`
  (fixed layer only, never tinted). It is scaled per socket: neck 1.0, shoulder 0.8, hip 0.9, waist 1.3.
- **Draw order at a socket:** the part, then the cables, then the flange on top. The flange ring hides the
  cable roots.
- **Oil colour** `#1d1712`; oil puddle decal `0x16110c` at alpha 0.85.
- **Spark colour** `#ffd36b`, using the existing `spark` particle.
- **Cables are drawn with Pixi `Graphics`** (cheap; about 5 strokes per socket), redrawn only while visible.
- **Wire geometry** (pure function, tested):
  `cableCurves(socket, seed, time, motion) → { from, ctrl, to, color }[]`. A socket is
  `{ at, dir, radius }` in rig units. The seed is stable per fighter or corpse, so the bundle keeps its look
  between frames.

## Build order (each step test-first)

1. **Simulation and effects: oil and sparks for robot victims.**
   - `combat.ts`: a hit on a player whose `build.body === 'robot'` emits `spark` (count 6, colour
     `#ffd36b`) plus `blood` (count 3, colour `#1d1712`).
   - `effects.ts`: DEATH and LIMB with a robot `parts.build.body` throw oil and sparks, and lay the oil decal.
   - `fighterBleed.ts`: robots drip oil.
   - Tests: an effect-event test per path, and a non-robot regression check that blood stays red.
2. **Flange in the kit.** Render `woundFlange` in `render_kit.py` and expose it as `ROBOT_KIT.extras.woundFlange`
   (`KitPartData`-like). Test: the kit has the extra, and its pivot is inside its polygon.
3. **Cable geometry.** `cableCurves` and socket positions per tear in `robotSockets.ts`. Tests:
   - 5 cables per socket, every length in [4, 9];
   - all cables point to the open side (dot product with `dir` > 0);
   - the same seed and time give the same curves;
   - sockets per tear kind: oneLeg → back hip; gib → neck, shoulders, hips on both sides; cut → waist ×2;
     limb → hip.
4. **Drawing.** `robotWounds.ts` draws flanges and cables for live fighters (`fighterArt`, replacing
   `drawStump` for kit bodies) and for corpses (`corpseArt` for gib, cut and limb). Sparks go through
   `createParticles`. Tests: a one-legged kit fighter has a socket view and no blood stump; a gib corpse has 10
   sockets (5 body side, 5 piece side); views are destroyed with their owners.
5. **Visual check.** Rig page (hurt, gib, cut, limb, both facings) and a bot match with a rocket kill on a robot.
