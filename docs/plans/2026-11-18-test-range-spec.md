# Test Range — Specification

Date: 2026-11-18
Status: draft for the owner's approval
Branch: `feature/test-range` (worktree `~/Documents/void-strike-range`), based on `release/0.5.0`

## Intent

A hidden shooting range inside the real game where the owner checks weapons before a
release: how much damage each weapon does, where hits land on each fighter body (the 0.5.0
hit zones: the Cat's head, crouched and prone bodies), and how crates, glass and barrels
break. It is a testing tool for the owner (and Claude), not a feature for players.

It must run the same code as a real match. Whatever is seen on the range is what players
get: damage, `hitRect()`, cover damage and return, ragdolls, robot sparks and oil, fire,
smoke, explosions.

The next task (smoke clouds with the CFD demo look, option A) will be checked here too.

## Decisions made by the owner

- Audience: only the owner. Not in the menu, no polish for players.
- Character targets: **still dummies** (option 1). No moving bots, no bots shooting back.
- Build approach: **a hidden mode inside the real game** (option 1), not a cheat layer over
  normal matches and not a separate page with its own engine.
- Armour: **yes, as a toggle** (2026-11-18). One key switches all dummies between no armour
  and full armour (100). Default: no armour, so the numbers show a weapon's plain damage.
  With armour the railgun wounds instead of killing (leg torn off, bleeding: the only
  lost-limb path, `shouldWound` / `inflictWound` in `combat.ts`) and `absorbArmor` lowers
  every other weapon's damage.
- Hit zones: **a key (H) toggles an outline of each dummy's `hitRect()`** for its current
  stance (option b). Not chosen: marking the exact point of every hit (it would change the
  bullet, rocket, rail, chainsaw and flame code shared with real matches); a damage number
  alone (a head shot and a body shot look the same).

## Goals

1. Open the range with a hidden link: `#range` on any build (localhost or the live site).
   Leaving it (Esc → menu, or removing the hash) returns to the normal game.
2. A small closed map with every target in plain view from the spawn area:
   - a row of cover: wood crate, metal crate, glass pane, barrel (the four `CoverKind`s)
   - a row of five dummies, one per base: Human, Female human, Robot, Toxic, Cat
3. The local player has all nine weapons from the start (keys 1–9, the existing weapon
   bar shows up to nine slots), unlimited ammo, cannot be hurt or killed, unlimited
   jetpack fuel.
4. Dummies are ordinary fighters with no bot brain: they are placed at their spots, face
   the spawn, hold a machine gun and never fire. They take real damage and die for real
   (ragdoll, limbs, robot oil and sparks, burning). Knockback is real: a hit or a blast moves
   a dummy, and it stays where it lands until it dies or R is pressed. The room is closed, so
   nothing falls out. No pinning: that would need a range exception in the shared movement
   code and would hide knockback from testing. *(Builder's call.)*
5. One key switches the stance of all dummies: standing → crouching → prone → standing.
   Another (K) switches their armour: none ↔ full (100). Reset keeps the current stance and
   armour setting and refills armour to it.
6. Readout:
   - every hit on a dummy shows the existing floating damage number; every hit on a piece of
     cover shows the same kind of number, **on the range only** (normal matches unchanged);
   - above each target: a health bar (and an armour bar on dummies when armour is on) and a
     "last 3 s" damage total. The total is worked out by the range from each target's health
     and armour drop between ticks, so it includes damage the game never shows as a number
     (burning after the flamethrower, bleeding after a railgun wound) without touching the
     shared damage code. *(Builder's call.)*
   - H toggles the `hitRect()` outline of every dummy.
7. Reset key (R): every piece of cover back at full health, every dummy alive at its spot
   in the current stance, fire, smoke, decals, corpses and loose projectiles cleared.
   Dead dummies also come back on their own a few seconds after dying.
8. Nothing from the range counts anywhere: no XP, no achievements, no lifetime stats,
   no leaderboards, no cloud save writes, no match result screen, no ads.
9. A small key legend on screen: 1–9 weapons, the stance key, K armour, H hit zones,
   R reset, Esc exit.

## Non-goals

- Moving or shooting bots; a "live" mode for dummies.
- Online play, guests, the Node server, the browser host. The range is offline only.
- Changing weapon numbers live (sliders for damage, range, rate).
- Phone and touch controls. Desktop keyboard and mouse only.
- Russian text. English only.
- A menu entry, patch note line or player-facing release note. It ships as its own small
  version per the release process with a CHANGELOG entry only and no "What's new" point
  for players. *(Builder's call.)*

## Anti-goals (a failure even if it works)

- Any range rule leaking into normal matches (god mode, infinite ammo, dummies without AI,
  reset, readout) or into online code paths.
- Range kills or damage reaching XP, achievements, stats, leaderboards or the cloud.
- The range taking its own path for damage, hits or cover (then it tests the wrong code).
- `GameCanvas.tsx` (already 1071 lines) growing by much: range logic lives in its own
  small modules; GameCanvas gets only thin hooks.

## Constraints

- Project rules: every file at most 200 lines, one responsibility per file, named exports,
  no silent catches.
- Coordinates: fighters and cover use `pos = (centerX, bottomY)`; platforms are top-left
  `{ x, y, w, h }`.
- Offline player creation lives in `src/components/GameCanvas.tsx` (≈ line 279 local player,
  ≈ 311 bots), not in `roomSetup.ts`.
- Pixi cleanup rules: `Graphics.destroy({ children: true, context: true })`, never
  `app.destroy(true)`.
- The physics tick is fixed at 120 per second; the range adds no per-frame work to normal
  matches.
- Built on `release/0.5.0` because the dummies must use the 0.5.0 bodies and hit zones.
  After 0.5.0 merges, `main` is merged in and the PR targets `main`.
- Tests with Vitest next to the code, as in the rest of the project.

## Approaches considered

1. **Hidden mode inside the real game (chosen).** `#range` starts an offline match with its
   own mode and map; dummies are fighters with the bot brain switched off. Same code as a
   real match. Cost: careful hooks into GameCanvas and mode checks, and a guard so nothing
   counts.
2. **Cheats over a normal match.** Spawn crates or dummies under the cursor on any map,
   god mode, infinite ammo. Tests real maps, but live bots get in the way, more UI is
   needed and the risk of counting stats is higher. Not chosen.
3. **Separate page with its own mini engine** (like `character-rig.html`). Rejected: it would
   not run the real game code, so it would test something players never get.

## Proposed shape (builder may refine)

- A new `GameMode.RANGE` and `MapId.RANGE`, never listed in the mode menu, map picker,
  tournament or online code.
- `src/game/range/` holds the range: the map (platforms, cover layout, dummy spots,
  spawn), dummy creation, rules (god mode, ammo, fuel), stance switching, reset, and the
  "does this count" guard. Each in its own small file with tests.
- `src/App.tsx` routes `#range` the way it routes `#ads-admin`.
- GameCanvas calls into the range module at setup, at each tick and on keys only when the
  mode is `RANGE`.
- Readout: the `DAMAGE` event already exists for fighters; cover hits get the same kind of
  event. Health bars above targets are drawn only on the range.

## Left to the builder

- Exact room size and positions, as long as every target is visible from the spawn
  without scrolling at 1512×700 and the targets stand at two or three distances.
- Whether dummies are `type: 'bot'` with a flag or a new entity type (pick whichever
  touches fewer code paths and keeps bots unchanged).
- The stance key (suggestion: C) and the dummy return delay (suggestion: 3 s). K (armour),
  H (hit zones) and R (reset) are fixed above; if one clashes with an existing game key,
  pick a free one and update the legend.
- How the "nothing counts" guard is enforced (suggestion: one check at the points where
  stats, XP, achievements and cloud saves are written, plus a test for each).
