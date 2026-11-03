// Wire protocol shared by the authoritative room (Node server or, later, a browser host)
// and game clients. Message payloads only — no transport code here.

import { GameState, GameMode, MapId } from '../../types';
import { GameEvent } from '../systems/events';
import type { FighterBuild } from '../build/buildParts';

export const SNAPSHOT_RATE = 30; // snapshots per second sent to clients
export const MAX_NAME_LENGTH = 16;

// Socket message names
export const MSG = {
    JOIN: 'join',
    JOINED: 'joined',
    JOIN_REJECTED: 'joinRejected',
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
export type Snapshot = Pick<GameState,
    'mode' | 'currentMap' | 'scores' | 'players' | 'projectiles' | 'pickups'
    | 'beams' | 'smokes' | 'hungerZone' | 'hungerWinnerId' | 'hungerRoundEndsAt' | 'hungerRoundStartedAt' | 'hungerEndReason' | 'gunGameWinnerId'
    | 'matchStartedAt' | 'matchEndsAt' | 'matchWinner' | 'matchEndReason' | 'lastHTFScore' | 'infiltrationEndTime'
> & { serverTime: number };

export interface JoinAccepted {
    id: string;
    mode: GameMode;
    map: MapId;
    platforms: GameState['platforms'];
    snapshot: Snapshot;
}

export interface JoinRejected {
    reason: 'invalid' | 'full' | 'already_joined';
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
    serverTime: now,
});
