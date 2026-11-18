# Blast FX — Spec (short)

**Date:** 2026-11-19 · **Status:** approved by the owner (look judged on the spike, 2026-11-18; "add it to 0.5.0")
**Branch:** `feature/blast-fx` (worktree `~/Documents/void-strike-blastfx`, from `feature/smoke-sim` 379e7cf).
Ships inside 0.5.0, with the smoke (`docs/plans/2026-11-18-smoke-sim-spec.md`).

## Intent

Next to the new smoke the owner found the rocket's flight smoke "horrible" and its explosion "ugly": a dotted
line of grey circles behind the rocket, and a blast made of orange circles, a thin ring, bead-like grey trails behind
the debris and a blob of seven grey circles. These were older effects, not a regression; the new smoke raised the bar.

## Approaches (owner picked 3)

1. Everything on the smoke grids (blast cloud and a grid-based trail). Best look, but a trail is long and fast:
   many grids per rocket, a risk for 120 fps.
2. New sprite textures only. Cheap, but still "particles" next to the real smoke.
3. **Hybrid (chosen):** the blast's smoke is a short-lived air grid of the smoke system with a fireball of the flame
   engine's additive puffs; the trail is a dense ribbon of soft smoke sprites.

## What it does

- **Blast** (every `explosionBurst`: rocket, grenade, barrel, fuel tank): a warm flash; a fireball of flame puffs flung
  out, rising and cooling white → orange → dark red; its smoke as a `BlastCloud` grid that the fireball fills with hot,
  sooty smoke for 0.35 s, glowing orange inside, rolling, rising and thinning out in about 2 s (gone by 4 s, fading
  over the last 0.8 s so it never pops away). World stirs push it like any smoke.
- **Rocket trail:** soft puffs every 5 px from the tail (frame-rate independent spacing), growing and fading over
  ~1.5–2 s, a hot glow at the nozzle. **Debris** trails thin dark smoke while it flies fast.
- **Looks only.** The simulation keeps only the `'ring'` marker (not drawn; its size is the blast scale), debris and
  embers. Damage, knockback, radius, bots, server and snapshots are unchanged. The renderer finds a fresh blast by its
  ring the first frame it is seen, so offline, host, guest and spectators look alike.

## Limits and fallbacks (builder's calls)

- At most 6 blast grids (one out of view gives its slot to a blast in view); grids out of view (+200 px) do not step;
  grid size 0.85 × the smoke cloud grid of the quality. Trails and the nozzle glow (one sprite per rocket) are made only
  in the view plus that margin.
- `low` quality (tournament tiles, menu preview), no smoke shader, or past the cap: the blast's smoke is a few soft dark
  puffs instead of a grid. The fireball, flash and trails are sprites and work everywhere.
- A failing grid logs one console error, frees the grids, later blasts use the puffs. Any other failure logs once and
  blasts are drawn no more; the smoke clouds and soot are not touched. No silent catches.
- The blast view is made only when a blast, debris or a rocket first appears (it draws the flame textures).
- Budget: as the smoke spec — 120 fps on the owner's MacBook. Measured: six rockets in 3 s cost 0.43 ms/frame on average.

## Left for later

- Mobile cost not measured (same as the smoke).
- Grenade-launcher grenades have no trail (only rockets had one before).
