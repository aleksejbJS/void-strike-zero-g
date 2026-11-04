# Destructible Cover — Spec

**Date:** 2026-11-04 · **Status:** draft, awaiting owner approval
**Mockup (look, damage stages, placement on every map, patch notes):** https://claude.ai/artifact/4EVuUYbCh3XT4ZmvH5EDc6

## Why

Maps are static: platforms never change during a match, and the open decks have nowhere to hide.
The owner wants cover the fight can wear down: crates you crouch behind, glass you can see
through, and barrels that punish standing next to them. The world reacting to rockets and
grenades is the point of the feature; new tactics (break the enemy's cover, bait a barrel) are
the payoff.

## Owner decisions (2026-11-04)

| Question | Decision |
|---|---|
| What gets destroyed | **Separate objects on the maps**; platforms stay indestructible |
| Object kinds | **Wooden crate, metal crate, glass panel, explosive barrel** |
| Bots | **Bots understand cover**: hide behind it, shoot through it, set off barrels |
| Loot from crates | **No** |
| Placement | **Claude places them** on all maps (see mockup + table below) |
| Graphics | **Keep the procedural look from the mockup** for now. Better art (images) comes later |
| Who a barrel blast hurts | **Everyone in the radius, at full damage** (teammates and the breaker too) |

Everything else below marked *(Claude's call)* was proposed in the mockup and is open to change.

## Goals

- Four cover kinds with their own HP, look, and damage stages, on all six platform layouts.
- Cover blocks fighters, bullets, blasts and line of sight exactly like a platform, until it breaks.
- Barrels explode when broken and can chain.
- Broken cover comes back, so a long match does not end on a bare map.
- Bots use cover, break it, and use barrels.
- Works the same offline, on the Node server and on the browser host (shared simulation).

## Non-goals

- Destructible platforms or holes cut by blasts.
- Loot or pickups from crates.
- Moving/pushable crates or physics-simulated cover. Cover is static.
- HP bars over cover (cracks show how much is left).
- Image sprites. The renderer only has to keep each kind's drawing in its own module so a
  later change can swap in images without touching gameplay code.
- A map editor. Positions live in the level data.

## Anti-goals (would be a failure even if it works)

- Cover that blocks a tunnel or a corridor so a route becomes impassable.
- A barrel that kills fighters on their spawn point.
- The client showing a crate the server already broke (or the reverse) for more than a moment;
  a fighter getting rubber-banded by an invisible crate.
- Frame drops on phones from per-frame drawing: art is baked once per map load, like platforms.
- Bots stuck on a crate or a glass panel.

## Objects

Sizes in world px. Position follows the entity convention: `pos = (centerX, bottomY)`,
hitbox `{ x: pos.x - w/2, y: pos.y - h, w, h }`.

| Kind | Size (w × h) | HP | Notes |
|---|---|---|---|
| Wooden crate | 50 × 46 | 150 | Railgun goes **through** it (damages it and keeps going) |
| Metal crate | 50 × 46 | 500 | Railgun **stops** in it |
| Glass panel | 16 × 90 | 60 | Blocks fighters and shots; does **not** block sight. Railgun goes through |
| Explosive barrel | 32 × 46 | 80 | Explodes at 0 HP |

Why 46 px *(Claude's call)*: a crouching fighter is 45 px tall (fully hidden) and a standing
fighter fires from 50 px (shoots over it). "Stand up to shoot, crouch to hide." Glass is 90 px,
taller than a standing fighter (72), so you cannot duck behind it.

## Behaviour

### Solid like a platform while intact

1. Fighters collide with intact cover and can stand on top of it.
2. Bullets, plasma, shotgun pellets, rockets and grenades hit cover like a wall: the projectile
   stops there (rockets/grenades explode there, as they do on a platform).
3. Explosion line-of-sight (`createExplosion`'s "walls shield from the blast") treats intact
   cover as a wall.
4. Railgun beam: stops at metal crates and barrels; passes through wood and glass, damaging each
   one it crosses.
5. Line of sight (bot senses and anything else that asks "can A see B"): wood, metal and barrels
   block; glass does not.
6. Grappling hook: does **not** attach to cover and passes through it *(Claude's call — cover
   can vanish under a hanging fighter)*.
7. Smoke clouds are unaffected by cover; the smoke launcher does not damage cover.
8. Corpses/ragdolls and debris are cosmetic; they may ignore cover.

### Taking damage

9. Any damage source can damage cover: own shots, teammates' and enemies' (no friendly-fire rule
   for cover). Damage per weapon:
   - direct hits (bullet, plasma, pellet, railgun, chainsaw tick): the weapon's normal damage;
   - explosions (rocket, grenade, barrel): **× 3** against cover *(Claude's call, so a metal
     crate takes 3 rockets, not 8)*. The piece of cover the projectile itself hit takes the full
     `damage × 3` (no falloff; impact-point geometry must not change the count). Other cover in
     the radius takes the usual falloff `× 3`, measured from the blast centre to the cover's
     centre and blocked by platforms like for fighters.
   Resulting shots-to-break table is in the mockup ("Чем ломать") and is the target for tests.
10. Damage stage for drawing: `> 66%` intact, `> 33%` cracked, `> 0` broken, `0` destroyed.
11. Hits on cover give feedback (cosmetic event → chips/sparks + material sound). No damage
    numbers on cover.

### Destroyed

12. At 0 HP the cover stops being solid at once (same tick) and emits a cosmetic event so clients
    play debris + sound. Remains (a low stub/scorch) are drawn but are not solid.
13. **Barrel**: at 0 HP it explodes like a rocket: radius **170**, damage **90** at the centre
    with the usual falloff and knockback. The kill/damage is credited to the fighter whose hit
    broke the barrel (kill feed, score, achievements). If the barrel was broken by another
    barrel's blast, credit passes down the chain to the original fighter.
13a. **The barrel blast hurts everyone in the radius at full damage** (owner, 2026-11-04): the
    breaker and the breaker's teammates too. It does not use the rocket's teammate skip or the
    self-damage halving. Killing yourself or a teammate with a barrel gives no score (same as
    any self/team kill rule the mode already has); bots do not shoot a barrel when a teammate or
    they themselves are inside its blast radius.
13c. A barrel kill shows in the kill feed and death screen with a barrel as the cause (not the
    breaker's weapon). It counts as a kill for score in every mode, but in **Gun Game it does not
    advance the weapon ladder** *(Claude's call: the ladder rewards the weapon in hand)*.
    Weapon-keyed achievements do not count it.
14. Barrel chains: a barrel caught in a blast that breaks it explodes **150 ms later**, not in
    the same call *(Claude's call: looks like a chain, avoids recursion)*.
15. A barrel at the last stage (≤ 33% HP) hisses and vents fire (visual + sound) as a warning.

### Coming back

16. Destroyed cover returns **35 s** after it broke *(Claude's call)*.
17. For the last **2 s** before it returns, a dashed yellow hologram outline shows at its spot
    (not solid). If any fighter overlaps the spot when it is due, it waits and retries every
    0.5 s until the spot is clear, so nobody ends up inside a crate.
18. It returns at full HP.
19. Match restart (`resetMatch`) and the Hunger Games round restart restore all cover at full HP.

### Bots

20. Bots see through glass but not through other cover.
21. Under fire, a bot looks for the nearest cover between itself and the threat within a short
    reach, moves behind it, crouches, and stands to shoot.
22. If the target hides behind wood or glass, the bot shoots the cover. It shoots metal only with
    rockets or grenades; with a railgun it fires at a target behind wood.
23. If an enemy stands within a barrel's blast radius and the bot can see the barrel, the bot may
    shoot the barrel instead of the enemy.
24. Bots do not idle next to barrels and do not pick a barrel as cover.
25. Navigation: the nav graph stays built from platforms only. Bots get over a crate by hopping
    (46 px is well under a hop) and over glass with the jetpack; a bot blocked by cover for more
    than 2 s must recover (jump/jet or go around).

### Network

26. The cover layout comes from the level data with stable ids and, like platforms today, the
    host sends it in the join message; the client uses the host's layout, not its own copy
    *(Claude's call: a client on a different build still sees the host's cover)*.
27. Snapshots carry only the changing part per cover: HP and, while destroyed, when it returns.
    Hit/destroy/explode are events (cosmetic on clients, like EFFECT/DAMAGE/DEATH today).
28. Client prediction: the local fighter collides with cover according to the latest snapshot
    (physics body removed when it breaks, added back when it returns).

## Placement

Rules *(Claude's call)*:
- Cover goes on open decks with nowhere to hide and on deck edges facing the centre.
- Symmetric maps get mirrored placement, so no team gets extra cover.
- Barrels sit where routes cross, at least **400 px (straight line) from flags and from fixed
  team spawn areas**. Random spawn spots (free-for-all modes) are covered by the spawn shield,
  which shipped in 0.4.28 (on `origin/main`; branch from it). Hunger Games has its 3 s
  round-start shield.
- Nothing inside narrow tunnels (Tunnels map), so no route gets blocked.
- Cover never overlaps a pickup. A conflict is fixed by sliding the object along its platform
  (its mirror counterpart slides too); a centre-line object that cannot slide is split into a
  mirrored pair or dropped. Pickups are not moved.
- The tournament map gets **no cover** (a layout without entries has none); cover is per layout.

Positions (`kind, x, y` with `x` = centre and `y` = top of the platform the object stands on):

| Layout | Objects |
|---|---|
| Deathmatch · Default | wood −850,700 · 2850,700 · 700,700 · 1300,700 · 400,900 · 1600,900 — metal 1000,900 · −1130,−100 · 2630,−100 — glass 720,250 · 1280,250 — barrel −500,900 · 2500,900 · 1000,500 |
| Deathmatch · Tunnels | wood −1400,900 · 3400,900 · 700,200 · 1300,200 · 2450,400 · 2750,200 · −230,450 — metal 1000,900 · 1000,−400 · −430,−50 — glass −320,−600 · 2620,−600 — barrel 20,900 · 2020,900 · 2750,600 |
| Hunger Games | wood −1000,1400 · 2200,1400 · −300,1200 · 1100,1200 · −1550,300 · 2850,300 — metal −1950,−200 · 3150,−200 · 950,−900 · −1750,1300 · 3050,1300 — glass −40,900 · 1040,900 — barrel 1500,1400 · 400,1200 · 530,600 · −2200,800 · 3400,800 |
| Capture the Flag (also Gun Game) | wood 300,800 · 1700,800 · −800,800 · 2800,800 · 1000,−200 — metal −230,500 · 2230,500 — glass 820,600 · 1180,600 — barrel 1000,800 |
| Hold the Flag | wood 300,800 · 1700,800 · 880,550 · 1320,550 · 640,300 · 1760,300 · 1000,−200 — metal −230,500 · 2230,500 — barrel 1000,800 |
| Infiltration | wood 1420,500 · 1780,500 · 830,350 · 0,800 · 1100,800 · 2000,800 — metal 2630,600 · 2530,400 · 2630,200 — glass 2610,0 — barrel 1600,800 · 3050,600 · 600,800 |

Known fixes to apply to the table (found by checking it against `level.ts`):
- Deathmatch · Default: drop the centre barrel 1000,500 (it sits on the health/ammo pickups).
- Tunnels: metal 1000,900 (on the armor pickup) → mirrored pair 860,900 and 1140,900;
  metal 1000,−400 (on a weapon pickup) → mirrored pair 830,−400 and 1170,−400.
- Hold the Flag: drop the centre barrel 1000,800 (390 px from the flag).
- CTF/HtF metal −230,500 and 2230,500, HtF wood 880,550, Infiltration wood 830,350 and 1420,500
  overlap pickups: slide per the rule above.
- Infiltration wood 1420,500 and 1780,500 overhang their deck by 5 px → 1430 and 1770.

The builder verifies with a test that every object stands on a platform top, does not overlap a
platform or another object, and that barrels keep the 400 px rule. A position that fails is moved
the minimum needed and the change is noted in the PR.

## Look and sound

- Drawing follows the mockup: four damage stages per kind plus the respawn hologram, baked once
  per map load with the same canvas kit as platforms (noise, bolts, worn hazard paint, light from
  the upper left, soft cast shadow). Each kind's drawing lives in its own module.
- Debris, chips, sparks, glass shards, smoke and the barrel blast are client-side cosmetics
  driven by events.
- Sounds per material (wood crack, metal clang, glass shatter, barrel hiss, explosion). Reuse
  existing sounds where they fit; missing ones are left to the builder (see below).

## Constraints

- Shared simulation in `src/game/` (the server imports it); no server-only copies.
- 120 ticks/s fixed step; Matter.js is collision-only (gravity 0); forces stay in `movement.ts`.
- Matter bodies use centre coordinates: centre = (pos.x, pos.y − h/2).
- Files ≤ 200 lines, one responsibility each, named exports, no silent catches.
- Any new visible text in EN + RU.
- One branch / one PR / one 0.4.x release; the patch notes text is in the mockup ("Текст для
  патча").

## Acceptance

- All six layouts show their cover; offline, server and browser host behave the same.
- Shots-to-break match the mockup table (unit tests on damage).
- A barrel kill is credited to the fighter who broke it; a two-barrel chain credits the same
  fighter.
- Cover returns after 35 s and never inside a fighter.
- Online: breaking a crate is visible to all clients within normal snapshot latency; the local
  fighter does not collide with a broken crate or pass through an intact one.
- Bots: in a 2-minute bots-only Deathmatch on each map, no bot is stuck on cover for more than
  2 s; bots are seen taking cover and shooting barrels.
- No measurable FPS drop on the Default map at the 1512 × 700 test window.

## Left to the builder

- Data model and file layout (a cover list in the game state vs. folding cover into a shared
  "solids" helper), as long as every place that treats platforms as solid also treats intact
  cover as solid.
- Snapshot encoding details and how often cover state is sent.
- Bot heuristics and their tuning numbers (search radius for cover, when to prefer a barrel).
- Particle counts and exact sounds (new sound files only if nothing existing fits).
