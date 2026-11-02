# Void Strike: Zero-G - Changelog

## Version 0.4.8 (2026-11-02)

### 🚩 Objective Banners
- Team modes show a big team-coloured banner under the score when an objective changes hands (spec: `docs/plans/2026-11-02-match-feel-spec.md`, part 2): CTF flag grabbed / lost (carrier died, the flag goes home) / returned / captured, Hold the Flag taken / lost (holder died or threw it), Infiltration intel grabbed / dropped / extracted; EN and RU
- The simulation emits a new `FLAG` game event (`systems/flagEvents.ts`) where a flag changes hands, so online clients get it with the other events and no protocol change
- The banner (`hud/FlagBanner.tsx`, text in `hud/flagBannerText.ts`) drops in, holds and fades in 2.6 s (CSS `hb-banner`, fade only with reduced motion); a newer event replaces it at once

## Version 0.4.7 (2026-11-02)

### 🛠️ Setup Screen
- From 1024 px wide the character screen fits the window: the page no longer scrolls, the part tiles scroll inside their panel and Back / Start stay at the bottom (a 14" MacBook window is ~860 px tall; the page was ~1226 px)
- In a desktop window up to 960 px tall (new Tailwind screen `short`) the title, gaps, name field, tile pictures and buttons are a bit smaller
- The tile panel opens each tab at its first slot and ignores scroll anchoring, so pictures that load late do not shift it
- Phones keep the old layout with one page scroll

## Version 0.4.6 (2026-11-02)

### 🎥 Camera
- The camera shows a fixed slice of the world, about 1600 × 900 units, scaled to fill the window (spec: `docs/plans/2026-11-02-match-feel-spec.md`, part 1); before, the world was drawn 1:1 and a bigger window saw more of the map
- A window that is not 16:9 shows the extra width or height instead of cutting the picture; on phones the zoom never drops below 0.6, so fighters stay readable
- Backdrop, world and post effects sit in one scaled container (`render/viewport.ts`); the cursor stays in window pixels; mouse and touch aim are converted through the same viewport offline and online
- Real ad banners (DOM overlay) are scaled with the canvas and stay on their posters

## Version 0.4.5 (2026-11-02)

### 🎬 Menu Mode Previews
- The six mode previews are drawn live by the match renderer instead of HTML/CSS schematics (spec: `docs/plans/2026-11-02-mode-previews-spec.md`): station / mine / arena backdrop and platform art without ads, real fighters ("You" in the player's own build), flags, intel, projectiles, railgun beams, blasts, ragdolls and the Hunger Games zone
- A director plays a per-mode script (keyframes, aims, shots, deaths, weapon switches, carried flags, props, zone) into a `GameState` at the physics tick rate; loops are 5–8 s and seamless
- Texts (scores, bases, extraction, Gun Game ladder, "You") stay translatable; one Pixi app serves every preview for the page life and pauses off-screen or in a hidden tab; reduced motion gets a still frame; no WebGL → the old schematic scene
- Baked scene textures are now owned per scene (`bakeScene`), so the preview and the match can never free each other's art; `createThemedScene` can skip ad places; the preview leaves no scorch marks for the next match

## Version 0.4.4 (2026-11-02)

### 🐛 Fixes
- Missing art after match → menu → match (and in any canvas that outlives another one): Pixi 8.14.3's `Batcher.destroy()` hands back to its page-wide batch pool every batch in its array, including the ones `begin()` had already returned on an earlier frame and that another live renderer may have taken since. Those batches end up in the pool twice, two batchers share one batch, and the live renderer draws with a dead renderer's geometry: `glDrawElements: Insufficient buffer size`, then `Cannot read properties of null (reading 'instanceCount')`, missing or black art until a reload. `src/game/render/batchPoolFix.ts` cuts the array to the batches the batcher still owns before Pixi's destroy runs (Pixi 8.22 does the same itself); `destroyApp()` installs it. Unit tests cover the patch

## Version 0.4.3 (2026-11-02)

### 🧩 Fighter Builder
- The fighter is built from parts (spec: `docs/plans/2026-11-02-fighter-builder-spec.md`); any part combines with any other:
  - Helmet: round, robot box (keeps its short antenna), glass dome (a bubble on a collar with a cartoon face in the head color), angular trooper helmet
  - Visor: strip, full glass, slit, T-shape, two eyes; each visor adapts to the helmet (on the robot box the strip stays a solid glowing panel); the visor glow is its own color
  - Ears, horns and antennae: none, cat, two antennae, wolf, bunny, round, little horns, ram horns, lamp antenna (blinks when firing), crest
  - Tail: none, cat (long S-curve, tip up), tentacle (thin and wavy with a glowing tip), lizard (tapering, spikes on top), mechanical (metal links with a light at the tip); the old straight stick tail is gone
  - Jetpack body: pack, twin tanks, rocket, wings (folded on the ground, open in flight), scrap; twin tanks and scrap burn two flames
  - Flame color: fire, blue, toxic green, purple, white
  - Torso pattern: none, chest band, racing stripes, hazard band, camo, split; the pattern has its own color
  - Shoulder badge on the front shoulder pad, in the pattern color: none, chevron, a number (0–99), an emblem (skull, star or bolt)
- Tails, floppy ears, the lamp and the wings move on critically damped springs driven by the fighter's speed, state and last shot, so they react to running, jumping and jetpack flight without jitter
- The 11 skins are now presets: a ready build plus palette made of free parts; picking one replaces the whole build, then every part can be changed ("(changed)" shows under the preset name)
- A returning player's saved skin and colors turn into the matching preset build on first load, so nobody loses their look

### 📈 Levels and Unlocks
- Finishing a match while still in it gives 20 XP; winning it (first place, winning team, last one standing, Gun Game winner) gives 30 more; matches against bots count, leaving early gives nothing, and joining during a results screen pays nothing
- Level = 1 + floor(XP / 50); part *k* of the 30-item unlock order opens at level *k* + 1, so everything is open at level 31 (1,500 XP); achievements keep their own XP and open no parts
- The results screen, the Hunger Games round result and the Gun Game winner block show the XP gained, the new level and the part it opened, with its slot
- Progress is saved in the browser; each unlock records what opened it (today always `level`) so purchases can be added later

### 🛠️ Setup Screen
- Tabs with picture tiles: Head (helmet, visor, ears, visor glow), Body (tail, pattern, badge), Jetpack (body, flame), Colors (the body colors plus the pattern color)
- The chosen tile has a hazard-yellow border; locked tiles are dimmed with a lock and "Lvl N"; an XP bar under the preview shows the level and the XP to the next part
- The preview keeps a fixed height

### 🌐 Online and Ragdolls
- The join request carries the build (part ids, badge number, visor and pattern colors); the host checks every id against the known lists and falls back to the free default for anything unknown (unlocks are not checked: progress is client-side by design); players on older clients get their skin's preset
- Every client draws other players with their build; the ragdoll head keeps helmet, visor and ears, the ragdoll torso keeps pattern and badge

### 🦾 Limbs
- Arms and legs are drawn as one piece per limb (both outlines, then both fills, then highlights), so the joints bend smoothly without the round knee and elbow pads that hid the seam; the living fighter and the ragdoll share the same limb drawer

## Version 0.4.2 (2026-11-02)

### 🚩 Flags
- All flags are drawn by code in one "station standard" design (spec: `docs/plans/2026-11-02-flag-look-spec.md`): steel pole with brass collars and a glowing crystal, segmented cloth with shaded folds, a dark hem with rivets, chevrons and a swallowtail end
- CTF bases get a plinth with hazard tape, a pulsing team light strip and a floor glow; the plinth snaps to the platform under the flag
- The Hold the Flag flag stands upright on its pedestal; a dropped one is planted at a lean with a pulsing ring around it; a flag with no floor below bobs in mid-air
- A carried flag trails against the carrier's motion (level when running, down when flying up, hanging when still); Hold the Flag carriers keep their fire, now at the crystal
- The 1152 × 896 flag pictures (shrunk ~7× without mipmaps, so they shimmered) are removed

### 🐛 Fixes
- CTF: a blue fighter carrying the red flag showed a yellow (intel) flag; the carried colour now depends on the game mode

## Version 0.4.1 (2026-11-02)

### 🐛 Fixes
- Black world at match start (production build): tearing down the character preview's Pixi canvas with `destroy(true)` released Pixi's page-wide batch pool while the match renderer was still using it, so its next frame crashed in the batcher ("Cannot read properties of null (reading 'clear')") and only the HUD stayed visible until the page was reloaded. Every Pixi app now goes through `destroyApp()` in `src/game/render/pixiApp.ts`, which removes the canvas without touching the global pools; a unit test guards the call

## Version 0.4.0 - "Hazard Bay" (2026-11-02)

### 🛰️ Map Looks: Station, Mine, Arena
- The default map (Deathmatch, Gun Game, CTF, Hold the Flag, Infiltration) is drawn as a space station: stars and a planet through hull windows, girders and pipes, cargo containers, hanging lamps, rotating beacons
- Platforms are worn metal decks with bolts, chipped hazard paint and cast shadows; the floor is a grating lit from below; map edges are hull columns; team bases are tinted blue/red
- Depth: far layers move slower than the playfield (parallax); vignette and film grain; fighters get a soft contact shadow
- Tunnels is an asteroid mine: rock face with strata and cracks, timber supports, strings of bulbs, ducts and scaffolding, ore carts, rock slabs with a steel lip and glowing veins, bedrock with a rail track
- Hunger Games is a show arena: a dome, stands with a dim crowd behind lime-lit railings, truss rigging with speakers, sweeping spotlights, bright plates with a lime neon edge, a polished arena floor
- Art is generated by code and baked once per map; only lights, screens and grain animate
- In-world ad places on every map — station: two wall lightboxes 300×250, a container sticker 300×100, an LED panel 728×90; mine: two lit boards, an ore-crate sticker, an LED panel; arena: two big screens over the stands 300×250 and an LED ribbon 728×90. Each can show a TrafficStars spot from `public/ads.json`: the banner sits in its frame, follows the camera, gets the scene's light, platforms and girders in front cut it, fighters in front fade it, no clicks during a match. It loads only after being half on screen for a second and refreshes at most every 30+ s. Without an ad the place shows a house poster
- Hidden admin page `#ads-admin`: paste spot codes, test them live in the in-game frame, download `ads.json`

### 🧍 New Fighter
- Redrawn character: shoulders, hips, knees and elbows; both hands hold the weapon (rear hand on the grip, front hand on the foregrip) at any aim
- Steps follow the real running speed; leaning into the run, tucked legs in flight, deep crouch, recoil and muzzle flash
- Helmet with a visor that looks where you aim; outline and shading keep the fighter readable on dark maps
- Robot, beast and alien skins keep their heads, ears, antennae and tails; every body-part color still applies
- Bodies break into parts in their own colors (any custom color, not only the four team colors)
- Before/after pictures in the menu's "What's new" panel

### 🎇 Shots, Hits and Fighter Polish
- Every weapon's shot has its own look: machine-gun and shotgun tracers with a glow, a pulsing plasma orb with a fading ghost trail, a drawn rocket with a flickering exhaust and smoke behind it, a spinning grenade, a three-layer rail beam
- Impacts: a flash and falling sparks where a shot meets a wall, plus a scorch mark on walls and floors that fades in about 4 seconds
- Explosions: flash, fireball, shockwave ring, embers, rising smoke and a scorch mark on a wall or floor close to the blast
- Fighters that get hit: blood droplets and a brief brightening of the fighter
- Muzzle flash: a star with a warm light on the fighter's hands, fading over about 120 ms (it used to be visible for about 20 ms)
- Fighter volume: highlights on limbs, torso and head, a visor reflection, a strap, a pouch, knee and elbow pads, a glow behind the jetpack flame
- Fighter silhouette: bigger head, chest and boots, thicker limbs, a shoulder pad and a helmet ridge; the body stays within 6 px of the hitbox in every pose, checked by a test (antennae, ears and tails excluded)
- Fighter liveliness: landing squash with dust, dust under the feet while running, head bob; ragdoll parts match the new proportions
- The simulation now announces `blood` for a fighter hit and `spark` for a wall hit (it announced `spark` for both); same event channel, no gameplay or protocol change, so online players see the same effects
- Particles have their own motion per kind (streak sparks, droplets, soft smoke, shells, dust) and a budget of 500 live ones: above it, smoke and dust are not spawned
- Before/after pair "Shots and hits" in "What's new"; the fighter picture is retaken

### 🎨 New Interface
- **Main menu** redesigned: pick a mode and watch a short animated preview of how it plays, with its three key rules (Infiltration shows the whole raid: grab the intel, bring it to extraction)
- **What's new** panel with the full release history
- **Character setup** redesigned: live preview on a platform, a custom color for every body part
- **HUD** redesigned: health, armor and fuel with item icons, weapon pictures in the slots, match clock and goal
- **Objective hints** in team modes ("You have the red flag. Bring it to your base.")
- All interface text in English and Russian

### 🏁 Matches That End
- Deathmatch (20 kills), Capture the Flag (3 captures), Hold the Flag (60 points) and Infiltration (3 points) end at the score limit or after 10 minutes
- Results screen with winner, final score and ranking; the next match starts after 10 seconds
- Hunger Games rounds are limited to 5 minutes; betting credits carry over between rounds
- Hunger Games round start: fighters spawn on platform tops across the whole arena, at least 700 px apart, and nobody can be hurt for the first 3 seconds ("Fight in 3…2…1"); rounds used to be over in 6–16 seconds
- Hunger Games zone: closes in from the sides and the top while its bottom stays on the arena floor (fighters used to hang in the air at the zone edge and take damage), stays centered at its smallest size instead of drifting, also shrinks every 30 seconds without deaths, and freezes once the round is decided (the winner could die on the results screen)
- Hunger Games results list the winner first; bots skip pickups outside the zone and step off platforms to reach enemies below

### 🌐 Multiplayer
- **Create game**: host a match in your browser and invite friends with a link (WebRTC)
- Join a dedicated server by its address; the server chooses mode and map (`SERVER_MODE`, `SERVER_MAP`)
- Smoother online play: your own movement is predicted, other players are interpolated
- Blood, explosions and damage numbers are visible online
- Hunger Games online; players joining mid-round watch until the next one
- The server validates everything clients send and no longer crashes on malformed messages

### 🤖 Movement and Bots
- Running and crouch-walking are twice as fast (about 240 px/s); jumps and the jetpack are unchanged
- Bots move with the same controls as players, at the same speed
- Bots pick an enemy they can see instead of one behind a wall, and look for hidden enemies instead of waiting
- Bots fight in Gun Game (they used to ignore everyone)
- Bots shoot back while retreating to a medkit, aim at the body and lead moving targets correctly
- Bots no longer hop in place every quarter second, and can drop down to lower floors instead of hovering
- Bots react like people: 0.4–0.9 s after spotting an enemy (and after the Hunger Games start shield) before the first shot; their aim error grows with distance and target speed. A running player used to be cut down within a second of the shield dropping
- Bots know the map: a navigation graph built from each map's platforms (surfaces, plus how to get between them by walking, dropping, jetpack or grapple hook) and a route search. They reach every floor of every map instead of getting stuck under platforms or running into walls; Tunnels and arena bots now roam the whole map (the old hand-placed waypoints belonged to the default map only)
- Bots use the grapple hook like players: fire at the underside of a ledge too high for the jetpack, reel in, let go and finish over the edge with the jetpack
- Bots in a fight: strafe bursts instead of standing still, a short jetpack hop after taking a hit, and when nearly dead an escape by hook or jetpack to another platform away from the enemy
- CTF bots: the flag carrier heads straight home (no medkit detours, no hops), teammates escort it; the bases come from the level data
- Bots skip pickups placed inside solid blocks (Tunnels has three in its central block) and jetpack up to pickups hanging in the air
- Measured in bots-only matches (kept as a test): Deathmatch, 3 bots, one minute — 6–12 kills in every run (was 3–9) and no bot standing still for more than 1.5 s (was up to 45 s); Tunnels — 6 kills (was 0); Hunger Games — 7 kills (was 4); CTF — see the respawn change below
- F3 debug view draws each bot's route (offline play)
- Bots only go for pickups they can reach: standing on the surface below, or hopping up from it (CTF's shotgun hangs in mid-air beside a platform; bots used to hop under it for good)
- CTF: teams respawn on the floor behind their base (~700 px from their flag) instead of on the flag itself, where defenders reappeared on top of a carrier 3 s after dying. Bots-only, 7 matches of 3 min: 3–10 flag pickups and 3 captures in total (was 0–3 pickups, 0 captures)
- Tunnels: the rocket launcher, chainsaw and armor were inside the solid central block (unreachable for everyone); moved to the tunnel mouths and under the block. A test now checks every map for buried pickups
- "What's new" shows before/after pictures of the three map looks

### 🎯 Gameplay Fixes
- Same game speed on 60, 120 and 144 Hz screens (fixed 120 ticks per second)
- Railgun and explosions no longer go through walls; bullets hit only the first player in their path
- Stray bullets disappear instead of flying forever
- Killing yourself no longer gives a point; friendly fire works the same for every weapon
- Crouching no longer pushes you into the floor
- Standing on the ground is detected reliably: running fighters used to count as airborne about a third of the time (or more), sliding with frozen legs and without ground friction
- The smaller team no longer gets a free point on every respawn (CTF, Hold the Flag)
- Keys no longer stay pressed after switching windows; touch controls work on phones
- Weapon names in the HUD and kill feed are translated; two kills in the same millisecond no longer break the kill feed
- Textures no longer disappear after returning to the menu

### 🛠️ Technical
- Shared authoritative game room used by both the Node server and the browser host
- Large components split into small modules; 384 automated tests (from 56)

## Version 0.3.1 (2025-11-28)

### 🎮 Gameplay
- **Gun Game**: weapon ladder, no pickups, win after the final weapon

### 🎨 Interface
- Skin selection arrows; robots and beasts with their own accents
- Weapon selection fixes

### 🌐 Server
- ESM compatibility; localtunnel and ngrok tunnels

### 🐛 Fixes
- Achievements count only for the player
- Winning Gun Game no longer exits the game abruptly

## Version 0.3.0 - "Ragdoll & Modular Update" (2025-11-25)

### 🎮 New Game Modes
- **Hold The Flag** - King of the hill style mode where teams fight for control of a neutral flag
  - Score points every 4 seconds while holding your team's flag
  - Flag carrier moves slower and takes extra damage
  - Can throw flag with crouch + jump
  - Special golden flag visual with fire effects

- **Infiltration** (Work in Progress) - Asymmetric mode where attackers steal intel
  - Blue team must grab intel and extract to zone
  - Red team defends for limited time
  - Intel drops on death
  - Timer-based scoring

### 💀 Ragdoll Physics System
- **Realistic Death Effects**
  - Bodies now break apart into 6 pieces (head, torso, 2 arms, 2 legs)
  - Each part has independent physics with gravity, rotation, and collisions
  - Parts bounce off platforms and gradually come to rest
  - Smooth fade-out over 5 seconds
  - Blood splatter and decals on death

### 🎨 Modular Character System
- **Improved Character Rendering**
  - Characters now built from separate body parts
  - Left arm with independent animation (swings while running)
  - Right arm holds weapon and aims
  - Helper functions for easy customization
  - Z-index layering for proper rendering order
  - Ready for sprite replacement and custom skins

### 🌐 Multiplayer (PeerJS)
- **Peer-to-Peer Multiplayer**
  - Host/Client architecture
  - Create game and share invite link
  - Join via URL parameter
  - Real-time state synchronization
  - Remote player input handling
  - Players replace bots when joining

### 🎯 Gameplay Improvements
- **Bot AI Enhancements**
  - Bots now actively seek flags in Hold The Flag mode
  - Improved pathfinding and objective prioritization
  - Better combat behavior
  - Weapon switching based on distance

- **Visual Improvements**
  - Intel item with golden briefcase visual
  - Flag glow effects (blue, red, golden)
  - Improved pickup rendering
  - Better team color indicators

### 🛠️ Technical Improvements
- **Code Architecture**
  - Modular body part creation functions
  - Cleaner separation of rendering logic
  - Better type definitions for network packets
  - Improved state management

### 🐛 Bug Fixes
- Fixed `rect()` calls to use `roundRect()` for rounded corners
- Fixed asset path issues for Netlify deployment
- Corrected mouse coordinate conversion for multiplayer
- Fixed team balancing in respawn logic

---

## Version 0.2.0 - "Multiplayer Foundation" (2025-11-24)

### Features
- PeerJS integration for P2P multiplayer
- NetworkManager class for connection handling
- Host/Client game modes
- State synchronization
- Remote input processing

---

## Version 0.1.0 - "Initial Release" (2025-11-23)

### Features
- Deathmatch mode
- Capture The Flag mode
- Bot AI
- Multiple weapons (Machine Gun, Shotgun, Plasma Gun, Rocket Launcher, Grenade Launcher, Railgun, Chainsaw)
- Jetpack movement
- Grappling hook
- Dash ability
- Pickups (Health, Armor, Ammo, Fuel)
- Particle effects
- Sound system
- Scoreboard
- Player customization (name, color, jetpack color)

---

## Upcoming Features

### v0.4.0 - "Customization & Polish"
- [ ] Body part skin system
- [ ] Sprite-based character rendering
- [ ] Skin selection UI
- [ ] More visual styles for each body part
- [ ] Improved animations
- [ ] Sound effects for ragdoll
- [ ] Complete Infiltration mode
- [ ] Extraction zone visuals
- [ ] Intel carrier effects

### Future
- [ ] More game modes (Team Deathmatch, Survival)
- [ ] Power-ups and special abilities
- [ ] Map editor
- [ ] Custom game settings
- [ ] Leaderboards
- [ ] Achievements
