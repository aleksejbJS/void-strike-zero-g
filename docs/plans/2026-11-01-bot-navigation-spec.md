# Bot Navigation — Spec (phase B)

Status: implemented · 2026-11-01

## Problem

After the phase A fixes, bots fight when they meet, but they still steer like this:
walk left/right towards the goal's x, jetpack if the goal is more than 80 px higher,
fall if it is lower. They do not know how the level is built. As a result:

- An enemy on another floor, or behind a wall, keeps a bot running into the wall or
  standing above/below the enemy. In a one-minute Deathmatch simulation with 3 bots,
  kills range from 1 to 12 depending only on where they spawned.
- CTF bots rarely bring a flag home (0 captures per simulated minute with 6 bots).
- Roaming uses hand-placed waypoints for the default Deathmatch map only; on the
  Tunnels map bots roam towards points of a different map.
- The CTF bases are hard-coded in the bot code instead of read from the level.

## Goal

Bots get from any place to any reachable place on every map, using the same
controls as a player (walk, fall, jetpack). Mode logic (what to go for) stays as it
is in `botGoals.ts`; this phase changes only *how they get there* and how they move
in a fight.

Bots also learn the grapple hook (approved 2026-11-01), as players use it: to
reach ledges the jetpack cannot, to cross gaps without fuel, and to swing out of a
fight.

Not in this phase: difficulty levels (phase C), team tactics.

## Design

### 1. Navigation graph (built once per map)

Built automatically from `getPlatforms(mode, map)`, no hand-placed points.

- **Node** = a standable surface: the top of a platform, split into pieces wherever
  another platform blocks it (a wall standing on a floor makes two surfaces).
- **Edges**, each with a cost in seconds:
  - `walk` — between overlapping/adjacent surfaces at the same height.
  - `drop` — off an edge onto a surface below, if the fall lands on it.
  - `jet` — up to a surface above, if the height is within the jetpack's reach on a
    full tank (measured from the real physics, not guessed), with a clear path.
  - `hook` — to a surface that a grapple shot can reach: the bot fires the hook at an
    anchor point (a platform underside or edge within hook range and in sight),
    reels in, then releases above the landing surface. Costs no fuel, so it is also
    the fallback when the tank is low.

The graph is cached by map, so the server, the browser host and offline play build
it once.

### 2. Path search

A* over the graph from the bot's surface to the goal's surface. The bot plans again
every 0.5 s or when the goal moves to another surface. If the goal cannot be
reached, the bot goes to the nearest reachable point instead of freezing.

### 3. Following a path

Each edge type turns into player controls:

- `walk` — hold left/right.
- `drop` — walk off the edge, no jetpack until below the start surface.
- `jet` — walk to the take-off point, then jetpack with side thrust towards the
  landing point. If fuel is too low, take a `hook` edge instead or wait to recharge.
- `hook` — aim at the edge's anchor, fire, hold "reel in" until above the landing
  surface, release. If the hook misses or the rope is cut, re-plan.

The progress check from phase A stays as a last resort: a bot that makes no progress
on an edge marks it as blocked for a few seconds and plans around it.

### 4. Movement in a fight

- Strafe: short random left/right bursts while shooting, instead of standing still.
- Dodge: a short jetpack hop after taking damage (with a cooldown).
- Escape: when low on health and an anchor is in reach, swing away on the hook.
- Keep the preferred range for the weapon by moving along the graph, not straight
  away from the enemy (which ran bots into walls or off ledges).

### 5. Cleanups

- Roaming picks random surfaces from the graph, so it works on every map.
- CTF bases come from the level data (`baseFlagPos`).

## Files

| File | Responsibility |
|---|---|
| `src/game/systems/botNavGraph.ts` | build and cache the graph for a map |
| `src/game/systems/botPathfinder.ts` | route search (Dijkstra, counts running along surfaces), nearest reachable surface |
| `src/game/systems/botRoute.ts` | keep the route current: re-plan, advance, block failing edges |
| `src/game/systems/botSteering.ts` | turn the next edge into controls |
| `src/game/systems/botClimb.ts` | jetpack climb onto a surface (jet edges, hook finish) |
| `src/game/systems/botHook.ts` | fire/reel/release the hook (anchors are found in the graph) |
| `src/game/systems/botCombatMoves.ts` | strafe, dodge and hook escape |
| `src/game/systems/botRoam.ts` | roam between random reachable surfaces |
| `src/game/systems/botNavState.ts` | route and fight-move memory, bot controls |
| `src/game/systems/bot.ts` | uses the above instead of direct steering |
| `src/game/render/botPathOverlay.ts` | F3: draw each bot's route |
| `src/test/botBench.ts` | bots-only match on a simulated clock |

Each file stays under 200 lines.

## Testing

- Unit tests on small made-up maps: stairs, a wall on a floor, a pit, a ledge too
  high for the jetpack (reachable only with the hook).
- A bot benchmark test that runs bots-only matches with a simulated clock (the same
  probe used for phase A, kept in the repo). Acceptance targets:
  - Deathmatch, 3 bots, 60 s: at least 6 kills in each of 5 runs (now 1–12).
  - CTF, 6 bots, 3 min: at least one capture.
  - Any mode: no living bot stays in one place for more than 10 s while an enemy is
    alive.
- F3 debug overlay draws each bot's current path, for tuning by eye.

## Decisions

1. Grapple hook: yes, bots use it (2026-11-01).

## Results (bots-only matches, `botBenchmark.test.ts`)

| Run | Before | After |
|---|---|---|
| Deathmatch, 3 bots, 60 s, 5 seeds — kills | 3, 6, 8, 8, 9 | 6, 6, 9, 10, 12 |
| Same — longest a living bot stood still | 11–45 s | ≤ 1.4 s |
| Tunnels, 60 s — kills / longest still | 0 / 58 s | 6 / 1.4 s |
| Hunger Games, 60 s — kills / longest still | 4 / 57 s | 7 / 6.3 s |
| CTF, 6 bots, 3 min — captures | 0 | 1 in 6 runs; 1–3 flag pickups per run |

The CTF capture target is not met: carriers reach the enemy flag and run for home, but
defenders respawn on their own flag 3 s after dying (`getSpawnPoint`), so a carrier
seldom survives the 2,700 px trip. The test checks what the bots control (they reach and
take the flag, nobody stands still); the spawn rule is a game design question.

Also found: Tunnels places two weapons and the armor inside the solid central block
(`level.ts` pickups at y 350/550), where nobody can collect them. Bots now skip them.

## Open questions

1. Should phase C (difficulty levels) follow right after, or wait for feedback on B?
2. CTF spawns: move each team's respawn away from its own flag (e.g. to the base floor behind it), so carriers have a chance?
3. Tunnels: make the "tunnel through the centre" hollow, or move the three items out of the block?
