# Fighter Builder — Parts, Unlocks by Level, New Setup Screen

**Date:** 2026-11-02
**Status:** Approved in brainstorming (mockups in `.superpowers/brainstorm/`, not committed)
**Builds on:** `2026-11-02-visual-polish-spec.md` (current fighter look), `ui-hazard-bay` design (setup screen style)

## Why

Players can pick 1 of 11 skins and recolour 5 body parts. Shapes are shared: every beast has the same ears,
every beast and alien has the same short straight tail stick, which looks weak (the product owner's trigger:
"our cat has a so-so tail"). We want real self-expression and a reason to keep playing: players build a fighter
from parts, and new parts open as they level up.

## Goals

1. A player builds a fighter from scratch: any part combines with any other (cat ears on a robot box is fine).
2. Each part looks good and alive: tails bend and react to running, jumping and jetpack flight.
3. Parts open one by one as the player levels up; what's locked is visible, with the level that opens it.
4. Online, everyone sees everyone's build. Ragdoll pieces keep the parts.

## Non-goals

- Accessories (scarf, cape, stickers, bandolier, flag): shown in mockups, rejected.
- Purchases, accounts, server-side progress, anti-cheat. Progress lives in the browser; editing it by hand is accepted.
  Purchases come later as a separate project after accounts.
- Changes to physics, hitbox sizes or gameplay.

## Anti-goals (a failure even if it works)

- A player who returns after the update loses a look they already had.
- Parts that look pasted on, break the outlined "Hazard Bay" cartoon style, or flicker/jump between frames.
- A setup screen where new players can't tell what's locked and why.

## Parts

All names below are player-facing (RU/EN through i18n). "Free" means open from the start.

| Slot | Options (free in bold) | Notes |
|---|---|---|
| Helmet shape | **round**, **robot box**, glass dome, angular | Box keeps today's short antenna as part of its shape. Dome: transparent bubble on a collar, a simple cartoon face inside, face colour follows the head colour. Angular: faceted trooper helmet. |
| Visor shape | **strip** (today), full glass, slit, T-shape, two eyes | Visor glow colour is its own colour pick (free). Each visor adapts to the helmet: on the robot box the strip is today's solid glowing panel, on the round helmet today's dark glass with a glow line. |
| Ears / horns / antennae | **none**, **cat** (today's beast ears), **two antennae** (today's alien), wolf, bunny, round, little horns, ram horns, lamp antenna, crest | Bunny ears flop when running and jumping. Lamp antenna blinks when firing. Any option works on any helmet shape. |
| Tail | **none**, **cat**, **tentacle**, lizard, mechanical | Today's straight stick is removed. Cat: long S-curve, tip up. Tentacle: thin, wavy, glowing tip, idles with a slow wriggle. Lizard: tapering, spikes on top, whips side to side. Mechanical: chain of metal links with a light at the tip. |
| Jetpack body | **today's pack**, twin tanks, rocket, wings, scrap | Twin tanks and scrap have two flames. Wings fold on the ground and open in flight. Body colour stays the jetpack colour pick. |
| Flame colour | **fire** (today), blue, toxic green, purple, white | |
| Torso pattern | **none**, **chest band** (today's robot band), racing stripes, hazard band, camo, split | Pattern colour is its own colour pick (free). |
| Shoulder badge | **none**, chevron, number, emblem | On the front shoulder pad, because the front arm covers the chest in side view. Uses the pattern colour. Number: player types 0–99. Emblem: one unlock gives three symbols (skull, star, lightning). |

Colours stay as today (torso, head, arms, legs, jetpack), plus visor glow and pattern colour. All colours are free.

## Presets (the former skins)

The 11 skins become **presets**: a ready build (parts + palette) to start from. Picking a preset replaces the
whole build; after that every part can be changed. Presets use only free parts.

| Today's style | Preset parts |
|---|---|
| human (Marine, Red Baron, Golden God, Noir) | round, strip, no ears, no tail |
| robot (Cyborg-01, Sentinel Bot) | robot box, strip, no ears, no tail, chest band |
| beast (Cyber Wolf, Sky Raptor) | round, strip, cat ears, cat tail |
| beast (Hammy) | round, strip, cat ears, no tail |
| alien (Toxic, Junkyard Hopper) | round, strip, two antennae, tentacle tail |

Today's accent colour per skin becomes the preset's visor glow and pattern colour. All presets: today's jetpack,
fire flame, no badge, and no pattern except the robot chest band.

**Migration:** a returning player's saved skin and colours turn into the matching preset build on first load,
so nobody loses their look.

## Levels and unlocks

- XP sources:
  - finishing a match while still in it: **20**. A match ends when the results screen shows, a Hunger Games round ends,
    or a Gun Game winner is declared;
  - winning it (first place in free-for-all, on the winning team, last one standing, the Gun Game winner): **+30**;
  Matches vs bots count. Leaving early gives nothing.
  Achievements give **no** XP for levels: they stay as they are today (their own XP and titles) and open no parts.
  Decided by the product owner, so returning players don't start with most parts already open.
- Level = 1 + floor(total XP / 50). Total XP is the match XP saved in the browser.
- Item number *k* in the order below opens at level *k* + 1. 30 items, so everything is open at level 31,
  i.e. 1,500 XP: about 50 matches for a player who wins one in three (30 matches always winning, 75 never winning).
- Each unlock record carries an "unlocked by" field (today always `level`) so a later `purchase` source fits without rework.

Unlock order (mixes categories on purpose):

1 wolf ears · 2 full-glass visor · 3 lizard tail · 4 blue flame · 5 racing stripes · 6 twin tanks · 7 little horns ·
8 slit visor · 9 glass dome · 10 hazard band · 11 green flame · 12 bunny ears · 13 rocket · 14 chevron ·
15 T visor · 16 camo · 17 round ears · 18 purple flame · 19 mechanical tail · 20 angular helmet · 21 wings ·
22 number · 23 ram horns · 24 two-eyes visor · 25 split · 26 lamp antenna · 27 white flame · 28 scrap jetpack ·
29 emblem · 30 crest

**After a match:** whichever end screen the mode uses (results screen, Hunger Games round end, Gun Game winner overlay)
shows XP gained and, if a level was reached, which part opened.

**Online:** XP is worked out on the player's own client from the match result, the same way as offline.

## Setup screen (mockup option A, "tabs with tiles")

- Left, as today: fighter preview, preset arrows under it (preset name, "(changed)" once edited),
  and an XP bar ("Level 6 · 60 XP to the next part").
- Right: name field, then tabs **Head** (helmet, visor, ears, visor glow), **Body** (tail, pattern, badge),
  **Jetpack** (body, flame), **Colours** (the colour rows of today plus pattern colour).
- Each option is a tile with a small picture. The chosen tile has a hazard-yellow border. Locked tiles are dimmed
  with a lock and "Lvl N" and cannot be picked.
- Start / Back buttons as today. Hazard Bay tokens, fonts and Cyrillic fallback as today.

## Online and ragdolls

- The join request carries the build (part ids, badge number, the new colours) instead of deriving looks from
  `skinId`. The host validates every id against the known lists and falls back to the free default for anything unknown.
  The host does **not** check unlocks (progress is client-side by design).
- Every client draws other players with their build.
- Ragdoll head shows helmet, visor and ears; ragdoll torso shows pattern and badge. Tail and jetpack are not part of
  the ragdoll today and stay that way.

## Constraints

- Files stay under 200 lines, one responsibility each (the head, tail, jetpack and pattern drawing will need their own modules).
- Rig-space drawing, outline style and `RIG_SCALE` as in the current fighter code. Helmet shapes must keep the
  existing "stays inside the hitbox" test passing; ears, horns, antennae and tails stay outside that check as today.
- Graphics destroy calls keep `context: true` (known Pixi leak).
- RU and EN strings for every new label.

## Calls made by Claude during brainstorming (the product owner should check these)

- (Context: the product owner approved every part listed above and rejected accessories, the puff tail and the bushy tail.)
- The Hammy preset has no tail (the product owner rejected the puff tail).
- The tentacle tail is free so alien presets keep a tail; this leaves 30 unlockable items, not 31.
- Badges live on the shoulder pad, share the pattern colour.
- Today's robot chest band becomes a free pattern so robot presets keep their look.
- Visors adapt to the helmet shape (the robot strip stays a solid glowing panel).
- Gun Game and Hunger Games ends give XP like any other match.
- Dome face colour follows head colour.
- A level takes 50 XP, not the 100 first proposed: without achievement XP, 100 would stretch the full set to ~100 matches
  instead of the agreed ~50–60.
- Exact XP numbers and unlock order above are a first pass, meant to be tuned.

## Left to the builder

- Data model and module layout, how the build travels in snapshots, storage keys and migration code.
- How tails and floppy parts animate (lagging segments, spring, etc.), as long as they react to running, jumping,
  flying and look stable.
- Tile pictures (live mini renders or static drawings).
- Build order. Suggested: data model + presets + migration → helmet/visor/ears → tails → jetpack/flame →
  pattern/badge → XP and unlocks → setup screen → results screen → online.
