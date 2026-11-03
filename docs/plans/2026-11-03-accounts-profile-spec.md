# Player Accounts & Profile Spec

Status: approved 2026-11-03 (mockups in `.superpowers/brainstorm/`)

## Problem

A player's nickname, achievements, fighter XP and fighter build live only in one browser
(`localStorage`). Anyone can take any nickname, progress is lost on another device, and there is
no screen that shows all achievements outside a match (only the in-match HUD panel and toasts).

The owner wants: "type a nickname, bind a password to it — that's my account — and a profile
where I see all my achievements".

## Goals

- A nickname + password is an account. The nickname is unique: nobody else can use it.
- The account carries **achievements, fighter XP (unlocks) and the fighter's whole look** to any
  device: log in elsewhere and everything is there. "Look" = the build (`fighterBuild`) plus the
  preset (`selectedSkin`) and the body colours (`playerColor`, `headColor`, `torsoColor`,
  `armColor`, `legColor`, `jetpackColor`) — synced together as one `build` value.
- A separate **Profile** screen shows the nickname, fighter level and all achievements.

## Non-goals

- No email, no password recovery, no password change (forgot password = account lost; the
  sign-up form says so).
- No anti-cheat: achievements are still counted in the player's browser and trusted as sent.
- No leaderboards, friends, match history, avatars, nickname change or account deletion UI.
- No translation of achievement names/descriptions (they stay English, as in the HUD today).
- The in-match achievements panel and toast stay as they are.

## Anti-goals (failure even if it "works")

- The account gets in the way of playing: a guest must never be forced to register, and a
  Supabase outage / no internet must never stop a match from starting.
- Progress is lost: logging in on a second device, or syncing, must never lower any number.
- Clutter: the menu and the fighter screen get one small entry point each, nothing more.

## Decided behaviour

### Guest (unchanged by default)
Plays exactly as today; everything stays in `localStorage`.

### Fighter setup screen (`src/components/setup/CharacterSetup.tsx`) — mockup "A"
- **Guest:** under the name field a single line: `🔒 Protect nickname with a password · Log in`.
  Either link opens a small modal (Hazard Bay card) with two tabs:
  - **New account:** nickname (prefilled from the name field) + password, warning
    "the password cannot be recovered", button Create. On success the guest's local
    achievements, XP and build are uploaded into the new account.
  - **Log in:** nickname + password. On success local guest progress is **merged** into the
    account (see Sync).
  - Errors shown inline: nickname taken (on New account), wrong nickname or password, network
    unavailable.
- **Logged in:** the name input becomes a locked plate `Alex  🔒 account` with a `Profile →`
  link. The nickname can only change by logging out.
- **Guest types a taken nickname:** on Start the check finds it taken → Start is blocked,
  message "This name is taken. If it's your account, enter the password", and the modal opens
  on the Log in tab with the nickname filled. If the check cannot reach the service, the guest
  is let through (anti-goal: outages never block play).

### Nickname rules (builder's call, approved with the spec)
- Account nicknames: 3–12 characters (same 12 as the name field today), letters (Latin or
  Cyrillic), digits, `_`, `-`, and single inner spaces; trimmed. One nickname may not mix Latin
  and Cyrillic letters, so look-alike tricks (`Alex` with a Cyrillic `А`) are impossible.
- "Same nickname" = equal after trimming and lower-casing.
- Reserved, cannot be registered: `Anonymous` and bot names (`Bot <n>`). The guest default name
  `Anonymous` is never checked as "taken".
- Guest names stay free-form as today; only the taken-check applies to them.
- Encoding to the email local part must fit 64 characters for any valid nickname
  (12 Cyrillic letters = 24 UTF-8 bytes, so hex fits).

### Main menu (`src/components/menu/MainMenu.tsx`)
One button in the header (next to What's new / language): the player's nickname with a 🔒 when
logged in, or "Profile" for a guest. It opens the Profile screen.

### Profile screen (new, full screen) — mockup "A"
- Back to menu; "saved in the cloud" marker when logged in.
- Left column: nickname (big display font), title from the highest unlocked achievement reward
  title if any, fighter level + progress bar to next level (from `levelForXp`), tiles
  "achievements N/17" and "achievement XP".
- Right column: filter chips All / Combat / Movement / Modes / Collecting / Special (`veteran`,
  `perfectionist`) and a grid of all
  achievements: unlocked in colour, locked greyed with a progress bar `progress / max`; border
  colour by rarity.
- Logged in: `Log out` button. Guest: the same profile from local data, plus a call to action
  "Protect your nickname with a password" opening the same modal.
- Log out: confirm, try one last push, then the device becomes a clean guest (local
  achievements, XP, look and name are cleared; cloud data is untouched). If that push fails, the
  unsent progress is kept on the device under that account's id and pushed the next time the
  same account logs in on this device — logging out never loses progress.
- The Profile button and screen exist even when Supabase is not configured (guest profile from
  local data); only the account parts are hidden then.

### Online
When logged in, the account nickname is the name sent in the join request. Nothing else in the
network protocol changes.

## Storage: Supabase (owner's choice)

- New dependency `@supabase/supabase-js`. URL and anon key come from Vite env
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), set as GitHub Actions variables for the Pages
  build and in a git-ignored `.env.local` for development. The anon key is public by design;
  the database is protected by Row Level Security. If the variables are missing, the account
  UI is hidden and the game works as a guest-only game.
- **Auth:** Supabase email+password auth with "confirm email" turned off. The nickname is turned
  into a synthetic, never-mailed email: lower-cased nickname, encoded so any allowed character
  fits an email local part, at a reserved domain (e.g. `@players.invalid`). Because the email is
  derived from the nickname, Supabase's unique email guarantees a unique nickname, case-insensitively.
  The session is persisted by supabase-js, so the player stays logged in.
- **Tables** (SQL migration committed under `supabase/migrations/`):
  - `profiles(id uuid pk → auth.users, nickname text, created_at)` — readable by everyone
    (needed for the "is this name taken" check), insertable/updatable only by the owner.
  - `player_progress(user_id uuid pk → auth.users, achievements jsonb, fighter_xp int,
    build jsonb, updated_at)` — read/write only by the owner (RLS `auth.uid() = user_id`).
  - A `nickname_taken(nick text) returns boolean` function (or an equivalent lookup on
    `profiles`) for the guest check.

## Sync rules

- `localStorage` stays the working copy the game reads and writes (offline-first). Existing
  keys: `achievementProgress`, `fighterXp`, `fighterBuild` + the preset/colour keys, `playerName`.
- **Merge** (used on log in, sign up and every push): per achievement take the higher
  `progress`, `unlocked` if either is unlocked, the earliest `unlockedAt`; XP = the higher of the
  two; look = the most recently changed one (track a local `savedAt` that moves only when the
  look actually changes, not on every Start).
- **Pull** after log in and on app start when logged in: fetch → merge with local → write local.
- **Push** at the end of every match, after an achievement unlock and after saving a build:
  fetch → merge → upsert. A failed push is kept as "dirty" and retried on the next push or app
  start. Pushes are debounced so a burst of unlocks is one request.
- Two devices playing at the same time may race; the merge rule means the worst case is a
  slightly lower number until the next push from the other device. Acceptable.

## Keep-alive

A free Supabase project pauses after 7 days without requests; while paused, login, sync and the
taken-name check do not work (the game itself still does). A scheduled GitHub Actions workflow
makes one cheap read (e.g. `nickname_taken('keepalive')` with the public anon key) every 3 days.

## Owner's one-time setup (before release)

Create a free Supabase project, turn off "Confirm email", run the migration, and put the project
URL + anon key into the repo's GitHub Actions variables. The builder writes a short step-by-step
in the PR.

## Code

- `src/account/` (new): Supabase client, nickname ↔ email encoding, auth (sign up / log in /
  log out / session), progress merge (pure, unit-tested), sync (pull / push / dirty retry),
  a React hook exposing `{ status, nickname, signUp, logIn, logOut }`.
- Storage modules (`achievements.ts`, `progress.ts`, `buildStorage.ts`) get small hooks to read
  and replace their whole stored value and to notify sync on change; their existing behaviour
  stays.
- `src/components/profile/` (new): Profile screen + achievement card/grid, Hazard Bay tokens.
- `src/components/setup/`: account line, modal, locked name plate, taken-name check on Start.
- `App.tsx` / menu: Profile screen state and the header button.
- Strings EN + RU in a new `src/i18n/accountStrings.ts`.
- Achievement categories: add a `category` field to each achievement definition.
- Each file ≤ 200 lines; every error handled explicitly (network failures logged and shown as a
  friendly message, never swallowed).
- Tests: nickname encoding (Cyrillic, case), merge rules (never lowers a value), sync with a fake
  client (dirty retry, offline), setup modal states, taken-name blocking, profile rendering of
  locked/unlocked/progress, menu button.

## Release

One feature branch and PR, one 0.4.x version with a short patch note (per the release process).
