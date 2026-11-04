# Account Hardening Spec (0.4.26)

Status: approved by the owner 2026-11-04 (decisions below are final). Follows
`docs/plans/2026-11-03-accounts-profile-spec.md`.

## 1. A lost session leaks account A's progress into account B

**Problem.** When a session dies without a logout on this device (expired, revoked, cleared by the
browser), start-up shows a guest but local storage still holds A's achievements, XP and look. A later
login as B merges all of it into B.

**Decision.** A device-owner marker (`accountOwner` in localStorage, `src/account/deviceOwner.ts`) is
written when any login completes and removed on logout. Start-up with no usable session
(`currentUser()` null or rejecting) and an owner marker: the local snapshot is saved as that account's
pending progress (merged with any pending it already had), local data is cleared and the device becomes a
clean guest. Only that account gets it back, on its next login. No marker = a genuine guest: untouched.
Offline with a known session is not "gone": `currentUser()` already answers from the stored session and
the cached nickname. As a second lock, `completeLogin` sets the owner's data aside the same way if a
*different* account logs in while the marker still names someone else. While logged in, the provider
listens to Supabase `SIGNED_OUT` (`AccountApi.onSessionEnded`, Supabase details in `accountSession.ts`)
and runs the logout steps (flush attempt, pending, clear, guest) without calling the server signOut.
Limitation: devices that lost their session before 0.4.26 have no marker and cannot be told apart.

## 2. Hidden login after an error

**Problem.** `signInWithPassword` succeeds, reading the nickname fails: the window says "failed", but the
session is stored and the next reload logs the player in silently.

**Decision.** Fall back to `user_metadata.nickname` (written at sign-up). Without a usable one, end the
fresh session (`signOut({ scope: 'local' })`, removing the stored session by hand if that fails) and
then reject.

## 3. Start under someone else's nickname while accounts load

**Problem.** The taken-name check runs only for status `guest`; during `loading` Start launched at once.

**Decision.** During `loading` Start waits (busy button, up to `TAKEN_CHECK_TIMEOUT_MS` = 3 s): logged in
→ the account nickname; guest → the taken check; still loading → start anyway with a warning. A restored
login re-creates the setup screen; the waiting Start carries over to the new screen.

## 4. Look-alike nicknames — strict whitelist

**Decision.** New names (sign-up and the guest name on the setup screen) may contain only A-Z, a-z,
А-Я, а-я, Ё, ё, 0-9, space, `_`, `-`, and must not mix Latin and Cyrillic. Logging in keeps the wider
0.4.22 rules (`validateExistingNickname`), so existing accounts keep working; keys and the e-mail
encoding are unchanged. The sign-up trigger gets the same whitelist
(`supabase/migrations/20261105000000_account_hardening.sql`). A guest name that breaks the rules blocks
Start with a translated hint; empty / "Anonymous" stay allowed.

## 5. Nickname takeover by e-mail change

**Decision.** A `before update of email on auth.users` trigger rejects any real e-mail change (the fake
e-mail is the nickname). Same migration; the owner runs it in the SQL editor (`docs/supabase-setup.md`).

## 8. Account windows and keyboard / mouse races

**Decision.** While the account window or the logout question is open, everything else is `inert`
(`src/components/useModalLayer.ts`, shared). The account links are disabled while Start is busy; a
check that answers while a window is open never launches the match; the account window is keyed on its
request. A submit refused because an earlier request is still running says "Previous request is still
finishing, try again in a moment" (new `AccountError` code `busy`) instead of "no connection".
