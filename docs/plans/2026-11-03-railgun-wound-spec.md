# Railgun Wound (Lost Leg + Bleeding) Spec

Status: approved 2026-11-03

## Problem

The railgun (200 damage) one-shots everyone, even through full armor: armor absorbs at most
its own value, so 100 armor + 100 health still dies. Armor is worth nothing against it. The
owner wants armor to save you from the railgun, but at a price that keeps the shot scary.

## Decision

### The hit

- A railgun beam hits a fighter who has **any armor (> 0)**:
  - armor drops to **0** (the beam burns it all, however much there was);
  - health becomes **min(current health, 10)** — never heals a fighter who had less;
  - the fighter **loses a leg** and starts **bleeding**;
  - knockback, the blood burst and the beam look stay as today.
- A railgun hit on a fighter with **no armor** kills as today (cut in half). That includes a
  wounded fighter: the wound burned their armor, so a second beam finishes them.
- A wounded fighter who picks up armor and is beamed again: same rule — armor to 0,
  health min(current, 10), still one leg, the bleed is credited to the newest shooter.
- Only the railgun wounds. Every other weapon works exactly as today, also on a wounded
  fighter (a machine-gun bullet at 10 HP kills normally, credited to whoever fired it).
- The Hunger Games round-start shield still blocks the beam completely (as today).

### Bleeding

- **−1 HP per second** while wounded, no knockback, no floating damage numbers.
  From 10 HP that is **10 seconds** to reach a medkit.
- Bleeding to death counts as a **kill by the railgun shooter**: score, kill feed line
  "shooter — Railgun — victim", Gun Game progress, and the "20 railgun kills" achievement
  (for a human shooter), exactly as if the beam had killed. Not the weapon the shooter happens
  to hold at that moment.
- The same credit applies when a wounded fighter dies **with no other player as killer**:
  their own rocket/grenade splash, falling off the map, or Hunger zone damage. A wounded
  fighter cannot deny the frag by killing themselves. (Owner's decision, 2026-11-03.)
- If the shooter has left the match by then, it is a death with no killer ("World"), no score.
- A bled-out body **slumps** (`fall`), it is not cut in half.
- Bleeding **pauses once the round or match is decided** (Hunger winner screen, match end),
  so a wounded winner never bleeds out on the victory screen. *(builder-check call)*
- If no medkit is reachable in time (taken, far away, behind the Hunger zone), the fighter
  dies. The wound is a 10-second chance, not a guaranteed save; no 1 HP floor, no timeout.

### Without a leg

- **Cannot run.** On the ground, left/right only hops slowly on one leg at crawl speed
  (~60 px/s, a quarter of a run; same as `PRONE_SPEED`).
- **Everything else works as normal:** jump, jetpack, grapple hook, crouch, lie down, shoot,
  switch weapons, carry a flag.

### Healing

- Picking up **any medkit** (+25 HP as today) gives the leg back and stops the bleeding.
  A wounded fighter always has < 100 HP, so the medkit is always taken.
- Death and respawn also clear the wound. A new round / new match starts unwounded.

### Look and feel

- The severed leg flies off as a torn leg piece (the same piece the gib death already uses),
  plus a blood burst at the hip.
- The fighter is drawn with one leg (the back leg is gone) and a bloody stump; the hop is a
  small one-leg bounce while moving on the ground.
- Blood drips from the stump while bleeding.
- The corpse of a wounded fighter (whatever killed them) also has only one leg.
- HUD: a pulsing red blood drop next to the HP number while bleeding (the HP visibly ticking
  down is the main signal).

### Online and bots

- Works identically for humans and bots, offline and online (Node server and browser host).
  The wound is part of the fighter state the host sends; the client's own movement
  prediction uses it, so a wounded player does not rubber-band when trying to run.
- Bots: a bot already goes for the nearest medkit below 60 HP, so a wounded bot (10 HP) heads
  for one by itself. A wounded bot carrying a flag must **also** go for a medkit (today a flag
  carrier never detours). A wounded bot moves along the ground at hop speed, so its route
  planning should prefer jetpack and hook over long walks while wounded.

## Non-goals

- No other limbs (arms, head), no limb damage from other weapons.
- No bandages or other healing items; only the existing medkit.
- No change to railgun damage, fire rate, or how it kills an unarmored fighter.
- No bleeding sound (the existing hit sound plays on the beam hit).

## Anti-goals

- The wound must not make the railgun weaker against unarmored fighters.
- The shooter must never lose the frag for a wound that bleeds out.
- A wounded fighter must not be stuck by the controls: flying and hooking always work
  (whether a medkit is close enough is up to the map and the clock).

## Code (guidance for the builder)

- `Entity`: an optional wound field, e.g. `wound?: { by: string; bleedAcc?: number }`
  (missing on older hosts = never wounded). Server-authoritative, sent in snapshots.
- `combat.ts`, railgun branch → a new small module (e.g. `wound.ts`) decides "wound instead
  of kill" before `applyDamage`; `applyDamage` must take the kill-feed weapon and death kind
  from the source for a bleed-out instead of `killer.weapon`.
- Bleed tick in the fixed-step simulation (per tick, relative to `PHYSICS_TICK_RATE`),
  next to the existing per-player updates in `physics.ts`. Medkit pickup and respawn clear it.
- `movement.ts`: wounded → ground speed `PRONE_SPEED` (runs on the host and in client prediction).
- Cosmetics only through events / client-side from state (never written by the simulation):
  an EFFECT event for the leg flying off; drips spawned by the client from `wound`.
- Render: fighter pose/view without the back leg + stump; corpse without the leg.
- Bots: medkit goal for a wounded flag carrier; route cost while wounded.
- Tests: wound vs kill by armor; self-kill, fall-out and zone deaths credit the shooter; armor → 0 and health min(·,10); bleed reaches 0 at ~10 s and
  credits the shooter with Railgun; medkit and respawn clear; hop speed; second beam kills.
- Release: its own branch/PR and 0.4.x patch note.

## Left to the builder

- Exact stump, drip and hop visuals; the HUD drop's look.
- Whether bleeding is applied as 1 HP per second in steps or smoothly per tick (same total).
