# Free-for-All Bot Looks Spec

Status: approved 2026-11-03 (option C)

## Problem

In Deathmatch, Gun Game and Hunger Games every bot is the same blue "Marine" with the
default build (`createBots` in `src/game/net/roomSetup.ts` colours a team-less bot like a
blue one). With no teams there is no reason for identical fighters, and you cannot tell
who is who in a fight.

## Decision

Option C, "preset + a little random" (chosen over A "presets only" and B "fully random"):

- Each bot in a free-for-all mode wears a different skin preset (colours, helmet, ears,
  tail from `presetBuild`). Skins are shuffled per room and do not repeat until all 11
  are used (Hunger Games has up to 8 fighters, so in practice no repeats).
- On top of the preset, four slots are random: flame, torso pattern, shoulder badge
  (with a random badge number and emblem). Any part may appear, locked or not: bots
  show players what can be unlocked.
- Pattern colour and visor colour stay the preset's, so colours always match.

## Non-goals

- Team modes (CTF, Hold the Flag, Infiltration): bots stay red/blue.
- Bot names stay "Bot N".
- Menu mode previews keep their own red/blue/green actors.
- No protocol change: `build` is already part of every player in the snapshot.

## Code

- `src/game/build/botLooks.ts` — pure `ffaBotLooks(count, rng)`: colours, skin and build per bot.
- `createBots` uses it for team-less bots.
- Tests: distinct skins, wrap-around past 11, every build survives `sanitizeBuild` unchanged,
  team-mode bots unchanged.
