# Spawn Shield — Spec

**Date:** 2026-11-04 · **Status:** approved 2026-11-04, implemented in 0.4.28

## Problem

After a respawn a fighter can be killed on the spawn point before they can react
(spawn-killing). There is no protection right now: `physics.ts` brings the fighter back
with 100 HP and they are hittable from the very first tick.

## Owner decisions (2026-11-04)

| Question | Decision |
|---|---|
| Duration | **2 seconds** after a respawn |
| Shield holder fires | **Firing removes the shield** at once |
| Visual | **Fighter blinks** (semi-transparent, flickering) while shielded |
| Match start / first join | **No shield** — only after a death |

## Behaviour

1. When a dead fighter respawns (any mode with respawn: DM, TDM, CTF, HTF, Gun Game,
   Infiltration), they get a shield until `now + 2000 ms`.
2. While shielded, `applyDamage` ignores the hit completely: no HP/armor loss, no knockback,
   no railgun wound, no damage number.
3. **Exception:** falling out of the map still kills (`amount >= 9999`), same rule as the
   Hunger Games round-start shield — otherwise a fighter could get stuck out of bounds.
4. The shield ends early the moment its holder **fires any weapon** (gun shot, rocket,
   grenade/smoke launcher, railgun, chainsaw swing). Grappling hook, jetpack and movement
   do not count.
5. Picking up items, weapons and flags works as usual.
6. Bots do not waste shots on a shielded target: they hold fire until the shield ends,
   then wait their normal reaction delay (same pattern as the Hunger Games shield).
7. Hunger Games is untouched: there is no mid-round respawn, and the round restart
   (`respawnEveryone`) does not count as "after a death" — that mode already has its own
   3 s round-start shield.
8. The server is authoritative: the shield is decided in the shared simulation
   (`src/game/systems`), so offline, Node server and browser host behave the same.

## Visual

- While shielded, the whole fighter (body, weapon, rope, carried flag) flickers between
  alpha ≈ 0.35 and ≈ 0.85 roughly every 120 ms.
- When the shield ends (time or first shot) the fighter is fully opaque immediately.
- Visible to everyone, including the shielded player themself.

## Technical design

| Area | Change |
|---|---|
| `src/types.ts` | `Entity.spawnShieldUntil?: number` (timestamp; missing = no shield) |
| `src/game/systems/spawnShield.ts` (new) | `SPAWN_SHIELD_MS = 2000`, `spawnShieldLeft(p, now)`, `grantSpawnShield(p, now)`, `dropSpawnShield(p)` |
| `src/game/systems/physics.ts` | respawn branch calls `grantSpawnShield` |
| `src/game/systems/combat.ts` | `applyDamage` returns early when shielded (except `amount >= 9999`); `fireWeapon` (and the chainsaw path) calls `dropSpawnShield` on the shooter |
| `src/game/systems/botAim.ts` | hold fire at a shielded target while the reaction time runs (not tied to the planned end: a target that fires loses its shield and gets an answer soon) |
| `src/game/systems/botSenses.ts` | `pickTarget` prefers a visible enemy that can be hurt over a nearer shielded one |
| `src/game/net/clock.ts` | shift `spawnShieldUntil` to the local clock (so the blink lasts the right time online) |
| `src/game/render/spawnShieldBlink.ts` (new) + `playerVisual.ts` | container alpha flicker while `spawnShieldLeft > 0` |

No protocol change: players are sent whole in snapshots, the new optional field travels
automatically; old hosts simply never set it (= no shield, no blink).

## Tests

- Respawn sets the shield; it expires after 2 s.
- Shielded target takes no damage and no knockback; no wound from a railgun.
- Falling out of the map (`amount >= 9999`) still kills a shielded target.
- Firing drops the shooter's shield; the next hit damages normally.
- First spawn / Hunger Games round restart give no shield.
- Bots do not fire at a shielded target and prefer one that can be hurt.
- Bot benchmark: Deathmatch floor lowered 6 → 4 kills/min (20 seeds: avg 8.4 → 8.0, min 4).
- `toLocalClock` shifts `spawnShieldUntil`.

## Release

- Branch `feature/spawn-shield` (in a worktree), own PR, own 0.4.x version
  (check the newest version on `origin/main` first).
- Patch note (1 point): "Spawn protection: 2 seconds of invulnerability after a respawn —
  ends early if you shoot."

## Out of scope

- Shield on first join / match start.
- Configurable duration in match settings.
- A separate shield sound.
