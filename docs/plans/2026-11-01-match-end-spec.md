# Match End and Victory Screen — Spec

**Date:** 2026-11-01
**Status:** Approved (score or time; results then automatic next match)

## Problem

Deathmatch, Capture the Flag, Hold the Flag and Infiltration never end. Hold the Flag silently
clamps the score at 200 (about 13 minutes of holding); the others count forever. Players get no
moment of victory and no natural point to stop or switch.

## Rules

A match ends when a side reaches the score limit, or when the time limit runs out — whichever
comes first. On time, the side with the higher score wins; equal scores are a draw.

| Mode | Score limit | Counts |
|---|---|---|
| Deathmatch | 20 | kills of one player |
| Capture the Flag | 3 | flag captures of a team |
| Hold the Flag | 60 | team points (1 per 4 s of holding) |
| Infiltration | 3 | team points (extractions / successful defenses) |

Time limit: 10 minutes for all four. Gun Game and Hunger Games keep their own rules.

## Flow

1. Match ends → gameplay freezes (no more scoring), the **results screen** shows: winner
   (team or player) or "Draw", why it ended (score limit / time's up), final score, ranking.
2. After **10 seconds** a new match starts by itself on the same mode and map: scores reset,
   everyone respawns, flags and pickups reset.
3. A **Back to menu** button leaves at any time.

Online, the server (or browser host) runs the same rules and resets the room, so everyone
moves to the next match together. Timestamps are converted to each client's clock.

## HUD

- Match clock (time left) next to the team score; for Deathmatch at the top of the scoreboard.
- "First to N" under the score so the goal is visible.
- Infiltration's own 3-minute defense timer moves into the objective line.

## Implementation notes

- Shared `src/game/systems/matchRound.ts` (like `hungerRound.ts`): limits, `updateMatch`,
  `isMatchOver`, `matchTimeLeft`; called from `updatePhysics`.
- `GameState`: `matchStartedAt`, `matchEndsAt`, `matchWinner`, `matchEndReason` (in snapshots).
- Room: `resetMatch` (shares player reset with `resetHungerRound`). Offline: GameCanvas restarts
  the round as it does for Hunger Games.
