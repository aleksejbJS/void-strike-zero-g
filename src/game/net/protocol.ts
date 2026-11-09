// Wire protocol shared by the authoritative room (Node server or, later, a browser host)
// and game clients. Message payloads only — no transport code here.

import { GameState, GameMode, MapId } from '../../types';
import { GameEvent } from '../systems/events';
import type { FighterBuild } from '../build/buildParts';
import type { Cover, CoverStatus } from '../cover/coverTypes';
import { coverStatusOf } from '../cover/coverNet';

export const SNAPSHOT_RATE = 30; // snapshots per second sent to clients
export const MAX_NAME_LENGTH = 16;
/** Watch-only connections allowed per room (they never take a player slot). */
export const SPECTATOR_CAP = 6;

// Socket message names
export const MSG = {
    JOIN: 'join',
    JOINED: 'joined',
    JOIN_REJECTED: 'joinRejected',
    WATCH: 'watch',
    WATCHING: 'watching',
    INPUT: 'input',
    SNAPSHOT: 'snapshot',
    EVENTS: 'events',
} as const;

export interface JoinRequest {
    name: string;
    color: string;
    headColor: string;
    torsoColor: string;
    armColor: string;
    legColor: string;
    jetpackColor: string;
    skinId: string;
    build: FighterBuild;
}

// Gameplay-relevant state only. Particles, decals, floating texts and ragdolls are
// cosmetic: clients create them locally from events instead of receiving them.
// Platforms never change during a match: they are sent once in JoinAccepted.
// Cover too (layout in JoinAccepted); snapshots carry only its changing part, `coverStatus`.
export type Snapshot = Pick<GameState,
    'mode' | 'currentMap' | 'scores' | 'players' | 'projectiles' | 'pickups'
    | 'beams' | 'smokes' | 'hungerZone' | 'hungerWinnerId' | 'hungerRoundEndsAt' | 'hungerRoundStartedAt' | 'hungerEndReason' | 'gunGameWinnerId'
    | 'matchStartedAt' | 'matchEndsAt' | 'matchWinner' | 'matchEndReason' | 'lastHTFScore' | 'infiltrationEndTime'
    | 'playerStats' | 'statsSession'
> & { serverTime: number; coverStatus?: CoverStatus[] };

export interface JoinAccepted {
    id: string;
    mode: GameMode;
    map: MapId;
    platforms: GameState['platforms'];
    /** Cover layout (absent from a host that has none: the client then plays without). */
    cover?: Cover[];
    snapshot: Snapshot;
}

/** What a spectator gets for WATCH: the world, but no entity id. */
export interface WatchAccepted {
    mode: GameMode;
    map: MapId;
    platforms: GameState['platforms'];
    cover?: Cover[];
    snapshot: Snapshot;
}

export interface JoinRejected {
    reason: 'invalid' | 'full' | 'already_joined' | 'spectators_full';
}

export type EventBatch = GameEvent[];

export const buildSnapshot = (state: GameState, now: number): Snapshot => ({
    mode: state.mode,
    currentMap: state.currentMap,
    scores: state.scores,
    players: state.players,
    projectiles: state.projectiles,
    pickups: state.pickups,
    beams: state.beams,
    smokes: state.smokes,
    hungerZone: state.hungerZone,
    hungerWinnerId: state.hungerWinnerId,
    hungerRoundEndsAt: state.hungerRoundEndsAt,
    hungerRoundStartedAt: state.hungerRoundStartedAt,
    hungerEndReason: state.hungerEndReason,
    matchStartedAt: state.matchStartedAt,
    matchEndsAt: state.matchEndsAt,
    matchWinner: state.matchWinner,
    matchEndReason: state.matchEndReason,
    gunGameWinnerId: state.gunGameWinnerId,
    lastHTFScore: state.lastHTFScore,
    infiltrationEndTime: state.infiltrationEndTime,
    playerStats: state.playerStats,
    statsSession: state.statsSession,
    serverTime: now,
    coverStatus: coverStatusOf(state.cover ?? []),
});
