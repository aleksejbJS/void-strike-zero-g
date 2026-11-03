# Player Accounts & Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nickname + password accounts (Supabase) that carry achievements, fighter XP and the fighter's look across devices, plus a full-screen Profile with all achievements.

**Architecture:** `localStorage` stays the game's working copy. A new `src/account/` layer reads/writes a whole `PlayerSnapshot` from the existing storage modules, merges it with the cloud copy (never lowering a value) and pushes it to Supabase after matches, unlocks and look changes. React gets the account state from an `AccountProvider`; the setup screen gets a link + modal, the menu a Profile button, and a new Profile screen renders the snapshot.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind (Hazard Bay `bay-*` tokens), Vitest + Testing Library (jsdom, `localStorage` is a `vi.fn` mock from `src/test/setup.ts`), `@supabase/supabase-js` v2.

**Spec:** `docs/plans/2026-11-03-accounts-profile-spec.md` (read it first; mockups in `.superpowers/brainstorm/69129-1793718200/content/profile-layout.html` option A and `setup-account.html` option A).

## Global Constraints

- No file over 200 lines; one responsibility per file; named exports (existing default exports stay).
- Every error handled explicitly: log with `console.warn`/`console.error` and surface a friendly message; no empty `catch`.
- No secrets in code: Supabase URL/anon key only via `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `.env.local` is already git-ignored (`*.local`).
- Missing env → `status: 'disabled'`: account UI hidden, Profile still works for the guest, game unchanged.
- Network problems never block a match: the taken-name check times out after 3000 ms and lets the guest through.
- Merge never lowers progress, XP, or unlock state.
- Every UI string EN + RU in `src/i18n/accountStrings.ts`, merged in `src/i18n/locales.ts` like `setupStrings`.
- Code comments and commits in English. Hazard Bay look; check RU text renders (Fira fallback).
- Nickname rules verbatim from the spec: 3–12 chars, letters (Latin or Cyrillic, not mixed), digits, `_`, `-`, single inner spaces, trimmed; same = trimmed + lower-cased; reserved `Anonymous` and `Bot <n>`.

## Review Focus

1. Supabase down / offline while pressing Start as a guest → Start proceeds after ≤3 s, no error dialog (test in Task 8).
2. Log in on a device whose guest progress is ahead on some achievements and behind on others → every value ends at the max (test in Task 3).
3. Log out while the last push fails → unsent snapshot kept under that user id, pushed when the *same* account logs in again, never given to another account (test in Task 6).
4. Cloud row with garbage (`achievements` not an object, negative/NaN XP, unknown achievement ids, invalid build) → sanitized to an empty/default snapshot part, no crash (test in Task 3).
5. Persisted session that cannot be refreshed at app start → app falls back to guest status, local data untouched (test in Task 7).

---

### Task 1: Nickname rules and email encoding

**Files:**
- Create: `src/account/nickname.ts`
- Test: `src/account/nickname.test.ts`

**Interfaces:**
- Produces:
  - `export const NICK_MIN = 3, NICK_MAX = 12`
  - `export type NicknameError = 'too_short' | 'too_long' | 'bad_chars' | 'mixed_scripts' | 'reserved'`
  - `export function normalizeNickname(raw: string): string` — trim, collapse inner whitespace runs to one space.
  - `export function nicknameKey(raw: string): string` — `normalizeNickname(raw).toLowerCase()`.
  - `export function validateNickname(raw: string): NicknameError | null`
  - `export function nicknameToEmail(raw: string): string` — `` `n${hex(utf8(nicknameKey(raw)))}@players.invalid` `` (hex of 12 Cyrillic letters = 48 chars, local part ≤ 64).
  - `export const GUEST_DEFAULT_NAME = 'Anonymous'`

- [ ] **Step 1: Write failing tests**: `validateNickname('Al')` → `'too_short'`; `'A'.repeat(13)` → `'too_long'`; `'Alex!'` → `'bad_chars'`; `'Аlex'` (Cyrillic А) → `'mixed_scripts'`; `'anonymous'`, `'Bot 3'` → `'reserved'`; `'Алексей'`, `'Alex_99'`, `'Big  Al'` → `null`; `normalizeNickname('  Big   Al ')` → `'Big Al'`; `nicknameToEmail('ALEX') === nicknameToEmail(' alex ')`; email local part of `'Ё'.repeat(12)` ≤ 64 chars and matches `/^n[0-9a-f]+@players\.invalid$/`.
- [ ] **Step 2:** `npx vitest run src/account/nickname.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** with `TextEncoder` for UTF-8; letters via `\p{Script=Latin}` / `\p{Script=Cyrillic}` regexes.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5: Commit** `feat(account): nickname rules and email encoding`

### Task 2: Achievement definitions split, categories, whole-progress API

**Files:**
- Create: `src/game/systems/achievementDefs.ts` (types + combat/modes defs), `src/game/systems/achievementDefsMore.ts` (movement/collecting/special defs) — split so each ≤ 200 lines
- Modify: `src/game/systems/achievements.ts` (keep manager + `track*` helpers; re-export `Achievement`, `AchievementProgress`, `ACHIEVEMENTS` so existing imports keep working)
- Test: `src/game/systems/achievements.test.ts` (extend)

**Interfaces:**
- Produces:
  - `export type AchievementCategory = 'combat' | 'movement' | 'modes' | 'collecting' | 'special'`; `Achievement.category: AchievementCategory`. Mapping: combat = first_blood, killer, slayer, executioner, chainsaw_master, sniper, demolition_expert; modes = flag_capturer, king_of_hill, survivor; movement = acrobatic, hook_master, speed_demon; collecting = collector, hoarder; special = perfectionist, veteran.
  - `AchievementManager.exportProgress(): AchievementProgress` (deep copy)
  - `AchievementManager.replaceProgress(p: AchievementProgress): void` (saves, no unlock toasts)
  - (Pushes are triggered by the existing `onAchievementUnlocked` listener plus match end — no per-tick progress listener is added.)

- [ ] **Step 1: Failing tests**: every achievement has one of the 5 categories and the mapping above; `replaceProgress({ killer: { progress: 10, unlocked: true } })` then `getAchievements()` shows killer unlocked and no unlock listener fired; `exportProgress()` mutation does not affect the manager.
- [ ] **Step 2:** `npx vitest run src/game/systems/achievements.test.ts` → new tests FAIL.
- [ ] **Step 3: Implement** the split and the three methods.
- [ ] **Step 4:** `npx vitest run` (whole suite — imports of `ACHIEVEMENTS` elsewhere must still resolve) → PASS.
- [ ] **Step 5: Commit** `refactor(achievements): split definitions, add categories and whole-progress API`

### Task 3: Player snapshot — read/write/clear local, sanitize, merge

**Files:**
- Create: `src/account/snapshot.ts` (types + sanitize + merge), `src/account/localSnapshot.ts` (localStorage I/O)
- Modify: `src/game/build/progress.ts` (export `setXp(xp: number): void`, the existing private `saveXp`), `src/store/uiStore.tsx` → move the `load*` helpers to new `src/store/playerStorage.ts` (brings uiStore under 200 lines) and add action `reloadPlayer(): void` that re-reads name, skin and colours from storage
- Test: `src/account/snapshot.test.ts`, `src/account/localSnapshot.test.ts`

**Interfaces:**
- Consumes: `AchievementProgress`, `achievementManager.exportProgress/replaceProgress` (Task 2); `loadXp`, `setXp`, `loadBuild`, `saveBuild`, `sanitizeBuild`, `DEFAULT_BUILD`.
- Produces:
  - `export interface FighterColors { player: string; head: string; torso: string; arms: string; legs: string; jetpack: string }`
  - `export interface FighterLook { build: FighterBuild; skinId: string; colors: FighterColors; savedAt: number }`
  - `export interface PlayerSnapshot { achievements: AchievementProgress; xp: number; look: FighterLook | null }` (`null` = guest never customised)
  - `export function sanitizeSnapshot(raw: unknown): PlayerSnapshot` — unknown achievement ids dropped, bad entries dropped, XP non-finite/negative → 0, invalid look → `null`.
  - `export function mergeSnapshots(a: PlayerSnapshot, b: PlayerSnapshot): PlayerSnapshot` — per id: max progress, unlocked = a||b, earliest defined `unlockedAt`; xp = max; look = larger `savedAt` (null loses).
  - `export function readLocalSnapshot(): PlayerSnapshot`; `writeLocalSnapshot(s: PlayerSnapshot): void` (also calls `achievementManager.replaceProgress`); `clearLocalSnapshot(): void` (removes `achievementProgress`, `fighterXp`, `fighterBuild`, `selectedSkin`, colour keys, `playerName`, `fighterLookSavedAt`; resets the manager).
  - `export function saveLookIfChanged(next: Omit<FighterLook, 'savedAt'>): boolean` — writes look keys and bumps `fighterLookSavedAt` to `Date.now()` only if different from what is stored; returns whether it changed.

- [ ] **Step 1: Failing tests** (`snapshot.test.ts`): merge of `{killer: 7/locked}` + `{killer: 10/unlocked, unlockedAt: 5}` → 10/unlocked/5 regardless of argument order; xp 120 vs 80 → 120; look with savedAt 2 beats savedAt 1, non-null beats null; `sanitizeSnapshot({ achievements: 'x', xp: -5, look: { build: 42 } })` → `{ achievements: {}, xp: 0, look: null }`; unknown id `'removed_ach'` dropped.
- [ ] **Step 2: Failing tests** (`localSnapshot.test.ts`, mocking `localStorage.getItem/setItem/removeItem`): round-trip write → read; `clearLocalSnapshot` removes every key listed above; `saveLookIfChanged` with an identical look returns false and does not write `fighterLookSavedAt`.
- [ ] **Step 3:** `npx vitest run src/account` → FAIL.
- [ ] **Step 4: Implement**; in `CharacterSetup.start()` replace the bare `saveBuild(build)` with `saveLookIfChanged({ build, skinId: preset.id, colors: … })` (keep the existing store actions).
- [ ] **Step 5:** `npx vitest run` → PASS (CharacterSetup tests still green).
- [ ] **Step 6: Commit** `feat(account): player snapshot, merge and local storage`

### Task 4: Supabase backend, API wrapper, keep-alive, owner setup

**Files:**
- Create: `supabase/migrations/20261103000000_accounts.sql`, `src/account/supabaseClient.ts`, `src/account/accountApi.ts`, `.env.example`, `.github/workflows/supabase-keepalive.yml`, `docs/supabase-setup.md`
- Modify: `package.json` (add `@supabase/supabase-js`), `.github/workflows/deploy.yml` (Build step env: `VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}`, `VITE_SUPABASE_ANON_KEY: ${{ vars.SUPABASE_ANON_KEY }}`)
- Test: `src/account/accountApi.test.ts`

**Interfaces:**
- Produces:
  - SQL: `profiles(id uuid primary key references auth.users on delete cascade, nickname text not null, nickname_key text not null unique, created_at timestamptz default now())` with RLS select-all, no client insert/update (rows are created only by a `security definer` trigger `after insert on auth.users` from `new.raw_user_meta_data->>'nickname'` / `'nickname_key'`, so an auth user can never exist without its profile row); `player_progress(user_id uuid primary key references auth.users on delete cascade, data jsonb not null, updated_at timestamptz default now())` RLS all-ops `auth.uid() = user_id`; `create function nickname_taken(nick_key text) returns boolean security definer` (select exists on `profiles.nickname_key`), granted to `anon, authenticated`.
  - `export function getSupabase(): SupabaseClient | null` (null when env missing; one shared client).
  - `export type AccountErrorCode = 'taken' | 'bad_credentials' | 'invalid_nickname' | 'network'`; `export class AccountError extends Error { code: AccountErrorCode }`
  - `export interface AccountUser { id: string; nickname: string }`
  - `export interface AccountApi { signUp(nick: string, password: string): Promise<AccountUser>; logIn(nick: string, password: string): Promise<AccountUser>; logOut(): Promise<void>; currentUser(): Promise<AccountUser | null>; isNicknameTaken(nick: string): Promise<boolean>; fetchSnapshot(userId: string): Promise<PlayerSnapshot | null>; saveSnapshot(userId: string, s: PlayerSnapshot): Promise<void> }`
  - `export function createAccountApi(client: SupabaseClient): AccountApi` — uses `nicknameToEmail`; `signUp` validates first (`invalid_nickname`), passes `options.data = { nickname, nickname_key }` (normalized nickname + `nicknameKey`) for the trigger, maps Supabase "already registered" → `taken`, "invalid login credentials" → `bad_credentials`, fetch/timeout failures → `network`; a sign-up that returns no session (email confirmation left on) is an `AccountError('network')` with a console.error naming the Supabase setting; `logIn` reads the display nickname from `profiles`; `isNicknameTaken` returns `false` without a request for names that fail `validateNickname`; `fetchSnapshot` runs `sanitizeSnapshot` on `data`.

- [ ] **Step 1: Failing tests** with a hand-rolled fake client (only the methods used): sign-up of `' Alex '` calls `auth.signUp` with `nicknameToEmail('Alex')` and `options.data` `{ nickname: 'Alex', nickname_key: 'alex' }`; `isNicknameTaken('Alex!')` → false with no rpc call; "User already registered" → `AccountError('taken')`; `'Аlex'` → `invalid_nickname` without calling the client; a thrown `TypeError('Failed to fetch')` → `network`; `fetchSnapshot` with garbage `data` → sanitized; `currentUser` with no session → `null`.
- [ ] **Step 2:** `npx vitest run src/account/accountApi.test.ts` → FAIL.
- [ ] **Step 3: Implement**; `npm i @supabase/supabase-js@^2`.
- [ ] **Step 4:** keep-alive workflow: `schedule: cron '0 6 */3 * *'` + `workflow_dispatch`, one `curl` POST to `${{ vars.SUPABASE_URL }}/rest/v1/rpc/nickname_taken` with the anon key headers and `{"nick_key":"keepalive"}`, `--fail`.
- [ ] **Step 5:** `docs/supabase-setup.md`: create free project → Authentication → turn off "Confirm email" → SQL editor: run the migration → Settings/API: copy URL + anon key → GitHub repo Settings → Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`; local dev: copy `.env.example` to `.env.local`. Written for a non-developer, in Russian with screenshots-free numbered steps.
- [ ] **Step 6:** tests PASS; `npm run build` succeeds without env.
- [ ] **Step 7: Commit** `feat(account): Supabase schema, API wrapper and keep-alive`

### Task 5: Sync engine

**Files:**
- Create: `src/account/sync.ts`
- Test: `src/account/sync.test.ts`

**Interfaces:**
- Consumes: `AccountApi` (Task 4); `readLocalSnapshot`, `writeLocalSnapshot`, `mergeSnapshots` (Task 3).
- Produces: `export function createSync(api: AccountApi, opts?: { debounceMs?: number }): Sync` where `interface Sync { pull(userId: string): Promise<void>; requestPush(userId: string): void; flush(userId: string): Promise<boolean>; hasPending(userId: string): boolean; dispose(): void }`
  - `pull`: fetch → merge with local → write local → if merged ≠ remote, `flush`.
  - `requestPush`: marks `accountDirty:<userId>` = `'1'` in localStorage and debounces (default 2000 ms) a `flush`.
  - `flush`: fetch → merge → save → clear dirty; on failure keep dirty, `console.warn`, return false.

- [ ] **Step 1: Failing tests** (fake api, `vi.useFakeTimers`): three `requestPush` within 2 s → one `saveSnapshot`; `saveSnapshot` rejecting → `hasPending` true, next `flush` succeeds → false; `pull` where remote xp 200, local 50 → local written with 200 and no save; remote missing (null) → local pushed.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(account): pull/push sync with dirty retry`

### Task 6: Pending snapshot on logout

**Files:**
- Create: `src/account/pendingStore.ts`
- Test: `src/account/pendingStore.test.ts`

**Interfaces:**
- Produces: `savePending(userId: string, s: PlayerSnapshot): void`, `takePending(userId: string): PlayerSnapshot | null` (reads + removes key `accountPending:<userId>`, sanitized).

- [ ] **Step 1: Failing tests**: save for `u1`, `takePending('u2')` → null, `takePending('u1')` → the snapshot, second `takePending('u1')` → null; corrupt JSON → null + warning.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(account): keep unsent progress across logout`

### Task 7: AccountProvider (state, login/logout flows, push triggers)

**Files:**
- Create: `src/account/AccountProvider.tsx`, `src/account/useAccount.ts`
- Modify: `src/index.tsx` (wrap `App` with `AccountProvider` inside `UIProvider`), `src/components/hud/useMatchRewards.ts` (after `addMatchXp` call `notifyProgressChanged()`)
- Test: `src/account/AccountProvider.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–6, `achievementManager.onAchievementUnlocked` (existing), `actions.reloadPlayer`.
- Produces:
  - `export type AccountStatus = 'disabled' | 'loading' | 'guest' | 'loggedIn'`
  - `export interface AccountState { status: AccountStatus; nickname: string | null; signUp(nick: string, pw: string): Promise<void>; logIn(nick: string, pw: string): Promise<void>; logOut(): Promise<void>; isNicknameTaken(nick: string): Promise<boolean> }` (methods reject with `AccountError`)
  - `export function useAccount(): AccountState`
  - `export function notifyProgressChanged(): void` (module-level event the provider listens to)
  - `AccountProvider` accepts optional `api?: AccountApi | null` prop for tests (default `getSupabase()` → `createAccountApi`, null → `'disabled'`).
- Flows: start → `currentUser()` (error → `'guest'`, warn) → if user: `takePending` merge into local, `pull`, `reloadPlayer`. `signUp`/`logIn` → merge pending + local → `pull` → write `playerName` = account nickname → `reloadPlayer`. `logOut` → `flush`; if false → `savePending(userId, readLocalSnapshot())`; then `api.logOut()`, `clearLocalSnapshot()`, `reloadPlayer` → `'guest'`. While logged in: `onAchievementUnlocked`, `notifyProgressChanged` → `requestPush`.

- [ ] **Step 1: Failing tests** (fake api): no api → `'disabled'`; `currentUser` rejects → `'guest'`; `logIn` success → status `'loggedIn'`, nickname `'Alex'`, `playerName` written `'Alex'`; logout with failing flush → pending saved for that id, local cleared; logging in again as the same id → pending merged and pushed; unlock after login → one `saveSnapshot` after debounce.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(account): account provider with login, logout and auto-sync`

### Task 8: Setup screen — account line, modal, locked name, taken check

**Files:**
- Create: `src/components/setup/account/AccountLine.tsx`, `src/components/setup/account/AccountModal.tsx`, `src/components/setup/account/NamePlate.tsx`, `src/components/setup/account/useTakenCheck.ts`, `src/i18n/accountStrings.ts`
- Modify: `src/components/setup/CharacterSetup.tsx` (render line/plate under the name; Start awaits the taken check; when `saveLookIfChanged` returns true call `notifyProgressChanged()`), `src/i18n/locales.ts`
- Test: `src/components/setup/account/AccountModal.test.tsx`, extend `src/components/setup/CharacterSetup.test.tsx`

**Interfaces:**
- Consumes: `useAccount` (Task 7), `validateNickname`, `GUEST_DEFAULT_NAME` (Task 1).
- Produces: `useTakenCheck(): (name: string) => Promise<boolean>` — false for `'Anonymous'`/empty, for `status` ≠ `'guest'`, and on timeout (3000 ms) or error (warn).
- UI per mockup A: guest → `🔒 Protect nickname with a password · Log in`; modal tabs New account / Log in, nickname prefilled, password field, the "cannot be recovered" warning on New account, inline errors for each `AccountErrorCode` and `NicknameError`; logged in → plate `<nick> 🔒 account` + `Profile →` (calls a new optional `onOpenProfile?: () => void` prop on `CharacterSetup`; link hidden when absent — App wires it in Task 9); `AccountModal` exported as `AccountModal: React.FC<{ initialTab: 'signup' | 'login'; initialNickname: string; onClose: () => void }>` for reuse by Task 9; status `'disabled'` → nothing new rendered.

- [ ] **Step 1: Failing tests**: guest sees both links; clicking Log in opens the modal on the Log in tab; `taken` error shows the taken message; logged-in renders the plate and no input; guest with name `Alex` and `isNicknameTaken` → true: Start does not call `onContinue` and the modal opens on Log in with `Alex`; `isNicknameTaken` never resolving → Start continues after 3000 ms (fake timers); `'disabled'` renders the old screen unchanged.
- [ ] **Step 2–4:** FAIL → implement → PASS; `CharacterSetup.tsx` stays ≤ 200 lines.
- [ ] **Step 5:** run the app (`npm run dev`), check EN + RU at 1512×700 and phone landscape 640×290.
- [ ] **Step 6: Commit** `feat(setup): protect nickname with a password, log in, taken-name check`

### Task 9: Profile screen and menu button

**Files:**
- Create: `src/components/profile/ProfileScreen.tsx`, `src/components/profile/ProfileSummary.tsx`, `src/components/profile/AchievementGrid.tsx`, `src/components/profile/AchievementCard.tsx`, `src/components/menu/ProfileButton.tsx`
- Modify: `src/App.tsx` (`showingProfile` state; Profile reachable from menu and from setup's `Profile →`), `src/components/menu/MainMenu.tsx` (header button), `src/i18n/accountStrings.ts`
- Test: `src/components/profile/ProfileScreen.test.tsx`, extend `src/components/menu/MainMenu.test.tsx`

**Interfaces:**
- Consumes: `useAccount`, `achievementManager.getAchievements/getTotalXP`, `loadXp`, `levelForXp`, `XP_PER_LEVEL`, `AchievementCategory`.
- Produces: `ProfileScreen: React.FC<{ onBack: () => void }>`; `ProfileButton: React.FC<{ onOpen: () => void }>`.
- Content per mockup A: back button, cloud marker when logged in; left: nickname (guest: current `playerName`), title = `reward.title` of the unlocked achievement with the highest `reward.xp` (none → hidden), level + bar, tiles `N/17` and achievement XP; logged in → Log out (confirm dialog) / guest + not disabled → "Protect your nickname" opening `AccountModal`; right: filters All/Combat/Movement/Modes/Collecting/Special, grid with locked cards greyed + `progress / max` bar, border by rarity.

- [ ] **Step 1: Failing tests**: 17 cards under All; Special filter shows exactly veteran + perfectionist; a locked card with progress 32/100 shows `32 / 100`; title shows `Veteran` when only veteran (and lower-XP ones) are unlocked; logged-in shows Log out, guest shows the protect CTA, disabled shows neither; menu button shows the nickname with 🔒 when logged in, "Profile" for a guest, and calls `onOpen`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** run the app, check EN + RU at 1512×700 and phone landscape.
- [ ] **Step 6: Commit** `feat(profile): profile screen with all achievements`

### Task 10: Release

- [ ] `git fetch`, take the next free `0.4.x` from `origin/main`; add a short grouped patch note (EN + RU) in `src/components/menu/patchNotes.ts` and `CHANGELOG.md`.
- [ ] `npm run lint && npx vitest run && npm run build` → all green.
- [ ] PR body includes the owner setup steps from `docs/supabase-setup.md` and states that accounts stay hidden until the GitHub variables are set.
- [ ] Commit `docs: 0.4.x release notes`; merging waits for the owner's "влей".
