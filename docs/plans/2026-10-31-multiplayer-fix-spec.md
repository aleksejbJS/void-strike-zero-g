# Multiplayer & Server Fix — Spec

**Date:** 2026-10-31
**Status:** Approved — D1 (b), D2 server config, D3 browser hosting (phase 2), D4 hide
**Scope:** `server/src/**`, `src/game/systems/socket.ts`, the network parts of `src/components/GameCanvas.tsx`, `src/components/MainMenu.tsx`

## Problem Statement

Multiplayer does not work as a product today. A player who tries it hits one of these:

| # | What the player sees | Root cause |
|---|---|---|
| 1 | "Create game" starts an empty match | `NetworkMode.HOST` has no branch in GameCanvas; players are only spawned for OFFLINE |
| 2 | "Join" / public server connects to the wrong place | Client always connects to `http://<page host>:3001`, ignoring the entered ID/URL (`GameCanvas.tsx:~323`) |
| 3 | Public server list is empty | Default matchmaking URL (`void-strike-matchmaking.herokuapp.com`) returns 404 |
| 4 | Own player rubber-bands constantly | Server applies input twice (legacy Matter forces + Force Pipeline), client predicts with different code and tick rate |
| 5 | Others' players move with *your* keys during prediction | `updatePhysics` treats every non-remote `type: 'player'` as local |
| 6 | Kill feed and sounds duplicate | Reconciliation replays the full `updatePhysics` (weapons, bots, events) per pending input |
| 7 | HUD shows someone else's HP/ammo; keys 1–6 switch another player's weapon | HUD and weapon keys read `players[0]` / `'player'` instead of the local socket id |
| 8 | Invisible walls | Bodies of left/dead players are never removed (client) or disabled (server) |
| 9 | Server lag with several players | Full `GameState` incl. particles, decals, floating texts, ragdolls broadcast 60×/s to everyone |
| 10 | Map changes for everyone when someone joins; collisions use the old map | `join` switches `currentMap` but Matter platforms are never rebuilt |

Security/robustness on the server:

- `join` with no payload throws (`data.mapId` read before checking `data`)
- `name`, colors, `skinId` stored and broadcast unvalidated (1 MB name → ~60 MB/s per client)
- A second `join` on the same socket leaves a ghost body and can duplicate the player
- Input rate limit trusts the client's `timestamp` (omit it → no limit)
- Matchmaking `/register`, `/heartbeat`, `DELETE /servers/:id` have no auth; heartbeat never re-registers after a 404
- Server ticks at 60/s while client gameplay is tuned at `PHYSICS_TICK_RATE` (120/s) → bullets, grenades, timers run at half speed online
- `server/src/game/**`, most of `server/src/constants.ts` and `server/src/types.ts` are dead copies (server imports the client modules)

## Goals

1. A friend can join my game by address and we play a full Deathmatch without rubber-banding, ghost walls or wrong HUD.
2. The server cannot be crashed or flooded by a malformed or malicious client.
3. Online gameplay feels the same as offline (same tick rate, same rules).

## Non-goals (this iteration)

- Browser-hosted games (P2P) — **phase 2**, separate spec. Phase 1 keeps the authoritative
  simulation transport-agnostic so the same module can later run inside the host's browser.
- Accounts, persistence, anti-cheat beyond input validation
- Lag compensation for hit detection (rewinding)

## Design

### Shared authoritative core (new, `src/game/net/`)

Pure game-room logic with no socket.io/Node imports: join validation, input queues, tick,
snapshot building, event collection. The Node server wraps it with socket.io now; a
browser host wraps it with WebRTC in phase 2.

### Server

- **Tick** at `PHYSICS_TICK_RATE` using the shared constant; **broadcast** snapshots at 30/s.
- **Inputs:** per-player queue keyed by `sequence`; each tick consumes at most one input (falls back to the last one if the queue is empty). Remove the legacy Matter force block. Rate limit by server arrival time.
- **Snapshot** = players, projectiles, pickups, scores, beams, mode-specific fields. Particles, decals, floating texts and ragdolls are **not** sent; the server emits gameplay events (`KILL`, `SOUND`, `HIT`, `EXPLOSION`) and clients spawn effects locally.
- **Join:** validate the payload (types, name ≤ 16 chars, hex colors, whitelisted `skinId`); ignore repeat joins; mode/map per D2; reply with the map so the client builds the same platforms.
- **Death:** disable the dead player's body (sensor) until respawn; skip input for dead players.
- **Matchmaking:** per D4.
- Delete dead server copies; import shared types/constants from `src/`.

### Client

- Connect to the address the player entered (or picked from the list).
- **Local player id** = socket id, passed to `updatePhysics`, HUD (`syncVisuals`) and weapon keys.
- Network model per D1.
- Remove Matter bodies whose ids are missing from the latest snapshot.
- Menu: per D3.

### Testing

- Unit: join validation, input queue, snapshot filter, body cleanup.
- Integration: start the server in-process, connect two `socket.io-client` bots, assert positions converge and no duplicate events.
- Manual: two browser windows on one machine, then two machines on LAN.

## Decisions needed

**D1 — Network model**
- (a) Server-authoritative, **no prediction**, interpolate everyone ~100 ms behind. Simplest, no rubber-banding; input delay = ping (fine on LAN/<50 ms).
- (b) **Predict own movement only + smooth correction** toward server position when off by more than a threshold. Responsive; small occasional corrections; moderate work. *(recommended)*
- (c) Full prediction with input replay (what the code attempts now). Best feel at high ping; most complex; needs a deterministic local re-sim of the player only.

**D2 — Who picks mode/map**
- Server config (env `SERVER_MODE`, `SERVER_MAP`); joiners see it in the menu. *(recommended)*
- First player to join picks.

**D3 — Menu entry points**
- Keep "Join by address" (+ public list if D4 = deploy); hide "Create game" until browser hosting exists. *(recommended)*
- Keep "Create game" and implement browser hosting (P2P) — large separate project.

**D4 — Public server list**
- Hide it for now. *(recommended until hosting is chosen)*
- Deploy the matchmaking service (needs a host: Render/Fly/Railway…) and add per-server tokens.

## Decisions (2026-10-31)

- **D1:** (b) predict own movement + smooth correction
- **D2:** server config (`SERVER_MODE`, `SERVER_MAP` env)
- **D3:** browser hosting wanted → phase 2 with its own spec; "Create game" hidden until then
- **D4:** hide the public server list

## Implementation order (phase 1)

1. Shared room core + server wiring (validation, input queue, 120/s tick, 30/s snapshots, events, dead-body sensor, mode/map from env, delete dead copies)
2. Client protocol: connect to entered address, local id everywhere, snapshot apply, body cleanup, effects from events
3. Prediction (D1-b) + interpolation of remote players
4. Menu: join by address, hide "Create game" and public list
5. Integration test with two socket clients; manual two-window test
