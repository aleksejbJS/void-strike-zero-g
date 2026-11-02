# Flags — "Station Standard" Look Spec

Status: implemented 2026-11-02 (approved the same day)

## Problem

Flags look cheap in two different ways:

- **On the ground** (CTF bases, the Hold the Flag flag) they are 1152 × 896 PNGs shrunk ~7×
  to 170 px with no mipmaps: jagged edges that shimmer while the pickup bobs; lots of
  transparent padding makes the flag itself small; the neutral flag is a grey PNG tinted
  amber and looks muddy.
- **On a carrier's back** (`render/carriedFlag.ts`) it is a white stick and a flat
  four-point polygon that bobs up and down. It shares nothing with the ground art.

Decided 2026-11-02 from the animated mockup (https://claude.ai/artifact/51zDEPJR5nLXZKiwL2DEDN):
**option A, "Station Standard"**, all flags drawn by code (the user chose "C" in the
first round: replace the pictures too, not only the carried flag).

## Goals

1. One flag design everywhere: at a base, dropped, and carried.
2. The cloth reads as cloth: segmented, shaded folds, a wave that travels to the free end;
   carried, it trails against the carrier's motion and hangs when the carrier stops.
3. Team colour is the first thing you read, at game scale, on every map theme.
4. Identical offline and online: drawn only from `state.pickups` and players' `hasFlag`,
   `pos`, `vel`, which snapshots already carry.
5. No measurable frame-time cost (at most 4 flags on screen in any mode).

## Non-goals

- No gameplay change: pickup hitbox (80 × 100 above `pos`), flag positions, capture,
  drop and return rules, scoring, bots, network protocol stay as they are.
- **No return timer.** The mockup showed a countdown ring on a dropped flag; the game has
  no timer (a CTF flag returns to base instantly when its carrier dies; a dropped Hold the
  Flag flag stays until picked up), so the dropped flag gets a plain pulsing ring.
- The Infiltration intel pickup on the ground is not changed.
- HUD and menu flag icons (mode previews, objective HUD) are not changed.

## Anti-goals (would make this a failure even if it "works")

- A ground flag drawn in front of a fighter standing at the base (flags stay below
  fighters in draw order, as pickups are today).
- A plinth or pole floating above, or sunk into, the platform it stands on.
- Glow that hides the carrier: the carrier halo stays ≤ 36 px radius, alpha ≤ 0.3.
- Per-frame allocations growing with time, or a leaked `GraphicsContext`
  (`destroy({ children: true, context: true })` everywhere — see the 0.4.1 pool fix).

## Design

Sizes are world px at game scale; angles in radians; `t` in seconds.

### 1. Palette

| Flag | main | dark (folds) | light (highlights, emblem, crystal) |
|---|---|---|---|
| Blue | `#3b82f6` | `#1e3a8a` | `#93c5fd` |
| Red | `#ef4444` | `#7f1d1d` | `#fca5a5` |
| Neutral (Hold the Flag, on the ground and carried) | `#f59e0b` | `#92400e` | `#fde68a` |
| Intel (carried in Infiltration) | `#facc15` | `#854d0e` | `#fef08a` |

Today a carried Hold the Flag flag is orange `#f97316` while the same flag on the ground
is amber: both become the neutral amber. The carried colour is picked by game mode: today
any blue fighter carrying a red flag gets intel yellow, including in CTF (bug, fixed here).

### 2. Parts

- **Pole**: steel bar 6 px wide with a light centre stripe (left/right dark), brass collars
  (`#b8893a`) at the foot and where the cloth's top is pinned; on top a diamond crystal
  10 × 16 px in the light colour with a baked glow (r 14, main colour, blend `add`).
- **Cloth**: 88 × 54 px, 14 segments, "swallowtail" cut 16 px deep at the free end.
  Shape: travelling wave `amp · u · sin(ω t − k u)` with `u` = 0 at the pole, 1 at the end
  (amp 7, k 5, ω 3.2), bottom edge offset by a smaller wave, slight sag `6 u²`. Each
  segment is filled with main mixed toward dark (slope down) or light (slope up) by the
  wave's slope, so folds read as light and shadow. Thin dark outline (black, alpha 0.5).
- **Hem**: the first segment at the pole is dark (dark mixed 40 % toward `#0b0d10`) with
  two light rivets — the strap that holds the cloth.
- **Emblem**: two chevrons (`>>`) pointing to the free end, in the light colour, at the
  middle of the cloth, following the cloth's local tilt.
- **Plinth** (team flags at their base only): trapezoid 92 px wide at the floor, 72 at the
  top, 20 tall, steel gradient; a hazard-tape band (yellow/black, the platforms' tape)
  across it; a light strip on top in the team colour, pulsing; a floor glow (baked glow
  sprite squashed to 140 × 28, alpha ≈ 0.4, pulsing ±20 % at ~0.5 Hz).

### 3. Placement on the ground

Pickup `pos` is not the floor: CTF bases sit 30 px above their platform, the Hold the Flag
spot 10 px above its pedestal, a dropped flag exactly on the carrier's feet. So the view
snaps the flag's foot to the **top of the nearest platform whose top is within
[pos.y − 4, pos.y + 40] and which spans pos.x**; no such platform → mid-air.

| Situation | How it is told apart | Look |
|---|---|---|
| Team flag at its base (CTF) | `team` is BLUE/RED (they are only ever active at their base) | plinth + upright pole 136 px + full cloth; wind angle `0.20 + 0.06 sin(0.7 t)` |
| Neutral flag at its spot (Hold the Flag) | within 4 px of `HTF_FLAG_POS` | no plinth (the map's pedestal is its base), upright pole 120 px, cloth × 0.9 |
| Neutral flag dropped or thrown | anywhere else, on a surface | pole planted at a lean of 0.38 to the left or right (picked from the pickup id, stable), length 104, cloth × 0.8, hanging (angle 0.75, amp × 0.55); a pulsing ring on the floor (ellipse 84 × 16, light colour) so it is easy to spot |
| Any flag in mid-air | no surface found | upright pole 104, cloth × 0.8, bobbing ±4 px |

Ground flags no longer use the shared pickup float animation or the round pickup halo.

### 4. Carried

Same pole/cloth/emblem, scaled for the back: pole 60 px from today's back point
(`upperPoint(pose, -9, -16)`), cloth × 0.5, no plinth.

- `s` = carrier speed / top run speed, clamped to 0..1, from `vel` (both axes). `vel` is in
  Matter units (px per 60 Hz frame), so a full run is about 4.
- Cloth direction blends from **hanging** (1.15 below the horizontal, behind the back) at
  `s = 0` to **straight against the velocity** at `s = 1` — so it streams behind when
  running and downward when flying up on the jetpack.
- Wave grows with speed: amp × (0.5 + 0.8 s), ω × (0.9 + 1.4 s).
- Pole leans back by 0.12 + 0.28 s.
- Carrier halo: one baked glow sprite r 36, main colour, alpha 0.25 pulsing ±10 %
  (replaces today's two drawn circles of r 45/35).
- Hold the Flag carriers keep their fire; it is drawn around the crystal instead of at a
  fixed point.

### 5. Code

New folder `src/game/render/flag/` (each file ≤ 200 lines, named exports):

| File | Job |
|---|---|
| `flagPalette.ts` | the colour table above; `flagPaletteFor(pickup)` / `carriedPaletteFor(entity)` |
| `flagCloth.ts` | pure geometry: cloth points, swallowtail point, per-segment shade for a time and a wind setting |
| `flagPaint.ts` | draws pole, cloth, hem, emblem into a `Graphics` |
| `flagStand.ts` | plinth + floor glow, dropped ring |
| `flagPlacement.ts` | pure: surface snap and the situation table (§3) |
| `groundFlagView.ts` | create/update/destroy the container for a FLAG pickup |
| `carriedWind.ts` | pure: speed → cloth angle, wave multipliers, pole lean (§4) |

Changed:

- `render/carriedFlag.ts` — rewritten on top of the shared parts.
- `systems/renderer.ts` — FLAG pickups are handed to `groundFlagView`; every FLAG branch
  in `createPickupVisual` / `updatePickupVisual` and the FLAG entry of
  `PICKUP_DISPLAY_SIZE` are removed (renderer only calls, never grows).
- `systems/assets.ts`, `components/GameCanvas.tsx` — stop loading flag textures
  (`flag_base`, `flag_blue`, `flag_red`, the SVG fallback, the "upgrade to texture" branch).
- `public/assets/items/flag_*.png` — deleted (kept in git history).

Glows use the existing baked `glowTexture()` (`render/effects/glowTextures.ts`); the static
parts (pole, plinth) are built once per flag and only the cloth `Graphics` is redrawn each
frame.

### 6. Tests

- `flagCloth`: the pole edge never moves; the free end moves by about `amp`; shade stays in
  −1..1; the swallowtail point lies between the free end's corners.
- `flagPlacement`: CTF base (+30 px), Hold the Flag spot (+10), dropped (0), no platform →
  mid-air; neutral at/away from its spot; lean side is stable for an id.
- `carriedWind`: standing still → hanging; running right → cloth to the left; flying up →
  cloth downward.

### 7. Done when

- Unit tests and type check pass.
- In the running game: screenshots of a CTF base (blue and red), the Hold the Flag spot,
  a dropped neutral flag, a CTF carrier and a Hold the Flag carrier, compared with the
  mockup; the F3 overlay still shows ~120 ticks/s.
- Online: a second client sees the same flags (local host session).

## Delivery

Own branch `feature/flag-look` from `main` (independent of `feature/fighter-builder`, which
touches no flag file), own PR, then version 0.4.x with a short patch note and a
before/after picture of a base flag.
