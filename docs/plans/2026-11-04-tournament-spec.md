# Tournament Mode Spec

Status: approved 2026-11-04

## Problem

Friends who play together want an event: a knockout of 1-on-1 duels with one champion.
Strangers want the same thing from a list of open tournaments. Today the only online play is one
shared free-for-all room. There are no duels, no bracket, nothing to watch once you are out, and
no reward for winning a series.

## Decision in one paragraph

A new menu entry, **Tournaments**.
- A player creates a tournament, or signs up for an open one, or joins by a friend's link.
- The creator presses **Start** whenever enough people have joined.
- Seats are drawn at random into a single-elimination bracket. Empty seats get bots.
- Every match is a 1-on-1 on a new small mirrored arena, **"The Pit"**. The first to **10 kills**
  wins, and both fighters start with the same fixed weapon set.
- All matches of a round run **in parallel**. Winners advance; losers can watch any running
  matches, several at once in a **split screen**, or leave.
- Three new achievements reward the run.

## Goals

- A friends' evening: one link, up to 8 people, about 20–30 minutes for the whole bracket.
- Strangers can find and join an open tournament from the menu.
- Duels feel fair. Identical loadouts and a mirrored map mean skill decides.
- Being knocked out is not the end: you can watch the rest of the bracket live.

## Non-goals (first version)

- Ranked play, ratings, seeding by skill, prize pools, tournament history pages.
- Brackets larger than 8. Double elimination. Team tournaments.
- A dedicated game server. Production stays browser-hosted P2P plus Supabase (see Constraints).
- Real anti-cheat. The match host reports the result, and that is accepted for v1.

## Anti-goals (would make it a failure even if it "works")

- A tournament that **gets stuck**: a bracket waiting forever on a player who left, or on a creator
  who closed the tab.
- A host that **lags** in their own match because spectators eat their upload.
- Breaking or slowing the normal modes (Deathmatch, CTF, Hunger…) for players who never touch
  tournaments.

## Constraints (facts from the code, 2026-11-04)

- **Production is browser-hosted P2P.**
  - GitHub Pages serves a static site, and a "host" browser runs the authoritative `GameRoom` in a
    Web Worker (`src/game/net/hostSession.ts`, `hostWorker.ts`). Peers connect over PeerJS.
  - The invite link is `?host=<peerId>` (`serverAddress.ts`).
  - `server/` is not deployed.
- **Supabase is the only always-on backend.**
  - Free tier, live since 2026-11-04, accounts in `src/account/`, migration in `supabase/migrations/`.
  - Nothing uses Realtime yet.
  - A new migration must be run by the owner in the Supabase SQL editor before release, as with
    accounts (`docs/supabase-setup.md`).
- **A browser host is capped** at `BROWSER_HOST_MAX_PLAYERS = 6` humans because of upload.
- **One `GameRoom` per worker or process**, because of the global event bus (`room.ts:40`).
- **Match end today auto-restarts** after 10 s with the same players (`matchRound.ts`, `roomSetup.ts`
  `resetMatch`). `RoomConfig` has only `{mode, map, maxPlayers}`, and the score limit is hard-coded
  per mode.
- **No spectator role exists.** Hunger Games fakes one with a dead player who never respawns. The
  camera always follows the local player (`camera.ts`).
- **The client renders exactly one world today.**
- **Achievements progress inside the simulation** (`combat.ts` → `achievements.ts`). Online, that is
  the host's worker, so guests earn nothing. Tournament achievements must be awarded **on each
  player's own client** from the tournament result, as match XP already is (`matchOutcome.ts`).
- **Project rules:**
  - Files stay at 200 lines or fewer.
  - Every UI string exists in EN and RU (`src/i18n`).
  - UI follows the Hazard Bay tokens.
  - Test at 1512×700, the owner's 14" screen.

## How it works

### Entering

- **Menu → Tournaments** shows the list of open tournaments. Each row has a name, the creator, and
  either seats `5/8` with **Sign up**, or `in progress · semifinals` with **Watch**.
- Two more buttons: **+ Create tournament** and join by a friend's link.
- **Guests may join with just a nickname.** An account is not required. If the player is logged
  in, their account nickname is used.
- **Create:** the player enters a name, and the tournament appears in the public list at once.
  Creating one also produces a shareable link.
- **Lobby (before start):**
  - 8 seat tiles. Empty ones read "free → bot".
  - Rules line: 1v1 · first to 10 · The Pit.
  - **Copy link** button, plus **Start**, which only the creator sees.
  - Signing up takes any free seat. The final positions are drawn at start.

### Starting

- The creator presses **Start** whenever they want. At least **2 humans** are needed.
- **Bracket size:** with 2–4 humans the bracket is 4; with 5–8 it is 8. Empty seats become bots.
- Seats are shuffled randomly. Sign-up closes at start.
- If the creator leaves before start, the creator role passes to the earliest remaining sign-up.
  If everyone leaves, the tournament disappears.

### Matches

- All matches of a round start in parallel. The next round starts once both feeder matches of a
  bracket node have finished. A semifinal does not wait for the other semifinal's feeders.
- **Bot vs bot:** decided instantly with a random winner, without playing.
- **Human vs bot:** played normally. The human's browser hosts, and the bot plays at normal
  difficulty.
- **Human vs human:** one of the two browsers hosts the match room and the other joins
  automatically, with no link pasting. Host choice is left to the builder (see below).
- **Rules:**
  - Deathmatch scoring, first to **10 kills** wins.
  - A **10-minute** cap: whoever leads wins. On a tie, the next kill wins (sudden death).
  - The match ends once. There is **no auto-restart** for tournament matches.
- **Loadout:**
  - Each fighter spawns, and respawns after every death, with: machine gun (infinite ammo),
    shotgun, railgun, rocket launcher, grenade launcher, smoke launcher and chainsaw.
  - The plasma gun is excluded.
  - Each weapon has its normal starting ammo and refills on respawn.
- **No weapon pickups** on the map. The centre of The Pit has health, armor and ammo pickups only.
- **No-show:** a player who has not connected to their match within **60 s** loses it, and the
  opponent advances.
- **Mid-match disconnect:**
  - If a fighter does not reconnect within 60 s, they lose.
  - If the host's browser dies, the guest wins.

### The Pit (new map)

- About **2600 × 1400 px**, a closed box, mirrored left/right.
  - A small tower of ledges on each side, with each fighter's spawn at its foot.
  - Stacked platforms in the middle, with the health/armor/ammo pickups at the centre.
  - Two small high ledges for jetpack play.
- For scale: a fighter is 30 × 72 px, and one screen shows roughly 1500 × 800.
- Bots need waypoints for it, like the other maps (`level.ts` `getWaypoints`).
- The approved sketch is option A in the brainstorm mockup (`.superpowers/brainstorm/…/arena-layouts.html`).
- **Tournament-only in v1.** The Pit is not in the normal map choice and needs no CTF, HTF,
  Infiltration or Hunger setup. Making it a normal map is a later, separate task.
- **Ads:** two in-world poster places with **new** spot ids, wired like the other maps
  (`src/game/render/scene/adPlaces.ts`, `public/ads.json` via `/#ads-admin`). The owner creates
  the spot codes. House posters fill the places while there are no codes.

### Bracket screen

- Columns: quarterfinals → semifinals → final → 🏆.
- Finished matches show the winner highlighted and the loser crossed out. Running matches show a
  live score and a **LIVE** tag with **Watch**.
- The player's own match is outlined.
- The screen shows between your matches, and is reachable from a button in-game.

### Watching (spectators)

- Anyone eliminated, waiting for their next match, or arriving from the list via **Watch** can watch.
- A spectator has no body and no input, and is not counted as a player. They just receive the
  match's snapshots.
- **Split screen:**
  - The layout adapts to the number of running matches: 1 fills the screen, 2 split in halves,
    3–4 form a 2×2 grid.
  - Clicking a tile expands it full-screen, and clicking again goes back to the grid.
  - Only the focused tile plays sound.
  - A strip on top shows the bracket and the live scores.
  - The spectator chooses which running matches to watch.
- **Ads in split screen:** only a tile expanded to full screen shows in-world ads. Small grid tiles
  show none, so one spot is never displayed several times at once.
- **Phones** show one match at a time and switch with a swipe.
- **Spectator cap per match**, about 6 and to be tuned by measurement, because the host is also a
  fighter and must not lag. A full match shows "spectator seats full" and still shows its live
  score.
- Split screen is the biggest technical piece. Build it as its own stage after single-match
  watching works, but it ships in the same release.

### Achievements

| id | Name | Condition | Rarity |
|---|---|---|---|
| `tournament_champion` | Champion 🏆 | win a tournament | legendary |
| `tournament_finalist` | Finalist 🥈 | reach a tournament final | epic |
| `tournament_flawless` | Flawless 🧊 | win a tournament match 10:0 | rare |

- RU names are to be written with the owner's tone. Working names: Чемпион, Финалист, Сухарь.
- Beating bots counts.
- **Walkovers** (no-show, disconnect, host death):
  - The player advances, but gets no win XP bonus for that match.
  - Champion and Finalist require at least one tournament match **won by playing**.
  - Flawless only counts for a played match.
  - The tournament result therefore records how each match was decided: played or walkover.
- Achievements give no level XP (owner's rule, see fighter builder). Tournament matches give
  normal match XP like any other match.
- Awarded on each player's own client, then synced to the account if they are logged in.

### Lifetime and cleanup

- A lobby nobody starts expires after 30 minutes.
- A finished tournament stays visible (bracket, champion) for 10 minutes, then leaves the list.

## Decided by the owner

- Parallel matches, not one at a time.
- Players join by friend link or by signing up from a public list.
- The creator presses Start, and empty seats are filled by bots.
- Guests may play.
- Map shape A, "The Pit".
- Same loadout for both fighters: everything except plasma.
- Split-screen watching of several matches at once, chosen over a single match plus a live
  scoreboard.
- The three achievements above.
- The Pit is tournament-only in v1, with two new ad places, and no ads in small split-screen tiles.
- Walkovers advance but give no win XP. Champion and Finalist need at least one played win.

## Claude's calls (owner may override)

- Bracket of 4 for 2–4 humans, 8 for 5–8.
- Creator role passes on if the creator leaves the lobby.
- 60 s no-show and disconnect rule.
- 10-minute cap with sudden death.
- Bot-vs-bot decided instantly.
- Spectator cap of about 6.
- One-match swipe view on phones.
- Lobby expires after 30 min, finished tournament visible for 10 min.
- Match result reported by the host, with no cheat protection in v1.

## Left to the builder

- The Supabase schema, RLS, and how guests write safely, given that guests have no auth today.
  Anonymous sign-in and security-definer RPCs with per-seat secrets are both acceptable.
- Realtime vs polling for list, lobby and bracket updates.
- Which fighter hosts a human-vs-human match, for example the lower-latency one or the one with
  the lower seat number.
- How the host publishes its `peerId` to the opponent and spectators.
- How the split screen renders several worlds, given the single-world client and the global event bus.
- How the per-room `scoreLimit`, loadout, map and no-restart flags are added to `RoomConfig`,
  without changing existing modes.
- How the creator's Start and bracket advancement are coordinated: who writes the next round and
  how races are avoided.

## Release

- One feature branch and PR, one `0.4.x` version, and a short grouped patch note
  (see the release process).
- Before merge, the owner runs the new Supabase migration. It puts `tournaments` and `tournament_matches` into
  Realtime itself; the owner only checks that, and must NOT enable `tournament_seats` (it holds the seat secrets).
- The PR must include the exact SQL and owner steps, as `docs/supabase-setup.md` does for accounts.
