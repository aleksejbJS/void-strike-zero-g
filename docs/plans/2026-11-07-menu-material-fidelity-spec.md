# Menu Material Fidelity — Specification

Status: implemented; approved by the user's instruction to implement the three selected fixes.

## Reference and Scope

Use `Void Strike atompunk desktop menu.png` as the visual authority.
Improve the shared materials used by the main menu, ADS, tournaments,
character setup, and their associated dialogs.

1. Replace large repeated rust patches with fine dark painted-metal grain,
   sparse small abrasions, sharp silver/orange edges, and dimensional rivets.
2. Replace blurred yellow gradients with solid saturated yellow painted
   metal, small dark chips, and clean edges.
3. Match the stencil emblems, title decorations, stripe ornaments, and
   keyboard legend to the reference; keep Tournaments visible locally.

## Implementation

Generate reusable bitmap material assets with the built-in image tool:
matte dark steel, chipped yellow paint, and an isolated metal frame.
Keep text and interaction controls in React. Use one shared material
implementation across existing menu roots. Keep CSS and components under
200 lines each. Preserve unrelated working-tree edits and dependencies.

For an unconfigured tournament service, retain the visible Tournaments
button and show a clear localized unavailable message when selected.
Do not expose broken tournament actions or provision backend services.

## Verification

Compare before/after screenshots at 1672×941 using English text for a fair
visual comparison. Check Russian text, 390px portrait, and 844×390
landscape. Verify selected and disabled states, actual character colours,
focus, navigation, and canvas visibility. Test the tournament button with
and without its service. Run affected tests, source type checking, and a
production build. Preserve gameplay art and game rules.

## Asset Provenance

Record final generation prompts and project paths in a companion asset
manifest. Do not overwrite the original rust texture or logo.

## Delivered Assets

Built-in ImageGen produced three 1254×1254 PNG assets in
`public/assets/menu/materials/`: `steel-fine.png`, `yellow-chipped.png`,
and the transparent `riveted-frame.png`. The original logo and rust
asset remain intact. Full prompts are recorded in
`2026-11-07-menu-material-assets.json`.

## Validation Results

- Production build passed; existing chunk-size warnings remain.
- Production source TypeScript check passed.
- Final interface suite: 39 files, 247 tests passed.
- Expanded affected suite: 312 passed, 1 existing failure in
  `useTakenCheck.test.tsx`, "leaves no timer behind after a quick answer".
  The unchanged test and hook reproduce the failure in an isolated run.
  Existing test-helper typing errors also reflect externally changed Vitest
  dependencies; package files were not changed by this task.
- Tournaments stays visible without its service and opens a localized,
  keyboard-accessible notice; configured-service navigation still passes.
- Browser verified desktop EN/RU, 390px portrait, 844×390 landscape,
  setup thumbnails, profile, ADS, and tournament availability notice.
- Independent review found a small-control frame overflow. Fixed by
  separating border-image paint width from physical border width.
  Setup scroll height fell from 397px to the 390px viewport height.
- Final independent review: no outstanding findings.
- Changes remain local; no commits or publication.

## Follow-up: Header and Local Rust Dust

The user requested removing the tagline and making the reference's localized
rust spray visible. Remove the slogan and its flanking stripe ornaments;
keep the logo left and menu actions right. Add a separate transparent,
fine-grained rust-dust asset concentrated in irregular edge/corner clusters.
Layer it behind content on the shared metal surfaces with varied positions;
keep the sharp frames, readable text, character colours, and yellow paint.
Verify desktop and short landscape layouts and the menu interactions.

Follow-up delivered: tagline and its unused ornaments removed; a generated
transparent `public/assets/menu/materials/rust-dust.png` supplies localized
corner deposits. Generation details are in `2026-11-07-rust-dust-asset.json`.
The overlay is behind panel content and does not filter character or canvas
colours. Menu tests: 35 passed. Build passed. Browser checks: 844×390 main
and setup fit the viewport; 390px portrait has no horizontal overflow.

## Follow-up: Reference Typography

The user requested matching the remaining typography to the reference.
Use locally served Oswald for the tall, condensed headings and primary
controls, and Roboto Condensed for descriptions and supporting labels.
Both families must cover English and Russian. Use real medium/semibold
weights instead of the existing heavy 800/900 treatment. Enlarge desktop
mode names, the play action, description text, and map labels to match
the reference hierarchy; retain compact sizes on short phone screens.
Apply the same families to the related menus, while keeping HUD fonts
and the logo artwork intact. Include upstream font licences and verify
actual loaded faces, long Russian labels, desktop and mobile overflow,
keyboard controls, source types, affected tests, and production build.

Typography delivered: locally served variable fonts with upstream OFL files
and provenance in `public/assets/fonts/SOURCES.txt`. Verified both languages
at 1200, 1440 and 1672px with no clipped mode or primary-action labels.
The 1672×941 layout fits fully; smaller desktops retain vertical scrolling.
Portrait cards use bounded grid tracks and stacked icon/text; landscape
main/setup fit 844×390 with Start visible. Final UI tests: 247 passed;
production source types and build passed. Independent review found no
outstanding issues. Exact pixel identity is not asserted.

## Follow-up: Material Depth and Non-Repeating Wear

The user rejected the flat rust overlay and repeated corner deposits.
Replace the diffuse overlay with opaque, physically shaded material art:
pitted oxide, dark cavities, exposed steel, and lifted paint lips whose
small highlights and contact shadows convey depth at menu scale. Generate
two distinct dark-metal materials and three matching frame variants.
Use different baked wear patterns and surface offsets; keep a consistent
upper-left light direction rather than mirroring the same texture.
Preserve frame geometry, clear text areas, current typography, colours,
selected states, layout, and game canvases. Inspect generated assets at
full size and in the menu; verify desktop and mobile before delivery.

Depth refinement delivered: two opaque metal surfaces and three transparent
nine-slice frame variants in `public/assets/menu/materials/depth/`. Their
prompts and reference paths are in `2026-11-07-menu-depth-assets.json`.
The flat dust overlay and mirrored wear are no longer used. Surfaces use
one continuous cover crop per panel, with distinct positions and frame
variants; non-seamless source art is never tiled. This also removes the
straight texture seams found during review on wide backgrounds.

Final verification: 247 UI tests across 39 files passed; production build
and whitespace check passed. Browser inspected EN/RU desktop, profile,
character setup, ADS and tournament availability notice. Main and setup
fit 844×390; 390px portrait has no horizontal overflow. Independent final
review confirmed the seams are gone and found no further issues.
Final screenshots: `.playwright-mcp/material-depth-final-ru.png` and
`.playwright-mcp/material-depth-final-en.png`.

## Follow-up: Preview Width Regression

The user approved fixing the preview's empty right strip. The Stage's
scale was capped at 1, leaving a 620px scene inside the new 717.375px
desktop content area. Remove the cap so the complete scene and its HTML
overlays scale proportionally to the available width. Keep the fixed
logical coordinates and existing narrow-screen behaviour. Reduce desktop
vertical padding around the preview, description and controls to retain
the full 1672×941 layout with the larger scene; retain font sizes.

Verification: the browser width assertion failed before the fix with
97px uncovered and passed afterward. All six modes fill the preview;
scene proportions hold at 1920, 1672, 1440, 1200, 844 and 390px widths.
The 1672×941 menu and 844×390 landscape menu fit their viewports.
Menu tests: 35 passed; production build and whitespace check passed.
Independent review found no outstanding issues. Screenshot:
`.playwright-mcp/preview-width-fixed-desktop-ru.png`.

## Follow-up: Worn Yellow Paint

The user approved pronounced wear on all yellow plates. Generate two
distinct yellow-paint materials with chipped raised paint, exposed dark
steel, pitted oxide, fine scratches and grime near fasteners and edges.
Keep the saturated warm yellow and readable dark text. Match the existing
metal's upper-left lighting and tactile depth; avoid uniform speckling,
blurred gradients, mirrored wear and large muddy patches.

Implementation: preserve the current paint asset, save new sibling assets,
then assign varied paint materials and crops through the shared menu CSS.
Use continuous non-repeating material fills. Keep geometry, typography,
preview sizing, interaction states and actual character colours intact.
Record prompts and asset paths; inspect desktop, narrow controls and
mobile, run affected tests and build, and request a final visual review.

Delivered: built-in ImageGen produced opaque 2172×724 materials
`public/assets/menu/materials/depth/yellow-worn-a.png` and
`yellow-worn-b.png`; full prompts and references are recorded in
`2026-11-07-yellow-paint-assets.json`. Different plate and builder-group
crops keep wear from repeating. Original yellow material is retained.
Desktop EN/RU, mobile portrait/landscape, setup, profile and ADS inspected;
character swatches retain their actual colours. Preview still fills its
717.375px area, and the main 1672×941 and setup 844×390 layouts fit.
Final verification: 247 tests in 39 files and production build passed;
independent desktop/mobile review found no outstanding issues.
Screenshot: `.playwright-mcp/yellow-wear-final-ru.png`.

## Follow-up: Join Label Clearance

The user approved a smaller frame and larger text inset for Join. Use
18px frame paint with 20px horizontal padding, and 12px/14px on short
landscape screens. Prevent button flex compression. Browser verified
English and Russian at 1672×941, 844×390 and 390×844: text clears both
frame edges and the invite field remains usable. Menu tests: 35 passed;
production build and whitespace check passed.
