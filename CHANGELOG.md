# Void Strike: Zero-G - Changelog

## Version 0.4.27 (2026-11-04)

### 🎯 Railgun and Armor Slivers
- Armor absorbs `min(armor, dmg × 0.66)`, so hits left fractional leftovers like 0.3 while the HUD showed `Math.round(armor)` = 0; the railgun then wounded a fighter who seemed to have no armor. Armor below 1 now counts as none: one shared helper (`systems/armor.ts`: `hasArmor`, `absorbArmor`) clears any leftover below 1 to 0 right after armor absorbs a hit, and `shouldWound` checks `hasArmor` (armor ≥ 1). The damage maths moved out of `combat.ts` into the helper

### 🪝 Hook Reels, Jetpack Rests
- While the grapple is attached, W/Space only reel in: the jetpack does not fire (no thrust, no flame, `jetpackOn` false, no fuel spent) and the tank refills the whole time the hook is attached, even while W is held (before, a reeling player also thrust and burned fuel). `movement.ts` computes `flying = input.isFlying && !p.grapple.active` once and uses it for thrust, `jetpackOn`, air strafe and recharge, so the rule is shared by offline play, the server, client prediction and bots

## Version 0.4.26 (2026-11-04)

### 🛡️ Account Hardening
- Spec: `docs/plans/2026-11-04-account-hardening-spec.md`. **Owner step before merging:** run `supabase/migrations/20261105000000_account_hardening.sql` in the Supabase SQL Editor (`docs/supabase-setup.md`, last section)
- Lost sessions: a device-owner marker (`accountOwner`, `src/account/deviceOwner.ts`) is written when a login completes and removed on logout. A start-up that finds no usable session while the marker names an account keeps the local progress as that account's pending progress (`pendingStore`) and leaves a clean guest; a genuine guest (no marker) is never touched, and an offline start with a known session stays logged in as before. `completeLogin` also sets a previous owner's progress aside before another account logs in. While logged in, Supabase `SIGNED_OUT` (`AccountApi.onSessionEnded`, `accountSession.ts`) runs the logout steps without a second server sign-out
- Log in: when the nickname cannot be read after a successful sign-in, the nickname from the sign-up metadata is used; without one the fresh session is ended again (`signOut({ scope: 'local' })`, or removed from storage) before the error, so a reload cannot log the player in silently
- Start while accounts load: the button waits (busy) up to 3 s for the start-up; logged in → account nickname, guest → taken-name check, still loading → starts with a warning. A Start waiting when a restored login re-creates the screen carries over to the new screen
- Nickname whitelist for new names (sign-up and guest names): A-Z, a-z, А-Я, а-я, Ё, ё, digits, space, `_`, `-`, no Latin+Cyrillic mix. Log-in keeps the 0.4.22 rules (`validateExistingNickname`) so existing accounts still work; keys and e-mails are unchanged. The sign-up trigger repeats the whitelist (contract test extended). A broken guest name blocks Start with a hint under the name field (EN/RU)
- The account e-mail is locked: a `before update of email on auth.users` trigger (`prevent_email_change`) rejects any change, so nobody can move their account onto another nickname's address
- Account windows (`useModalLayer`): the page behind the account window and the logout question is `inert`; Esc and focus return are shared. The account links are disabled while Start is busy, a name check that answers while a window is open never launches the match, and the window is keyed on its request. A login / logout refused because an earlier one is still finishing says so (new `AccountError` code `busy`) instead of "no connection"

## Version 0.4.25 (2026-11-04)

### 🏆 Tournaments
- A knockout of 1-on-1 duels for up to 8 players (spec: `docs/plans/2026-11-04-tournament-spec.md`, plan: `docs/plans/2026-11-04-tournament-plan.md`, owner setup: `docs/supabase-setup.md`, "Tournaments"). New menu button **Tournaments**: the public list of open tournaments (sign up, or watch a running one), **+ Create tournament** and joining by a friend's link (`?tournament=<id>`). Guests may play with just a nickname; a logged-in player's account nickname is used. The button appears only when the build has the Supabase settings
- Lobby and start: 8 seat tiles ("free → bot"), a rules line, Copy link, and Start for the creator. Every signed-up browser sends a lobby heartbeat (`lobby_seen`, every 15 s); if the creator's tab has been silent for 60 s, Start goes to the earliest-joined player who is still present (the server checks the same rule, `start_tournament`). At least 2 humans are needed; the bracket has 4 places for 2–4 humans and 8 for 5–8, seats are shuffled at start and empty places become bots. If the creator leaves before the start the role passes to the earliest sign-up; an unstarted lobby expires after 30 minutes (the screen then says so instead of offering Start) and a finished tournament stays listed for 10 minutes
- Matches: all matches of a round run in parallel, and a node starts as soon as both of its feeder matches are done. Bot vs bot is decided at once by a coin flip. Human vs bot is hosted by the human's browser. Human vs human: the lower human seat hosts the match room and publishes its PeerJS id, the other browser joins by itself (no link to paste). Your part runs by itself on every tournament screen (list, bracket, watch): the autopilot (`components/tournament/autopilot/`) starts your duel when it is ready and tells the server you are there (`match_seen` every 10 s). A ready match is closed by walkover once a side has sent no heartbeat for 60 s: that side loses (both silent: a coin flip). Any browser can call `resolve_stale`, so a bracket never waits for a player who left. A match still open 25 minutes after it became ready (`ready_at`) is closed too, by the same stale-side rule and by a coin flip when both sides are still there (sudden death has no cap of its own). Escape during an unfinished duel asks first ("Press Esc again to forfeit the match"); a second Escape within 2 s forfeits: no more heartbeat, so the opponent wins by the 60 s rule. A guest whose link drops stays in the duel with a "Reconnecting…" overlay and dials the host again for up to 60 s, keeping its score; after that it counts as absent. The host drops a guest that sent no input for 8 s (`RoomConfig.idleKickMs`, duel rooms only), so a reloaded guest gets its seat back. The match host reports the result (no anti-cheat in this version); the result is queued and retried every 5 s until the server takes it, even after the duel screen closed
- The duel (`GameMode.DUEL`, tournament-only, not in the mode menu): first to 10 kills, a 10-minute cap (the leader wins; a tie goes to the next kill, sudden death, and so does a 10:10 after a mutual kill at 9:9), no auto-restart (`RoomConfig.restartMatches` and `RoomConfig.bots`, both optional, so the other modes are unchanged). Both fighters spawn and respawn with the same loadout: machine gun, shotgun, railgun, rocket launcher, grenade launcher, smoke launcher and chainsaw, each with its normal ammo, no plasma (`systems/duelRules.ts`). The HUD shows up to 7 weapon slots and "Sudden death" instead of a stuck 0:00. The duel end screen reads "Back to bracket" instead of "Next match"; Escape on it goes back to the bracket
- New map **The Pit** (`MapId.PIT`, `data/pitMap.ts`, `render/scene/themes/pitTheme.ts`): a closed 2600 × 1400 box, mirrored left to right, a tower of ledges on each side with a spawn at its foot, stacked platforms in the middle with health, armor and ammo pickups only (no weapons), two high ledges for jetpack play. Bot waypoints in `level.ts`. Two in-world poster places `pit.wall-poster-a` and `pit.wall-poster-b` (300×250) in `public/ads.json` and on the ad settings page; house posters fill them until the owner adds codes
- Bracket screen: quarterfinals, semifinals, final, trophy; the winner highlighted and the loser crossed out, a LIVE tag on running matches (live scores are on the watch screen's strip), a walkover marked as such, your own match outlined, and a banner about your part. It shows between your matches: the duel returns to it when it ends
- Watching: a new spectator role in the room host (`WATCH` / `WATCHING` messages, `SpectatorSession`). A spectator receives snapshots and events, has no body and no input and takes no player place; at most `SPECTATOR_CAP` (6) per match, a full match answers `spectators_full`; only rooms that allow it (`RoomConfig.spectators`, set for tournament duels) accept `WATCH`. The split screen (`components/tournament/watch/*`) gives every watched match its own Pixi application and game state: 1 match fills the screen, 2 split in halves, 3–4 make a 2×2 grid; click a tile to expand it and click again to go back; only the focused tile plays sound; a strip on top shows the live scores and lets you tick which matches to watch (up to 4). Small tiles draw no ads; an expanded tile shows the Pit posters. A tile whose host goes silent gives up after 5 s, and a tile whose host left is retried automatically; every tile animates its fighters with its own memory; phones show one match at a time and switch by swipe. While your own match is being set up, the watch screen says "Your match is starting…"
- Achievements (awarded on each player's own client from the finished bracket, `tournament/awardTournament.ts`): `tournament_champion` (legendary), `tournament_finalist` (epic), `tournament_flawless` (rare, a played 10:0 win). Champion and Finalist need at least one played win, a walkover never counts. A walkover gives no match XP either, because XP is only paid when a duel really ends. Names stay English, like the other achievements; the usual unlock toast also shows on the bracket
- Supabase (`supabase/migrations/20261104000000_tournaments.sql`, tests in `supabase/tests/tournaments.test.sql`, run by `bash scripts/test-sql.sh` against a throwaway local Postgres): tables `tournaments`, `tournament_seats` and `tournament_matches` with row level security and read-only grants, plus `tournament_presence` (the fighters' heartbeats, not readable by browsers); every write is a `security definer` RPC (`create_tournament`, `join_tournament`, `leave_tournament`, `lobby_seen`, `start_tournament`, `match_seen`, `publish_host`, `report_result`, `resolve_stale`; the internal bracket step is `tournament_settle`), one transaction per bracket step, so browsers never race each other. A joining player gets a random 32-byte seat secret once (only its SHA-256 is stored; the browser keeps it in `localStorage`, or in memory when that is unavailable) and every later write must show it. Realtime carries only `tournaments` and `tournament_matches`; **`tournament_seats` and `tournament_presence` are deliberately not published**: every seat change bumps `tournaments.updated_at` so the lobby reloads, heartbeats never touch a published row (so they do not reload every watching browser), and an open lobby is re-read every 15 s for the presence it shows. The feed falls back to polling every 5 s if Realtime is unavailable. Creating and joining have no rate limit in this version
- The old Node server does not accept `SERVER_MODE=DUEL`: the duel is tournament-only (`server/src/config.ts`)
- **Owner run is the merge gate** (merging is the release, production already has the Supabase settings, so the Tournaments button appears as soon as it deploys, and there is no preview site): run the migration in the Supabase SQL Editor (safe to run again, also over an earlier version), check Realtime, then play the check list locally (`npm run dev` with the production Supabase values in `.env.local`), and only then merge. Step by step: `docs/supabase-setup.md`, "Tournaments"

## Version 0.4.24 (2026-11-04)

### 🌫️ Smoke Launcher Picture
- The smoke launcher had no picture of its own: on the map it was drawn from a few grey shapes (`render/smokeLauncherPickup.ts`), which read as an unclear blob next to the rendered weapon sprites; fighters held the green grenade launcher; the HUD used a flat cartoon SVG
- New pictures made from the grenade launcher render (`granat.png`): the body in gunmetal grey, the coloured grenades in the drum turned into white smoke canisters. `assets/items/smoke_launcher.png` (with a smoke puff at the muzzle) lies on the map; `assets/hud/smoke_launcher.png` (240×103, cropped exactly like `hud/grenade_launcher.png`, so the grip points still fit) is held by fighters and shown in the HUD
- `withSharedPictures` still lends the grenade launcher's pictures, now for the map sprite too, if the smoke launcher's own fail to load. Removed `smokeLauncherPickup.ts` and `hud/smoke_launcher.svg`; asset bundle bumped to `game-assets-v14`

## Version 0.4.23 (2026-11-04)

### 🪝 Jetpack Refills on the Hook
- The jetpack tank refilled only on the ground (`isGrounded`), so hanging on your own hook left it empty. It now also refills while the grapple is attached (`grapple.active`), at the same `JETPACK_RECHARGE` rate, and still not while thrusting (`movement.ts`). The rule lives in the shared Force Pipeline, so it applies offline, online and to bots alike

## Version 0.4.22 (2026-11-03)

### 🔒 Accounts and Profile
- Nickname + password accounts on Supabase (spec: `docs/plans/2026-11-03-accounts-profile-spec.md`, owner setup: `docs/supabase-setup.md`). A nickname is an account; no email and no password recovery (the sign-up form says so). Supabase email+password auth with "Confirm email" off: the nickname is turned into a never-mailed address (`nicknameToEmail`, lower-cased and hex-encoded at a reserved domain), so Supabase's unique email makes the nickname unique, case-insensitively. A database trigger repeats the nickname rules, so the public anon key alone cannot register a bad or look-alike name (`supabase/migrations/20261103000000_accounts.sql`, `src/account/nicknameEmailContract.test.ts` keeps the SQL and the browser rules in step)
- Nickname rules (`src/account/nickname.ts`): 3–12 characters, Latin or Cyrillic letters, digits, `_`, `-` and single inner spaces, trimmed; Latin and Cyrillic letters cannot be mixed in one nickname (no `Alex` with a Cyrillic `А`); `Anonymous` and `Bot <n>` are reserved; password at least `PASSWORD_MIN` (6) characters
- Setup screen (`components/setup/account/*`): a guest sees `🔒 Protect nickname with a password · Log in` under the name field, opening a modal with New account and Log in tabs (the nickname is taken from the name field; inline errors for a taken nickname, wrong nickname or password, a weak password, too many attempts and no connection). A logged-in player gets a locked name plate `Alex 🔒 account` with a `Profile →` link; the name changes only by logging out. A guest who types a taken name is stopped on Start with "This name is taken. If it's your account, enter the password" and the modal opens on Log in; if the check cannot reach the service the guest is let through. When logged in, the account nickname is the name sent when joining an online game
- What syncs (`src/account/sync.ts`, `snapshot.ts`): achievements (progress, unlocked, unlock time), fighter XP (so unlocked parts) and the fighter's whole look (build, preset and body colours, as one value with a `savedAt` that moves only when the look really changes). The merge never lowers anything: per achievement the higher progress, unlocked if either side is, the earliest unlock time; XP the higher of the two; the look the most recently changed one. It runs on sign-up, log in, app start while logged in (pull), and on every push
- Push: after a match, an achievement unlock and a saved build (`usePushTriggers`, `progressEvents.ts`), debounced by 2 s so a burst of unlocks is one request; fetch, merge, upsert. A failed push stays dirty and is retried on the next push, on app start and when the browser comes back online. `localStorage` is still the working copy the game reads and writes, so offline play, a Supabase outage or a missing connection never stop a match from starting
- Log out: confirm, one last push, then the device becomes a clean guest (local achievements, XP, look and name are cleared; the cloud copy is untouched). If that push fails the unsent progress is kept on the device under that account's id (`pendingStore.ts`) and pushed the next time the same account logs in here; it is never given to another account or merged into a guest, so logging out never loses progress
- Profile screen (`components/profile/*`, new, full screen): nickname, title of the unlocked achievement with the most XP, fighter level and a bar to the next one, tiles with achievements N/17 and achievement XP, filter chips (All, Combat, Movement, Modes, Collecting, Special; every achievement definition now has a `category`) and a grid of all 17 achievements, unlocked ones in colour with their reward and locked ones greyed with a progress bar and `progress / max`, border by rarity. Veteran shows hours (`2 / 10 h`), King of the Hill shows seconds (`123 / 500 s`) (`achievementProgress.ts`). Logged in: a "saved in your account" marker and Log out; guest: the same screen from local data with a "Protect your nickname" call to action. The main menu header gets one button: `Profile`, or the nickname with a 🔒 when logged in. Names and descriptions of achievements stay English, as in the HUD; the in-match panel and toast are unchanged
- Guest play is unchanged: nobody is ever forced to register. If the build has no Supabase settings, every account control is hidden and the game is guest-only, while the Profile screen still works from local data. `@supabase/supabase-js` is loaded on demand (`loadAccountApi.ts`), so it stays out of the first bundle
- Keep-alive: a free Supabase project pauses after 7 days without requests, which would stop log in, sync and the taken-name check (not the game). The scheduled workflow `.github/workflows/supabase-keepalive.yml` calls `nickname_taken` with the public key every 3 days and warns (without failing) when the variables are not set
- Strings EN + RU in `src/i18n/accountStrings.ts`
- **Owner setup needed before accounts appear**: create a free Supabase project, turn "Confirm email" off, run the SQL migration, and add the GitHub Actions **variables** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (`deploy.yml` passes them to the build as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; locally use a git-ignored `.env.local`, see `.env.example`). Until both are set the released game shows no account UI. Step by step: `docs/supabase-setup.md`

## Version 0.4.21 (2026-11-03)

### 📜 Ad Settings Page Scrolls
- The ad settings page (`#ads-admin`) could not be scrolled: the game turns page scrolling off (`body { overflow: hidden }` in `index.html`), so on a laptop only the first of the 11 ad places was reachable. The page's `<main>` is now its own scroll container (`h-screen overflow-y-auto`); the game itself is unchanged. Owner-only page, so no player patch note

## Version 0.4.20 (2026-11-03)

### 🦵 Railgun Wound
- A railgun beam on a fighter with any armor (> 0) no longer kills (spec: `docs/plans/2026-11-03-railgun-wound-spec.md`): armor drops to 0, health becomes min(health, `WOUND_HEALTH` = 10) and the fighter loses the back leg (`Entity.wound = { by: shooterId }`, `systems/wound.ts`). A beam on an unarmored fighter still kills, including a wounded one (the wound burned the armor). A wounded fighter who picks up armor and is beamed again is wounded again: armor 0, health min(·, 10), the bleed credited to the newest shooter, no second leg thrown. Only the railgun wounds; the Hunger round-start shield still blocks the beam
- Bleeding: −`BLEED_HP_PER_S` (1) HP per second, applied per tick (`systems/bleeding.ts`, after the players loop in `updatePhysics`) as plain health loss: no armor, knockback, Hold the Flag bonus or damage number. Paused once the Hunger round is decided (and stops with the match). Any medkit (+25 HP as before) gives the leg back and stops it; death and respawn clear the wound
- Kill credit (`killCredit`): a wounded fighter who bleeds out, or dies with no other player as the killer (own splash, falling off the map, the Hunger zone), is a railgun kill by the shooter: score, kill-feed line with Railgun, Gun Game progress and the railgun achievement, whatever the shooter holds now. Kills by anyone else count as before. A bled-out body slumps (`fall`)
- Without the leg: ground speed is `PRONE_SPEED` (~60 px/s, a quarter of a run) in `applyMovement`, so the host and online client prediction agree; jump, jetpack, grapple, crouch, lying down, shooting and carrying a flag are unchanged. `wound` travels in the snapshot
- Look: a `LIMB` event throws a torn back leg along the beam with a blood burst at the hip (`launchLimb`, `addLimb`); the wounded fighter is drawn with one leg and a bloody stump, hops on one leg while moving on the ground and drips blood from the stump (one drop per 150 ms, client-side, none while hidden in smoke); a wounded fighter's corpse (`DEATH` with `oneLeg`) has one leg whatever killed them
- HUD: a pulsing red blood drop right after the HP digits while bleeding, on desktop and on the phone top bar (`BleedingDrop`, `hud.bleeding` label)
- Bots: a wounded flag carrier now also detours for a medkit, and route planning for a wounded bot uses the hop speed, so long walks cost more and jetpack and hook win

## Version 0.4.19 (2026-11-03)

### 💨 Smoke Launcher
- New weapon `SMOKE_LAUNCHER`: "the same grenade launcher, only smoke" (spec: `docs/plans/2026-11-03-smoke-grenade-spec.md`). A round flies like a grenade and bursts on a wall, floor or fighter, or when the fuse runs out; a direct hit takes 1 HP with no knockback and no blast. Damage 1, ammo 4 (max 8), fire rate 1500 ms, colour grey (`#9ca3af`); fighters hold it with the grenade launcher's picture
- The burst leaves a cloud (`systems/smoke.ts`): radius 110 px (~3 fighter heights across), 10 s with the last 2 s fading (it shrinks to nothing), at most 12 at once (the oldest goes first). Clouds live in `GameState.smokes`, are created and expired by the simulation only and are synced in snapshots (`smokes` in the protocol; the client shifts `bornAt` / `endsAt` onto its own clock). Bullets, rockets and beams still pass through smoke
- Bots cannot see a fighter inside a cloud or behind one (a bot standing in smoke still sees out); they do not know where such a fighter is, chase the last-seen spot (forgotten after 10 s, or once that fighter dies), look around it for 3 s (surfaces within 300 px), and spot them again once they step out. With nobody in sight, a bot heads for an enemy smoke does not hide before one it does. Hidden fighters no longer steer bot aim or retreat. Bots never pick up or fire the smoke launcher
- Renderer: the cloud is drawn above fighters; another fighter inside is hidden whole (body, grapple rope, carried flag, jetpack flame and its trail), and your own fighter shows as an outline. Offline and online alike
- One pickup in every layout except Gun Game (it cannot score kills, so it stays off the ladder): `weapon_smoke` on the default Deathmatch and CTF maps, `tun_smoke` (Tunnels), `htf_smoke`, `inf_smoke`, `hg_smoke`; each floats just above a platform and respawns like other weapons

## Version 0.4.18 (2026-11-03)

### 🐛 Fixes
- Online respawn: the client does not predict while dead, so its own Matter body stayed where the player died. On respawn the snapshot moved `local.pos` to the spawn point, but the next prediction step read the stale body back and the client played on from the death spot, while the server (and everyone else) had the player at the spawn point; the server's shots came from there. Every snap reset by `LocalPrediction.snapTo` was undone the same way. `ClientSession.predict` now pushes the local player into its body before stepping (`clientRespawn.test.ts`)

## Version 0.4.17 (2026-11-03)

### 🚀 Rockets
- A rocket now flies straight for its first 0.5 s (`ROCKET_MOTOR_TICKS` = 60 ticks, ~720 px) and only then starts to drop as before (+0.1 px/tick²). Before, it dropped from the first tick: 180 px lower after 720 px of flight. The age comes from `life` in `moveProjectile`, so clients extrapolating between snapshots follow the same path

## Version 0.4.16 (2026-11-03)

### 🐛 Fixes
- The invite banner of a browser-hosted game stayed on screen for the whole match with no way to close it. It now has a × button (`InviteBanner` `onClose`), and while a link exists a link button joins sound and achievements in the top-right (`HudButtons` `invite`, also on the phone top bar) to hide or show it again. Open by default; the state lives in `GameHud`

## Version 0.4.15 (2026-11-03)

### 🪖 Lying Down
- Hold Z, or push the touch move stick down to its edge (≥ 85 % and mostly downward), to lie down on the ground (spec: `docs/plans/2026-11-03-prone-spec.md`). Ctrl was the first choice; Ctrl+W closes the tab and pages cannot block it
- Lying: hitbox 26 px tall (crouch 45, standing 72), crawl speed `PRONE_SPEED` 0.18 (~60 px/s), shots leave 12 px above the feet and only forward: the aim is clamped to ±30° on the side it points to (`clampProneAim` / `clampProneAngle`, used by the simulation, client prediction, the drawn aim and the touch aim line). Jump / jetpack stands up first; never in the air; bots never lie down
- `systems/stance.ts` owns stand / crouch / lie heights and the muzzle height for the simulation, the host and prediction; `Entity.isProne` is optional (older hosts never set it), the host accepts `KeyZ`
- New `prone` pose (body along the ground, legs behind, head and gun forward, a small crawl cycle); the menu's key legend lists S (crouch) and Z (lie down)

## Version 0.4.14 (2026-11-03)

### 🐛 Fixes
- Online, projectiles appeared ahead of the gun: a client first sees a projectile a snapshot or more after it was fired (≈18–20 px per tick × round trip + up to 33 ms between snapshots), and other fighters are drawn `INTERP_DELAY_MS` (100 ms) in the past. `net/projectileCatchUp.ts` now draws each new projectile from its shooter's `shotOrigin` as seen on this screen and closes the gap linearly over 12 ticks (0.1 s); purely visual, the server still decides hits. Projectiles more than 400 px from their shooter's gun when first seen (in flight when you joined) are left alone
## Version 0.4.13 (2026-11-03)

### 📱 Phone HUD and Touch Controls
- Touch devices get their own HUD (`components/hud/mobile/*`, spec: `docs/plans/2026-11-03-mobile-hud-spec.md`, mockup D on the Mobile HUD canvas) instead of the desktop pieces, which are sized in fixed pixels and overlapped on a ~640 × 290 landscape phone (the old jetpack / hook buttons sat 230 px up and left the screen)
- Top bar 28 px, see-through, hazard hairline: health / armor / fuel with 12 px icons, clock and place (`#3 of 4`) or blue : red score, sound and achievements; objective line and a 3-line kill feed under it
- Twin sticks (`game/input/sticks.ts`, `game/input/touchSticks.ts`, per-finger by touch id, `touchcancel` handled): left = move keys (up = `KeyW` jump / jetpack), right = aim from the fighter's centre 300 units along the stick, fire only at the edge (≥ 85 % of a 64 px radius, dashed circle on the stick marks it; the move stick is 50 px), the shown aim glides after the stick (70 ms time constant, shortest way round), a centred stick keeps the last aim; dashed aim line in window pixels (`render/aimLine.ts`, `worldToScreen` in `render/viewport.ts`). The sticks only produce keys / aim / fire, so the host and protocol are unchanged
- Walk and run on the move stick: inside the dashed circle (< 85 %) it also presses a new `Walk` key, which on the ground scales the move input by `WALK_INPUT` = 0.5 (~120 px/s, keyboard always runs, air control stays full; `Walk` added to the host's allowed keys). New `walk` animation state picked from ground speed (0.5–3 per frame; run ≥ 3), so remote fighters show it too: stride 7 instead of 11, feet lifted 3.5 instead of 7, smaller hip bob, lean and head bob (`fighterPose.ts`, `fighterAnimator.ts`); no step dust while walking
- Carried weapons as a tappable row above the aim stick (shared `selectWeapon` with keys 1–6); hook button left of the stick; the jetpack button is gone
- Hint for the first 3 matches on a device, 6 s (`touchHintMatches` in localStorage)
- Menu and character setup on screens up to 500 px tall (a phone held sideways) fit one screen: the menu becomes three compact columns (mode names, preview + one-line description, map / play / create / join; tagline, rules and keyboard legend hidden), setup becomes preview + preset on the left and name, part tabs (tiles scroll inside) and Start on the right. They were one column 7 and 6 screens tall with desktop-size titles, since a sideways phone is wider than the `sm` breakpoint
- Full screen on touch devices (`components/fullscreen.ts`): Start match requests it (`navigationUI: 'hide'`) and a landscape lock, the top bar has a toggle (follows `fullscreenchange`, so it also brings it back after a swipe), and `App` leaves it when the menu shows. Failures are logged; iPhones have no page full screen, so nothing happens there. `isTouchDevice` moved here from `GameCanvas`
- Menu and setup are sized with `.h-viewport` (100vh, then 100dvh) instead of `h-screen`: on a phone 100vh is the height without the browser bar, and with `body { overflow: hidden }` the bottom (Start match) sat under the bar and could not be reached
- Overlays shrink on screens up to 500 px tall (Tailwind screen `phone`): death screen, match results (scrolls), Hunger Games and Gun Game panels move under the top bar, flag banner, invite

## Version 0.4.12 (2026-11-03)

### 💀 Deaths
- A death is a jointed ragdoll now (verlet points, links and joint limits; `systems/ragdoll/*`, spec: `docs/plans/2026-11-02-death-ragdoll-spec.md`) drawn with the fighter's own build (`render/ragdoll/*`), instead of 6 loose pieces. It lands, slides and slips off platforms; a body lies 3.5 s and fades 1 s, gib pieces 2 s + 1 s; at most 12 corpses
- The kind of death follows the killing hit (`systems/deathKind.ts`): machine gun, plasma, zone and falls → falls; shotgun within 120 units → thrown; rocket or grenade direct hit or overkill ≥ 30 → torn apart, otherwise thrown; railgun → cut in two; chainsaw → torn apart. The `DEATH` event carries the kind, the hit origin, the victim velocity, facing and weapon; older hosts fall back to a fall
- Later explosions push lying corpses (and make them hop); the dropped gun falls on its own
- Corpses fall at the rate living fighters really fall (`CORPSE_GRAVITY` = GRAVITY × 60 / tick rate = 0.18 per tick², `ragdoll/corpseStep.ts`), so a fighter killed in mid-air keeps falling the same way
- Tuning in the game against the approved mockup: launch speeds scale by √(corpse gravity / mockup gravity), so arcs and spin match the mockup in fighter heights (played ~1.8× faster); throw and gib power lowered to the mockup's arcs (12 and 8, the mockup's power faded with distance to the blast); a splash kill (rocket or grenade blast) throws each point away from the blast at full strength however close it went off, a shot shoves the whole body (falls onto its back): the `DEATH` event always carries `blast` (true for a splash, false for a shot or any other cause), only events from older hosts lack it and decide by the distance of the hit; a launch or a later blast push faster than the step's cap is slowed as a whole; the machine-gun fall straightens the knees so the body more often ends flat on its back; cut legs bend at the knees when drawn (no boots through the floor)
- A rocket that hits a fighter and finishes them with its own blast counts as a direct hit (torn apart, not thrown); that blast does not push the fresh gib a second time (`ragdoll/corpsePush.ts` skips corpses born this tick)
- A corpse from a host with an unknown `weapon` drops no gun instead of breaking the drawing
- Each client simulates its own corpses from the event, the server never does; 8 deaths at once keep 120 fps at 1512 × 700
- A corpse collides only with the platforms within reach of its body this tick (same motion, ~5× cheaper: 12 corpses on the Deathmatch map 0.63 → 0.13 ms per tick), and a body lying still is not redrawn

## Version 0.4.11 (2026-11-03)

### 🤖 Bots
- Free-for-all bots (Deathmatch, Gun Game, Hunger Games) each wear a different skin preset, shuffled per match with no repeats until all 11 are used, plus a random flame, torso pattern and shoulder badge (`build/botLooks.ts`, spec: `docs/plans/2026-11-03-ffa-bot-looks-spec.md`). They used to be identical blue Marines. Team-mode bots stay red/blue

## Version 0.4.10 (2026-11-02)

### 🐛 Fixes
- House posters lay out their texts with `textRow` (`render/scene/textRow.ts`): each text starts after the measured end of the previous one and the row shrinks to fit. The fixed x positions overlapped because Big Shoulders has no Cyrillic and the Fira fallback is wider ("ПОЧИНИМ ЗА ЧАС" ran over "ДОК 4 · КРУГЛОСУТОЧНО")
- Character preview on phones: the 360 px canvas stood 74 px above the bottom of a 300 px panel, so its top (the helmet) was cut. The canvas is now 290 px (the tallest build plus a little air) and shrinks to the room above the platform; at ≥ 1080 px tall it is drawn exactly as before

## Version 0.4.9 (2026-11-02)

### 💥 Explosions
- New blast composition (`systems/explosionFx.ts`, spec: `docs/plans/2026-11-02-match-feel-spec.md`, part 3): a bigger flash, a core fireball plus 3 offset billows (lumpy, not a disc), the ring, 10 hot debris chunks flung mostly upward that cool from ember orange to dark and drop smoke puffs behind them (trails), 10 embers, a 7-puff smoke cloud that lives ~1.5 s, 3 light smoke puffs
- New particle kinds `debris` and `soot`; soot is warm grey rather than black so it reads on the dark maps, and it counts against the particle budget
- The `EFFECT` event carries an optional `size`: the blast radius / 150, × 0.85 for a grenade (cosmetic only; damage and radius unchanged)
- Camera shake for the local player (`render/screenShake.ts`): up to 14 world units at the blast, falling off with distance to nothing at 900; a new blast never weakens a running shake. The renderer already jittered the world by `shakeIntensity`, which nothing fed until now
- 3 volleys of 10 blasts keep 120 fps at 1512 × 700

## Version 0.4.8 (2026-11-02)

### 🚩 Objective Banners
- Team modes show a big team-coloured banner under the score when an objective changes hands (spec: `docs/plans/2026-11-02-match-feel-spec.md`, part 2): CTF flag grabbed / lost (carrier died, the flag goes home) / returned / captured, Hold the Flag taken / lost (holder died or threw it), Infiltration intel grabbed / dropped / extracted; EN and RU
- The simulation emits a new `FLAG` game event (`systems/flagEvents.ts`) where a flag changes hands, so online clients get it with the other events and no protocol change
- The banner (`hud/FlagBanner.tsx`, text in `hud/flagBannerText.ts`) drops in, holds and fades in 2.6 s (CSS `hb-banner`, fade only with reduced motion); a newer event replaces it at once

## Version 0.4.7 (2026-11-02)

### 🛠️ Setup Screen
- From 1024 px wide the character screen fits the window: the page no longer scrolls, the part tiles scroll inside their panel and Back / Start stay at the bottom (a 14" MacBook window is ~860 px tall; the page was ~1226 px)
- In a desktop window up to 960 px tall (new Tailwind screen `short`) the title, gaps, name field, tile pictures and buttons are a bit smaller
- The tile panel opens each tab at its first slot and ignores scroll anchoring, so pictures that load late do not shift it
- Phones keep the old layout with one page scroll

## Version 0.4.6 (2026-11-02)

### 🎥 Camera
- The camera shows a fixed slice of the world, about 1600 × 900 units, scaled to fill the window (spec: `docs/plans/2026-11-02-match-feel-spec.md`, part 1); before, the world was drawn 1:1 and a bigger window saw more of the map
- A window that is not 16:9 shows the extra width or height instead of cutting the picture; on phones the zoom never drops below 0.6, so fighters stay readable
- Backdrop, world and post effects sit in one scaled container (`render/viewport.ts`); the cursor stays in window pixels; mouse and touch aim are converted through the same viewport offline and online
- Real ad banners (DOM overlay) are scaled with the canvas and stay on their posters

## Version 0.4.5 (2026-11-02)

### 🎬 Menu Mode Previews
- The six mode previews are drawn live by the match renderer instead of HTML/CSS schematics (spec: `docs/plans/2026-11-02-mode-previews-spec.md`): station / mine / arena backdrop and platform art without ads, real fighters ("You" in the player's own build), flags, intel, projectiles, railgun beams, blasts, ragdolls and the Hunger Games zone
- A director plays a per-mode script (keyframes, aims, shots, deaths, weapon switches, carried flags, props, zone) into a `GameState` at the physics tick rate; loops are 5–8 s and seamless
- Texts (scores, bases, extraction, Gun Game ladder, "You") stay translatable; one Pixi app serves every preview for the page life and pauses off-screen or in a hidden tab; reduced motion gets a still frame; no WebGL → the old schematic scene
- Baked scene textures are now owned per scene (`bakeScene`), so the preview and the match can never free each other's art; `createThemedScene` can skip ad places; the preview leaves no scorch marks for the next match

## Version 0.4.4 (2026-11-02)

### 🐛 Fixes
- Missing art after match → menu → match (and in any canvas that outlives another one): Pixi 8.14.3's `Batcher.destroy()` hands back to its page-wide batch pool every batch in its array, including the ones `begin()` had already returned on an earlier frame and that another live renderer may have taken since. Those batches end up in the pool twice, two batchers share one batch, and the live renderer draws with a dead renderer's geometry: `glDrawElements: Insufficient buffer size`, then `Cannot read properties of null (reading 'instanceCount')`, missing or black art until a reload. `src/game/render/batchPoolFix.ts` cuts the array to the batches the batcher still owns before Pixi's destroy runs (Pixi 8.22 does the same itself); `destroyApp()` installs it. Unit tests cover the patch

## Version 0.4.3 (2026-11-02)

### 🧩 Fighter Builder
- The fighter is built from parts (spec: `docs/plans/2026-11-02-fighter-builder-spec.md`); any part combines with any other:
  - Helmet: round, robot box (keeps its short antenna), glass dome (a bubble on a collar with a cartoon face in the head color), angular trooper helmet
  - Visor: strip, full glass, slit, T-shape, two eyes; each visor adapts to the helmet (on the robot box the strip stays a solid glowing panel); the visor glow is its own color
  - Ears, horns and antennae: none, cat, two antennae, wolf, bunny, round, little horns, ram horns, lamp antenna (blinks when firing), crest
  - Tail: none, cat (long S-curve, tip up), tentacle (thin and wavy with a glowing tip), lizard (tapering, spikes on top), mechanical (metal links with a light at the tip); the old straight stick tail is gone
  - Jetpack body: pack, twin tanks, rocket, wings (folded on the ground, open in flight), scrap; twin tanks and scrap burn two flames
  - Flame color: fire, blue, toxic green, purple, white
  - Torso pattern: none, chest band, racing stripes, hazard band, camo, split; the pattern has its own color
  - Shoulder badge on the front shoulder pad, in the pattern color: none, chevron, a number (0–99), an emblem (skull, star or bolt)
- Tails, floppy ears, the lamp and the wings move on critically damped springs driven by the fighter's speed, state and last shot, so they react to running, jumping and jetpack flight without jitter
- The 11 skins are now presets: a ready build plus palette made of free parts; picking one replaces the whole build, then every part can be changed ("(changed)" shows under the preset name)
- A returning player's saved skin and colors turn into the matching preset build on first load, so nobody loses their look

### 📈 Levels and Unlocks
- Finishing a match while still in it gives 20 XP; winning it (first place, winning team, last one standing, Gun Game winner) gives 30 more; matches against bots count, leaving early gives nothing, and joining during a results screen pays nothing
- Level = 1 + floor(XP / 50); part *k* of the 30-item unlock order opens at level *k* + 1, so everything is open at level 31 (1,500 XP); achievements keep their own XP and open no parts
- The results screen, the Hunger Games round result and the Gun Game winner block show the XP gained, the new level and the part it opened, with its slot
- Progress is saved in the browser; each unlock records what opened it (today always `level`) so purchases can be added later

### 🛠️ Setup Screen
- Tabs with picture tiles: Head (helmet, visor, ears, visor glow), Body (tail, pattern, badge), Jetpack (body, flame), Colors (the body colors plus the pattern color)
- The chosen tile has a hazard-yellow border; locked tiles are dimmed with a lock and "Lvl N"; an XP bar under the preview shows the level and the XP to the next part
- The preview keeps a fixed height

### 🌐 Online and Ragdolls
- The join request carries the build (part ids, badge number, visor and pattern colors); the host checks every id against the known lists and falls back to the free default for anything unknown (unlocks are not checked: progress is client-side by design); players on older clients get their skin's preset
- Every client draws other players with their build; the ragdoll head keeps helmet, visor and ears, the ragdoll torso keeps pattern and badge

### 🦾 Limbs
- Arms and legs are drawn as one piece per limb (both outlines, then both fills, then highlights), so the joints bend smoothly without the round knee and elbow pads that hid the seam; the living fighter and the ragdoll share the same limb drawer

## Version 0.4.2 (2026-11-02)

### 🚩 Flags
- All flags are drawn by code in one "station standard" design (spec: `docs/plans/2026-11-02-flag-look-spec.md`): steel pole with brass collars and a glowing crystal, segmented cloth with shaded folds, a dark hem with rivets, chevrons and a swallowtail end
- CTF bases get a plinth with hazard tape, a pulsing team light strip and a floor glow; the plinth snaps to the platform under the flag
- The Hold the Flag flag stands upright on its pedestal; a dropped one is planted at a lean with a pulsing ring around it; a flag with no floor below bobs in mid-air
- A carried flag trails against the carrier's motion (level when running, down when flying up, hanging when still); Hold the Flag carriers keep their fire, now at the crystal
- The 1152 × 896 flag pictures (shrunk ~7× without mipmaps, so they shimmered) are removed

### 🐛 Fixes
- CTF: a blue fighter carrying the red flag showed a yellow (intel) flag; the carried colour now depends on the game mode

## Version 0.4.1 (2026-11-02)

### 🐛 Fixes
- Black world at match start (production build): tearing down the character preview's Pixi canvas with `destroy(true)` released Pixi's page-wide batch pool while the match renderer was still using it, so its next frame crashed in the batcher ("Cannot read properties of null (reading 'clear')") and only the HUD stayed visible until the page was reloaded. Every Pixi app now goes through `destroyApp()` in `src/game/render/pixiApp.ts`, which removes the canvas without touching the global pools; a unit test guards the call

## Version 0.4.0 - "Hazard Bay" (2026-11-02)

### 🛰️ Map Looks: Station, Mine, Arena
- The default map (Deathmatch, Gun Game, CTF, Hold the Flag, Infiltration) is drawn as a space station: stars and a planet through hull windows, girders and pipes, cargo containers, hanging lamps, rotating beacons
- Platforms are worn metal decks with bolts, chipped hazard paint and cast shadows; the floor is a grating lit from below; map edges are hull columns; team bases are tinted blue/red
- Depth: far layers move slower than the playfield (parallax); vignette and film grain; fighters get a soft contact shadow
- Tunnels is an asteroid mine: rock face with strata and cracks, timber supports, strings of bulbs, ducts and scaffolding, ore carts, rock slabs with a steel lip and glowing veins, bedrock with a rail track
- Hunger Games is a show arena: a dome, stands with a dim crowd behind lime-lit railings, truss rigging with speakers, sweeping spotlights, bright plates with a lime neon edge, a polished arena floor
- Art is generated by code and baked once per map; only lights, screens and grain animate
- In-world ad places on every map — station: two wall lightboxes 300×250, a container sticker 300×100, an LED panel 728×90; mine: two lit boards, an ore-crate sticker, an LED panel; arena: two big screens over the stands 300×250 and an LED ribbon 728×90. Each can show a TrafficStars spot from `public/ads.json`: the banner sits in its frame, follows the camera, gets the scene's light, platforms and girders in front cut it, fighters in front fade it, no clicks during a match. It loads only after being half on screen for a second and refreshes at most every 30+ s. Without an ad the place shows a house poster
- Hidden admin page `#ads-admin`: paste spot codes, test them live in the in-game frame, download `ads.json`

### 🧍 New Fighter
- Redrawn character: shoulders, hips, knees and elbows; both hands hold the weapon (rear hand on the grip, front hand on the foregrip) at any aim
- Steps follow the real running speed; leaning into the run, tucked legs in flight, deep crouch, recoil and muzzle flash
- Helmet with a visor that looks where you aim; outline and shading keep the fighter readable on dark maps
- Robot, beast and alien skins keep their heads, ears, antennae and tails; every body-part color still applies
- Bodies break into parts in their own colors (any custom color, not only the four team colors)
- Before/after pictures in the menu's "What's new" panel

### 🎇 Shots, Hits and Fighter Polish
- Every weapon's shot has its own look: machine-gun and shotgun tracers with a glow, a pulsing plasma orb with a fading ghost trail, a drawn rocket with a flickering exhaust and smoke behind it, a spinning grenade, a three-layer rail beam
- Impacts: a flash and falling sparks where a shot meets a wall, plus a scorch mark on walls and floors that fades in about 4 seconds
- Explosions: flash, fireball, shockwave ring, embers, rising smoke and a scorch mark on a wall or floor close to the blast
- Fighters that get hit: blood droplets and a brief brightening of the fighter
- Muzzle flash: a star with a warm light on the fighter's hands, fading over about 120 ms (it used to be visible for about 20 ms)
- Fighter volume: highlights on limbs, torso and head, a visor reflection, a strap, a pouch, knee and elbow pads, a glow behind the jetpack flame
- Fighter silhouette: bigger head, chest and boots, thicker limbs, a shoulder pad and a helmet ridge; the body stays within 6 px of the hitbox in every pose, checked by a test (antennae, ears and tails excluded)
- Fighter liveliness: landing squash with dust, dust under the feet while running, head bob; ragdoll parts match the new proportions
- The simulation now announces `blood` for a fighter hit and `spark` for a wall hit (it announced `spark` for both); same event channel, no gameplay or protocol change, so online players see the same effects
- Particles have their own motion per kind (streak sparks, droplets, soft smoke, shells, dust) and a budget of 500 live ones: above it, smoke and dust are not spawned
- Before/after pair "Shots and hits" in "What's new"; the fighter picture is retaken

### 🎨 New Interface
- **Main menu** redesigned: pick a mode and watch a short animated preview of how it plays, with its three key rules (Infiltration shows the whole raid: grab the intel, bring it to extraction)
- **What's new** panel with the full release history
- **Character setup** redesigned: live preview on a platform, a custom color for every body part
- **HUD** redesigned: health, armor and fuel with item icons, weapon pictures in the slots, match clock and goal
- **Objective hints** in team modes ("You have the red flag. Bring it to your base.")
- All interface text in English and Russian

### 🏁 Matches That End
- Deathmatch (20 kills), Capture the Flag (3 captures), Hold the Flag (60 points) and Infiltration (3 points) end at the score limit or after 10 minutes
- Results screen with winner, final score and ranking; the next match starts after 10 seconds
- Hunger Games rounds are limited to 5 minutes; betting credits carry over between rounds
- Hunger Games round start: fighters spawn on platform tops across the whole arena, at least 700 px apart, and nobody can be hurt for the first 3 seconds ("Fight in 3…2…1"); rounds used to be over in 6–16 seconds
- Hunger Games zone: closes in from the sides and the top while its bottom stays on the arena floor (fighters used to hang in the air at the zone edge and take damage), stays centered at its smallest size instead of drifting, also shrinks every 30 seconds without deaths, and freezes once the round is decided (the winner could die on the results screen)
- Hunger Games results list the winner first; bots skip pickups outside the zone and step off platforms to reach enemies below

### 🌐 Multiplayer
- **Create game**: host a match in your browser and invite friends with a link (WebRTC)
- Join a dedicated server by its address; the server chooses mode and map (`SERVER_MODE`, `SERVER_MAP`)
- Smoother online play: your own movement is predicted, other players are interpolated
- Blood, explosions and damage numbers are visible online
- Hunger Games online; players joining mid-round watch until the next one
- The server validates everything clients send and no longer crashes on malformed messages

### 🤖 Movement and Bots
- Running and crouch-walking are twice as fast (about 240 px/s); jumps and the jetpack are unchanged
- Bots move with the same controls as players, at the same speed
- Bots pick an enemy they can see instead of one behind a wall, and look for hidden enemies instead of waiting
- Bots fight in Gun Game (they used to ignore everyone)
- Bots shoot back while retreating to a medkit, aim at the body and lead moving targets correctly
- Bots no longer hop in place every quarter second, and can drop down to lower floors instead of hovering
- Bots react like people: 0.4–0.9 s after spotting an enemy (and after the Hunger Games start shield) before the first shot; their aim error grows with distance and target speed. A running player used to be cut down within a second of the shield dropping
- Bots know the map: a navigation graph built from each map's platforms (surfaces, plus how to get between them by walking, dropping, jetpack or grapple hook) and a route search. They reach every floor of every map instead of getting stuck under platforms or running into walls; Tunnels and arena bots now roam the whole map (the old hand-placed waypoints belonged to the default map only)
- Bots use the grapple hook like players: fire at the underside of a ledge too high for the jetpack, reel in, let go and finish over the edge with the jetpack
- Bots in a fight: strafe bursts instead of standing still, a short jetpack hop after taking a hit, and when nearly dead an escape by hook or jetpack to another platform away from the enemy
- CTF bots: the flag carrier heads straight home (no medkit detours, no hops), teammates escort it; the bases come from the level data
- Bots skip pickups placed inside solid blocks (Tunnels has three in its central block) and jetpack up to pickups hanging in the air
- Measured in bots-only matches (kept as a test): Deathmatch, 3 bots, one minute — 6–12 kills in every run (was 3–9) and no bot standing still for more than 1.5 s (was up to 45 s); Tunnels — 6 kills (was 0); Hunger Games — 7 kills (was 4); CTF — see the respawn change below
- F3 debug view draws each bot's route (offline play)
- Bots only go for pickups they can reach: standing on the surface below, or hopping up from it (CTF's shotgun hangs in mid-air beside a platform; bots used to hop under it for good)
- CTF: teams respawn on the floor behind their base (~700 px from their flag) instead of on the flag itself, where defenders reappeared on top of a carrier 3 s after dying. Bots-only, 7 matches of 3 min: 3–10 flag pickups and 3 captures in total (was 0–3 pickups, 0 captures)
- Tunnels: the rocket launcher, chainsaw and armor were inside the solid central block (unreachable for everyone); moved to the tunnel mouths and under the block. A test now checks every map for buried pickups
- "What's new" shows before/after pictures of the three map looks

### 🎯 Gameplay Fixes
- Same game speed on 60, 120 and 144 Hz screens (fixed 120 ticks per second)
- Railgun and explosions no longer go through walls; bullets hit only the first player in their path
- Stray bullets disappear instead of flying forever
- Killing yourself no longer gives a point; friendly fire works the same for every weapon
- Crouching no longer pushes you into the floor
- Standing on the ground is detected reliably: running fighters used to count as airborne about a third of the time (or more), sliding with frozen legs and without ground friction
- The smaller team no longer gets a free point on every respawn (CTF, Hold the Flag)
- Keys no longer stay pressed after switching windows; touch controls work on phones
- Weapon names in the HUD and kill feed are translated; two kills in the same millisecond no longer break the kill feed
- Textures no longer disappear after returning to the menu

### 🛠️ Technical
- Shared authoritative game room used by both the Node server and the browser host
- Large components split into small modules; 384 automated tests (from 56)

## Version 0.3.1 (2025-11-28)

### 🎮 Gameplay
- **Gun Game**: weapon ladder, no pickups, win after the final weapon

### 🎨 Interface
- Skin selection arrows; robots and beasts with their own accents
- Weapon selection fixes

### 🌐 Server
- ESM compatibility; localtunnel and ngrok tunnels

### 🐛 Fixes
- Achievements count only for the player
- Winning Gun Game no longer exits the game abruptly

## Version 0.3.0 - "Ragdoll & Modular Update" (2025-11-25)

### 🎮 New Game Modes
- **Hold The Flag** - King of the hill style mode where teams fight for control of a neutral flag
  - Score points every 4 seconds while holding your team's flag
  - Flag carrier moves slower and takes extra damage
  - Can throw flag with crouch + jump
  - Special golden flag visual with fire effects

- **Infiltration** (Work in Progress) - Asymmetric mode where attackers steal intel
  - Blue team must grab intel and extract to zone
  - Red team defends for limited time
  - Intel drops on death
  - Timer-based scoring

### 💀 Ragdoll Physics System
- **Realistic Death Effects**
  - Bodies now break apart into 6 pieces (head, torso, 2 arms, 2 legs)
  - Each part has independent physics with gravity, rotation, and collisions
  - Parts bounce off platforms and gradually come to rest
  - Smooth fade-out over 5 seconds
  - Blood splatter and decals on death

### 🎨 Modular Character System
- **Improved Character Rendering**
  - Characters now built from separate body parts
  - Left arm with independent animation (swings while running)
  - Right arm holds weapon and aims
  - Helper functions for easy customization
  - Z-index layering for proper rendering order
  - Ready for sprite replacement and custom skins

### 🌐 Multiplayer (PeerJS)
- **Peer-to-Peer Multiplayer**
  - Host/Client architecture
  - Create game and share invite link
  - Join via URL parameter
  - Real-time state synchronization
  - Remote player input handling
  - Players replace bots when joining

### 🎯 Gameplay Improvements
- **Bot AI Enhancements**
  - Bots now actively seek flags in Hold The Flag mode
  - Improved pathfinding and objective prioritization
  - Better combat behavior
  - Weapon switching based on distance

- **Visual Improvements**
  - Intel item with golden briefcase visual
  - Flag glow effects (blue, red, golden)
  - Improved pickup rendering
  - Better team color indicators

### 🛠️ Technical Improvements
- **Code Architecture**
  - Modular body part creation functions
  - Cleaner separation of rendering logic
  - Better type definitions for network packets
  - Improved state management

### 🐛 Bug Fixes
- Fixed `rect()` calls to use `roundRect()` for rounded corners
- Fixed asset path issues for Netlify deployment
- Corrected mouse coordinate conversion for multiplayer
- Fixed team balancing in respawn logic

---

## Version 0.2.0 - "Multiplayer Foundation" (2025-11-24)

### Features
- PeerJS integration for P2P multiplayer
- NetworkManager class for connection handling
- Host/Client game modes
- State synchronization
- Remote input processing

---

## Version 0.1.0 - "Initial Release" (2025-11-23)

### Features
- Deathmatch mode
- Capture The Flag mode
- Bot AI
- Multiple weapons (Machine Gun, Shotgun, Plasma Gun, Rocket Launcher, Grenade Launcher, Railgun, Chainsaw)
- Jetpack movement
- Grappling hook
- Dash ability
- Pickups (Health, Armor, Ammo, Fuel)
- Particle effects
- Sound system
- Scoreboard
- Player customization (name, color, jetpack color)

---

## Upcoming Features

### v0.4.0 - "Customization & Polish"
- [ ] Body part skin system
- [ ] Sprite-based character rendering
- [ ] Skin selection UI
- [ ] More visual styles for each body part
- [ ] Improved animations
- [ ] Sound effects for ragdoll
- [ ] Complete Infiltration mode
- [ ] Extraction zone visuals
- [ ] Intel carrier effects

### Future
- [ ] More game modes (Team Deathmatch, Survival)
- [ ] Power-ups and special abilities
- [ ] Map editor
- [ ] Custom game settings
- [ ] Leaderboards
- [ ] Achievements
