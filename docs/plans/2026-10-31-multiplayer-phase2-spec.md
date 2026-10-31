# Multiplayer Phase 2 — Effects, Hunger Games Online, Browser Hosting

**Date:** 2026-10-31
**Status:** Approved — E1 (a) effect events, H1 (a) spectate until next round, P1 (a) PeerJS public broker, P2 (a) Web Worker
**Builds on:** `2026-10-31-multiplayer-fix-spec.md` (phase 1: authoritative `GameRoom`, `ClientSession`, prediction)

## Problem Statement

Phase 1 made online Deathmatch/CTF/HTF/Infiltration/Gun Game playable on a dedicated Node server. Three gaps remain:

1. **Effects are invisible online.** Blood, explosions, hit sparks, damage numbers, ragdolls, decals and jetpack flames are created inside the simulation as cosmetic state, which the server does not send. Online you see a projectile vanish and a health bar drop — nothing else.
2. **Hunger Games is offline-only.** Round flow (winner → 10 s → restart), the shrinking zone, spawn rules and spectating live in `GameCanvas.tsx`, not in the simulation, so the server cannot run them.
3. **"Create game" does nothing useful.** Playing with friends requires someone to run the Node server and expose a port or tunnel.

## Goals

1. Online matches look like offline ones: same effects at the same places.
2. A full Hunger Games round, restart included, works on the server and with a browser host.
3. A player clicks **Create game**, sends a link to a friend, and they play — no server, no port forwarding.

## Non-goals

- Host migration (if the host leaves, the match ends)
- Accounts or persistent credits (Hunger Games betting stays per browser)
- Anti-cheat against a malicious host (the host is the authority by design)

## Design

### 1. Effects online

The simulation emits **effect events** with positions instead of (or in addition to) writing cosmetic state.
The offline client and the online client turn the same events into particles, so they look identical.

```ts
| { type: 'EFFECT'; effect: 'blood' | 'spark' | 'explosion' | 'shell' | 'jetpack' | 'respawn'; x; y; color?; count? }
| { type: 'DAMAGE'; x; y; amount }   // floating damage number
| { type: 'DEATH'; entityId; x; y; color; height }  // ragdoll + blood decal
```

- `combat.ts`, `physics.ts`, `movement.ts` call `emitEffect(...)` rather than `createParticles` directly.
- One `effectsRenderer` subscriber spawns particles/decals/ragdolls/texts from events (both modes).
- Jetpack flames for remote players are derived on the client from `isFlying` in the snapshot (too frequent to send as events).
- Event batches are already sent 30×/s; expected size is small (tens of events per batch in a firefight).

### 2. Hunger Games online

Move round logic from `GameCanvas.tsx` into a shared `hungerRound.ts` used by `GameRoom` and offline mode:

- Spawn points for the Hunger map, no respawn, zone init/shrink (already shared), winner detection
- `RESTART_DELAY` (10 s) after a winner → reset players, pickups, zone; new round
- Snapshot carries `hungerRoundEndsAt` so every client shows the same countdown
- Late joiners per **H1**
- Betting/spectating stays client-side: credits per browser, spectate any living player by id
- Enable `HUNGER_GAMES` in `SERVER_MODE`

### 3. Browser hosting (P2P)

The host's browser runs a `GameRoom` and plays in it; friends connect over WebRTC data channels.

```
Host tab: GameRoom ──(local, no network)── host player
             │
         PeerHost (WebRTC, PeerJS)
             │
   Friend tabs: ClientSession over PeerTransport (same code as socket.io path)
```

- **Transport abstraction:** `ClientSession` and the server wrapper talk to a small `Transport` interface (`send`, `on`, `close`); implementations: socket.io (phase 1) and PeerJS data channel (new).
- **Host flow:** Create game → choose mode/map → get an invite link `…/?host=<peerId>` with a copy button → game starts immediately with bots; friends replace bots as they join.
- **Join flow:** open the link (or paste the code) → customization → join.
- **Host plays locally** through the room directly (no prediction needed, zero latency).
- **Host leaves:** clients see "Host left the game" and return to the menu.
- **Room size:** max 6 humans (host upload: 30 snapshots/s × players).
- **Background tab:** per **P2**.
- **Connectivity:** per **P1**.
- Remove the unused `network.ts` (its packet types don't match the phase-1 protocol).

## Testing

- Unit: effect events emitted at the right places; hunger round lifecycle (winner → restart → zone reset); transport adapter contract.
- Integration: two `ClientSession`s over an in-memory transport against a `GameRoom` (fast, no network); existing socket.io e2e stays.
- Manual: host + friend on two machines in different networks (home Wi-Fi + phone hotspot).

## Implementation order

1. Effects (smallest, improves every online mode)
2. Hunger Games online (server + shared round logic)
3. Browser hosting (largest; reuses 1 and 2)

## Decisions needed

**E1 — How effects reach clients**
- (a) Simulation sends effect events with coordinates. *(recommended)* Exact, same look online/offline; touches the code that spawns effects.
- (b) Clients guess effects from snapshot changes (health dropped → blood; projectile vanished → spark). No protocol change; misses things and can't tell causes apart.

**H1 — Joining a Hunger Games round already in progress**
- (a) Spectate until the next round. *(recommended)* Fair; joiner can bet while waiting.
- (b) Spawn alive immediately. Simple; unfair late entry, can break "last one standing".
- (c) Can't join mid-round; wait in a lobby screen. Clean; worst experience for short sessions.

**P1 — Connecting browsers (signaling and NAT traversal)**
- (a) PeerJS free public broker, no TURN relay. *(recommended to start)* Zero setup and cost; roughly 1 in 10 home networks (strict NAT, some mobile carriers) can't connect directly.
- (b) PeerJS broker + a TURN relay service (e.g. Metered/Twilio free tier). Works almost everywhere; needs an account and an API key, relayed traffic counts against a quota.
- (c) Our own signaling on the Node server. Full control; needs a server running, which defeats "no server".

**P2 — Host switches to another tab**
- (a) Run the room in a Web Worker. *(recommended)* Keeps simulating at full rate in the background; more work (state crosses a thread boundary).
- (b) Run on the main thread and warn "keep this tab open". Simple; the game freezes for everyone when the host alt-tabs (browsers throttle background tabs to ~1 tick/s).
