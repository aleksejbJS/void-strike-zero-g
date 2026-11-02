# Menu Mode Previews — In-Game Graphics Spec

Status: approved 2026-11-02 (option 1: scripted mini-scene with the real renderer); all six modes live

## Problem

The menu's mode previews (`components/menu/scenesSolo.tsx`, `scenesTeam.tsx`) are HTML/CSS
schematics: rectangle "figures", flat hazard-taped platforms, a dark box. They explain the
rules but look nothing like the game, so the first screen a player sees undersells it.

Options weighed 2026-11-02: (1) scripted mini-scene drawn by the game's own renderer,
(2) live bot match in the preview, (3) pre-recorded video loops. Chosen: **(1)** — looks like
the game, updates itself when the art changes, cheap to run, every frame is under our control.

## Goals

1. Each of the six previews shows real game art: station / mine / arena backdrop and
   platform art, real fighters (rig, jetpack flame, weapons, muzzle flash), real flags,
   projectiles, beams, particles and ragdolls.
2. Each preview tells its mode's story in a short loop (4–8 s), same beats as today:
   - **Deathmatch** — "You" jetpacks up, shoots a red bot, it ragdolls, "+1", kill line.
   - **Gun Game** — "You" kills, the weapon in hand changes up the ladder (ladder strip stays).
   - **Capture the Flag** — a blue carrier flies the red flag home, chased and shot at.
   - **Hold the Flag** — a red holder on the top platform, blue attackers jetpack in, score ticks.
   - **Infiltration** — blue grabs the intel, flies over the middle, lands in extraction.
   - **Hunger Games** — arena theme, the zone shrinks, "4 / 8 alive" counter.
3. The backdrop follows the map picked on the right (Default → station, Tunnels → mine;
   Hunger Games is always the arena), using the existing `themeFor(mode, map)`.
4. "You" is drawn in the player's own look from the fighter builder; everyone else uses the
   standard bot / team looks.
5. Texts ("You", kill line, scores, timers, "Extraction", "Intel") stay HTML overlays on top
   of the canvas, so EN/RU keep working through the existing `t()` keys.
6. No visible cost: the menu stays smooth on a mid-range phone; the preview pauses when the
   tab is hidden or the preview is scrolled off-screen.

## Non-goals

- No live simulation, no physics, no bots AI in the menu: positions come from a script.
- No gameplay, network or HUD change. The in-match renderer behaves exactly as before.
- Mode texts and rules under the preview (`modeInfo.ts`) are not changed.
- No ads inside the preview (ad places of the theme are not built there).

## Anti-goals (a failure even if it "works")

- Opening a match from the menu breaks or blanks the match canvas (the 0.4.1 "black world"
  class of bug: shared Pixi resources freed by the preview while the match uses them).
- The menu loads noticeably slower: the Pixi bundle must not block the menu's first paint.
- Fighters in the preview slide, float or moonwalk — the run/fly/fall poses must match motion.

## Design

### How it works

A small Pixi canvas inside the existing `Stage` (620 × 340, already scales down on phones).
Every frame a **director** builds a fake `GameState` for time `t` in the loop — players with
`pos`, `vel`, `isGrounded`, `jetpackOn`, `aim`, weapon, `lastFired`; projectiles, pickups
(flags, intel), particles, ragdoll parts, hunger zone — and hands it to the same drawing code
the match uses (`syncVisuals`, `createMapLook`, zone overlay). The camera is fixed on the
middle of a small purpose-built layout (floor + three platforms, like today's preview), in
world coordinates and drawn with the theme's platform art.

```
ModePreview ──► PreviewCanvas (Pixi app, lifecycle, pause)
                    │  each frame: state = director[mode](t, look)
                    ├─► createMapLook(...)   backdrop + platform art (no ads)
                    └─► syncVisuals(...)     fighters, flags, shots, particles, ragdolls
                HTML overlays (Badge, Pop, labels) — unchanged components
```

### Scripts

A script is a list of keyframes per actor (`{ at, pos, facing, state, aim, fire }`) plus
one-shot events (shot, hit, death → ragdoll, pickup, capture). The director interpolates
positions and derives `vel` from them, so the fighter animator picks the right pose and run
cycle by itself. Events reuse the game's effect spawners for muzzle puffs, sparks and ragdolls.
One file per mode, each well under 200 lines.

### Fallbacks

- **WebGL unavailable / Pixi fails to start:** the current CSS schematic scene is shown (kept
  as is, errors logged with `console.error`, no silent catch).
- **While Pixi loads:** the CSS scene is shown, then swapped for the canvas (lazy-loaded).
- **Reduced motion:** one still frame from the middle of the loop, no ticker.

### Fixes needed in shared code (found while scoping)

1. `releaseBakedTextures()` frees **all** baked textures page-wide. If the preview's scene is
   destroyed when the match scene already exists (they overlap at match start), the match
   loses its platform and backdrop art. Make baked textures owned per scene.
2. `createThemedScene` always builds ad places: add an option to skip them.
3. The fighter animator keeps memory per player id in a module-level map: preview actors get
   prefixed ids (`pv-…`) and are forgotten on unmount so they never collide with match ids.
4. **Found while building (pre-existing, also on `main`):** Pixi 8.14.3 `Batcher.destroy()` hands
   back to the page-wide batch pool batches that `begin()` already returned, some of them in use
   by another renderer. After match → menu → match (or a mode switch in the preview) live
   renderers draw with dead geometry: `glDrawElements: Insufficient buffer size`, then
   `reading 'instanceCount'`, missing art or a black canvas. Fixed by `render/batchPoolFix.ts`,
   installed by `destroyApp()`. Worth its own fix release.
5. The preview keeps **one** Pixi app for the page life (`preview/previewApp.ts`) and swaps the
   scene on mode/map change, so clicking through modes does not create a WebGL context per click.

### Files (planned)

- `components/menu/preview/PreviewCanvas.tsx` — Pixi app, lazy load, pause, fallback.
- `components/menu/preview/director.ts` — keyframe interpolation → `GameState`.
- `components/menu/preview/stageLayout.ts` — platforms and camera of the preview world.
- `components/menu/preview/scripts/*.ts` — one script per mode.
- Small changes: `bakedTextures.ts`, `themedScene.ts`, `ModePreview.tsx`.

## Acceptance

- All six modes show real game art and play their loop without gaps or jumps at the seam.
- Switching Default ↔ Tunnels changes the preview backdrop immediately.
- The builder look shows on "You"; changing it in the builder shows in the preview.
- Start a match from the menu 10× in a row (each mode): match art is always intact, no
  console errors, no Pixi warnings.
- Menu first paint is not slower than before (Pixi arrives after the menu is visible).
- Phone width: preview scales, text overlays stay readable, menu scrolls at 60 fps.
- RU locale: every overlay text is translated.

## Branch and release

The preview depends on the fighter builder's looks, which are on `feature/fighter-builder`
(not in `main` yet). Work goes on its own branch `feature/mode-previews`, cut from
`feature/fighter-builder` and merged after it; its own 0.4.x with a short note and a
before/after picture.

## Open questions

- Should the preview layout be a small slice of the real default map instead of a custom
  four-platform layout? (Proposed: custom — the composition is controlled and fits 620 × 340.)
