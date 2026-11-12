# Ragdoll hinge joints + rounded player corners — spec (2026-11-12)

Two small physics fixes from the external physics review. Matter.js stays (future dynamic physics).

## 1. Knees and elbows bend one way only

**Problem.** Corpse joints only have "do not fold flat" limits (minimum distance). Nothing stops
a knee or elbow from bending backwards. Measured on 300 random kills per kind (400 ticks each,
floor + wall): a joint ends a tick bent more than 10° the wrong way on 291/300 `fall` bodies,
276/300 `thrown`, 140/300 `cut`; worst cases 114–155°.

**Fix.** A hinge constraint inside the corpse relaxation loop (Verlet, no motors):
- Hinges: hip→knee→ankle (both legs), shoulder→elbow→hand (both arms).
- The bend sign is the 2D cross product of the two bones. It does not change when the body
  rotates or flips upside down, only when it is mirrored, so it is compared with `facing`.
  Knees fold the shin back, elbows fold the forearm forward (checked against the idle pose
  for every weapon: knees +25°, elbows −8…−144°).
- A joint bent the wrong way is moved back onto the straight line between its ends; the two
  ends move the other way by half as much each, so the body gains no speed.
- A hinge is skipped once one of its bones is torn off (gib, railgun cut, torn leg).
- Runs after the link pass and before platform collisions, in each of the 8 passes.

**Done when.** The same measurement shows (almost) no joint bent the wrong way at the end of a
tick; existing corpse tests (landing poses, rest, no tunnelling) stay green.

## 2. Rounded corners on the player body

**Problem.** Flying on the jetpack with the head pressed against a ceiling made of two flush
blocks, the fighter's sharp box corner catches the seam: horizontal speed drops 8 → 0.35 in one
tick, then takes ~0.25 s to build back. Running over a floor seam, diving along a floor seam
and sliding down a stacked wall do not snag (measured in a headless Matter simulation).

**Fix.** `chamfer: { radius: 3 }` on the player's Matter body (2 already removes the snag; 3 gives
margin). Bounds, feet position and grounding are unchanged; crouch scaling keeps working.

**Done when.** A regression test flies along a ceiling seam without losing speed and the other
three seam cases stay clean.

## Out of scope

Coyote time, ceiling corner correction, render interpolation, a corpse sleep state.
