# Ragdoll hinge joints, rounded player corners, diagonal takeoff — spec (2026-11-12)

Small physics fixes from the external physics review. Matter.js stays (future dynamic physics).

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

Checked afterwards: the rounded corners do not make a fighter slide off a ledge edge (it still
stands with 1 unit of footing, as before).

## 3. Diagonal jetpack takeoff no longer sticks to the floor

**Problem.** Holding W + D on the floor, the fighter stayed "grounded" for ~13 ticks (0.1 s): the
grounding band (feet within 3 units of a top) kept it on the ground, every tick the vertical speed
was reset to the floor-contact value and the thrust only crept it up 0.25 a tick, while ground
friction braked it sideways. Height after 10/20/40 ticks: 2.5 / 8.4 / 55. W alone (boost) was fine.

**Fix.** In the Force Pipeline a fighter thrusting up (jetpack on, not diving) is treated as airborne
for gravity, input and friction, even while its feet are still in the grounding band. `isGrounded`
itself is unchanged (animation, bots, fuel recharge keep using it).

**Result.** Height after 10/20/40 ticks: 6.6 / 25 / 95; a takeoff from the floor climbs like the same
thrust started 4 units up. Standing and diving along the floor are unchanged.

## 4. Point-only (legacy) corpses — checked, no change

Illustrated bodies (0.5.0) have contact radii, so their bones never pass through platforms (0% of
ticks). Point-only corpses still do (7–9%), but in 0.5.0 every local fighter gets an illustrated body
on the character setup screen before a match and all bots are illustrated; only a remote player on
an old cached client could still send a body-less build. Not worth changing.

## Out of scope

Coyote time, ceiling corner correction, render interpolation, a corpse sleep state, a separate
speed cap for rocket and hook impulses (next: a test branch to compare the feel).
