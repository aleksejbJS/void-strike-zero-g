# Smoke Grenade Launcher Spec

Status: approved 2026-11-03

## Problem

There is no way to hide in the open. Players want to drop smoke under their own feet when
cornered, or fill the approach to a flag they guard, so that nobody — player or bot — can see
who is inside.

## Decision

A new weapon, **Smoke Launcher** (`WeaponType.SMOKE_LAUNCHER`), "the same grenade launcher,
only smoke".

- **Getting it:** a weapon pickup on the maps, like every other gun; picked up into the
  inventory and selected by the usual weapon switching.
- **Firing:** the round flies exactly like a grenade (same arc/gravity, same 0.5 s fuse). It
  bursts on hitting a wall or floor, on hitting a fighter, or when the fuse runs out. It can be
  fired anywhere, including straight down at your own feet.
- **Damage:** a direct hit on an enemy takes **1 HP**, no knockback, no blast. The smoke itself
  never hurts or pushes anyone.
- **Smoke cloud:** where the round bursts, a cloud appears and lasts **10 seconds**: full
  strength for 8 s, then thins out over the last 2 s (shrinks and fades) instead of vanishing
  in one frame.
- **Size:** radius ~110 px, about three fighter heights across (a standing fighter is 72 px).
- **Hiding from players:** the cloud is drawn above fighters and is opaque in the middle. A
  fighter inside it is not visible, and neither is anything that would give them away: name,
  health bar, aim line, jetpack flame, carried flag. Same for everyone, offline and online.
- **Hiding from bots — smoke really hides:** a bot cannot see a fighter who is inside a cloud
  or behind one (the line from the bot to them crosses a cloud). A bot standing in smoke still
  sees fighters outside it, as a human does on screen. Seeing is not just about shooting:
  - A bot does not know where a hidden fighter is. It goes to the **spot where it last saw
    them** and searches around it; it does not walk straight to their real position.
  - If they step out of the smoke and come into view, the bot spots them again (with its usual
    reaction delay).
  - CTF: a flag carrier hidden in smoke is chased to where they were last seen, not tracked.
  - Walls keep today's behaviour (bots still head for an enemy behind a wall): only smoke hides
    a position.
- **Shots still pass:** bullets, rockets and beams fly through smoke and hit normally. Smoke
  blocks sight, not damage — firing blind into a cloud is allowed.

## Non-goals

- Bots never pick up or fire the smoke launcher.
- Not part of the Gun Game ladder (it cannot score kills, so a player would be stuck on it).
- No separate grenade key or grenade count outside the weapon system.
- No wind; the cloud does not move with the fighter.

## Builder's calls (decided without the owner, change if wrong)

- Ammo 4, max 8; fire rate 1500 ms; colour grey.
- Your own fighter inside your smoke is drawn as a faint silhouette for you only, so you do not
  lose yourself; to everyone else you are hidden.
- At most 12 clouds on the map at once; a new one beyond that removes the oldest.
- Pickups sit near cover or a flag. Respawn like other weapons (`WEAPON_RESPAWN_TIME`).
- A kill by the 1 HP hit (target already at 1 HP) is credited normally; the body just drops
  (like a machine-gun kill), no gibs.
- One pickup in every pickup layout except Gun Game (Deathmatch on each map, CTF, Hold the
  Flag, Infiltration, Hunger Games).

## Code

- `types.ts`: `WeaponType.SMOKE_LAUNCHER`; `SmokeCloud { id, pos, radius, bornAt, endsAt }`;
  `GameState.smokes?: SmokeCloud[]` (optional: older hosts simply never send it).
- `constants.ts`: `WEAPONS_DATA` entry (damage 1, knockback 0); `SMOKE_DURATION_MS = 10000`,
  `SMOKE_FADE_MS = 2000`, `SMOKE_RADIUS = 110`, `MAX_SMOKES = 12`.
- New `systems/smoke.ts`: spawn a cloud, expire old ones, `smokeRadiusAt(cloud, now)` (shrinks
  during the fade), `insideSmoke(state, point, now)`, `segmentBlockedBySmoke(state, a, b, now)`.
  `physics.ts` only calls into it (the file is already over the size limit).
- `physics.ts`: smoke round uses grenade gravity and fuse; on burst calls the smoke spawn instead
  of `createExplosion`. `combat.ts`: fuse life for the smoke round as for the grenade.
- `botSenses.ts`: `canSee` returns false when the target is inside smoke or the line from the
  bot crosses a cloud the bot itself is not in. `botMemory.ts`: `lastSeenPos` per target,
  updated while visible. `botGoals.ts`: while the target is hidden by smoke, `hunt` and CTF
  `defend` move to `lastSeenPos` (then search/roam nearby) instead of `target.pos`; behind a wall
  unchanged. `botWeapons.ts`: score the smoke launcher so bots never choose it, and skip it in
  `findWeaponPickup`.
- Net: `smokes` added to `Snapshot` / `buildSnapshot` so online clients and the browser host see
  the same clouds. The cloud is gameplay (bots and hiding depend on it), not a cosmetic effect.
- Render: a smoke cloud layer drawn above fighters (soft puffs, gently churning, fading out);
  fighter overlays (name, HP bar, aim line, flame, carried flag) skipped for fighters inside
  smoke; own-fighter silhouette. Grenade-style projectile look in grey; pickup drawing in
  `renderer.ts`; weapon grip; HUD icon `public/assets/hud/smoke_launcher.svg`; label
  `weapon.smokeLauncher` (EN "Smoke Launcher", RU "Дымовой гранатомёт"); `deathKind` case.
- Maps: one pickup per map in `data/level.ts`.
- Release: next 0.4.x patch note ("Smoke launcher: hide yourself or a flag for 10 seconds").
- Tests: burst on wall / fighter / fuse creates one cloud; 1 HP direct hit, no knockback; cloud
  expires after 10 s and shrinks during the last 2 s; cap of 12; bot `canSee` false through and
  inside smoke, true again after it clears, a bot in smoke sees out; a bot heads for the
  last-seen spot, not the hidden fighter's real position (hunt and CTF defend); behind a wall
  unchanged; bots never select or seek the weapon; snapshot carries `smokes`; projectiles pass
  through smoke; existing bot tests and benchmark still pass.
