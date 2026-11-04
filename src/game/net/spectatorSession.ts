// Client side of watching a match: connects, asks to watch, then only draws what the host
// sends. No input, no prediction, no Matter engine: nobody on this screen owns a fighter.
// Everything stays inside this session's own GameState (several tiles can be open at once),
// so effects never go through the global `gameEvents` bus.

import { Entity, GameState } from '../../types';
import { GameEvent } from '../systems/events';
import { applyEffectEvent, jetpackTrail, projectileTrail } from '../systems/effects';
import { followCamera } from '../systems/camera';
import { updateParticles, updateFloatingTexts, updateDecals } from '../systems/particles';
import { updateCorpses } from '../systems/ragdoll/corpses';
import { MSG, JoinRejected, Snapshot, WatchAccepted } from './protocol';
import { toLocalClock } from './clock';
import { applyCoverStatus, knownCover } from '../cover/coverNet';
import type { Cover } from '../cover/coverTypes';
import { SnapshotBuffer, interpolateRemotePlayers } from './interpolation';
import { ProjectileCatchUp } from './projectileCatchUp';
import { SessionSocket } from './sessionSocket';
import { sanitizeBuild } from '../build/sanitizeBuild';
import { presetBuild } from '../build/buildPresets';

export interface SpectatorCallbacks {
    onWatching: (info: WatchAccepted) => void;
    onRejected: (reason: JoinRejected['reason']) => void;
    /** The link is gone (it closed, with or without an answer, or never came up); fires at most once, and not after a rejection. */
    onEnded: (why: 'disconnected' | 'connection_error') => void;
    /** The caller decides whether this tile is audible. */
    onSound: (e: GameEvent) => void;
    /** A snapshot arrived (the first one comes with WATCHING); it reaches `state` on the next tick. */
    onSnapshot?: (snapshot: Snapshot) => void;
}

// Matches no fighter id, so interpolation moves every player
const NO_LOCAL_ID = '';
// Effects wait here for the next tick; a tile that stops ticking (hidden tab) must not grow forever
const MAX_QUEUED_EFFECTS = 300;

const scoreLeader = (players: readonly Entity[]): Entity | undefined =>
    players.reduce<Entity | undefined>((best, p) => (!best || p.score > best.score ? p : best), undefined);

export class SpectatorSession {
    /** Player the camera follows; null = whoever leads on score (also the fallback if that player is gone). */
    followId: string | null = null;
    private readonly buffer = new SnapshotBuffer();
    private readonly projectiles = new ProjectileCatchUp();
    private watching = false;
    private rejected = false;
    private ended = false;
    private platforms: GameState['platforms'] | null = null; // from the host, not yet in a state
    private cover: Cover[] | null = null; // likewise
    private latest: Snapshot | null = null;
    private effects: GameEvent[] = [];

    constructor(private readonly socket: SessionSocket, private readonly callbacks: SpectatorCallbacks) {
        this.socket.on('connect', () => this.socket.emit(MSG.WATCH, {}));
        // onEnded fires at most once; a rejection already told the caller why the link closes
        const end = (why: 'disconnected' | 'connection_error') => {
            if (this.ended) return;
            this.ended = true;
            callbacks.onEnded(why);
        };
        this.socket.on('disconnect', () => { if (!this.rejected) end('disconnected'); });
        this.socket.on('connect_error', () => end('connection_error'));
        this.socket.on(MSG.JOIN_REJECTED, (data: JoinRejected) => {
            this.rejected = true;
            callbacks.onRejected(data.reason);
        });
        this.socket.on(MSG.WATCHING, (info: WatchAccepted) => {
            this.watching = true;
            this.platforms = info.platforms;
            this.cover = knownCover(info.cover);
            this.receive(info.snapshot);
            callbacks.onWatching(info);
        });
        this.socket.on(MSG.SNAPSHOT, (snap: Snapshot) => this.receive(snap));
        this.socket.on(MSG.EVENTS, (events: GameEvent[]) => {
            for (const e of events) {
                if (e.type === 'SOUND') callbacks.onSound(e);
                else if (e.type !== 'KILL' && e.type !== 'FLAG') this.queueEffect(e); // tiles show no kill feed or banners
            }
        });
    }

    /** One display tick. `now` is `performance.now()`, the clock snapshots are stamped with on arrival. */
    tick(state: GameState, now: number) {
        if (!this.watching) return;

        if (this.platforms) {
            state.platforms = this.platforms;
            this.platforms = null;
        }
        if (this.cover) {
            state.cover = this.cover;
            this.cover = null;
        }
        if (this.latest) {
            this.applySnapshot(state, this.latest);
            this.latest = null;
        }
        for (const e of this.effects.splice(0)) applyEffectEvent(state, e);

        interpolateRemotePlayers(state.players, this.buffer, NO_LOCAL_ID, now);
        for (const p of state.players) {
            if (p.jetpackOn && !p.dead) jetpackTrail(state, p);
        }
        this.projectiles.advance(state.projectiles, state.players); // after interpolation: guns are where they're drawn
        for (const proj of state.projectiles) projectileTrail(state, proj);
        updateParticles(state);
        updateFloatingTexts(state);
        updateDecals(state, Date.now());
        updateCorpses(state);
        followCamera(state, this.cameraTarget(state));
    }

    dispose() {
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    private receive(snapshot: Snapshot) {
        this.buffer.push(snapshot, performance.now());
        this.latest = snapshot;
        this.callbacks.onSnapshot?.(snapshot);
    }

    private queueEffect(e: GameEvent) {
        if (this.effects.length >= MAX_QUEUED_EFFECTS) this.effects.shift();
        this.effects.push(e);
    }

    private cameraTarget(state: GameState): Entity | undefined {
        const chosen = this.followId === null ? undefined : state.players.find(p => p.id === this.followId);
        return chosen ?? scoreLeader(state.players);
    }

    private applySnapshot(state: GameState, snap: Snapshot) {
        toLocalClock(snap, Date.now() - snap.serverTime);
        const { serverTime: _serverTime, players, coverStatus, ...shared } = snap;
        Object.assign(state, shared);
        applyCoverStatus(state.cover ?? [], coverStatus);
        // A newer host may send parts this version does not know: drawing one would throw
        for (const p of players) if (p.build) p.build = sanitizeBuild(p.build, presetBuild(p.skinId));
        state.players = players;
    }
}
