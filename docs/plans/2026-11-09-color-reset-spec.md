# Reset a colour to the preset's original — spec (2026-11-09)

## Problem
On the character setup screen a player can recolour every body part, the visor and the pattern,
but cannot get one colour back. The only way is to flip the preset arrows away and back, which
also throws away every chosen part (helmet, tail, badge...).

## Decision (owner, 2026-11-09)
Option A: a small ↺ button on each colour row.

## Behaviour
- "Original" = the colour of the currently selected preset (skin): its palette for torso, head,
  arms, legs, jetpack; its starting build (`presetBuild`) for visor and pattern.
- The ↺ button sits at the end of each colour row (Colours tab: 5 body colours + pattern;
  Head tab: visor).
- It is shown only while the row's colour differs from the original (case-insensitive); its space
  is always reserved, so the swatches do not jump when it appears.
- Clicking it sets that one colour back to the original. Nothing else changes.
- Accessible name: "Restore original {part} color" / "Вернуть исходный цвет: {part}"; a tooltip
  with the same text.
- The "changed" mark next to the preset name keeps its current rule (any edit marks it).

## Out of scope
- A "reset all colours" button (option B).
- Resetting parts (helmet, tail...) to the preset.
