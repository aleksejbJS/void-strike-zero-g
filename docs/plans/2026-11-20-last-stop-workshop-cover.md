# Last Stop workshop cover

## Spec

Add one permanent steel shield at the workshop-side lip of the eastern service shaft. The shield joins the western edge of the opening and rises roughly two fighter heights above the floor. It interrupts the straight firing lane from the workshop's shotgun shelf toward the upper shaft, while the jump over it and the open center of the shaft preserve travel. Use the existing steel surface treatment and the shared map geometry for rendering, movement, and projectiles.

Keep the eight-player Deathmatch limit, map bounds, spawns, weapon and supply locations, and all three shafts. Preserve a vertically open drop wide enough for multiple fighters. A fighter sheltering on either side can use the shield top as a step. The shield creates a short approach where the nearby shotgun can matter.

## Implementation plan

1. Add a regression test for a standing-height firing line across the workshop approach, a clear path over the shield, and the open drop below that path. Confirm the standing-height check fails on the current map.
2. Add the steel slab to the existing ground-level geometry in `src/game/data/lastStop/layout.ts`. Verify the existing spawn, pickup, and navigation tests and examine the workshop in the game preview.
3. Repeat the six two-minute eight-bot matches using the same seeds. Compare right-sector railgun frags, shotgun frags, early respawn deaths, and travel in both directions through the right shaft. Bot results are directional evidence. The human playtest should confirm both approaches work under pressure.

## Playtest results

Six two-minute Deathmatch runs on each version used the same six seeds and eight bots. Right-side ground-sector railgun deaths dropped from 15 of 28 deaths to 4 of 27. Shotgun frags across the full map rose from 1 to 3, with zero in the right-side ground sector on the revised layout. Right-shaft traversals changed from 70 up and 76 down to 51 up and 67 down. An input-driven movement check cleared the shield with a jetpack and descended into the shaft.
