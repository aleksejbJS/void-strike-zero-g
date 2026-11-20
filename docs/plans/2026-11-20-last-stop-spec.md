# Last Stop — Eight-player Deathmatch prototype

Date: 2026-11-20. Status: playable prototype approved by the owner.

Reference: [Last Stop side-view concept](2026-11-20-last-stop-concept.png).

## Visual revision

The concept guides the art direction and layout. The match and map preview draw the scene from individual surfaces and props measured in world units. The original all-in-one plate stretched the room art and made the scenery dwarf the 72-unit fighter.

- Use 92-unit fuel pumps, roughly 108-unit doors, and roughly 76-unit cabinets. Keep close cover readable and align every solid prop with its collision footprint.
- Draw walkable terrain and structural cover from the same rectangles used by simulation. Apply small repeating textures and weathered bands at native world scale. Build storefronts, windows, beams and utility details as separate background elements with quiet lighting.
- Shape the visible fascia and underside of canopies with rounded ends, add arched surrounds to entrances and tunnel bays, and round the reinforced lips at the shafts. Keep straight standing surfaces visually distinct from the curved trim.
- Keep the four combat areas, three basement connections, outer bounds, pickups and spawns. Scale down the two pumps and underground cabinet. Hand-painted detail textures and individual props supply the rural atompunk styling.
- The material and prop atlases and distant dusk panorama were made with built-in ImageGen and are stored in `public/assets/maps/last-stop/`. The renderer fits each prop uniformly and uses the panorama only behind the architecture.
- Check the scene at match camera scale on desktop and touch-sized viewports. Confirm the revised prop sizes and preserve basement and street navigation.

## Goals

- Turn the selected rural atompunk gas station into a larger playable Deathmatch map for eight independent fighters.
- Support simultaneous fights at the pump court, pump house, repair garage, and split service basement. Give players a chance to break contact and re-enter from a different elevation.
- Give all nine current weapons a useful engagement on the same map. Retain the shared combat, movement, and camera settings.

## Prototype entry point

| Option | Benefit | Trade-off |
| --- | --- | --- |
| Add Last Stop as a Deathmatch map (proposed) | Play and compare both layouts through the usual menu. | Adds a map entry and routing for the scene, spawns, pickups, and cover. |
| Replace Standard Deathmatch directly | Makes the new layout available at the default entry point immediately. | Removes the existing map from side-by-side comparison before the eight-player playtest. |

Use the selectable map for a solo playtest with seven bots and for an eight-human dedicated-server match. The existing browser-host limit is six. Base the prototype on the available `origin/main` reference for 0.5.1, which includes the current movement and combat changes. A decision to make Last Stop the default follows the playtest.

## Layout

- Start with **4,800 × 1,800 world units** of clear playable bounds, approximately three normal camera widths. Use the extra room for wider approaches and vertical separation. Size doors, turns, and cover against the 30 × 72 standing hitbox.
- Keep the recognizable gas station and timber garage at opposite ends, with the pump house made from two offset solid structures. Separate sightlines at standing height with a permanent masonry or machinery break on each approach. Use three staggered roof sections for an exposed shortcut.
- Keep the three basement connections near x = 450, 2,400, and 4,350, measured from the left playable boundary. Use roughly 300–340 units of clear shaft width and accessible intermediate ledges. Offset and shield the central shaft mouth inside the pump house. At the foot of the shaft, the passage opens to both sides.
- Split the basement into two stepped compartments with permanent cover on either side of the junction. Give the roof and street approaches short connectors so a player can change elevation locally. Keep full standing clearance on the main passages. Check ascent with touch jetpack and with the existing bot movement.
- Use own-project art references for red enamel signage, cream lettering, chipped yellow paint, and quiet warm background lighting. Draw solid edges clearly. Attach cover silhouette and artwork to the actual collision positions.

## Weapon and pickup layout

Engagement distances are starting geometry targets. Keep short fighting pockets around **120–300 units**, medium views around **400–750**, and selected exposed angles around **900–1,200**. The current flamethrower reaches 300, the grapple reaches 600, and the railgun ray reaches 2,200. Long useful sightlines should end at permanent geometry and cover a portion of the map.

| Weapon | Starting pickup and play space |
| --- | --- |
| Machine gun | Everyone starts with it. The pump court and garage apron give room to track moving fighters while reaching permanent cover. |
| Shotgun | One near the cashier exit and one at a turn in the garage. Short entrances and offset partitions reward closing distance. |
| Chainsaw | Left basement compartment. Put a short, covered approach next to an alternate exit and room to pass an opponent. |
| Flamethrower | Right basement compartment. Give it a 150–300 unit fighting pocket with a second exit or hard corner outside the stream. |
| Plasma gun | Outer pump court. Give it a clear medium-range crossing with a second elevation to dodge to. |
| Rocket launcher | Exposed garage-side roof approach. Give it room to use splash and rocket jumps, with permanent blast cover on adjacent routes. |
| Grenade launcher | Canopy-side upper approach. Give it angles into the pump-house approaches and shaft mouths without access to all basement exits from one ledge. |
| Smoke launcher | Pump-house side shelf. Let a smoke cloud cover one exposed crossing so another route remains useful. Check with a human player. |
| Railgun | Exposed mid-height ledge on an approach to the pump house. Make a few long angles available across open space. Separate the pickup from the strongest firing perch, armor, and spawn lines. |

Use the existing pickup values and timers. Put armor in the exposed section of the basement left of its central junction. Spread health and fuel across the branches. Keep spawn pockets free from high-value pickups. Make masonry and fixed machinery the reliable line-of-sight breaks even after breakable props are gone.

## Spawns and verification

- Place 12 candidate spawns across the four fight areas. Give each direct access to hard cover and two departures through different sightlines. Allocate distinct start points and prefer positions outside live opponents' direct view on respawn. When every option is exposed, prefer fewer sightlines and more distance from opponents. Share the spawn selection between offline and authoritative matches.
- Check each spawn and pickup against collision geometry and bot navigation. Verify all three basement connections and both branches below the central shaft with a standing fighter, a bot, and touch controls. Verify the map is selectable from the ordinary Deathmatch entry point.
- Run a local eight-fighter match and confirm the match routes, pickup placement, and recovery from deaths. Smoke and the choice to disengage need human play checks. For an eight-human dedicated-server session, record early deaths after respawn, where fights concentrate, and which escape routes people use. Use those results to decide on the default map and any tuning.
