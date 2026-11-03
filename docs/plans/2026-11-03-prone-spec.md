# Lying Down (Prone) Spec

Status: approved 2026-11-03

## Problem

A fighter can stand, walk, run and crouch, but not lie down. Players asked for it on phones
("присесть и лечь"): lying down is the way to hide under fire.

## Decision

- **Phone:** the move stick pushed down — inside the dashed circle crouches (as today), down to
  the edge lies down. Letting go stands up.
- **Keyboard:** hold **Z** to lie down, release to stand. (Ctrl was the first choice; Ctrl+W
  closes the browser tab and pages cannot block it, and jumping while lying is Ctrl+W.)
- **Rules while lying:** only on the ground. Hitbox 26 px tall (crouch 45, standing 72), so most
  shots aimed at a standing or crouching fighter pass over. Crawls slowly (~60 px/s, a quarter of
  a run). Shoots forward only: the aim is clamped to ±30° from horizontal on the side it faces;
  the muzzle sits low. Jump / jetpack (W, Space, stick up) stands up first. Bots aim at the
  centre of the hitbox, so they aim lower at a lying fighter by themselves.
- **Look:** a new `prone` pose: body along the ground, head and gun forward, legs stretched
  behind; a small crawl cycle while moving. Legs reach outside the 30 px wide hitbox (only the
  head and torso can be hit), like the gun does today.

## Non-goals

- Bots never lie down.
- No prone in the air, no "dive to prone".
- No change to crouch, walk or run.

## Code

- `Entity.isProne?` (optional: older hosts and snapshots simply never set it); `KeyZ` allowed
  by the host; the touch stick presses `KeyZ` at the bottom edge.
- `playerControl.ts`: `wantsProne` in the controls, one `applyStance` for the simulation, the
  host and client prediction (height 72 / 45 / 26), prone aim clamp.
- `movement.ts`: `PRONE_SPEED`; `combat.ts`: low muzzle.
- Render: `prone` state and pose, aim height, crawl phase.
- Tests: stance from keys, jump stands up, aim clamp, crawl speed, pose fits the 26 px hitbox.
