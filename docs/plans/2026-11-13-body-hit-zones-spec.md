# Hit zones that follow the drawing — spec (2026-11-13)

## Problem

Shots, railgun beams and flame rays hurt a fighter only inside its movement box: 30 wide and
72 / 45 / 26 tall (standing / crouched / prone), the same for every body. The illustrated bodies
of 0.5.0 are drawn taller than that box. The cat is the worst: its head centre sits on the box's
top edge, so ears, eyes and forehead are above it while standing and the whole head is above it
while crouched. A shot at the cat's face flies over the box and does no damage (owner report).

Measured top of the opaque drawing above the feet (every aim, weapon and step; tail left out):

| Body | Standing (box 72) | Crouched (45) | Prone (26) |
|---|---|---|---|
| human | 80.0 | 54.5 | 33.0 |
| human-female | 75.1 | 50.0 | 33.1 |
| robot | 77.9 | 54.0 | 38.0 |
| toxic | 81.0 | 54.8 | 33.1 |
| cat | 96.1 | 69.8 | 45.2 |

## Owner decision

Option A: a separate hit zone that follows the drawing; movement physics stays as it is.

## Fix

- `hitRect(fighter)` in `src/game/systems/hitZone.ts`: the movement box, its top raised to the
  drawing's top for the fighter's body and stance (a table, rounded up). A fighter without an
  illustrated body keeps its plain box. The zone is never shorter than the box.
- Used by every damage check that tests the box: projectiles, the railgun beam and the
  flamethrower rays. The movement box (Matter body), pickups, the chainsaw and explosions (both
  measure distance to the feet) are unchanged.
- A test measures the pictures' pixels and fails when the table no longer matches the art.

Side effect: every illustrated body becomes 3–10 units easier to hit at the top of its head
(hair, robot head), which is where it is drawn. The cat gets the biggest change (+24 standing).

The online server runs the same code, so it needs a redeploy with the release.

## Out of scope

Width of the zone (heads stick out a little to the front; only near-vertical shots would notice),
helmets on illustrated bodies (the zone keeps the body's own head height), the chainsaw reach.
