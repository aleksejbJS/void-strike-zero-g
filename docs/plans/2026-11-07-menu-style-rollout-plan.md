# Menu Style Rollout — Implementation Plan

Goal: reuse the current atompunk menu art across all remaining menu surfaces.
Specification: [menu-style-rollout-spec.md](2026-11-07-menu-style-rollout-spec.md).
Stack: existing React, TypeScript, CSS, Vite, and Vitest; no new dependencies.

## Working Constraints

- Preserve existing uncommitted menu art and unrelated work.
- Make reversible working-tree edits; do not commit or publish this work.
- Keep edited and new files at 200 lines or fewer.
- Use existing interaction tests and browser inspection for this styling change.
  Do not add tests that merely assert CSS class names.

## Task 1: Shared Materials

Create `src/styles/atompunk.css`, `atompunk-controls.css`, and
`atompunk-screens.css`.
Extract the main menu's identical palette, texture, rim, rivet, and state
rules from `src/components/menu/atompunk-menu.css`.
Keep the main menu's layout rules local; split its responsive styles into
`src/components/menu/atompunk-responsive.css`. Load shared materials before
App and screen styles through direct TypeScript CSS imports.
Import the shared theme from `src/index.tsx`.

Verify: compare the main menu before/after at the same viewport; its art
and interactions must survive extraction.

## Task 2: Screens and Controls

Create `src/components/menu/MenuScreenHeader.tsx` for the compact logo,
page title, and return action. Use the same heading and button materials.

Apply explicit theme classes to:

- `src/components/ads/{AdsAdmin,AdPlaceCard,BannerTest}.tsx`.
- `src/components/tournament/{TournamentFrame,TournamentListRow,
  CreateTournamentForm,LobbySeats,BracketMatch}.tsx`.
- `src/components/tournament/watch/{WatchScreen,WatchStrip,WatchTile,
  MyMatchBanner}.tsx` where surrounding controls need the shared material.
- `src/components/setup/{CharacterSetup,CharacterPreview,ColorRow}.tsx`.
- `src/components/setup/builder/{BuilderTabs,PartTiles,XpBar,BadgeOptions}.tsx`.
- `src/components/setup/account/{AccountModal,NameField,NamePlate}.tsx`.
- `src/components/profile/{ProfileScreen,ProfileBody,ProfileSummary,
  ProfileAccountActions,AchievementGrid,AchievementCard,LogoutConfirm}.tsx`.
- `src/components/menu/WhatsNew.tsx`.

Preserve all handlers, ARIA attributes, color values, and state machines.
Scope the theme to screen/dialog roots. Do not filter canvas content.

Verify: run existing tests for setup, tournament, profile, menu, ads, and App.

## Task 3: Browser Verification and Review

Inspect setup, ADS, profile, news, account dialogs, and tournament screens
at desktop, narrow portrait, and short landscape sizes. Use browser-only
fixtures if the local tournament backend is unavailable; do not change
production configuration to enable a preview.

Check overflow, action visibility, keyboard focus, true color swatches,
and nested selected/disabled states. Fix visual defects before delivery.
Run `npm run build`, TypeScript checking, affected tests, and the full suite.
Record any existing failures separately. Check changed-file line counts
and whitespace. Request one fresh-context final review of this work.

## Progress

- Direction: exact reference matching; shared source for all materials.
- Baseline: affected test suite started before implementation.
- Task 1: complete; materials have a single shared definition.
- Task 2: complete; target screens, nested controls, and dialogs themed.
- Task 3: complete; final verification recorded below.

## Verification

- Production build: passed; existing chunk-size/dynamic-import warnings remain.
- Full root suite: 255 files and 2129 tests passed with local sockets allowed.
  Excluded unrelated `.claude` worktrees and `menu-backups` scratch directories.
- Final repeat after CSS import cleanup: 2128 passed; the existing
  `server/src/gameServer.test.ts` test "moves the player from inputs and
  acknowledges the latest sequence" failed its position comparison.
  Its isolated rerun passed all 5 tests. The test starts at a random spawn;
  no server or gameplay code was changed by this rollout.
- Source TypeScript: passed using a temporary config restricted to `src`.
  The default project check also includes old incomplete menu backups and
  has existing Vite/Vitest config-type errors; those were left untouched.
- Whitespace check: passed; changed/new source files are under 200 lines.
- Browser: setup desktop, portrait, landscape; profile; ADS direct link;
  news; tournament list/lobby/bracket fixtures; RU signup/login/logout at 320px.
- Final independent review: no Critical/Important findings. Fixed its
  thumbnail-hover finding; browser filter changed from brightness(1.13)
  to none, while border hover remains.
- Kept changes in the current working directory to preserve existing menu art.
  No commits, branches, account writes, tournament mutations, or publication.
- Temporary tournament fixtures existed only inside the preview browser.
- The normal preview on localhost:3000 works after direct CSS imports.

## Implementation Decisions

- Direct CSS imports avoid lazy PostCSS import failures in the already-running
  dev server and ensure mobile layout rules follow shared materials.
- Profile keeps the nickname as its only h1; the shared header uses h2 there.
- Achievement rarity classes remain intact and receive explicit theme colours.
- Existing behaviour tests and browser checks cover this visual rollout;
  no tests merely asserting newly introduced class names were added.
