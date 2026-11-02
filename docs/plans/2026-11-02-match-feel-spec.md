# Match Feel — Camera Size, Flag Banners, Explosions

Status: approved 2026-11-02 ("давай", open questions left at their defaults); parts 1 (0.4.6) and 2 (0.4.8) implemented

Reference: the user's screenshot of a 2D team shooter (fighters ~1/22 of the screen width,
a big team-coloured "RED FLAG GRABBED" line at the top, dirty explosions with dark debris).
Decided in chat 2026-11-02: **fixed view width**, **all four flag banners**,
**explosions from improved particles** (no sprite sheets).

Three independent parts, three branches and PRs, released one by one (shipped as 0.4.6 and 0.4.8; the numbers moved because other releases landed in between):

| # | Part | Branch |
|---|------|--------|
| 1 | Camera shows a fixed slice of the world | `feature/camera-view-width` |
| 2 | Flag banners | `feature/flag-banners` |
| 3 | Bigger, dirtier explosions | `feature/explosions` |

---

## Part 1 — Fixed view width

### Problem

The world is drawn 1:1: one world unit = one screen pixel. A fighter is 72 units tall, so
on a 2560-px window a fighter is 1/35 of the width and on a phone 1/11. Big monitors see more of
the map than small ones (unfair online) and everything looks tiny on them.

### Goal

Every screen shows about **1600 × 900 world units** (fighter ≈ 1/22 of the width, as in
the reference), scaled up or down to fill the window.

### Design — "virtual screen"

- `zoom = min(screenW / 1600, screenH / 900)`, so nobody sees *less* than 1600 × 900;
  a window wider than 16:9 shows a bit more sideways, a taller one a bit more vertically.
- Floor `zoom ≥ 0.6` so phones do not get microscopic fighters (they see ~1400 units
  instead of their current ~850: still more than today, less than desktop).
- One new module `src/game/render/viewport.ts`: `viewportOf(screenW, screenH)` returns
  `{ zoom, w, h }` where `w = screenW / zoom`, `h = screenH / zoom` (the *virtual* screen).
- A new root container under `app.stage` holds everything that is drawn today
  (backdrop layers, world, uiLayer) and gets `scale = zoom`.
- Every place that now mixes `app.screen.width/height` with the camera receives the
  virtual `w, h` instead — the formulas themselves do not change:
  - `renderer.ts` (world position), `playerVisual.ts` (aim shoulder),
  - `themedScene.ts` / `adPlaces.ts` / `mapLook.ts` (parallax, backdrop size, post filter),
  - `adsController.ts` (blockers, solids),
  - `physics.ts:147` and `GameCanvas.tsx:586` (mouse → world aim).
- Mouse and touch positions are divided by `zoom` once, where they are read
  (`GameCanvas.tsx` mouse/touch handlers).
- DOM ad overlay: its root element gets `transform: scale(zoom)` from the top-left, so
  banners stay glued to their posters.
- HUD (React) is not affected.

### Risks / checks

- Canvas-generated backdrops and fighter textures are stretched by up to ~1.6× on big
  screens: check sharpness; if soft, render them at virtual size × zoom (or raise
  the renderer `resolution` to `devicePixelRatio`).
- Window resize mid-match must update zoom and redraw the backdrop (today's resize path).
- Bots, physics and the network are untouched: only drawing and input change.

### Done when

- On 1280×720, 1920×1080 and 2560×1440 windows the same part of the map is visible
  (screenshots side by side).
- Aiming hits exactly under the cursor at every size; grapple too.
- Ad posters and real banners stay in place while the camera moves.
- All tests pass; new unit tests for `viewportOf` and mouse → world conversion.

---

## Part 2 — Flag banners

### What the player sees

A large uppercase line at the top centre, in the team's colour, with a dark outline,
"Hazard Bay" display font (Cyrillic fallback). It slides in, holds ~2.5 s, fades out.
A newer banner replaces the current one at once. Russian and English texts via i18n.

### Events (by mode)

| Mode | When | Banner (RU / EN) |
|------|------|------------------|
| CTF | enemy picks up a flag | КРАСНЫЙ ФЛАГ ВЗЯТ / RED FLAG GRABBED |
| CTF | carrier dies (flag goes home instantly — the game has no dropped CTF flag) | КРАСНЫЙ ФЛАГ ПОТЕРЯН / RED FLAG LOST |
| CTF | flag returned to base by its own team | КРАСНЫЙ ФЛАГ ВОЗВРАЩЁН / RED FLAG RETURNED |
| CTF | capture (point) | СИНИЕ ЗАХВАТИЛИ ФЛАГ / BLUE CAPTURED THE FLAG |
| Hold the Flag | a team picks up the neutral flag | СИНИЕ ВЗЯЛИ ФЛАГ / BLUE HAS THE FLAG |
| Hold the Flag | holder dies or throws it | СИНИЕ ПОТЕРЯЛИ ФЛАГ / BLUE LOST THE FLAG |
| Infiltration | intel grabbed / dropped / extracted | РАЗВЕДДАННЫЕ ВЗЯТЫ / ПОТЕРЯНЫ / ВЫВЕЗЕНЫ |

Colour = the flag's team (red/blue), amber for the neutral flag and intel.

### Design

- New event `{ type: 'FLAG'; action: 'grabbed' | 'lost' | 'returned' | 'captured'; team; mode }`
  in `events.ts`, emitted by the simulation where `hasFlag` changes
  (`physics.ts` pickup/capture/throw, `combat.ts` death drop). Events already travel to
  online clients (`room.drainEvents`), so online works with no protocol work.
- `GameCanvas` listener → `setFlagBanner(...)`; new HUD component `FlagBanner.tsx`
  (text + CSS animation), texts built by a pure function `flagBannerText()` (tested).
- The existing small floating "GRABBED" / "EXTRACTED" texts over Infiltration carriers stay.

### Done when

- Each row of the table shows its banner offline and online.
- A burst of events (grab → instant death) shows only the last one, no stacking.
- Tests for the event emission per mode and for the text function.

---

## Part 3 — Explosions

### Today

White flash (40), orange fireball growing 12 → 46, ring, 14 embers, 6 grey smoke puffs.
Clean and small; no screen shake (the shake code in `renderer.ts` exists but nothing
feeds it).

### Target look (reference)

1. **Core** — bright flash + 3–4 overlapping orange/yellow fire billows, slightly offset,
   so the ball is lumpy, not a perfect circle; ~1.5× today's size.
2. **Debris** — 8–12 dark (near-black) chunks flying out fast in all directions, each
   leaving a thin dark smoke streak that lingers ~0.6 s → the spiky "splat" silhouette.
3. **Smoke** — a dark-grey/brown cloud that grows and drifts up, lives ~1.5 s.
4. **Embers** — as today, fewer and faster.
5. **Shake** — a small camera shake, stronger the closer the blast is to the local
   player; can be skipped if it feels bad.
6. Size follows the weapon's blast radius (the event gets `radius`), so a grenade and a
   rocket look different.

### Design

- New particle kinds `debris` (dark chunk + trail of `soot` puffs it drops while flying)
  and `soot` (dark smoke); new composition in `effects.ts explosionAt`.
- Drawing in `particleDraw.ts`; the particle budget (`PARTICLE_BUDGET`) keeps the cost
  capped when many rockets fly at once.
- Only cosmetics: damage, radius, network are untouched (`radius` is an extra optional
  field in the existing EFFECT event).

### Done when

- Side-by-side screenshots before/after; 10 simultaneous rockets keep 120 fps.
- Tests for the composition (counts, kinds) and the debris trail spawning.

---

## Open questions

1. View size 1600 × 900 — OK, or slightly bigger/smaller after trying it?
2. Phones: floor `zoom ≥ 0.6` — OK?
3. Explosion screen shake — yes / no?
