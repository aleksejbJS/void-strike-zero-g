# Mobile HUD and Twin-Stick Controls Spec

Status: approved 2026-11-03 (mockup D on https://claude.ai/artifact/6dC3eBiaRZAk4ZtoETJ7Lm)

## Problem

On a phone in landscape (~640 × 290 CSS px) the in-game HUD is unusable: every piece is sized
in fixed desktop pixels (scoreboard 260 px, vitals 360 px, six 96 px weapon slots, 64 px ammo
digits), so they overlap each other and the game. The jetpack and hook buttons sit 230 px above
the bottom and leave the screen. Weapons can only be switched with keys 1–6, and aiming means
putting a finger on the target, which hides it.

## Decision

Mockup D ("slim top bar + twin sticks"), chosen after round 1 (A/B/C) was rejected as too big.
Only touch devices (`detectMobile()`) get it; the desktop HUD does not change.

**Top bar** (28 px, see-through dark band, thin hazard edge under it):
- left: health icon + number + bar, armor icon + number + bar, fuel icon + bar (12 px icons);
- centre: free-for-all → match clock + your place ("3RD / 4 · 2 kills"); team modes → blue : red
  score + clock; the objective line ("Take the red flag") sits small under the bar;
- right: sound and achievements buttons (14 px icons).
- Kill feed under the bar on the right, small text, no panels.

**Controls:**
- Left half of the screen: floating move stick (appears where the thumb lands). Up = jump /
  jetpack (as today's `KeyW`), left/right = run, down = crouch.
- Right half: floating aim stick. The fighter aims where the stick points; while the stick is
  pushed past a dead zone the weapon fires (twin-stick). Letting go stops firing and keeps the
  last aim. A dashed aim line runs from the fighter towards the aim point while aiming.
- Hook: a small round button left of the aim stick; the hook flies where the fighter aims.
- The old jetpack button is gone (the move stick does it).

**Weapons:** a small row above the aim stick with only the weapons you carry; tap one to
switch. The selected one has a yellow frame and its ammo (∞ for unlimited).

**Other HUD pieces on phones** (short screens, `max-height: 500px`): the mode panels (Hunger
Games, Gun Game), flag banner, death screen, match results and achievements shrink and move
below the top bar so nothing overlaps it.

**Hint:** "Left stick: move, up to fly · Right stick: aim and fire · Tap a weapon to switch",
shown for 6 s at the start of a match, only in the first 3 matches on this device.

## Non-goals

- No change to desktop HUD, keyboard or mouse.
- No portrait layout (the game is played in landscape).
- No gameplay change: the stick only produces the same inputs (keys, aim point, fire, hook)
  that the keyboard and mouse produce, so online play and the host need no change.

## Code

- `src/game/input/sticks.ts` (pure): stick deflection, move keys from the left stick, aim point
  from the right stick, fire threshold. Unit-tested.
- `src/game/input/touchSticks.ts`: touch listeners on the canvas (moved out of `GameCanvas`).
- `src/game/render/viewport.ts`: `worldToScreen` (inverse of `screenToWorld`).
- `src/components/hud/mobile/`: `MobileHud`, `MobileTopBar`, `MobileWeapons`, `TouchSticks`,
  `TouchHint`. `GameHud` renders `MobileHud` instead of the desktop pieces when `mobile` is set.
- Weapon switching shared by keys 1–6 and the touch row (`selectWeapon(index)`).
- Tests: stick maths, mobile HUD render (top bar values, weapon tap, team score), desktop HUD
  unchanged.
