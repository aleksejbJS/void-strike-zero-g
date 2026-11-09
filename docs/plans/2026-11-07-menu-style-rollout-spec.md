# Menu Style Rollout — Draft Specification

Status: approved direction; exact visual matching requested on 2026-11-07.

## Goal

Apply the existing main-menu and header art direction to the remaining
menu screens so navigation feels like one coherent game interface.
The user's `Void Strike atompunk desktop menu.png` is the visual authority.
Reuse the working-tree menu's logo, rust texture, metal rims, rivets,
cream typography, yellow plates, and control states rather than inventing
a related theme. Consistency must extend to nested controls and dialogs.

## Proposed Scope

- ADS administration: page header, toolbar, ad-place cards, inputs,
  preview frames, feedback messages, and the return action.
- Tournaments: list, creation form, lobby, seats, bracket, results,
  loading/error/empty states, and the surrounding spectator controls.
- Character setup: header, character-preview frame, preset controls,
  name field, XP bar, tabs, part tiles, colour controls, and start actions.
- Related menu surfaces: profile, achievements, account dialogs,
  logout confirmation, and the What's New panel.

## Visual Reference

- Background: `#191a19` with the existing warm overhead light.
- Panel surface: `#242522`; rusty edges and inset metal rims.
- Main text: `#f2dfb5`; supporting text: `#bcb19b`.
- Rust accent: `#ad6334`; primary and selected accent: `#edb82d`.
- Use the existing Fira Sans Extra Condensed heading treatment and
  the main menu's body typography.
- Reuse the existing logo and `public/assets/menu/rust.webp` texture.
- Keep texture at panel edges, away from text, previews, and form values.
- Preserve distinct selected, disabled, focused, success, and error states.

## Approach Options

1. Recommended: extract shared visual primitives from the approved menu
   styles and reuse them across the target screens. This keeps future
   changes consistent, with a small initial extraction cost.
2. Add separate style overrides to each screen. This needs less initial
   restructuring, but duplicates rules and makes future consistency harder.

## Recommended Design

Use shared styles for screen backgrounds, headers, panels, buttons, fields,
tabs, and notices. Retain screen-specific layout rules in focused files.
Use named exports for any new React components; keep each changed or new
file at 200 lines or fewer.

Secondary screens receive a compact version of the metal header, with the
existing logo, page title, and contextual return action. Scale its height
for phones and dense tournament layouts.

Retain the established layout and interaction model of each screen.
Character setup keeps its preview and editor columns; tournaments keep
their list, lobby, bracket, and spectator layouts. Apply metal styling
to their surrounding controls and frames.

Scope theme selectors to menu surfaces, including dialog roots, so they
do not propagate into match canvases or HUD elements.

## Functional Boundaries

This is a visual rollout. Preserve game rules, account behaviour, saved
character choices, ad configuration, tournament networking, routing, and
the current Russian/English translations. Preserve existing worktree edits.

## Acceptance Criteria

- Every proposed screen uses the same palette, metal edges, typography,
  and button states as the current main menu.
- ADS remains independently styled when opened directly via `#ads-admin`.
- Tournament states remain readable; spectator art stays clear of canvases.
- Actual character colours and part thumbnails retain their original hues.
- Start, Back, and dialog actions remain reachable on desktop and phones,
  including landscape phones with a short viewport.
- Keyboard focus, tab navigation, disabled controls, and status/error
  messages remain understandable.
- Shared-style extraction preserves the main menu's approved appearance.
- Existing affected tests and production build pass. Inspect the screens
  visually at desktop, narrow portrait, and short landscape sizes.

## Approval

The user confirmed the requirement by specifying that the style must be
identical, one for one, and attaching the reference image.
