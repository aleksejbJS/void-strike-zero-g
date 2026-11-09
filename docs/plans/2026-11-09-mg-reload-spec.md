# Machine Gun Magazine & Reload — Spec

Date: 2026-11-09 · Status: draft, waiting for owner approval

## Goal
The Machine Gun stops being an endless hose: it fires a 50-round magazine, then
reloads for about 1 second with a visible animation. It stays the basic weapon
that never runs out — only the magazine is limited.

## Owner decisions
- Magazine: 50 rounds. Reserve: unlimited.
- Reload time: 1.0 s. No firing while reloading.
- Reload starts **automatically only** (when the magazine is empty). No R key, no mobile button.
- Animation: the gun dips and tilts down, the empty magazine flies out and falls,
  the gun comes back up. Plus the existing reload sound and a HUD progress bar.
- Only the Machine Gun gets a magazine. Other weapons keep working as now (ammo from pickups).
- Bots reload by the same rules (no unfair advantage).

## Player-facing behaviour
1. A full magazine is 50 shots. At 10 shots/s that is ~5 s of continuous fire.
2. The shot that empties the magazine starts the reload. For 1 s the trigger does nothing.
3. After 1 s the magazine is full again (50).
4. Switching to another weapon does not cancel the reload: the Machine Gun finishes
   reloading in the background, so you can switch to a shotgun and come back to a full magazine.
5. Ammo pickups do not touch the Machine Gun (its reserve is unlimited anyway; reloading
   is the only way to refill the magazine).
6. Respawn gives a fresh, full Machine Gun (as today).
7. Gun Game (Machine Gun is the first ladder step) uses the same reload.

### HUD
- Desktop ammo box: `37 / 50` instead of `∞`.
- While reloading: the number is replaced by a "RELOADING" / "ПЕРЕЗАРЯДКА" label and a
  bar that fills over 1 s.
- Mobile weapon buttons: show the magazine count; the Machine Gun slot shows the same
  filling bar while reloading.

### Fighter animation (seen by everyone, online too)
- 0–25 %: the gun dips and tilts down (~35°), arms follow.
- ~15 %: the empty magazine drops out of the gun as a small falling piece (bounces/fades like shell casings).
- 25–75 %: hold low.
- 75–100 %: the gun comes back up to the aim.
- Recoil and muzzle flash are not shown during reload (no shots anyway).
- Reload sound plays for the local player when the reload starts.

## Technical design (short)
- `Weapon` gets an optional `reloadMs` (Machine Gun: 1000) and an optional
  `reloadEndsAt` timestamp. A weapon with `reloadMs` is "magazine-fed": `maxAmmo` = magazine size (50),
  reserve is unlimited.
- New module `src/game/systems/reload.ts` (pure, tested):
  - `canFire(weapon, now)` — false while reloading.
  - `tickReloads(entity, now)` — for every magazine-fed weapon in the inventory: empty and not
    reloading → start (`reloadEndsAt = now + reloadMs`); time is up → refill to `maxAmmo`, clear.
  - `reloadProgress(weapon, now)` — 0..1 for HUD and animation.
- `fireWeapon` (combat.ts) refuses to fire while reloading; physics.ts calls `tickReloads` for
  every fighter each tick (players and bots — so bots reload too).
- Ammo pickup in physics.ts skips magazine-fed weapons.
- Bot weapon choice (botWeapons.ts) already ignores weapons with 0 ammo, so a reloading
  Machine Gun is skipped until it is full again.
- Online: weapons travel in the snapshot already, so `reloadEndsAt` arrives automatically.
  `toLocalClock` (net/clock.ts) shifts it to the client's clock like `spawnShieldUntil`, so the
  bar and animation run at the right time on every machine.
- Animation: `FighterAnimator` reads `reloadProgress` and passes it to `solvePose` (gun angle and
  hand offset); it detects a new `reloadEndsAt` (like it detects a new `lastFired`) and spawns the
  falling magazine cosmetic. Cosmetics stay on the render side, the simulation does not draw.
- HUD: `setStats` also passes reload progress; `AmmoPanel` and mobile weapon slots render it.
  New i18n key `hud.reloading` (EN/RU).
- Version bump to the next 0.4.x, patch note in EN/RU.

## Tests
- 50 shots fire, the 51st does not; after 1000 ms the magazine is 50 again.
- No shots while reloading even if the fire rate allows.
- Background reload: switch away while empty → the Machine Gun is full after 1 s.
- Ammo pickup does not change the Machine Gun magazine.
- Bots: a bot's Machine Gun reloads; the bot does not fire while reloading.
- `toLocalClock` shifts `reloadEndsAt` for the active weapon and the inventory.
- `reloadProgress` and the pose: gun angle is lowest mid-reload and back to normal at 0 and 1.
- HUD: shows `37 / 50`, and the reloading label + bar.

## Out of scope
- Manual reload (R key / mobile button).
- Magazines for other weapons.
- New art for the magazine (drawn as a simple shape; can be swapped for an image later).
