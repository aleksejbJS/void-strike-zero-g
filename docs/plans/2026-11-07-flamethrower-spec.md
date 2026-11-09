# Flamethrower — Spec

**Date:** 2026-11-07 · **Status:** draft, awaiting owner approval
**Base:** `origin/main` at 0.4.31 (destructible cover and barrels are in). The local `main` checkout is
stale (0.4.24) — build in a worktree from `origin/main`.

## Intent

A new close-range weapon that is strong and fun to hold, with one rare, spectacular risk: if someone
shoots you while you carry it, the fuel tank on your back can catch fire, burn for 3 seconds where
everyone can see it, and then blow up — tearing the carrier apart in a burst of blood and gore and
hurting whoever stands nearby.

The moment the owner wants: the carrier sees their tank light up and knows they have ~3 seconds; the
shooter sees exactly the same thing; both think "wow, that was cool". The explosion is a rare
highlight, not a routine mechanic.

## Owner decisions (2026-11-07)

| Question | Decision |
|---|---|
| Range | **~300 world units** (~4 fighter heights; real flamethrowers reach 20–40 m, which would be the whole screen) |
| Stream damage | The stream hurts **while the target is in it** |
| Burning | A hit sets the target on fire: **1 HP every 0.5 s for 5 s**; the burning fighter **visibly burns** |
| How you get it | **Weapon pickup at fixed points on the map**, like other weapons |
| Tank risk | Small chance per hit that the carrier's tank ignites; **~3 s** later it explodes |
| Explosion | Carrier is **torn to pieces with blood**; people nearby are hurt too |
| Saving yourself | **Impossible for now** — a lit tank always explodes (no dropping the weapon) |
| Killing hit | **Can light the tank too** |
| Dying with a lit tank | **The fuse keeps running on the corpse**: it burns, then explodes when the 3 s are up |
| Underwater | **Does not work underwater.** There is no water in the game today: record the rule, build nothing for it |
| Accepted from playback | ~50 HP/s stream; a new hit restarts the 5 s burn; body burning and tank burning look different; ammo is "fuel" like other ammo; bots pick it up and use it; server decides the chance |

## Behaviour

### 1. The weapon
- New `WeaponType.FLAMETHROWER`. Hold fire to spray a continuous stream of flame.
- Damage ticks while fire is held: **5 HP every 100 ms (≈50 HP/s)**. Knockback ≈ 0, recoil ≈ 0.
- The stream reaches **300 units** from the muzzle in a narrow cone (*builder's call on the exact
  width; start around ±8°*). It hits **every enemy fighter in the cone** (flame does not stop at the
  first body), and stops at platforms and intact cover.
- Teammates are not hurt (same friendly-fire rule as every other gun). The carrier never hurts themself.
- Fuel: `ammo 100` (≈10 s of spraying), `maxAmmo 200`. One fuel unit per tick. Picking up a second
  flamethrower adds fuel the same way other weapon pickups add ammo.
- Cover: the stream damages cover it reaches like any shot (*builder's call on per-kind values;
  wood should burn faster than metal*). A barrel broken by flame goes off by the existing barrel rules.
- Death by the stream: the body just drops (`deathKind` 'fall'), like machine-gun deaths.

### 2. Burning (any fighter hit by the stream)
- Each stream hit sets/refreshes `burn` on the target: it **burns for 5 s after the last hit** (a new
  hit restarts the 5 s, it does not stack).
- While burning: **−1 HP every 0.5 s** (10 HP over a full burn), plus the stream damage while still in it.
- *My call:* burn damage ignores armor and has no knockback, like bleeding (`bleeding.ts`).
  A damage number for each burn tick is the builder's call.
- *My call:* nothing puts the fire out early (a medkit heals but does not extinguish). The future water
  rule: entering water extinguishes.
- Burn death is credited to whoever set the fire, with the Flamethrower in the kill feed (same pattern as
  the railgun bleed-out credit in `wound.ts`).
- **Visual:** flames licking over the whole body for as long as the burn lasts, visible to everyone.

### 3. The tank catches fire
- Only a fighter **holding the flamethrower as the current weapon** is at risk (*my call: the tank is
  drawn on their back only while it is in hand*).
- Every hit **by an enemy** (not self-damage, not the Hunger zone, falls, bleed or burn ticks) rolls a
  chance to ignite the tank. *Starting values (my call), all in one constants table for tuning:*

  | Hit | Chance per hit |
  |---|---|
  | Machine gun bullet | 2% |
  | Shotgun pellet (6 per shot) | 1% |
  | Plasma bolt | 5% |
  | Railgun beam | 5% |
  | Chainsaw tick | 2% |
  | Rocket / grenade (direct or splash), barrel blast | 15% |
  | Enemy flame stream tick (10/s) | 1.5% (≈15% per second in the stream) |

  Aim: a flamethrower carrier in a normal fight sees their tank go off rarely — roughly once in several
  lives, not every fight.
- A tank that is already lit ignores further rolls.
- Ignition starts a **3000 ms fuse**. The carrier keeps full control (can move, shoot, switch weapons),
  but **cannot stop it**: switching away from the flamethrower does not put it out.
- **Visual (must look different from body burning):** a roaring jet of flame from the tank on the back,
  a hissing sound, and a blinking warning mark above the fighter's head. Everyone sees it.

### 4. The tank explodes
- When the fuse ends, the tank explodes at the carrier's back.
- The carrier **always dies and is always gibbed** (`deathKind` 'gib' regardless of health/armor), with
  extra blood: body parts fly in every direction.
- **The killing hit can light the tank too** (owner decision): the roll happens on every enemy hit,
  including the one that kills the carrier.
- **Death does not stop the fuse** (owner decision): if the carrier dies with a lit tank (killed during the
  fuse, or by the very hit that lit it), the **corpse keeps burning** and the tank explodes when the 3 s run
  out, gibbing the corpse. A lit tank never fizzles out.
  - *My call:* a fighter who dies with a lit tank **drops where they stand** (`deathKind` 'fall', no throw and
    no gib from the killing hit), so everyone sees the burning corpse with the tank on its back.
  - *My call:* the blast happens **at the place of death**. Corpses are client-side ragdolls the simulation
    does not track, and the fighter respawns after `RESPAWN_DELAY` (3 s) — so the lit tank must live as
    its own small world object in the simulation (position, fuse end, credit), not on the fighter.
  - When it goes off, clients tear the existing corpse to pieces with blood (a new cosmetic path: gib a
    corpse that is already lying there) and play the blast.
- Blast: *my call — barrel-style*, radius **170**, base damage **90** with distance falloff, blocked by
  walls and cover, and it hurts **everyone in reach regardless of team** (a barrel blast in `cover/barrel.ts`
  works this way). Neighbours can be gibbed by the usual overkill rule. Cover in reach takes damage, and
  barrels in reach can chain.
- Credit: the fighter whose hit lit the tank gets the carrier's death and every kill the blast makes;
  kill feed weapon name **"Fuel Tank"**. Teamkills follow the existing barrel rules.
  *My call:* if a **different** fighter kills the carrier during the fuse, that finisher keeps the
  carrier's kill (same as the railgun bleed-out precedent in `wound.ts`: anyone else's kill stays theirs);
  the one who lit the tank still gets every other kill the blast makes.
- A tank blast hitting another flamethrower carrier rolls their ignition chance like any explosion (15%),
  so tanks can chain, like barrels.
- The Hunger Games round-start shield and the spawn shield (`spawnShield.ts`) still protect fighters from the blast.

### 5. Online
- The server/host decides everything (chance rolls, fuse, burn, blast) in the shared simulation in
  `src/game/systems`; offline, Node server and browser host behave the same.
- New per-fighter state (`burnUntil`, `burnBy`, `tankFuseAt`, `tankBy` or similar) travels in snapshots
  and is shifted to the local clock like the spawn-shield timestamp, so flames last the right time on clients.
- The flame stream must be visible to every client. It is a cosmetic drawn from shared state (e.g. "firing
  a flamethrower" from `lastFired` + weapon type), not simulated per particle. The simulation only emits
  events (`EFFECT`/`DEATH`/`SOUND`), as the multiplayer rule requires.
- The new weapon type and any new effect/death names must pass the existing network validation (see
  `isDeathKind` for the pattern). Note: `MAX_WEAPON_SLOTS` in `src/game/net/validation.ts` is 7, below
  the 9 weapon types there will be — raise it.

### 6. Maps, bots, UI
- **Maps:** one flamethrower pickup per map, in a close-quarters spot (*builder's call per map*). Standard
  weapon respawn time.
- **Not in** the Gun Game ladder and **not in** the tournament duel loadout (The Pit) — both stay as they are
  (Gun Game already blocks weapon pickups; The Pit has none).
- **Bots:** pick it up and use it — prefer it when the target is within ~300 units (`botWeapons.ts`), never
  aim it at cover or barrels (same fix as the chainsaw). No special behaviour while their tank is lit.
- **HUD:** weapon icon (PNG in `public/assets/hud/`, loaded via `assetUrl`), label in EN and RU, fuel shown
  as ammo. Map pickup drawn like other weapon pickups. Weapon drawn in the fighter's hands with a tank on the back.
- **Sounds:** flame loop while spraying, ignition hiss, the tank blast (the existing explosion sound is fine
  as a base).

## Non-goals
- Saving yourself from a lit tank (dropping or throwing the weapon) — maybe later.
- Water and extinguishing (no water exists yet).
- Fire spreading to the floor, burning areas, or fire spreading from a burning fighter to others.
- Achievements, Gun Game and duel changes.

## Anti-goals (a failure even if it technically works)
- Tank explosions so frequent that nobody wants to hold the flamethrower.
- A flamethrower so weak (only the 10 HP burn) that nobody picks it up.
- An explosion players don't understand: it must be obvious **why** the fighter blew up, i.e. the
  3 s warning is unmistakable and different from ordinary burning.
- Online desync: the shooter and the carrier must see the same ignition and the same blast.

## Left to the builder
- Exact cone width, cover damage per kind, damage numbers on burn ticks, map spots, art and sounds.
- Module layout. `combat.ts` is already over 200 lines: put the new logic in focused new modules
  (e.g. `flamethrower.ts`, `burning.ts`, `fuelTank.ts`) and keep each under 200 lines.
- All tuning numbers above live in constants so the owner can tweak them after playtesting.
