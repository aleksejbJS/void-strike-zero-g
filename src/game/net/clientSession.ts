// Client side of an online match: connection, input upload, snapshot merge,
// local prediction (spec D1-b) and interpolation of everyone else.

import { Entity, GameState, Vector2 } from '../../types';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { GameEvent } from '../systems/events';
import { FIXED_STEP_MS } from '../systems/fixedStep';
import { readControls, updateAim, updateGrapple, applyPlayerMovement } from '../systems/playerControl';
import { moveProjectile } from '../systems/physics';
import { followCamera, pickCameraTarget } from '../systems/camera';
import { jetpackTrail, projectileTrail } from '../systems/effects';
import { updateParticles, updateFloatingTexts, updateDecals, updateRagdolls } from '../systems/particles';
import { MSG, JoinRequest, JoinAccepted, JoinRejected, Snapshot } from './protocol';
import { LocalPrediction } from './prediction';
import { SnapshotBuffer, interpolateRemotePlayers } from './interpolation';
import { SessionSocket } from './sessionSocket';

export interface SessionCallbacks {
    onJoined: (info: JoinAccepted) => void;
    onRejected: (reason: JoinRejected['reason']) => void;
    onConnectionError: (message: string) => void;
    /** Connection lost after joining (server stopped, host left) */
    onDisconnected: () => void;
    /** Gameplay events from the server (kill feed, sounds) */
    onEvents: (events: GameEvent[]) => void;
}

export interface TickControls {
    keys: Record<string, boolean>;
    aim: Vector2; // world coordinates
    mousePressed: boolean;
    hookPressed: boolean;
}

// Fields the client owns for its own player between snapshots (predicted locally)
const PREDICTED_FIELDS = ['pos', 'vel', 'isGrounded', 'isCrouching', 'height', 'grapple', 'jetpackFuel', 'aim'] as const;

// Timestamps at or above this mean "never" (e.g. no respawn in Hunger Games)
const NEVER = Number.MAX_SAFE_INTEGER / 2;

/**
 * Server timestamps → this machine's clock (machines' clocks differ), so countdowns
 * for respawn, zone shrink, round restart and Infiltration show the right time.
 */
export const toLocalClock = (snap: Snapshot, offset: number) => {
    const shift = (t: number | undefined) => (t === undefined || t >= NEVER || t <= 0 ? t : t + offset);
    snap.hungerRoundEndsAt = shift(snap.hungerRoundEndsAt);
    snap.hungerRoundStartedAt = shift(snap.hungerRoundStartedAt);
    snap.matchStartedAt = shift(snap.matchStartedAt);
    snap.matchEndsAt = shift(snap.matchEndsAt);
    snap.infiltrationEndTime = shift(snap.infiltrationEndTime);
    snap.lastHTFScore = shift(snap.lastHTFScore);
    if (snap.hungerZone) {
        snap.hungerZone.nextShrinkAt = shift(snap.hungerZone.nextShrinkAt);
        snap.hungerZone.lastShrink = shift(snap.hungerZone.lastShrink);
    }
    for (const p of snap.players) p.respawnTimer = shift(p.respawnTimer) ?? 0;
};

export class ClientSession {
    localId: string | null = null;
    private readonly prediction = new LocalPrediction();
    private readonly buffer = new SnapshotBuffer();
    private latest: Snapshot | null = null;
    private sequence = 0;
    private weaponIndex: number | undefined;

    /** `socket`: socket.io to a Node server, a WebRTC peer, or the browser host's local link. */
    constructor(private readonly socket: SessionSocket, join: JoinRequest, private readonly physics: MatterPhysicsEngine, callbacks: SessionCallbacks) {
        this.socket.on('connect', () => this.socket.emit(MSG.JOIN, join));
        this.socket.on('disconnect', () => { if (this.localId) callbacks.onDisconnected(); });
        this.socket.on('connect_error', (err: Error) => callbacks.onConnectionError(err.message));
        this.socket.on(MSG.JOIN_REJECTED, (data: JoinRejected) => callbacks.onRejected(data.reason));
        this.socket.on(MSG.JOINED, (info: JoinAccepted) => {
            this.localId = info.id;
            this.receive(info.snapshot);
            callbacks.onJoined(info);
        });
        this.socket.on(MSG.SNAPSHOT, (snap: Snapshot) => this.receive(snap));
        this.socket.on(MSG.EVENTS, (events: GameEvent[]) => callbacks.onEvents(events));
    }

    /** Use the server's map: rebuild local collision world with platforms + our own body only. */
    setupWorld(state: GameState, info: JoinAccepted) {
        state.platforms = info.platforms;
        this.applySnapshot(state, info.snapshot);
        this.physics.clear();
        state.platforms.forEach(p => this.physics.addPlatform(p));
        const local = this.local(state);
        if (local) this.physics.addPlayer(local);
    }

    selectWeapon(index: number) {
        this.weaponIndex = index;
    }

    /** One fixed simulation tick. */
    tick(state: GameState, controls: TickControls, now: number) {
        if (!this.localId) return;

        this.sequence++;
        this.socket.emit(MSG.INPUT, {
            keys: controls.keys, mouse: controls.aim, mousePressed: controls.mousePressed,
            hookPressed: controls.hookPressed, sequence: this.sequence, timestamp: now, weaponIndex: this.weaponIndex,
        });

        if (this.latest) {
            this.applySnapshot(state, this.latest);
            this.latest = null;
        }

        const local = this.local(state);
        if (local && !local.dead) this.predict(state, local, controls);

        interpolateRemotePlayers(state.players, this.buffer, this.localId, now);
        for (const p of state.players) {
            if (p.id !== this.localId && p.jetpackOn && !p.dead) jetpackTrail(state, p);
        }
        for (const proj of state.projectiles) {
            moveProjectile(proj);
            projectileTrail(state, proj);
        }
        updateParticles(state);
        updateFloatingTexts(state);
        updateDecals(state, Date.now());
        updateRagdolls(state);
        followCamera(state, pickCameraTarget(state, this.localId));
    }

    dispose() {
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    private receive(snapshot: Snapshot) {
        this.buffer.push(snapshot, performance.now());
        this.latest = snapshot;
    }

    private local(state: GameState): Entity | undefined {
        return state.players.find(p => p.id === this.localId);
    }

    private predict(state: GameState, local: Entity, controls: TickControls) {
        if (!this.physics.bodies.has(local.id)) this.physics.addPlayer(local);

        // Same order as the server tick: step, read back, apply input, push
        this.physics.step(FIXED_STEP_MS);
        this.physics.syncGameState({ players: [local], platforms: state.platforms });
        const c = readControls(local, controls.keys);
        local.isCrouching = c.wantsDown;
        updateAim(local, controls.aim);
        updateGrapple(state, local, controls.hookPressed, controls.aim);
        applyPlayerMovement(state, local, c, state);
        this.prediction.applyCorrection(local);
        this.physics.syncFromGameState({ players: [local] });
        this.prediction.record(this.sequence, local.pos);
    }

    private applySnapshot(state: GameState, snap: Snapshot) {
        toLocalClock(snap, Date.now() - snap.serverTime);
        const { serverTime: _serverTime, players, ...shared } = snap;
        Object.assign(state, shared);

        const previous = new Map(state.players.map(p => [p.id, p]));
        state.players = players.map(server => {
            const mine = previous.get(server.id);
            if (server.id !== this.localId || !mine) return server;

            // Dead, or just respawned: the server decides where we are
            if (server.dead || mine.dead) {
                this.prediction.snapTo(server, mine);
                return server;
            }

            this.prediction.reconcile(server, mine);
            const merged: Entity = { ...server };
            for (const field of PREDICTED_FIELDS) (merged as any)[field] = (mine as any)[field];
            // Keep our weapon choice; the server catches up within one round trip
            const chosen = this.weaponIndex !== undefined ? merged.inventory[this.weaponIndex] : undefined;
            if (chosen) merged.weapon = chosen;
            return merged;
        });

        // Only platforms and our own player have bodies on the client
        const platformIds = new Set(state.platforms.map(p => p.id));
        for (const id of [...this.physics.bodies.keys()]) {
            if (id !== this.localId && !platformIds.has(id)) this.physics.removeBody(id);
        }
    }
}
